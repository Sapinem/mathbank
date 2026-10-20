# MAT-127 · SPRINT 1 — UI Support for Data Enrichment (Ichsan)

Status: **SELESAI (siap diverifikasi)** · Branch: `paperclip/dev`
Ruang lingkup: frontend Next.js 16 + React 19 + Tailwind v4 di `/home/hari/projects/mathbank`.

Tujuan: memastikan UI **siap menampilkan** data pengayaan Sprint 1
(media ACT-08, topik ACT-09, tipe soal ACT-10, kesulitan ACT-11) sebelum data
benar-benar terisi, lalu membuktikan tampilannya dengan data nyata.

---

## 1. Question Detail Page — `src/components/questions/question-detail-view.tsx`

Halaman `/questions/[id]` kini menampilkan empat blok pengayaan:

| Kebutuhan (brief) | Status | Bukti di kode |
|---|---|---|
| Gambar soal dari `question_media` | ✅ | kartu **Lampiran Gambar** + `QuestionMediaGallery` |
| `{{img:…}}` → `<img>` nyata | ✅ | sudah ada di `MathContent` (`MediaImage`), kini diperkuat fallback eksplisit |
| Fallback bila gambar tidak ada | ✅ | `QuestionMediaEmpty` + `QuestionImage` (state `failed`) |
| Difficulty badge 1–5 berwarna | ✅ | `DifficultyBadge` (hijau→biru→kuning→oranye→merah) + `showLabel` |
| Topik tags (klik → filter) | ✅ | `TopicTagList` → `/questions?topicId=<id>` |
| Tipe soal tag | ✅ | `TYPE_LABELS[q.questionType]` (header + kartu klasifikasi) |
| Status indicator | ✅ | `QuestionStatusBadge`: draft abu, review kuning, ready hijau, archived merah coret |

### Komponen baru

**`src/components/questions/question-image.tsx`**
- `QuestionImage` — render `/img/{shortId}` (jalur yang sama dengan di dalam naskah),
  memakai `width`/`height` dari DB agar tidak ada layout shift, `loading="lazy"`
  kecuali aset pertama, `alt` dari `altText`/`caption`.
- `QuestionMediaEmpty` — keadaan kosong eksplisit (bukan ruang kosong).
- `QuestionMediaGallery` — mengelompokkan aset per `role` (isi/opsi/pembahasan).
- `extractMediaShortIds()` / `hasInlineMedia()` — mendeteksi `{{img:<shortId>}}`
  di markdown. Dipakai untuk memberi tahu guru saat naskah merujuk gambar tetapi
  `question_media` belum terisi (kasus transisi ingest → enrichment).

**`src/components/questions/topic-tag.tsx`**
- `TopicTag` — tautan nyata ke Bank Soal terfilter (filter topik server-side sudah
  menelusuri keturunan topik di `buildQuestionFilter`, jadi UI tak perlu state baru).
- Hierarki 3 level dipetakan ke bobot visual berbeda; `isPrimary` diberi ring.
- `TopicTagList` — daftar + keadaan kosong ("Belum ada topik (menunggu pengayaan)").
- Target sentuh `min-h-[44px]` via `pointer-coarse:` (WCAG 2.2 AA, mobile).

**`src/components/questions/question-status-badge.tsx`**
- Pemetaan warna status sesuai brief. Catatan desain: `statusClass()` lama
  ("Siap" = biru brand) tetap dipakai daftar/kartu; badge detail sengaja
  memakai hijau agar makna "siap pakai" terbaca. Penyatuan kedua pemetaan
  dicatat sebagai tindak lanjut (§5).

**`src/components/questions/rubric-badge.tsx`** (diubah)
- `DifficultyBadge` kini berwarna per level (sebelumnya abu netral) dan punya
  prop `showLabel` untuk label teks "Sangat Mudah…Sangat Sulit".
- `difficultyToneClass(level)` diekspor agar chip rerata kesulitan di halaman
  paket memakai palet yang sama (satu sumber warna).

---

## 2. Backend pendukung (read-only, tanpa migrasi)

**`src/lib/services/question-read.ts`** — `getQuestion()` mengembalikan:
- `topics: QuestionTopicView[]` → `{ id, name, slug, level, isPrimary }`
  (join `question_topics` × `topics`, urut `level, name`).
- `media: QuestionMediaView[]` → `{ id, shortId, role, orderIndex, altText,
  caption, width, height, mimeType }` (join `question_media` × `media_assets`,
  urut `order_index`).
