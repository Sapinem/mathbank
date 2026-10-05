# AUDIT MILESTONE 11 — MODEL CONTEXT PROTOCOL / MCP (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & PASSED (100% Selesai)**  
**Target:** Integrasi Otomasi Agen AI — Server MCP (`mcp/server.ts`), Transport Stdio (`src/mcp-stdio.ts`), Transport HTTP (`/api/mcp`), Kebijakan Keamanan Agen (`mcp/policy.ts`), Registrasi 7 Tools MCP, & Proteksi Hak Akses Kunci Jawaban (`answerKey` Restriction).

---

## 1. Ringkasan & Ruang Lingkup Milestone 11

Milestone 11 adalah antarmuka otomatisasi agen AI (*Model Context Protocol / MCP*) yang memungkinkan agen eksternal (seperti Claude Desktop, Hermes Agent, Antigravity, atau runner otonom) berinteraksi secara aman dengan basis data MathBank:

1. **Dual Transport Architecture (`src/lib/mcp/server.ts`):**
   * **Stdio Transport (`src/mcp-stdio.ts`):** Untuk integrasi lokal agen CLI.
   * **Streamable HTTP Transport (`/api/mcp`):** Untuk panggilan remote agen via API (respons **JSON**, `enableJsonResponse: true`; **bukan** SSE).
2. **Katalog 7 Tools MCP Terdaftar (`mcp/tools.ts`):**
   1. `search_questions` — Pencarian hybrid & penyaringan butir soal.
   2. `get_question` — Mengambil rincian naskah soal.
   3. `create_question` — Membuat draf soal baru (status `draft`).
   4. `list_topics` — Mengambil pohon hierarki taksonomi 3-level.
   5. `list_sources` — Mengambil daftar referensi sumber/asal.
   6. `enrich_question` — Menjalankan pengayaan pedagogis AI.
   7. `embed_questions` — Menghitung vektor embedding BGE-M3 (1024-dim).
3. **Kebijakan Keamanan Agen Terpusat (`src/lib/mcp/policy.ts`):**
   * **L1 Actor Isolation:** Agen berjalan di bawah identitas khusus (`role: 'agent'` atau `role: 'machine'`).
   * **Proyeksi Rahasia S3 (Strict No-AnswerKey Policy):** Peran agen **DILARANG KERAS** membaca `answerKey` dalam kondisi apa pun. `answerKey` secara otomatis difilter dari seluruh output Tool MCP.
   * **Restriksi Mutasi L1:** Agen hanya diizinkan membuat soal status `draft` atau mendaftarkan aset TikZ; **agen dilarang menghapus soal, mempromosikan status menjadi `ready`, atau mengubah paket soal secara sepihak**.

---

## 2. Matriks Target vs Realisasi M11

| Fitur / Komponen | Target Spesifikasi (M11) | Realisasi Kode (`src/`) | Verdict |
| :--- | :--- | :--- | :---: |
| **MCP Server Core** | `mcp/server.ts` (Standard MCP Protocol v1) | `src/lib/mcp/server.ts` | ✅ Lulus |
| **Dual Transport** | Stdio CLI & Streamable HTTP `/api/mcp` | `src/mcp-stdio.ts` & `/api/mcp` | ✅ Lulus |
| **Pendaftaran 7 Tools** | Search, Get, Create, Topics, Sources, Enrich, Embed | `src/lib/mcp/tools.ts` | ✅ Lulus |
| **Proteksi Kunci (S3)** | Payload `answerKey` 100% tersembunyi dari agen | `mcp/policy.ts` & `actor.ts` | ✅ Lulus |
| **Aturan Mutasi Terbatas** | Agen hanya bisa buat draf (`draft`), dilarang hapus/ready | `MCP_CAPABILITIES` + `assertMcp()` + `MCP_FORBIDDEN` (`mcp/policy.ts`) | ✅ Lulus |
| **Manajemen Kredensial** | UI & API Akses Agen (`agent_keys`) | `/api/system/agent-keys` | ✅ Lulus |
| **Integritas Uji Logic** | 10 Test Suite Unit & Integration MCP Passed | `policy.test.ts` & `mcp.db.test.ts` | ✅ Lulus |

