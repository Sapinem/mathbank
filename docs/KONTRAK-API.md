# KONTRAK-API.md — Kontrak HTTP API MathBank

> **Status:** ✅ berlaku — mencerminkan **48 route handler** (71 method) di `src/app/api` per 2026-10-26.
> **Sumber kebenaran:** `src/lib/api/route-wrapper.ts` (envelope), `src/lib/contracts/*` (skema Zod).
> **Sifat:** dokumen hidup — perbarui saat endpoint ditambah/diubah.

---

## 1. Prinsip

1. **Envelope tunggal** — semua respons berbentuk konsisten (lihat §3). Tak ada bentuk ad-hoc.
2. **Satu tempat validasi** — skema Zod di `src/lib/contracts/`; dipakai service, API, dan (nanti) MCP.
3. **Guard terpusat** — `wrapRoute` menangani: resolve aktor → 401 → ganti-password → izin → parse → try/catch → format.
4. **Izin dari matriks L1** — setiap route menyebut `permission` (lihat `KEAMANAN.md` §RBAC).

---

## 2. Konvensi

| Aspek | Aturan |
|-------|-------|
| Base URL | `/api` |
| Format | JSON (`application/json`) |
| Autentikasi | **Session cookie** (Better Auth) **atau** header `x-api-key` (agen/mesin) |
| Izin | Dicek via matriks peran×aksi (`permissions.ts`) |
| **Traceability** | Setiap respons menyertakan header `X-Request-ID` (diteruskan dari header masuk bila ada). Log error 500 memuat `rid=<id>`. |
| **Cache** | Semua respons lewat `wrapRoute` menyetel `Cache-Control: no-store` + `Vary: Cookie, Authorization`. Hanya `/img/*` yang publik dan boleh di-cache. |
| **Idempotensi** | Empat endpoint mutasi (`POST /api/questions`, `POST /api/bundles`, `POST /api/v1/ingest/upload`, `POST /api/v1/ingest/commit`) menerima `Idempotency-Key`. Key sama + **payload sama** (≤60 dtk) → replay (header `Idempotent-Replay: true`). Key sama + **payload beda** → **422 `IDEMPOTENCY_KEY_REUSED`**, bukan replay. Sidik jari = SHA-256(method + path + body mentah). |
| **Path aksi** | Operasi non-CRUD memakai sub-path kata kerja (`/duplicate`, `/validate`, `/merge`, `/clean-unused`, `/flag`, `/status`, `/permanent`, `/export/moodle`). Konsekuensi ADR-0022 (larangan Server Actions), **disengaja** — bukan kelalaian REST. |
| Ganti password | Bila `mustChangePassword`, semua endpoint diblokir **403 `PASSWORD_CHANGE_REQUIRED`** — **kecuali** `/api/auth/me` (agar UI bisa baca status) & endpoint auth Better Auth (ganti password). UI dialihkan ke `/change-password`. |
| Versi | Inti **v0** (tanpa prefix versi); hanya ingest memakai `/api/v1`. Penyatuan **belum diputuskan** — lihat §8 |

---

## 3. Envelope Respons

**Sukses:**
```json
{ "data": <hasil> }
```