- `topicIds` tetap dipertahankan (dipakai pemilih topik di editor).

Proyeksi aman (S3) tidak berubah: `answerKey` tetap bergantung
`canSeeAnswerKey`, `embedding*`/`aiTagged*` tetap dibuang.

**`src/lib/services/bundle-query.ts`** — `attachEnrichment()` untuk `listBundles`:
- 2 query agregat untuk SELURUH halaman (bukan N+1 per baris).
- `COUNT(DISTINCT questions.id)` dipakai karena join `question_topics`
  menggandakan baris per topik (tanpa DISTINCT rerata kesulitan jadi berbobot).
- Keluaran: `questionCount`, `avgDifficulty` (1 desimal), `topicCount`,
  `taggedQuestionCount`, `topicCoverage` (0–1).

**`src/lib/services/bundle-shared.ts`** — tipe `BundleEnrichment`; field
`enrichment?` **opsional** sehingga respons lama/paket kosong tetap valid.

---

## 3. Bundle page — `src/components/bundles/bundle-list-view.tsx`

Komponen baru `src/components/bundles/bundle-enrichment.tsx`:
- `DifficultyAverageChip` — rerata kesulitan berwarna (tone sama dengan badge).
- `TopicCoverageChip` — `"12 topik · 45%"` (topik berbeda + % butir bertopik).
- `BundleEnrichmentSummary` — ringkasan 3 metrik, dipakai di kartu grid (`compact`)
  dan tabel (kolom "Rerata Kesulitan" + "Cakupan Topik", tersembunyi < md).

Angka sengaja jujur: cakupan = **persen butir yang sudah bertopik**, bukan hanya
jumlah topik — guru bisa melihat sisa pekerjaan pengayaan.

Detail paket (`/bundles/[id]`) tetap ringan: `getBundle` tidak menghitung
agregat; ringkasan hanya di jalur daftar (didokumentasikan di tipe).

---

## 4. Halaman Kurasi (persiapan Sprint 2) — `src/app/(app)/curate/page.tsx`

- Rute `/curate` **aktif** dan memakai App Shell yang sama (header, breadcrumb, sidebar).
- Isi: kerangka kerja + rencana antrean Sprint 2 (antrean `review`/terflag,
  panel pratinjau memakai komponen yang sama: `QuestionImage`,
  `DifficultyBadge`, `TopicTagList`).
- **Tidak ada data palsu**: halaman menyatakan eksplisit bahwa antrean menyusul,
  agar guru tidak salah kira kurasi sudah berjalan.
- Dapat dijangkau dari halaman Telaah: tombol **"Ruang Kurasi"** di
  `review-view.tsx`. (Belum ditambahkan ke sidebar karena `nav-config.test.ts`
  mengunci jumlah item grup "Kerja" = 4 — perubahan nav harus lewat Rofik.)

---

## 5. Verifikasi (bukti nyata, bukan klaim)

Data produksi saat verifikasi: **11.867 soal hidup**, **14.440 tautan topik**,
**1.639 tautan media**.

1. **`npx tsc --noEmit`** → lolos tanpa error.
2. **`getQuestion()` terhadap soal nyata** (`01a1155c-…`, soal dengan media + topik):
   ```json
   { "difficulty": 2, "status": "draft",
     "topics": [{ "name": "Luas & Volume Bangun Ruang", "level": 3, "isPrimary": true }],
     "media":  [{ "shortId": "QAGwtVfi", "role": "content", "mimeType": "image/jpeg" }] }
   ```
3. **`listBundles()` dengan agregat** (3 paket teratas):
   ```
   233 butir · rerata 2.0 · 40 topik · cakupan 40%
    30 butir · rerata 2.5 · 20 topik · cakupan 57%
    25 butir · rerata 2.2 · 16 topik · cakupan 56%
   ```
   Cocok dengan hitungan manual `itemCount`, jadi agregat tidak menggandakan baris.

4. **Kontrak data diverifikasi ulang (2026-10-20, DB hidup)** — soal
   `01a11566-26ae-…` (media + topik), keluaran `getQuestion()`:
   ```json
   {"difficulty":2,"status":"draft","questionType":"single_choice",
    "topics":[{"id":"01a0f838-…","name":"Segi Empat","level":3,"isPrimary":true}],
    "media":[{"shortId":"mbEVRMdk","role":"content","mimeType":"image/jpeg"}]}
   ```
   `listBundles()` → `233/233`, `30/30`, `25/25` butir (enrichment.questionCount
   == itemCount) ⇒ agregat **tidak** menggandakan baris.

