# KONTRAK-API.md — Kontrak HTTP API MathBank

> **Status:** ✅ berlaku — mencerminkan **51 route handler · 76 method** di `src/app/api` per 2026-10-27
> (`/api/auth/[...all]` menyumbang `GET`+`POST` lewat Better Auth). Angka hidup dicetak
> `pnpm lint:authz`; jangan salin ke dokumen lain.
> **Sumber kebenaran:** `src/lib/api/route-wrapper.ts` (envelope), `src/lib/contracts/*` (skema Zod).
> **Spesifikasi mesin:** `/openapi.json` (`public/openapi.json`) — DIHASILKAN dari kode, lihat ADR-0027.
> **Sifat:** dokumen hidup, **kecuali §4** (tabel dihasilkan; sunting `registry.ts` lalu regenerasi).

---

## 1. Prinsip

1. **Envelope tunggal** — semua respons berbentuk konsisten (lihat §3). Tak ada bentuk ad-hoc.
2. **Satu tempat validasi** — skema Zod di `src/lib/contracts/`; dipakai service, API, dan (nanti) MCP.
3. **Guard terpusat** — `wrapRoute` menangani: resolve aktor → 401 → ganti-password → izin → parse → try/catch → format.
4. **Izin dari matriks L1, dideklarasikan per method** — setiap method `wrapRoute` **wajib**
   memuat `authz` (ADR-0026):
   - `{ kind: "route", permission }` — gerbang izin di route;
   - `{ kind: "service", enforcedIn, routeGate? }` — ditegakkan di service yang punya
     `ownerId` (izin ber-`own` **tidak boleh** jadi gerbang route, CONSTRAINT #35);
   - `{ kind: "authenticated" }` — cukup login;
   - `{ kind: "public", reason }` — tanpa login, wajib beralasan + disetujui di
     `PUBLIC_ROUTES`.

   `pnpm lint:authz` memeriksa setiap deklarasi terhadap matriks izin **dan** terhadap kode
   service (fungsi di `enforcedIn` harus benar-benar memuat pemeriksaan izin).

---

## 2. Konvensi

| Aspek | Aturan |
|-------|-------|
| Base URL | `/api` |
| Format | JSON (`application/json`) |
| Autentikasi | **Session cookie** (Better Auth) **atau** header `x-api-key` (agen/mesin) |
| Izin | `authz` per method, dicek via matriks peran×aksi (`permissions.ts`); lihat ADR-0026 |
| **Traceability** | Setiap respons menyertakan header `X-Request-ID` (diteruskan dari header masuk bila ada). Log error 500 memuat `rid=<id>`. |
| **Cache** | Semua respons lewat `wrapRoute` menyetel `Cache-Control: no-store` + `Vary: Cookie, Authorization`. Hanya `/img/*` yang publik dan boleh di-cache. |
| **Idempotensi** | Empat endpoint mutasi (`POST /api/questions`, `POST /api/bundles`, `POST /api/ingest/upload`, `POST /api/ingest/commit`) menerima `Idempotency-Key`. Key sama + **payload sama** (≤60 dtk) → replay (header `Idempotent-Replay: true`). Key sama + **payload beda** → **422 `IDEMPOTENCY_KEY_REUSED`**, bukan replay. Sidik jari = SHA-256(method + path + body mentah). |
| **Path aksi** | Operasi non-CRUD memakai sub-path kata kerja (`/duplicate`, `/validate`, `/merge`, `/clean-unused`, `/flag`, `/status`, `/permanent`, `/export/moodle`). Konsekuensi ADR-0022 (larangan Server Actions), **disengaja** — bukan kelalaian REST. |
| Ganti password | Bila `mustChangePassword`, semua endpoint diblokir **403 `PASSWORD_CHANGE_REQUIRED`** — **kecuali** `/api/auth/me` (agar UI bisa baca status) & endpoint auth Better Auth (ganti password). UI dialihkan ke `/change-password`. |
| Versi | **Tanpa prefix versi** di seluruh API. Ingest kini di `/api/ingest/*`; `/api/v1/ingest/*` tetap hidup sebagai **alias deprecated** sampai 2027-01-25 — lihat §8 |

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

> Legenda kolom **Izin**: `question:view`, `question:create`, dst — lihat `permissions.ts`.
> `service` = tidak ada gerbang izin di route; otoritas (termasuk `own`) ditegakkan di
> service yang punya objeknya (ADR-0026, CONSTRAINT #35). `publik` = `authz.kind`
> `public` dengan alasan tertulis. `token` = header `Authorization: Bearer $METRICS_TOKEN`.

> **Tabel di bawah DIHASILKAN** — jangan sunting tangan. Sumbernya `src/lib/api/openapi/registry.ts`
> + deklarasi `authz` di tiap route. Regenerasi: `pnpm openapi:generate` (gerbang: `pnpm openapi:check`).
> Spesifikasi mesin: [`public/openapi.json`](../public/openapi.json) → disajikan di `/openapi.json`.

<!-- BEGIN:GENERATED:endpoints -->
### auth — Autentikasi & identitas (Better Auth).

| Method | Path | Izin | Ringkasan |
|--------|------|:----:|-----------|
| `GET` | `/api/auth/{all}` | Better Auth | Handler Better Auth (semua metode) |
| `POST` | `/api/auth/{all}` | Better Auth | Handler Better Auth (semua metode) |
| `GET` | `/api/auth/me` | (login) | Identitas aktor aktif |

### questions — Bank soal: baca, tulis, transisi status.

| Method | Path | Izin | Ringkasan |
|--------|------|:----:|-----------|
| `GET` | `/api/questions` | `question:view` | Daftar soal (filter + paginasi) |
| `POST` | `/api/questions` | `question:create` | Buat soal baru |
| `DELETE` | `/api/questions/{id}` | service | Hapus lunak soal |
| `GET` | `/api/questions/{id}` | `question:view` | Detail soal + opsi |
| `PATCH` | `/api/questions/{id}` | service | Perbarui soal |
| `PATCH` | `/api/questions/{id}/flag` | service | Tandai/lepas 'perlu perhatian' |
| `DELETE` | `/api/questions/{id}/permanent` | service | Hapus permanen soal |
| `PATCH` | `/api/questions/{id}/status` | service | Ubah status soal (FSM) |
| `POST` | `/api/questions/batch` | service | Aksi massal soal (maks 200 id) |
| `GET` | `/api/stats` | `question:view` | Statistik dasbor |

### bundles — Paket soal, item, ekspor Moodle.

| Method | Path | Izin | Ringkasan |
|--------|------|:----:|-----------|
| `GET` | `/api/bundles` | `question:view` | Daftar paket soal |
| `POST` | `/api/bundles` | service (gerbang `question:view`) | Buat paket soal |
| `DELETE` | `/api/bundles/{id}` | service | Arsipkan paket (hapus lunak) |
| `GET` | `/api/bundles/{id}` | `question:view` | Detail paket + item berurutan |
| `PATCH` | `/api/bundles/{id}` | service | Ubah metadata paket |
| `POST` | `/api/bundles/{id}/duplicate` | service (gerbang `question:view`) | Duplikasi paket |
| `POST` | `/api/bundles/{id}/export/moodle` | service | Ekspor paket ke folder GitSync |
| `GET` | `/api/bundles/{id}/items` | `question:view` | Item paket berurutan + soal tertanam |
| `POST` | `/api/bundles/{id}/items` | service (gerbang `question:view`) | Tambah soal ke paket |
| `PUT` | `/api/bundles/{id}/items` | service (gerbang `question:view`) | Susun ulang urutan item (atomik) |
| `DELETE` | `/api/bundles/{id}/items/{itemId}` | service (gerbang `question:view`) | Lepas soal dari paket |
| `GET` | `/api/bundles/{id}/validate` | `question:view` | Pratinjau kesiapan ekspor |

### taxonomy — Topik, label, sumber, event, jenjang.

| Method | Path | Izin | Ringkasan |
|--------|------|:----:|-----------|
| `GET` | `/api/events` | `question:view` | Daftar event ujian |
| `POST` | `/api/events` | `reference:manage` | Buat event |
| `DELETE` | `/api/events/{id}` | `reference:manage` | Hapus event |
| `PATCH` | `/api/events/{id}` | `reference:manage` | Ubah event |
| `GET` | `/api/grades` | `question:view` | Daftar jenjang |
| `GET` | `/api/sources` | `question:view` | Daftar sumber |
| `POST` | `/api/sources` | `reference:manage` | Buat sumber |
| `DELETE` | `/api/sources/{id}` | `reference:manage` | Hapus sumber |
| `PATCH` | `/api/sources/{id}` | `reference:manage` | Ubah sumber |
| `GET` | `/api/tags` | `question:view` | Daftar label |
| `POST` | `/api/tags` | `taxonomy:manage` | Buat label |
| `DELETE` | `/api/tags/{id}` | `taxonomy:manage` | Hapus label |
| `PATCH` | `/api/tags/{id}` | `taxonomy:manage` | Ubah label |
| `POST` | `/api/tags/clean-unused` | `taxonomy:manage` | Hapus label tanpa pemakaian |
| `POST` | `/api/tags/merge` | `taxonomy:manage` | Gabung label |
| `GET` | `/api/topics` | `question:view` | Daftar topik |
| `POST` | `/api/topics` | `taxonomy:manage` | Buat topik |
| `DELETE` | `/api/topics/{id}` | `taxonomy:manage` | Hapus topik |
| `GET` | `/api/topics/{id}` | `question:view` | Detail topik |
| `PATCH` | `/api/topics/{id}` | `taxonomy:manage` | Ubah/pindah topik (propagasi level) |

### media — Aset media.

| Method | Path | Izin | Ringkasan |
|--------|------|:----:|-----------|
| `GET` | `/api/media` | `question:view` | Daftar aset media |
| `DELETE` | `/api/media/{shortId}` | `media:manage` | Hapus aset + berkas fisik |
| `GET` | `/api/media/{shortId}` | `question:view` | Detail aset + soal pemakai |
| `PATCH` | `/api/media/{shortId}` | `media:manage` | Ubah metadata aset |
| `GET` | `/api/media/orphans` | `media:manage` | Aset tanpa pemakai |
| `POST` | `/api/media/upload` | `media:manage` | Unggah aset media (multipart) |

### ai — Embedding & enrichment pedagogis.

| Method | Path | Izin | Ringkasan |
|--------|------|:----:|-----------|
| `POST` | `/api/ai/embed` | `question:view` | Hitung embedding soal |
| `POST` | `/api/ai/enrich` | `question:view` | Enrichment pedagogis (satu atau massal) |
| `GET` | `/api/ai/health` | `settings:manage` | Status layanan LLM & embedding |
| `GET` | `/api/ai/models` | `settings:manage` | Daftar model yang tersedia |
| `GET` | `/api/ai/settings` | `settings:manage` | Baca konfigurasi AI |
| `POST` | `/api/ai/settings` | `settings:manage` | Simpan konfigurasi AI |

### ingest — Antrean ingest naskah (wajah mesin).

| Method | Path | Izin | Ringkasan |
|--------|------|:----:|-----------|
| `POST` | `/api/ingest/commit` | `question:create` | Commit antrean → soal draft |
| `GET` | `/api/ingest/queue` | `ingest:queue:read` | Antrean ingest + ringkasan status |
| `POST` | `/api/ingest/upload` | `question:create` | Unggah naskah ke antrean ingest |
| `POST` | `/api/v1/ingest/commit` | API key | Alias deprecated: commit antrean menjadi soal draft |
| `GET` | `/api/v1/ingest/queue` | API key | Alias deprecated: antrean ingest + ringkasan status |
| `POST` | `/api/v1/ingest/upload` | API key | Alias deprecated: unggah naskah ke antrean |

### system — Pengaturan, API key agen, dev.

| Method | Path | Izin | Ringkasan |
|--------|------|:----:|-----------|
| `GET` | `/api/dev/demo-status` | publik | Status login demo |
| `POST` | `/api/dev/quick-login` | publik | Login cepat akun demo |
| `DELETE` | `/api/mcp` | publik | Akhiri sesi MCP (405 pada mode stateless) |
| `GET` | `/api/mcp` | publik | Metode MCP tak dipakai (405) |
| `POST` | `/api/mcp` | API key | Transport MCP (Streamable HTTP, stateless) |
| `GET` | `/api/settings` | `settings:manage` | Baca pengaturan aplikasi |
| `PATCH` | `/api/settings` | `settings:manage` | Ubah pengaturan aplikasi |
| `GET` | `/api/system/agent-keys` | `user:manage` | Daftar API key agen |
| `POST` | `/api/system/agent-keys` | `user:manage` | Buat API key agen (rahasia sekali) |
| `DELETE` | `/api/system/agent-keys/{id}` | `user:manage` | Cabut API key agen |

### observability — Health, readiness, metrik.

| Method | Path | Izin | Ringkasan |
|--------|------|:----:|-----------|
| `GET` | `/api/health` | publik | Kesehatan aplikasi (liveness + readiness) |
| `GET` | `/api/metrics` | token | Metrik runtime |
| `GET` | `/api/ready` | publik | Readiness probe |
<!-- END:GENERATED:endpoints -->

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

## 8. Versioning (DIPUTUSKAN 2026-10-27)

**Keputusan: API tidak memakai prefix versi.** ADR-0028 mencabut prefix `v1` dari
jalur ingest karena hanya tiga endpoint yang berversi sementara seluruh API lain
tidak — perbedaan itu tidak memberi manfaat dan menyesatkan klien.

| Jalur | Status |
|---|---|
| `/api/ingest/{upload,queue,commit}` | **kanonik** |
| `/api/v1/ingest/{upload,queue,commit}` | **alias deprecated**, berakhir **2027-01-25** (90 hari) |

Alias mendelegasikan ke handler kanonik yang sama (bukan salinan), lalu menambahkan:

```http
Deprecation: true
Sunset: Mon, 25 Jan 2027 00:00:00 GMT
Link: </api/ingest>; rel="successor-version"
```

Setelah 2027-01-25 alias dihapus tanpa pengganti. **Jangan menambah prefix versi
baru**: perubahan yang memutus klien diselesaikan lewat masa transisi + header
deprecation, bukan lewat `/v2`.

---

## 9. Rujukan

- Envelope & guard: `src/lib/api/route-wrapper.ts`
- Skema: `src/lib/contracts/question.ts`
- Izin: `src/lib/auth/permissions.ts`, `KEAMANAN.md` §RBAC
- Otorisasi: `src/lib/api/authz.ts` (tipe deklarasi), `src/lib/api/route-inventory.ts`
  (inventaris + pemeriksa), `scripts/check-authz.ts` (`pnpm lint:authz`), ADR-0026
- Kontrak mesin: `src/lib/api/openapi/spec.ts` (penyusun murni), `src/lib/api/openapi/registry.ts`
  (ringkasan/tag/skema respons), `scripts/generate-openapi.ts` (`pnpm openapi:generate`,
  `pnpm openapi:check`), `public/openapi.json` (artefak, disajikan di `/openapi.json`), ADR-0027
- Tes: `src/lib/api/route-wrapper.test.ts`, `src/lib/api/authz-coverage.test.ts`,
  `src/lib/api/openapi/registry.test.ts`,
  `src/lib/api/ingest-authz.db.test.ts`, `src/lib/api/reference-authz.db.test.ts`,
  `src/lib/api/zod-hardening.test.ts` (cakupan Zod, hitungan diturunkan dari inventaris),
  `src/lib/contracts/question.test.ts`, `e2e/api.spec.ts`
