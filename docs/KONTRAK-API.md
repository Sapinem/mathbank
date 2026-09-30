# KONTRAK-API.md — Kontrak HTTP API MathBank

> **Status:** ✅ berlaku — mencerminkan 13 endpoint nyata (per 2026-09-29).
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
| **Idempotensi** | Endpoint mutasi tertentu (`POST /api/questions`, `POST /api/bundles`) mendukung header **`Idempotency-Key`** — permintaan ulang dgn key sama (≤60 dtk) di-*replay* (respons sama, header `Idempotent-Replay: true`), mencegah *double-submit*. |
| Ganti password | Bila `mustChangePassword`, semua endpoint diblokir **403 `PASSWORD_CHANGE_REQUIRED`** — **kecuali** `/api/auth/me` (agar UI bisa baca status) & endpoint auth Better Auth (ganti password). UI dialihkan ke `/change-password`. |
| Versi | Saat ini **v0** (prefix `/api`); versioning eksplisit menyusul (lihat §8) |

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
| 422 | `NOT_READY` | `review→ready` tanpa `answer_key` (guard kesiapan) |
| 429 | `RATE_LIMITED` | Terlalu banyak permintaan (rate limit token bucket) — sertakan header `Retry-After` (detik) |
| 500 | `INTERNAL_ERROR` | Kesalahan tak terduga |

---

## 4. Katalog Endpoint

> Legenda izin: `question:view`, `question:create`, dst — lihat `permissions.ts`.

### 4.1 Autentikasi

| Method | Path | Izin | Keterangan |
|--------|------|:----:|------------|
| `*` | `/api/auth/[...all]` | — | Handler Better Auth (login, logout, session, API key) |
| `GET` | `/api/auth/me` | (login) | Identitas aktor aktif + peran |

### 4.2 Soal (questions)

| Method | Path | Izin | Status | Keterangan |
|--------|------|:----:|:------:|------------|
| `GET` | `/api/questions` | `question:view` | 200 | Daftar + filter + paginasi |
| `POST` | `/api/questions` | `question:create` | 201 | Buat soal baru |
| `GET` | `/api/questions/[id]` | `question:view` | 200 | Detail soal |
| `PATCH` | `/api/questions/[id]` | `question:edit` | 200 | Perbarui soal (`own` berlaku) |
| `DELETE` | `/api/questions/[id]` | `question:delete` | 200 | Soft-delete (`own` berlaku) |
| `PATCH` | `/api/questions/[id]/status` | *(per-tujuan di service)* | 200 | Transisi status FSM. **T-M4-3:** TANPA gerbang route `question:edit` (izin beda per tujuan: `setReady`/`archive`/`edit`+`own`, ditegakkan di service — gerbang route tanpa `ownerId` dulu memblokir penelaah). |
| `PATCH` | `/api/questions/[id]/flag` | `question:flag` | 200 | Tandai/lepas "perlu perhatian" |
| `DELETE` | `/api/questions/[id]/permanent` | *(per-tujuan di service)* | 200 | **T-M4-4:** hapus PERMANEN — hanya soal soft-deleted; RESTRICT paket; anak CASCADE |

**Query `GET /api/questions`** (semua opsional):
`q`, `status`, `questionType`, `grade`, `difficulty` (1–5), `cognitiveLevel`, `topicId`, `tagId`, `sourceId`, `eventId`, `flagged`, `includeDeleted` (default `false`), `limit` (1–100, default 20), `offset` (default 0).

**Body `POST/PATCH`** (ringkas — lengkap di `contracts/question.ts`):
`questionType`, `difficulty`, `cognitiveLevel`, `grade`, `contentMarkdown`, `dataPayload`, `answerKey` (opsional; **wajib** untuk `ready`), `status` (default `draft`), `parentId`/`childOrder` (stimulus), `sourceId`/`eventId`/`eventYear`/…, `options[]`, `topicIds[]`, `tagIds[]`.

**Body `PATCH .../status`:** `{ "status": "<draft|review|ready|archived>" }`.

### 4.3 Referensi

| Method | Path | Izin | Keterangan |
|--------|------|:----:|------------|
| `GET` | `/api/topics` | `question:view` | Daftar topik (taksonomi) |
| `PATCH` | `/api/topics/[id]` | `taxonomy:manage` | **T-M5-2:** ubah/pindah topik — re-parent **mempropagasi `level` ke seluruh subtree** (transaksi) |
| `POST` | `/api/tags/clean-unused` | `taxonomy:manage` | **T-M5-3:** hapus semua label `usage_count=0`; balikan `{ removed }` |
| `GET` | `/api/sources` | `question:view` | Daftar sumber |
| `GET` | `/api/events` | `question:view` | Daftar event ujian |
| `GET` | `/api/stats` | `question:view` | Statistik dasbor |

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

- **Rate limiting AKTIF** (sejak 2026-09-29): token bucket **in-memory** per aktor (fallback IP), diterapkan di `wrapRoute` via opsi `rateLimit`. Kelebihan → **429** + header `Retry-After`.
  - Kebijakan: default 60 burst / ~60 per menit; mutasi lebih ketat (`POST /api/questions` 20 burst, `DELETE` 10 burst).
  - Implementasi: `src/lib/api/rate-limit.ts`; store **siap-swap** ke Redis saat multi-instance.
- API key di-hash; rahasia tak pernah masuk log.
- **Proyeksi kolom (S3 — ✅)**: respons soal **tidak pernah** memuat `embedding*`/`aiTagged*` (internal). `answer_key` & `options.is_correct` hanya untuk viewer berwenang (**admin/teacher/reviewer**); `agent`/`machine` tak pernah. Ditegakkan di `src/lib/db/projections/question.ts` — data tak meninggalkan server. Lihat `KEAMANAN.md` §8b.

---

## 8. Versioning (rencana)

- Kini: **v0** implisit (`/api/...`).
- Akan datang: `/api/v1/...` bila ada klien eksternal (M12/Moodle) — perubahan **breaking** dihindari lewat penambahan field opsional.
- Deprecation: endpoint lama diberi header `Deprecation` + jendela ≥1 rilis.

---

## 9. Rujukan

- Envelope & guard: `src/lib/api/route-wrapper.ts`
- Skema: `src/lib/contracts/question.ts`
- Izin: `src/lib/auth/permissions.ts`, `KEAMANAN.md` §RBAC
- Tes: `src/lib/api/route-wrapper.test.ts` (22 tes), `e2e/api.spec.ts`
