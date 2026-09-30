# RENCANA INGEST — Antrean, Commit & Endpoint (M9-3)

> **Status:** 🟡 rencana → implementasi
> **Dibuat:** 2026-09-30
> **Milestone:** M9-3 (bagian akhir M9 Ingest Korpus)
> **Bergantung pada:** `segment.ts`/`adapters` (M9-2), `ingest/media` (M9-2b), `ingest_queue` (M1), `createQuestion` (M5)

---

## 1. Ringkasan

M9-1 (cleaning), M9-2 (segmentasi+adapter), M9-2b (media), M9-2c (pusmendik) sudah
selesai — semua **fungsi murni/terisolasi**, belum ada yang **menyentuh DB**.
M9-3 menyambungkan semuanya ke **antrean** + **penyimpanan soal**, plus **endpoint**.

**Prinsip (dari `AGENTS.md §2` & keputusan user):**
- **SEMUA hasil ingest = draft** (walau kunci jelas).
- **Idempoten** — konten sama → tak dibuat ulang (hash).
- **Jangan menebak kunci** — kosong + flag lebih baik.
- **Gagal gambar tidak memblokir** ingest.

## 2. Komponen

```
src/lib/ingest/
  queue.ts          — enqueue artikel + status (pending→processing→done|failed|skipped)
  commit.ts         — ParsedItem → soal draft (createQuestion) + sumber + topik
  hash.ts           — contentHash (idempotensi) — fungsi murni
  service.ts        — orkestrasi: terima artikel → segmentasi → media → commit
```

Dan endpoint:
```
src/app/api/v1/ingest/upload/route.ts   POST  — machine: kirim artikel
src/app/api/v1/ingest/queue/route.ts    GET   — session: lihat antrean
src/app/api/v1/ingest/commit/route.ts   POST  — machine: proses → soal draft
```

## 3. Skema antrean (`ingest_queue`, sudah ada sejak M1)

| Kolom | Pakai |
|---|---|
| `title`, `slug`, `sourceOrigin`, `sourceUrl` | identitas artikel |
| `rawContent`, `rawFormat` | isi mentah (`html` \| `json`) |
| `mediaManifest` | hasil media (sourceUrl → localUrl) |
| `targetType`, `targetGrade`, `targetTopicId` | tujuan soal |
| `status` | `pending`→`processing`→`done`\|`failed`\|`skipped` |
| `errorMessage`, `processedAt` | jejak |

## 4. Idempotensi (hash)

`contentHash = sha256(rawContent)` (artikel) & `itemHash = sha256(source+stem)` (soal).
- Artikel dengan hash sama yang sudah `done` → **skipped** (tak diproses ulang).
- Soal dengan hash sama → **tak dibuat ulang**.

## 5. Alur M9-3

```
POST /api/v1/ingest/upload  { url, title, source, rawHtml|rawJson, format }
  → queue.enqueue()  → baris ingest_queue (status=pending)

POST /api/v1/ingest/commit  { ids? | all }
  → untuk tiap baris pending:
      status=processing
      → segmentArticle/segmentJson → ParsedItem[]
      → ingestArticleMedia (unduh gambar → localUrl)
      → commit.commitItems(items) → createQuestion(status="draft")
      status=done  (atau failed + errorMessage)
```

## 6. Aturan mutu commit

- `type` dari adapter (`single_choice`/`multiple_choice_checkbox`/`matrix_grid`/`essay`).
- `grade` dari `targetGrade` (wajib; bila kosong → pakai "umum").
- `difficulty` default 3, `cognitiveLevel` default `understand` (dapat diubah telaah).
- `answerKey.correct` = `it.correct` (kosong bila tak ada kunci → **draft + flag**).
- **Semua `status="draft"`** (keputusan user).
- `sourceId` di-resolve dari `sourceOrigin` (sumber web) — dibuat bila belum ada.
- `sourceUrl` disimpan sebagai jejak.

## 7. Izin & rate limit

- Endpoint ingest = mesin (`question:create`), `rateLimit` (CONSTRAINTS #33).
- `upload`/`commit` → `idempotent: true` (anti double-submit).

## 8. Catatan Verifikasi

- `ingest_queue`: `src/lib/db/schema/system.ts:49-75`.
- Izin `machine: question:create = yes`, `question:view = no`: `permissions.ts`.
- `createQuestion(input, actor)`: `src/lib/services/question-service.ts:162`.
- Machine auth via API key: `src/lib/auth/resolve.ts:actorFromApiKey`.
- Endpoint mesin `/api/v1/ingest/*`: `DESAIN-PER-LAPISAN-MATHBANK.md:249-252`.