**Error:**
```json
{ "error": { "code": "<KODE>", "message": "<pesan>" } }
```
Validasi menambah `details`:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Data tidak valid", "details": [ ... ] } }
```

### Peta status & kode error

| HTTP | `code` | Kapan |
|:----:|--------|-------|
| 400 | `VALIDATION_ERROR` | Body/query gagal Zod |
| 401 | `UNAUTHORIZED` | Tak ada session/API key valid |
| 403 | `FORBIDDEN` | Tak punya izin, atau wajib ganti password |
| 404 | `NOT_FOUND` | Sumber daya tak ada |
| 409 | `CONFLICT` | Konflik data / `INVALID_TRANSITION` (transisi FSM salah) |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | Key sama masih diproses (permintaan paralel) |
| 413 | `PAYLOAD_TOO_LARGE` | Body melebihi batas (unggah media) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Tipe berkas tak didukung (unggah media) |
| 422 | `NOT_READY` | `review→ready` tanpa `answer_key` (guard kesiapan) |
| 422 | `IDEMPOTENCY_KEY_REUSED` | Key sama dipakai untuk payload berbeda — **tidak** di-replay |
| 429 | `RATE_LIMITED` | Terlalu banyak permintaan (rate limit token bucket) — sertakan header `Retry-After` (detik) |
| 500 | `INTERNAL_ERROR` | Kesalahan tak terduga |

---

## 4. Katalog Endpoint

> Legenda izin: `question:view`, `question:create`, dst — lihat `permissions.ts`.

### 4.1 Autentikasi & observabilitas

| Method | Path | Izin | Keterangan |
|--------|------|:----:|------------|
| `*` | `/api/auth/[...all]` | — | Handler Better Auth (login, logout, session, API key) |
| `GET` | `/api/auth/me` | (login) | Identitas aktor aktif + peran |
| `GET` | `/api/health` | publik | 200/503 + invarian skema; `?probe=liveness` tanpa DB |
| `GET` | `/api/ready` | publik | Readiness (DB + invarian) |
| `GET` | `/api/metrics` | token | `METRICS_TOKEN` bila diset; non-produksi bila tidak |
| `POST` | `/api/mcp` | API key | Transport MCP Streamable HTTP (stateless). `GET`/`DELETE` → **405** |

### 4.2 Soal (questions)

| Method | Path | Izin | Keterangan |
|--------|------|:----:|------------|
| `GET` | `/api/questions` | `question:view` | Daftar + filter + paginasi |
| `POST` | `/api/questions` | `question:create` | Buat soal baru (201, `Idempotency-Key` didukung) |
| `GET` | `/api/questions/[id]` | `question:view` | Detail soal |
| `PATCH` | `/api/questions/[id]` | service | Perbarui soal (`own` — ditegakkan di service, CONSTRAINT #35) |
| `DELETE` | `/api/questions/[id]` | service | Soft-delete (`own` — di service) |
| `PATCH` | `/api/questions/[id]/status` | service | Transisi FSM; izin **beda per tujuan** (`setReady`/`archive`/`edit`+`own`) |
| `PATCH` | `/api/questions/[id]/flag` | service | Tandai/lepas "perlu perhatian" |
| `DELETE` | `/api/questions/[id]/permanent` | service | Hapus PERMANEN — hanya soal soft-deleted; RESTRICT paket; anak CASCADE |
| `POST` | `/api/questions/batch` | service | Aksi massal (maks 200 id); izin per-butir per aksi |

**Query `GET /api/questions`** (semua opsional):
`q`, `status`, `questionType`, `grade`, `difficulty` (1–5), `cognitiveLevel`, `topicId`, `tagId`, `sourceId`, `eventId`, `flagged`, `includeDeleted` (default `false`), `mode` (`text`|`semantic`), `limit` (1–100, default 20), `offset` (default 0).

Boolean hanya menerima `true|false|1|0`; nilai lain → **400**. (Jangan kirim `false` ke parser gaya `Boolean()` — `"false"` akan terbaca `true`; perilaku itu sudah ditutup.)

**Body `POST/PATCH`** (ringkas — lengkap di `contracts/question.ts`):
`questionType`, `difficulty`, `cognitiveLevel`, `grade`, `contentMarkdown`, `dataPayload`, `answerKey` (opsional; **wajib** untuk `ready`), `status` (default `draft`), `parentId`/`childOrder` (stimulus), `sourceId`/`eventId`/`eventYear`/…, `options[]`, `topicIds[]`, `tagIds[]`.

**Body `PATCH .../status`:** `{ "status": "<draft|review|ready|archived>" }`.

### 4.3 Paket (bundles)

| Method | Path | Izin | Keterangan |
|--------|------|:----:|------------|
| `GET` | `/api/bundles` | `question:view` | Daftar paket |
| `POST` | `/api/bundles` | `question:view` | Buat paket (`Idempotency-Key` didukung) |
| `GET` | `/api/bundles/[id]` | `question:view` | Detail paket |
| `PATCH` | `/api/bundles/[id]` | service | Ubah paket (`own`) |
| `DELETE` | `/api/bundles/[id]` | service | Hapus paket (`own`) |
| `GET` | `/api/bundles/[id]/items` | `question:view` | Item paket |
| `POST` | `/api/bundles/[id]/items` | `question:view` | Tambah item |
| `PUT` | `/api/bundles/[id]/items` | `question:view` | Susun ulang urutan item (atomik) |
| `DELETE` | `/api/bundles/[id]/items/[itemId]` | `question:view` | Lepas item |
| `POST` | `/api/bundles/[id]/duplicate` | `question:view` | Duplikasi paket |
| `GET` | `/api/bundles/[id]/validate` | `question:view` | Pratinjau kesiapan ekspor |
| `POST` | `/api/bundles/[id]/export/moodle` | service | Tulis folder GitSync + commit; 422 `EXPORT_BLOCKED` bila ada soal tanpa kunci |

### 4.4 Taksonomi & referensi

| Method | Path | Izin | Keterangan |
|--------|------|:----:|------------|
| `GET` | `/api/topics` | `question:view` | Daftar topik |
| `POST` | `/api/topics` | `taxonomy:manage` | Buat topik |
| `GET` | `/api/topics/[id]` | `question:view` | Detail topik |
| `PATCH` | `/api/topics/[id]` | `taxonomy:manage` | Ubah/pindah topik — re-parent **mempropagasi `level` ke seluruh subtree** (transaksi) |
| `DELETE` | `/api/topics/[id]` | `taxonomy:manage` | Hapus topik |
| `GET` | `/api/tags` | `question:view` | Daftar label |
| `POST` | `/api/tags` | `taxonomy:manage` | Buat label |
| `PATCH` | `/api/tags/[id]` | `taxonomy:manage` | Ubah label |
| `DELETE` | `/api/tags/[id]` | `taxonomy:manage` | Hapus label |
| `POST` | `/api/tags/merge` | `taxonomy:manage` | Gabung label |
| `POST` | `/api/tags/clean-unused` | `taxonomy:manage` | Hapus label `usage_count=0`; balikan `{ removed }` |
| `GET` | `/api/sources` | `question:view` | Daftar sumber |
| `POST` | `/api/sources` | `reference:manage` | Buat sumber |
| `PATCH` | `/api/sources/[id]` | `reference:manage` | Ubah sumber |
| `DELETE` | `/api/sources/[id]` | `reference:manage` | Hapus sumber |
| `GET` | `/api/events` | `question:view` | Daftar event ujian |
| `POST` | `/api/events` | `reference:manage` | Buat event |
| `PATCH` | `/api/events/[id]` | `reference:manage` | Ubah event |
| `DELETE` | `/api/events/[id]` | `reference:manage` | Hapus event |
| `GET` | `/api/grades` | `question:view` | Daftar jenjang |
| `GET` | `/api/stats` | `question:view` | Statistik dasbor |

### 4.5 Media

| Method | Path | Izin | Keterangan |
|--------|------|:----:|------------|
| `GET` | `/api/media` | `question:view` | Daftar aset |
| `POST` | `/api/media/upload` | `media:manage` | Unggah aset (multipart; 415/413 dipetakan) |
| `GET` | `/api/media/orphans` | `media:manage` | Aset tanpa pemakai |
| `GET` | `/api/media/[shortId]` | `question:view` | Detail aset + soal pemakai |
| `PATCH` | `/api/media/[shortId]` | `media:manage` | Ubah metadata |
| `DELETE` | `/api/media/[shortId]` | `media:manage` | Hapus aset; **409** bila masih dipakai |
| `GET` | `/img/[shortId]` | publik | Berkas biner (ETag + `public, max-age=86400`); **bukan** di bawah `/api` |

### 4.6 AI

| Method | Path | Izin | Keterangan |
|--------|------|:----:|------------|
| `POST` | `/api/ai/embed` | `question:view` | Hitung embedding |
| `POST` | `/api/ai/enrich` | `question:view` | Enrichment pedagogis |
| `GET` | `/api/ai/health` | `settings:manage` | Status layanan embedding |
| `GET` | `/api/ai/models` | `settings:manage` | Daftar model |
| `GET` | `/api/ai/settings` | `settings:manage` | Baca konfigurasi AI |
| `POST` | `/api/ai/settings` | `settings:manage` | Simpan konfigurasi AI |

### 4.7 Ingest (satu-satunya jalur ber-prefix versi)

| Method | Path | Izin | Keterangan |
|--------|------|:----:|------------|
| `POST` | `/api/v1/ingest/upload` | `question:create` | Unggah naskah (`Idempotency-Key`) |
| `GET` | `/api/v1/ingest/queue` | `question:view` | Antrean ingest |
| `POST` | `/api/v1/ingest/commit` | `question:create` | Commit hasil ingest (`Idempotency-Key`) |

### 4.8 Sistem & dev

| Method | Path | Izin | Keterangan |
|--------|------|:----:|------------|
| `GET` | `/api/settings` | `settings:manage` | Baca pengaturan aplikasi |
| `PATCH` | `/api/settings` | `settings:manage` | Ubah pengaturan |
| `GET` | `/api/system/agent-keys` | `user:manage` | Daftar API key agen |
| `POST` | `/api/system/agent-keys` | `user:manage` | Buat API key (rahasia hanya sekali) |
| `DELETE` | `/api/system/agent-keys/[id]` | `user:manage` | Cabut API key |
| `GET` | `/api/dev/demo-status` | publik | Status demo (non-produksi) |
| `POST` | `/api/dev/quick-login` | service | Login demo; 404 di produksi kecuali dua flag demo diset |

---

## 5. Contoh

**Buat soal (draft, tanpa jawaban):**
```http
POST /api/questions
Content-Type: application/json