---

## 3. Hasil Pengujian Otomatis M11

Seluruh pengujian unit & integrasi MCP dieksekusi secara otomatis dan **100% Lulus**:
* `policy.test.ts` ➔ **10 Tests Passed** (`npx vitest run src/lib/mcp/`).
* `mcp.db.test.ts` ➔ **6 DB Tests Passed**; `agent-key.db.test.ts` ➔ **5 DB Tests Passed** (`pnpm test:db`).
* **Total:** **21 tes MCP terkait** (10 unit + 11 DB), semuanya lulus.

---

## 4. Review Komparasi vs QBank (M11 MCP Engine)

| Dimensi | QBank (Sistem Lama) | MathBank (Sistem Baru) | Keunggulan MathBank |
| :--- | :--- | :--- | :--- |
| **Integrasi Agen** | Script custom terpisah tanpa standar protokol. | **Standard Model Context Protocol (MCP)**. | **MathBank Kompatibel dengan Seluruh Agen AI Modern.** |
| **Keamanan Kunci** | Agen bisa membaca kunci jawaban secara polos. | **Strict No-AnswerKey Policy (S3 Guard)**. | **MathBank Mencegah Kebocoran Kunci ke Agen.** |
| **Transport Protocol** | Hanya HTTP REST biasa. | **Dual Transport (Stdio CLI + Streamable HTTP)**. | **MathBank Lebih Fleksibel untuk CLI & Remote.** |

---

## 📄 KESIMPULAN MILESTONE 11

**MILESTONE 11 (MODEL CONTEXT PROTOCOL / MCP) TELAH VERIFIED LULUS 100%. ANTARMUKA AGEN MATHBANK AMAN TERISOLASI, 100% TERBEBAS DARI KEBOCORAN KUNCI JAWABAN, DAN SIAP DIHUBUNGKAN DENGAN SELEKSI AGEN AI KELAS ENTERPRISE.**

---

## § Catatan Verifikasi

> Wajib menurut `CONSTRAINTS.md` #44 untuk setiap dokumen di `docs/audit/`.

**Diverifikasi ulang: 2026-09-30** terhadap kode & tes nyata:

| Klaim | Hasil verifikasi |
|---|---|
| `mcp/{server,tools,policy,actor}.ts`, `src/mcp-stdio.ts`, `/api/mcp` | ✅ **Ada** |
| 7 tool MCP | ✅ Sesuai (`search_questions`, `get_question`, `create_question`, `list_topics`, `list_sources`, `enrich_question`, `embed_questions`) |
| `policy.test.ts` 10 unit | ✅ **10 Lulus** |
| "10 Test Suite" (total) | ⚠️ **Koreksi → 21** (10 unit + `mcp.db.test.ts` 6 + `agent-key.db.test.ts` 5) |
| **HTTP "SSE" Transport** | ❌ **Keliru** → **Streamable HTTP** dengan `enableJsonResponse: true` (respons JSON) |
| `assertAgentCanMutate()` | ❌ **TIDAK ADA** → gerbang nyata: `canMcp`/`assertMcp` + `MCP_CAPABILITIES`/`MCP_FORBIDDEN` |
| Agen tak pernah lihat `answerKey` | ✅ Terverifikasi (uji in-memory + HTTP live) |

**Sumber bukti:** `npx vitest run src/lib/mcp/` (10 lulus), `pnpm test:db` (6+5), pembacaan
`src/app/api/mcp/route.ts` (`enableJsonResponse`) & `src/lib/mcp/policy.ts`.

> **Catatan:** dokumen ini dibuat setelah M11 tuntas; dua koreksi (nama "SSE" dan fungsi
> `assertAgentCanMutate`) sudah dibetulkan agar tidak menyesatkan.
