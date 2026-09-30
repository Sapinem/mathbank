# VERIFIKASI — Audit M7 (Paket Soal)

> **Pemicu:** melanjutkan audit M7 (satu-satunya dokumen yang masih ⏳ belum diverifikasi).
> **Metode:** verifikasi tiap klaim ke kode + **uji live lewat-route per peran** (HTTP).
> **Ringkas:** struktur & sebagian besar klaim **akurat** (14 tes DB ✅, RESTRICT ✅,
> duplikasi ✅, validasi ✅). Ditemukan **1 klaim berlebihan + 2 bug nyata** (T-M7-2, T-M7-3).

---

## A. Klaim yang TERVERIFIKASI ✅

| Klaim | Bukti |
|---|---|
| `bundle-service.ts` CRUD + slug unik (`-2`,`-3`) | `uniqueSlug()` benar (slug hanya di antara paket aktif) ✅ |
| Item: tambah/hapus/urut | `addItem`/`removeItem`/`reorderItems` ada ✅ |
| RESTRICT hapus soal terpakai | Live: hapus soal di paket **aktif** → **409** ✅ |
| Duplikasi paket | `duplicateBundle()` menyalin metadata + item ✅ |
| Validasi paket (tanpa kunci = warning) | `validateBundle()` benar (`valid` tak terpengaruh kunci) ✅ |
| 14 Test Suite DB | `bundle-service.db.test.ts` = **14 `it()`** ✅ |
| UI Builder + Sheet mobile | `bundle-builder.tsx` ada; `DesktopOnly` sudah dibuang ✅ |
| Proyeksi aman (`canSeeAnswerKey`) | `listBundleItems(id, actor)` benar ✅ |

---

## B. TEMUAN

### 🟠 T-M7-1 — Klaim "Deduplikasi Stimulus 1×" BERLEBIHAN (overstatement)
Dokumen (§1.2) menyatakan: *"Jika sebuah soal anak dimasukkan ke dalam paket, baris
stimulus induknya (`role='stimulus'`) disimpan **tepat 1 kali**"* — menyiratkan
**otomasi** (memasukkan anak → induk stimulus ikut ditambahkan sekali).

**Faktanya:** `addItem()` **tidak** punya logika stimulus apa pun — ia hanya menolak
duplikat via `UNIQUE(bundle_id, question_id)` lalu insert. "1×" **hanya** efek samping
constraint: pemanggil **harus manual** menambah stimulus dengan `{ role: "stimulus" }`
(seperti di tes: `addItem(b.id, stimulus.id, admin, { role: "stimulus" })`). Tidak ada
"auto-insert induk stimulus untuk N anak".

**Dampak:** dokumen menyesatkan pembaca tentang adanya fitur otomatis. **Perbaikan =
nyatakan apa adanya** (dedup = invarian UNIQUE + konvensi `role`, bukan otomasi).

### 🟠 T-M7-2 — `reorderItems` menerima daftar PARSIAL → `orderIndex` DUPLIKAT (bug nyata)
`reorderItems` menyetel `orderIndex = i+1` **hanya** untuk id yang dikirim; id lain
dibiarkan. Bila klien mengirim **subset**, posisi bentrok.

**Bukti live:** paket 4 item (`order 1,2,3,4`); `PUT /items` dengan **2 dari 4** id
(item ke-3 & ke-4) → **200 OK**, tapi hasil: `orderIndex = [1, 1, 2, 2]` → **DUPLIKAT
& urutan ambigu**.

Tambahan: loop update **tanpa `db.transaction`** → bila gagal di tengah, urutan
tinggal separuh (inkonsisten).

**Perbaikan:** (a) **wajibkan** `itemIds` = **seluruh** item paket (tolak subset 400),
atau (b) renormalisasi **seluruh** item dalam transaksi. + bungkus transaksi.

### 🟠 T-M7-3 — Paket TERARSIP masih memblokir hapus soal (RESTRICT abadi; bug nyata)
`isQuestionUsedInBundles`/`bundlesUsingQuestions` (`bundle-service.ts:495/507`)
**tidak** memfilter `deletedAt`. Bandingkan `listBundles`/`getBundle`/`uniqueSlug`
yang **selalu** `isNull(bundles.deletedAt)`.

**Bukti live:** soal di paket aktif → hapus = **409** (benar). Paket **diarsipkan**
(hilang dari semua daftar/UI). Hapus soal **lagi** → **tetap 409** *"Soal ini dipakai
di paket soal — keluarkan dari paket dulu."* Padahal paketnya sudah terarsip & **tak
bisa dibuka** → **soal mustahil dihapus** (dead-end). Pengguna **tak punya jalan keluar**.

**Perbaikan:** RESTRICT hanya berlaku untuk paket **aktif** (`isNull(bundles.deletedAt)`)
di kedua fungsi itu (mengikuti kebijakan yang sudah dipakai `listBundles`).

---

## C. Catatan (tak masuk temuan)
- **Slug unik** benar: hanya bentrok dengan paket aktif, jadi arsip tidak "menyandera" slug.
- **`archiveBundle`** hanya soft-delete paket (item dibiarkan) — konsisten dgn soft-delete;
  masalahnya ada di T-M7-3 (RESTRICT tak sadar arsip), bukan di sini.

## D. Kesimpulan
Struktur M7 & fitur intinya **nyata dan bekerja**; klaim dokumen **mayoritas akurat**,
kecuali **T-M7-1** (klaim otomasi stimulus berlebihan). Dua bug **nyata** yang luput:
**T-M7-2** (reorder parsial → urutan rusak) & **T-M7-3** (RESTRICT abadi setelah arsip).
Keduanya persis kelas cacat yang sama: *"fitur ada, tapi perilaku di jalur nyata tak diuji"*.

## E. STATUS PERBAIKAN (2026-09-30) — ✅ SELESAI
- **T-M7-2 ✅ DIPERBAIKI:** `reorderItems` kini **menolak daftar parsial/duplikat**
  (`ConflictError`) & menulis ulang urutan dalam **transaksi**. **Terbukti:** parsial
  1-dari-2 → **409**, urutan tetap `[1,2]` (dulu `[1,1]`).
- **T-M7-3 ✅ DIPERBAIKI:** `isQuestionUsedInBundles`/`bundlesUsingQuestions` + enforcement
  di `question-service` (delete & hard-delete) kini **hanya paket AKTIF**
  (`innerJoin bundles + isNull(deletedAt)`). **Terbukti:** hapus soal setelah paket
  diarsip → **200** (dulu 409 abadi).
- **T-M7-1 ✅ DIDOKUMENTASIKAN:** §1.2 audit M7 dikoreksi (bukan otomasi).
- **Tes DB:** 14 → **18** (+4). **Pelajaran → `CONSTRAINTS.md` #45–46.**


*Lihat juga: `docs/audit/M7-PAKET-SOAL.md`, `src/lib/services/bundle-service.ts`,
`src/app/api/bundles/[id]/items/route.ts`.*