{
  "questionType": "single_choice",
  "difficulty": 3,
  "cognitiveLevel": "apply",
  "grade": "g12",
  "contentMarkdown": "Hitung \\( \\int_0^1 x\\,dx \\)."
}
```
→ `201`
```json
{ "data": { "id": "01a0eded-…", "status": "draft", "…": "…" } }
```

**Coba jadikan `ready` tanpa jawaban:**
```http
PATCH /api/questions/01a0eded-…/status

{ "status": "ready" }
```
→ `422`
```json
{ "error": { "code": "NOT_READY", "message": "Soal belum bisa ditandai 'Siap': jawaban (answer_key) belum diisi." } }
```

---

## 6. Guard Kesiapan (domain)

Sebuah soal **boleh** dibuat tanpa `answer_key`. Namun:
- **Tak bisa** masuk status `ready` (→ `422 NOT_READY`).
- **Tak bisa** diekspor ke Moodle.
- Tipe `stimulus` dikecualikan.

Ditegakkan sebagai **guard service** (`assertReady()` di `fsm/question-fsm.ts`), bukan CHECK keras DB.

---

## 7. Rate Limiting & Keamanan

- **Rate limiting AKTIF**: token bucket **in-memory** per aktor (fallback IP), diterapkan di `wrapRoute` via opsi `rateLimit`. Kelebihan → **429** + header `Retry-After`.
  - **Cakupan terukur: 64/64 pemanggilan `wrapRoute` mengaktifkan `rateLimit`** (tidak ada method yang lolos). `/api/mcp` memakai kebijakan sendiri (60 burst, 2/detik).
  - Kebijakan: default 60 burst / ~60 per menit; mutasi lebih ketat (`POST /api/questions` 20 burst, `DELETE` 10 burst); health 120 burst.
  - Implementasi: `src/lib/api/rate-limit.ts`; store **siap-swap** ke Redis saat multi-instance. **Batas saat ini per-proses** — dengan >1 instance, batas efektif = batas × jumlah instance.
- API key di-hash; rahasia tak pernah masuk log.
- **Proyeksi kolom (S3 — ✅)**: respons soal **tidak pernah** memuat `embedding*`/`aiTagged*` (internal). `answer_key` & `options.is_correct` hanya untuk viewer berwenang (**admin/teacher/reviewer**); `agent`/`machine` tak pernah. Ditegakkan di `src/lib/db/projections/question.ts` — data tak meninggalkan server. Lihat `KEAMANAN.md` §8b.

---

## 8. Versioning (BELUM DIPUTUSKAN)

Keadaan sekarang **dua konvensi hidup bersamaan**:

- Inti aplikasi: **v0** implisit (`/api/questions`, `/api/bundles`, …).
- Ingest: **v1** eksplisit (`/api/v1/ingest/*`) — dipakai klien ingest eksternal.

Dua pilihan yang sama-sama sah, dan **belum ada yang dipilih**:

1. **Naikkan semua ke `/api/v1`** — konsisten, tapi memecah klien yang sudah ada; butuh periode transisi + header `Deprecation`.
2. **Cabut prefix `v1` dari ingest** — konsisten ke arah v0, tapi memecah klien ingest.

Sampai keputusan diambil: **jangan menambah prefix versi baru** dan **jangan mengganti path yang sudah dipakai**. Perubahan bentuk respons hanya lewat penambahan field opsional.

---

## 9. Rujukan

- Envelope & guard: `src/lib/api/route-wrapper.ts`
- Skema: `src/lib/contracts/question.ts`
- Izin: `src/lib/auth/permissions.ts`, `KEAMANAN.md` §RBAC
- Tes: `src/lib/api/route-wrapper.test.ts`, `src/lib/api/zod-hardening.test.ts` (audit cakupan Zod 48 route), `src/lib/contracts/question.test.ts`, `e2e/api.spec.ts`
