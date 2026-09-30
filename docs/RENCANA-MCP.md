# RENCANA — MCP (M11)

> **Status:** 🟡 dirancang — keputusan terkunci 2026-09-30
> **Milestone:** M11 · **Dependensi:** M10 · **Rujukan:** `DESAIN-PER-LAPISAN-MATHBANK.md` (L1, L9)

## 1. Latar

MCP (*Model Context Protocol*) adalah "wajah" untuk peran **`agent`** (L1): agen AI
*on-demand* (mis. Claude Desktop, Cursor, klien MCP lain) yang ingin membaca &
menulis ke MathBank lewat protokol standar — bukan lewat HTTP ad-hoc.

Analogi (L1): `agent` = **barista** (1 permintaan → 1 hasil), beda dari `machine`
= **pabrik** (pipeline ingest massal).

## 2. Keputusan (terkunci 2026-09-30)

| # | Keputusan | Alasan |
|---|-----------|--------|
| **D1** | Expose **Stdio + Streamable HTTP** sekaligus (satu `server.ts`, dua transport) | Maksimum kompatibilitas: stdio untuk klien desktop lokal; HTTP untuk agen remote |
| **D2** | Pakai **SDK resmi** `@modelcontextprotocol/sdk` **1.29.x** (spec `2025-11-25`) | Jangan tulis JSON-RPC sendiri → ikut spec, hindari drift. zod 4 sudah ada (peer dep terpenuhi) |
| **D3** | Izin `agent` **ikut L1 apa adanya** | `question:create` + `question:view` (cari) + **enrichment**; `question:edit` = **`own`**; **TIDAK** bundle/hapus/status/taksonomi |

> **Aturan mutlak:** agen **tidak pernah** melihat `answer_key` (L1). Tool yang
> mengembalikan soal memakai proyeksi aman (tanpa `answer_key`).

## 3. Arsitektur

```
src/lib/mcp/
  server.ts     — buat McpServer + daftarkan tool (dipakai kedua transport)
  policy.ts     — kebijakan tulis SATU tempat (peran × aksi × kepemilikan)
  tools.ts      — definisi tool (nama, schema zod, handler → service)
  actor.ts      — bangun Actor `agent` dari konteks MCP (API key)
  stdio.ts      — entry StdioServerTransport (dijalankan: node/tsx)
  http.ts       — StreamableHTTPServerTransport (di-mount route Next.js)
```

- **Satu sumber kebijakan** (`policy.ts`): semua tool membaca izin dari sini,
  **bukan** menaruh cek izin sendiri-sendiri (hindari drift).
- Tool **tipis**: hanya memvalidasi input (zod) → panggil **service** yang sudah
  ada (`question-service`, `taxonomy-service`, `enrichment-service`). Tidak ada
  query DB langsung di tool.
- Transport **stdio** & **HTTP** berbagi `server.ts` yang sama.

## 4. Tool (permukaan M11)

| Tool | Aksi | Izin (L1) | Service |
|------|------|-----------|---------|
| `search_questions` | Cari soal (teks/semantik) | `question:view` | `listQuestions` |
| `get_question` | Ambil 1 soal (proyeksi aman) | `question:view` | `getQuestion` |
| `create_question` | Buat 1 soal (draft) | `question:create` | `createQuestion` |
| `create_questions_bulk` | Buat banyak (draft) | `question:create` | `createQuestion` × N |
| `list_topics` | Daftar topik | `question:view` | `listTopics` |
| `create_topic` | Buat topik | `taxonomy:manage`* | `createTopic` |
| `list_sources` | Daftar sumber | `question:view` | `listSources` |
| `enrich_question` | Usul metadata via AI | `question:edit` (own) | `enrichQuestion` |
| `embed_questions` | Hitung embedding | `question:edit` (own) | `embedQuestions` |
| `search_assets` / `create_asset` | Aset (gambar) | `asset:view`/`create` | (M9 media / Galeri Aset) |

> \* `taxonomy:manage` untuk `agent` **hanya bila L1 mengizinkan** — diverifikasi
> ulang terhadap `permissions.ts` saat implementasi; bila ragu → **jangan buka**.

**Tool TIDAK dibuka (di luar L1):** ubah status, hapus, permanen, bundle
(create/edit), apa pun yang menyentuh `answer_key`.

## 5. Autentikasi & Aktor

- **HTTP transport**: header `x-api-key` (atau `Authorization: Bearer`) → verifikasi
  API key (sudah ada di `resolve.ts`) → Actor `agent`.
- **Stdio transport**: API key dari ENV (`MCP_API_KEY`) saat proses dijalankan
  lokal; bila kosong → mode dev terbatas (hanya baca, TIDAK menulis).
- Actor yang dibangun **selalu** lewat `resolveActor`/jalur yang sama → matriks izin
  L1 tetap **satu sumber kebenaran**.

## 6. Keamanan

- **Tak pernah** `answer_key` di keluaran tool (proyeksi aman + tes yang membuktikan).
- Rate limit per API key (sudah aktif di plugin Better Auth: 120 req/menit).
- Tulis (create/enrich) selalu lewat `policy.ts` → cek izin + kepemilikan (`own`).
- Audit: setiap tulis lewat service yang sudah mencatat `audit_logs`.
- **DNS-rebinding protection** aktifkan di HTTP transport (spec 2025-11-25).
- Stdio: tidak ada jaringan → permukaan lebih kecil; tetap hormati izin.

## 7. Langkah (M11-a … M11-e)

| Tahap | Isi | Gate |
|-------|-----|------|
| **M11-a** | `policy.ts` + `actor.ts` (izin L1 dalam satu tempat) | tsc 0, tes unit |
| **M11-b** | `tools.ts` (schema zod + handler → service) | tes unit per tool |
| **M11-c** | `server.ts` + `stdio.ts` + `http.ts` | tsc 0, tes unit transport (mock) |
| **M11-d** | Route Next.js `/api/mcp` (Streamable HTTP) | tes alur API (DB) |
| **M11-e** | Manajemen API key agen (buat/cabut) + dokumen | tes DB + `pnpm check` |

## 8. Yang MENYUSUL (di luar M11)

- UI MCP (halaman pengaturan API key agen + contoh konfigurasi klien).
- OAuth 2.1 (spec 2025-11-25) — bila agen remote butuh otorisasi pengguna; M11
  pakai API key dulu (sederhana & sudah ada).
- Resource/prompt MCP (M11 hanya **tool**).

## 9. Catatan Verifikasi

*(Diisi saat implementasi — bukti nyata tiap langkah: perintah, keluaran, tes.)*
