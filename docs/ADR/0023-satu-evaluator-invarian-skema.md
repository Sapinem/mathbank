# ADR-0023 — Satu evaluator invarian skema di modul murni; hitungan tabel mengecualikan sisa migrasi

- **Status:** Diterapkan
- **Tanggal:** 2026-10-24
- **Pengambil keputusan:** Pemilik proyek (persetujuan atas temuan review), dieksekusi oleh agen
- **Terkait:** ADR-0007 (DB reproduktif dari file), ADR-0022 (pipa API), `CONSTRAINTS.md` #16/#19, `AGENTS.md` §3

## Konteks

Gerbang invarian skema punya tiga konsumen yang memeriksa hal yang sama terhadap DB:
`src/lib/db/invariants.ts` (health/ready + guard startup), `scripts/db-verify.ts`
(gerbang `pnpm check`), dan `scripts/snapshot-metrics.ts` (dokumen acuan metrik).

Sebelum keputusan ini, ketiganya **menyalin** angka dan aturannya sendiri:

- Angka yang sama tertulis di dua tempat dengan nilai **berbeda**: `invariants.ts`
  menuntut 27 tabel / 25 trigger, `db-verify.ts` menuntut 26 / 24. Tidak ada yang
  menang, jadi "gerbang" bergantung pada berkas mana yang dipanggil.
- Salinan di `snapshot-metrics.ts` hanya memeriksa empat angka — tanpa trigger
  wajib, CHECK wajib, dan daftar tabel terlarang — tetapi dokumen yang dihasilkannya
  mencetak "sama dengan `pnpm db:verify`". Snapshot bisa hijau saat `db:verify` merah.
- DB dev berisi tabel sisa migrasi `question_options_mat146_backup`. Karena hitungan
  memakai `>= 26` dan tabel sisa ikut terhitung, **sisa itu menjadi kelonggaran tepat
  satu tabel**: hilangnya satu tabel skema sungguhan tidak memerahkan gerbang mana pun.
- Daftar "tabel terlarang" hanya berisi `question_options`, sehingga invarian negatif
  yang baru ditambahkan selalu melaporkan `[]` untuk satu-satunya sisa yang benar-benar ada.

Keputusan ini lahir dari review kode (skill `ce-code-review`, 7 reviewer) atas
`HEAD~6..working tree`; empat temuan berbeda menunjuk akar yang sama.

## Keputusan

1. **Satu modul murni memiliki angka dan aturannya.** `src/lib/db/schema-expectations.ts`
   (tanpa impor apa pun) mengekspor `EXPECTED_INVARIANTS`, daftar trigger/CHECK wajib,
   daftar tabel terlarang, `isForbiddenTable()`, dan `evaluateInvariants()`.
   Ketiga konsumen **memanggil** fungsi itu; tidak ada yang menyalin perbandingan.
2. **Hitungan `tables` mengecualikan sisa migrasi** (`right(table_name, 7) <> '_backup'`)
   di ketiga query. Dengan begitu `tables: 26` berarti tepat 26 tabel skema, bukan
   "26 atau lebih, termasuk sampah".
3. **Satu predikat untuk "objek terlarang":** nama di `FORBIDDEN_TABLES` **atau** cocok
   pola `/_backup$/`. Gerbang dan laporan snapshot memakai predikat yang sama.
4. **Semantik `>=` dipertahankan** untuk angka (migrasi aditif tidak boleh memerahkan
   gerbang), tetapi kelonggaran struktural dari tabel sisa dihapus lewat butir 2.
5. **Proyeksi HTTP ikut pindah ke modul murni.** `InvariantReport` dan `toInvariantsDto()`
   tinggal di sana agar `/api/health` dan `/api/ready` memakai satu proyeksi — dan agar
   route bisa diuji tanpa memuat koneksi DB.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| Biarkan tiga salinan, sinkronkan manual | Sudah terbukti gagal: dua salinan sudah menyimpang (27/25 vs 26/24) tanpa ada yang menyadari |