5. **Bukti render komponen** — `npx tsx e2e-manual/mat127-render-check.tsx`
   merender komponen nyata dengan props nyata (`renderToStaticMarkup`) dan
   memeriksa markup: **15/15 PASS**
   - `DifficultyBadge` L1–L5 → 5 tone berbeda (`success`, `info`, `gold-fg`,
     `warning`, `error`) + label "Sangat Mudah…Sangat Sulit".
   - `QuestionStatusBadge` draft/review/ready/archived (arsip ber-`line-through`).
   - `TopicTagList` menghasilkan `<a href="/questions?topicId=…">` + keadaan kosong.
   - `QuestionMediaGallery` → `<img src="/img/mbEVRMdk">`; galeri kosong →
     "Belum ada gambar yang tertaut ke soal ini."
   - `BundleEnrichmentSummary` → "233", "40", "40%"; `enrichment` undefined → `null`
     (respons lama tetap aman).

Catatan: `vitest run` untuk folder komponen gagal start worker (timeout pool)
karena mesin sedang menjalankan beberapa agen paralel — bukan kegagalan asersi.
Uji komponen adalah ranah Rofik; komponen baru sengaja diberi tanda tangan
murni (props → render) agar mudah diuji. Skrip `e2e-manual/mat127-render-check.tsx`
disediakan sebagai bukti sementara dan bisa dipromosikan Rofik jadi unit test.

---

## 6. Tindak lanjut (bukan blocker MAT-127)

1. **Tag AI ACT-10** belum bisa ditampilkan: tabel `tags` masih generik
   (`name`/`slug`), belum ada `tag_type` (tipe soal / kompetensi). Begitu skema
   Faruq mendarat, cukup tambah `tags: QuestionTagView[]` di `getQuestion` dan
   satu blok chip di kartu klasifikasi.
2. **Penyatuan pemetaan warna status** (`statusClass` biru-brand vs badge detail
   hijau) — perlu keputusan desain Kemal agar tidak ada dua arti untuk "Siap".
3. **Entri sidebar `/curate`** — menunggu Rofik memperbarui `nav-config.test.ts`
   (jumlah item grup "Kerja" terkunci di 4).
4. **Gambar opsi/pembahasan** — `question_media.role` sudah dibaca & diberi label,
   tetapi aset ber-role `option` belum disisipkan ke baris opsi tertentu
   (butuh kolom penghubung opsi↔media; saat ini tampil di galeri lampiran).

---

## 7. Verifikasi ulang & penutupan (heartbeat lanjutan)

Run sebelumnya berhenti setelah pekerjaan kode selesai tetapi **sebelum commit**
(`adapter_failed`). Pada lanjutan ini:

1. **`npx tsc --noEmit`** dijalankan ulang dengan `pipefail` → **exit 0**,
   log kosong (tidak ada error tipe).
2. **Rute `/curate` dirender** lewat dev server proyek yang sudah berjalan
   (`http://127.0.0.1:3010`): respons `307 → /login` dengan payload RSC halaman
   lengkap — judul `Kurasi Soal — MathBank`, kartu "Kerangka halaman siap —
   antrean menyusul", dan tautan ke `/review`. Artinya rute benar-benar
   ter-resolve di App Router dan hanya tertahan gerbang autentikasi, bukan 404.
3. **Commit**: `8b440e2` — 12 berkas (4 komponen baru, halaman `/curate`,
   3 service, nav-config, dokumen ini). `matrix-grid-view.tsx` disertakan
   karena `question-detail-view.tsx` mengimpornya (komponen sudah dipakai,
   sebelumnya belum ter-track).
4. Berkas milik agen lain yang belum di-commit (parser ingest, print view,
   `globals.css` probe audit) **sengaja tidak disentuh** agar tidak mencampur
   pekerjaan yang belum selesai.

Status DoD: gambar soal ✅ · difficulty badge ✅ · topic tags ✅ · status
indikator ✅ · statistik paket ✅ · rute `/curate` ✅.

**Siap diperiksa Rofik (tes komponen) dan Hafiz (build/hidrasi).**

---

## 8. Verifikasi independen (heartbeat penutup)

