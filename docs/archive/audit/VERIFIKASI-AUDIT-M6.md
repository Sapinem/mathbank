# VERIFIKASI — Audit M6 (Pencarian & Filter)

> **Pemicu:** pemilik meminta membahas `docs/audit/M6-PENCARIAN-DAN-FILTER.md`.
> **Metode:** verifikasi tiap klaim ke kode + **uji live** (trigram, typo, multi-kata,
> urut relevansi) + uji fungsi `fusion.ts` langsung.
> **Ringkas:** jalur pencarian **live & sehat** (trigram + typo + urut relevansi ✅).
> Tapi **`fusion.ts` (RRF + dedup) BELUM terintegrasi** dan **logika dua-ambangnya
> TIDAK sesuai dokumen** → 2 temuan (T-M6-1, T-M6-2).

---

## A. Klaim yang TERVERIFIKASI ✅

| Klaim dokumen | Bukti |
|---|---|
| Trigram + GIN index | `idx_questions_content_trgm` = `gin (content_markdown gin_trgm_ops)`; `pg_trgm` aktif (`drizzle/manual/00-extensions.sql:19`) ✅ |
| Toleransi typo | Live: `q=trigonometr` → 1 hasil ✅ |
| Multi-kata | Live: `q='limit fungsi'` → 1 hasil; `q='fungsi'` → 3 ✅ |
| Urut relevansi (similarity) | `listQuestions` `byRelevance` saat `q` ada — terurut `similarity()` DESC ✅ |
| Filter topik rekursif (subtree) | `collectTopicDescendants` + `questionIdsForTopics` benar ✅ |
| File & fungsi yang diklaim ada | `filters.ts`, `fusion.ts`, `fusion.test.ts` (11 tes lulus) ✅ |
| RRF `k=60`, dedup Jaccard ada di kode | Benar **ada**, tapi lihat T-M6-2 (integrasi) |

**Catatan:** klaim "`word_similarity`" **tidak tepat** — kode memakai operator **`%`**
(=`similarity()` + `pg_trgm.similarity_threshold`, default 0.3), bukan
`word_similarity()`. Fungsional OK; komentar kode menyebut `word_similarity` → **misleading**.

---

## B. TEMUAN

### 🟠 T-M6-2 — `fusion.ts` (RRF + dedup) BELUM TERINTEGRASI (klaim dokumen menyesatkan)
Dokumen M6 menampilkan "**Deduplikasi Hasil: Jaccard Similarity**" seolah fitur yang
**sudah jalan**. Faktanya: `rrfFuse`, `dedup`, dan `hybridSearch` **hanya dipanggil
dari file tesnya sendiri** — **NOL konsumen produksi** (bukti: `grep` impor
`@/lib/search/fusion` di luar `fusion*` = kosong). Ini **pustaka yang dibangun
mendahului konsumennya** (pencarian semantik = M10). Status "✅ Lulus" untuk dedup/RRF
→ **menyesatkan**; yang benar: *"belum terpakai"*.

### 🟠 T-M6-1 — Logika dua-ambang dedup TIDAK sesuai dokumen (ambang `exact` = logika mati)
Dokumen **dan** docstring `dedup()` menyatakan: buang jika similarity ≥ `exact` (0.98),
**atau** similarity ≥ `near` (0.85) **DAN** salah satu kandidat tanpa penalaran berbeda.

Kode faktual (`fusion.ts:74`):
```ts
return s >= exact || (s >= near && text !== undefined && k.text !== undefined);
```
Karena `exact (0.98) > near (0.85)`, syarat `s >= near` **sudah mencakup**
`s >= exact` → **seluruh kondisi menyusut jadi `s >= near`**. Akibatnya:
- ambang `exact` **tak pernah berpengaruh** (logika mati);
- syarat "**penalaran berbeda**" **tidak ada di kode** → pasangan "near"
  (0.85–0.98) **dibuang tanpa syarat**.

**Bukti (uji langsung):** pasangan dgn similarity **0.8571** (di antara 0.85 & 0.98),
penalaran **sama-sama ada** → kandidat ke-2 **dibuang**. Padahal per dokumen, near
hanya dibuang bila salah satu tanpa penalaran → seharusnya **dipertahankan**.

**Dampak:** saat integrasi (M10), soal berbeda yang mirip 85–98% berisiko
**ter-dedup salah** → hasil hilang. Belum berdampak sekarang (belum dipakai).

### 🟡 T-M6-4 — Pemuatan seluruh topik/pautan ke memori (skalabilitas)
`collectTopicDescendants` memuat **semua** topik, `questionIdsForTopics` memuat
**semua** pautan soal↔topik ke memori lalu menyaring. Berfungsi benar, tapi tidak
efisien pada skala besar (rekomendasi #1 dokumen sendiri menyebut 100k+).

### 🟡 T-M6-5 — `filters.ts` tanpa uji unit khusus
Klaim "Unit Test: Edge Case Rekursi" hanya tercakup **tidak langsung** via
`question-service.db.test.ts`; tidak ada `filters.test.ts`. Cakupan ada, tapi
tak terkunci eksplisit.

### ❎ Koreksi (bukan bug): pencarian multi-kata "tak jalan" = **artefak shell**
Awalnya tampak `q='limit fungsi'` → 0 hasil; setelah encoding URL benar
(`--data-urlencode`) → **1 hasil**. **Tidak ada bug**; hasil salah berasal dari
kurang-encode shell. (Verifikasi mandiri koreksi klaim sendiri.)

---

## C. Kesimpulan & usul
- **Jalur pencarian yang LIVE (trigram, typo, multi-kata, urut relevansi, filter
  subtree) = SEHAT** ✅. Audit M6 **akurat** untuk klaim struktur/ketersediaan.
- **2 temuan nyata**, keduanya di `fusion.ts` yang **belum dipakai**:
  T-M6-1 (logika ambang dedup salah) & T-M6-2 (klaim dokumen menyesatkan).

## D. STATUS PERBAIKAN (2026-09-30) — ✅ SELESAI
- **T-M6-1 ✅ DIPERBAIKI:** `dedup()` kini menerapkan disain dua-ambang yang benar:
  `s ≥ exact` → duplikat (apa pun penalarannya); zona `near` → duplikat **hanya bila
  penalaran sama** (`normReasoning`); penalaran beda → **dipertahankan**. `Candidate`
  + `lookupReasoning` ditambahkan. **Terbukti:** pasangan s=0.857 penalaran-berbeda →
  dulu dibuang, kini **bertahan**. Tes `fusion.test.ts` **11 → 16** (+5).
- **T-M6-2 ✅ DIDOKUMENTASIKAN:** status `fusion.ts` di `docs/audit/M6-*.md`
  diubah dari "✅ Lulus" → "⚠️ belum terintegrasi (dipakai M10)".
- **Pelajaran → `CONSTRAINTS.md` #42–43.**
- T-M6-4 (skalabilitas) & T-M6-5 (uji `filters.ts`) = **dicatat**, tak dikerjakan.

*Lihat juga: `docs/audit/M6-PENCARIAN-DAN-FILTER.md`, `src/lib/search/fusion.ts`,
`src/lib/question/filters.ts`, `CONSTRAINTS.md`.*