| Pindahkan evaluator ke `invariants.ts` | Modul itu mengimpor `db`; skrip yang hanya butuh angka ikut membuka koneksi kedua dan bergantung pada `DATABASE_URL` saat import |
| Ubah `>=` menjadi `===` (persamaan ketat) | Migrasi aditif yang sah akan memerahkan gerbang; yang bocor bukan semantiknya, melainkan tabel sisa yang ikut dihitung |
| Drop `question_options_mat146_backup` lebih dulu, kode tak diubah | Menutupi masalah, bukan memperbaikinya: sisa migrasi berikutnya akan mengulang kelonggaran yang sama |
| Tambahkan `question_options_mat146_backup` ke `FORBIDDEN_TABLES` saja | Menyelesaikan satu instance, bukan kelasnya; pola `*_backup` menangkap sisa berikutnya tanpa perlu ingat mendaftar |

## Konsekuensi

**Positif:**
- Ambang gerbang kembali bermakna: hilangnya satu tabel skema memerahkan health, ready,
  `db:verify`, dan snapshot sekaligus.
- Snapshot tidak bisa lagi hijau saat `db:verify` merah.
- Menambah objek terlarang = satu suntingan di satu berkas.
- `pnpm db:verify` mengukur tabel nyata: DB dev melaporkan `tables: 26`, bukan 27.

**Negatif / utang:**
- Gerbang sempat memerahkan DB dev (`question_options_mat146_backup`), dan itu
  disengaja: gerbang akhirnya melihat objek yang selama ini tak terlihat. Tindak
  lanjutnya sudah dijalankan **2026-10-24** atas persetujuan pemilik: tabel diarsipkan
  ke `backups/question_options_mat146_backup_20261024-014228.dump` (43.245 baris,
  dipulihkan ke DB sementara untuk membuktikan arsipnya utuh) lalu di-DROP.
  `pnpm db:verify` kini hijau di DB dev dan DB uji. Konsekuensinya: gerbang ini
  akan memerahkan build lagi bila sisa migrasi baru muncul — memang itu tujuannya.
- Gerbang tetap tidak bisa membedakan "tabel A diganti tabel B" (jumlah sama). Deteksi
  per-nama hanya ada untuk trigger dan CHECK, bukan tabel — lihat `REQUIRED_TABLES`
  sebagai usulan yang belum diambil.
- Dua definisi "terlarang" masih hidup berdampingan: predikat pola `*_backup` di modul
  murni, dan konvensi penamaan itu sendiri. Sisa dengan pola lain (`*_old`, `*_bak`)
  tidak tertangkap.

## Catatan

- Commit: `a3e8924` (gerbang invarian), `b53af4b` (ekstraksi commit batch + pengerasan probe).
- Berkas kunci: `src/lib/db/schema-expectations.ts`, `src/lib/db/invariants.ts`,
  `scripts/db-verify.ts`, `scripts/snapshot-metrics.ts`.
- Tes: `src/lib/db/schema-expectations.test.ts` (murni, 8 kasus),
  `src/lib/db/invariants.db.test.ts` (DB uji: sisa migrasi dilaporkan **dan** tidak
  menambah hitungan tabel).
- Verifikasi saat keputusan diambil: `pnpm test` 1124 lulus · `pnpm test:db` 24 berkas
  lulus · `tsc`/`lint`/`build` bersih · `pnpm db:verify` DB uji hijau, DB dev merah
  hanya karena tabel sisa (bukti gerbang bekerja).
- Verifikasi setelah tindak lanjut (2026-10-24): tabel sisa diarsipkan + di-DROP,
  `pnpm db:verify` **hijau di kedua DB** (26 tabel / 24 trigger / 3 CHECK / 1 HNSW),
  `invariants.db.test.ts` 2/2 lulus, snapshot §4 bersih. Skrip perbaikan opsi
  (`fix-double-encoded-options.ts`) ikut diperbaiki: memakai `sql.json()` dan
  memverifikasi hasil lewat `RETURNING jsonb_typeof(...)` — sebelumnya melaporkan
  sukses tanpa mengubah satu baris pun.
