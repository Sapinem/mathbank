# MAT-148 — Verifikasi UI JSONB (QuestionEditor, Kartu, Detail)

**Tanggal:** 2026-10-23
**Branch:** `paperclip/dev`
**Lingkup:** `question-editor.tsx`, `type-specific-fields.tsx`, `question-card.tsx`,
`matrix-grid-view.tsx`, `matching-view.tsx` (baru), `question-detail-view.tsx`,
`question-edit-view.tsx`.

## 1. Kontrak tulis: `data_payload` + `answer_key`

`QuestionEditor.submit()` tidak lagi mengirim opsi relasional (`options: []`);
seluruh struktur per tipe dibangun oleh `buildDataPayload()` / `buildAnswerKey()`
dengan bentuk kanonik MAT-145:

| Tipe | `data_payload` | `answer_key` |
| --- | --- | --- |
| Pilihan Ganda | `{type:"multiple_choice", options:[{id,contentMarkdown,distractorRationale?}], shuffleOptions}` | `{correctOptionIds:["A"]}` |
| PG Kompleks | `{type:"complex_multiple_choice", options:[…], shuffleOptions}` | `{correctOptionIds:[…]}` |
| Menjodohkan | `{type:"matching", premises:[…], responses:[…]}` | `{matchingPairs:{premiseId:responsId}}` |
| Matriks B–S | `{labels:[…], rows:[{text,answer}]}` | `{}` (kunci per baris) |
| Isian Singkat | `{type:"short_answer", rubricGuidelines?}` | `{acceptedAnswers:[…]}` |
| Uraian | `{type:"essay", rubricGuidelines?}` | `{scoringRubric}` |

`type` hanya disertakan bila struktur sudah memenuhi minimum skema, sehingga
penyimpanan **draf setengah jadi** tidak ditolak 422 oleh gerbang tulis lapis 2.

Bukti end-to-end (dev server, akun demo `guru`):

```
POST /api/questions  (matrix_grid) → 201, dataPayload.rows tersimpan apa adanya
POST /api/questions  (matching)    → 201, answerKey.matchingPairs tersimpan
DELETE /api/questions/{id}         → 200 (dua soal uji dibersihkan)
```

## 2. Kontrak baca: zero join

`GET /api/questions` dan `GET /api/questions/{id}` mengembalikan `dataPayload`
langsung dari kolom JSONB; tidak ada `question_options` yang di-join.

Komponen baca:

- `question-card.tsx` — `q.options?.length ?? 0` (defensif; tidak ada lagi
  `TypeError: undefined is not iterable`).
- `question-detail-view.tsx` — matriks via `readMatrixGridPayload(q.dataPayload)`,
  menjodohkan via `readMatchingPayload(q.dataPayload)`.
- `matching-view.tsx` — **baru**: dua kolom premis/respons dari
  `data_payload.premises|responses`; `flex-col sm:flex-row` (bertumpuk di 360px).

## 3. Multi-viewport & konsol (dev server, Chromium, emulasi mobile)

`scrollWidth === innerWidth` di semua halaman (tidak ada overflow horizontal),
`console.error` = 0:

| Halaman | 360px | 768px | 1280px |
| --- | --- | --- | --- |
| `/questions` | scrollW 360, err 0 | 768, 0 | 1280, 0 |
| `/questions/new` | 360, 0 | 768, 0 | 1280, 0 |
| `/questions/[id]` (matriks) | 360, 0 | 768, 0 | 1280, 0 |
| `/questions/[id]` (menjodohkan) | 360, 0 | — | 1280, 0 |
| `/questions/[id]/edit` | 360, 0 | 768, 0 | 1280, 0 |

### Defect yang ditemukan & diperbaiki

1. **`console.error` Base UI di setiap kunjungan detail/edit**
   (`A component that acts as a button expected a native <button> …`).
   Tiga `<Button render={<Link/>}>` tidak menyatakan `nativeButton={false}`
   (`question-detail-view.tsx` ×2, `question-edit-view.tsx` ×1).
   Setelah perbaikan: 0 error konsol di seluruh viewport.
2. **Soal menjodohkan tidak menampilkan premis/respons** di halaman detail
   (hanya stem). Ditambahkan `MatchingView` + `readMatchingPayload()`.

## 4. Gerbang statis

- `npx vitest run src/components/questions` → **9 berkas, 107 tes lulus**.
- `npx tsc --noEmit` → **0 error** pada seluruh berkas lingkup MAT-148.
  (22 error yang tersisa berasal dari `scripts/r5-batch2.ts` — berkas **untracked**
  milik run MAT-35 yang berjalan bersamaan, di luar lingkup ini.)
- `npx eslint` pada berkas yang disentuh → bersih.
- `next build` → tahap kompilasi **lulus** (5,9 menit); tahap TypeScript
  terhenti oleh berkas `scripts/r5-batch2.ts` di atas.

## 5. Catatan untuk verifikator (Hafiz)

- Uji ulang dengan sesi demo (`POST /api/dev/quick-login {key:"guru"}`).
- Data `matching` dan `short_answer` **belum ada** di bank (0 baris saat
  verifikasi: 9.335 PG, 22 PG kompleks, 330 matriks, 2.181 uraian). Untuk uji
  visual menjodohkan, buat satu soal lewat editor lebih dulu.