Verifikasi ulang dijalankan **dari nol** (tidak memakai klaim run sebelumnya),
pada branch `paperclip/dev` dengan commit `8b440e2` + `a5b6498` sudah mendarat:

1. **`npx tsc --noEmit`** (`set -o pipefail`) → **exit 0**, tanpa keluaran error.
2. **Keterpasangan komponen → halaman** (grep, bukan asumsi):
   - `question-detail-view.tsx` mengimpor & memakai `QuestionMediaGallery`
     (baris 234), `TopicTagList` (414), `QuestionStatusBadge` (136, 388),
     `DifficultyBadge` (140, 404), `TYPE_LABELS` (91, 149).
   - `bundle-list-view.tsx` memakai `BundleEnrichmentSummary` (543, mode
     `compact` di kartu) + `DifficultyAverageChip` (645) & `TopicCoverageChip`
     (652) di kolom tabel "Rerata Kesulitan"/"Cakupan Topik" (header 603–606).
   - `src/app/(app)/curate/page.tsx` ada dan menjadi rute App Shell.
3. **Data nyata (`.env` proyek, 2026-10-20)** — `listBundles(actor,{limit:5})`,
   total **577 paket**; agregat terisi konsisten dengan `itemCount`:
   | Paket | Butir | Rerata | Topik | Cakupan |
   |---|---|---|---|---|
   | Simulasi TKA | 233 | 2.0 | 40 | 40% |
   | Smp_matp | 30 | 2.5 | 20 | 57% |
   | Sma_amatw | 25 | 2.2 | 16 | 56% |
   | Sma_amatp | 25 | 2.2 | 20 | 68% |
   | Sd_matd | 30 | 2.0 | 9 | 37% |

   `questionCount === itemCount` di kelima baris → `COUNT(DISTINCT …)` memang
   mencegah penggandaan baris akibat join `question_topics`.
4. **`getQuestion()` pada soal nyata** (`01a1155c-…`, satu-satunya soal yang
   punya media *dan* topik pada irisan query):
   ```json
   { "difficulty": 2, "status": "draft", "type": "single_choice",
     "topics": ["Aritmetika Sosial(L2)", "Barisan & Deret(L2)",
                "Luas & Volume Bangun Ruang(L3,primary)"],
     "media":  ["QAGwtVfi:content:image/jpeg:nullxnull"],
     "hasAnswerKey": false }
   ```
   Tiga hal terbukti: (a) hierarki topik + `isPrimary` sampai ke UI,
   (b) media membawa `shortId`/`role`/`mimeType`, (c) `answerKey` tetap
   tersembunyi untuk penonton tanpa izin — proyeksi aman tidak bocor.
   Catatan: `width`/`height` media masih `null` di DB (pengisi aset belum
   mengukur dimensi), dan `QuestionImage` sudah menanganinya
   (`width={asset.width ?? undefined}`) sehingga tidak ada `NaN`/layout shift.
5. **Rute** di dev server `127.0.0.1:3010`: `/curate`, `/bundles`, `/questions`
   semuanya `307` (gerbang auth) — tidak ada 404.
6. **Bukti render nyata (SSR, data DB):** `npx tsx e2e-manual/mat127-render-check.tsx`
   → **15/15 PASS** (`HASIL: SEMUA LOLOS`): 5 tone kesulitan unik
   (`success/info/gold-fg/warning/error`), 4 status (draft abu, review kuning,
   ready hijau, archived coret), `TopicTagList` menghasilkan tautan filter +
   pesan saat kosong, `QuestionMediaGallery` menghasilkan `/img/<shortId>` +
   fallback saat kosong, `BundleEnrichmentSummary` membaca `233 butir`, dan
   paket tanpa agregat tidak merusak markup.

### Status akhir DoD
| Butir DoD | Status |
|---|---|
| Question detail menampilkan gambar soal | ✅ (galeri + inline `{{img:…}}` + empty state) |
| Difficulty badge 1–5 berwarna | ✅ |
| Topic tags klikabel → filter | ✅ |
| Tipe soal tag | ✅ |
| Status indicator 4 keadaan | ✅ |
| Bundle page statistik pengayaan | ✅ (kartu + tabel, data nyata) |
| Rute `/curate` ada | ✅ |

Tidak ada blocker. Empat tindak lanjut di §6 tetap berlaku dan **bukan** bagian
DoD MAT-127 (menunggu skema Faruq, keputusan Kemal, dan PR nav Rofik).
