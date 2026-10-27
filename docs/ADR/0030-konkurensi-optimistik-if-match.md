# ADR-0030 — Konkurensi optimistik lewat `version` + `If-Match`

- **Status:** Diterima
- **Tanggal:** 2026-10-27
- **Pengambil keputusan:** pemilik produk + rencana remediasi API (Fase E)
- **Terkait:** ADR-0022 (`wrapRoute`), CONSTRAINT #36 (penjagaan balapan status), `docs/KONTRAK-API.md` §8

## Konteks

Sebelumnya API tidak punya cara bagi klien untuk berkata "saya menyunting versi
yang saya baca". Setiap `PATCH` menimpa apa pun yang ada di DB. Dua penelaah yang
membuka soal yang sama — satu memperbaiki naskah, satu memperbaiki kunci — akan
saling menimpa, dan yang kalah **tidak pernah tahu** perubahannya hilang. Tidak
ada galat, tidak ada log, tidak ada jejak: hasilnya soal yang benar menurut satu
orang dan salah menurut yang lain.

`updated_at` tidak bisa dipakai sebagai penanda versi. Resolusinya mikrodetik dan
dua UPDATE berurutan dalam satu transaksi bisa mendapat nilai yang sama; lebih
buruk, klien hanya punya string waktu untuk dibandingkan, tanpa arti "saya melihat
revisi ke-3".

## Keputusan

**Kolom `version` (integer, default 1) pada 8 tabel, dinaikkan trigger DB, dan
`If-Match` WAJIB pada setiap mutasi baris sejak rilis pertama.**

### Tabel berversi

| Tabel | Rute yang menuntut `If-Match` |
|---|---|
| `questions` | `PATCH/DELETE /api/questions/{id}`, `PATCH …/flag`, `PATCH …/status`, `DELETE …/permanent` |
| `bundles` | `PATCH/DELETE /api/bundles/{id}`, `POST/PUT …/items`, `DELETE …/items/{itemId}` |
| `events` | `PATCH/DELETE /api/events/{id}` |
| `media_assets` | `PATCH/DELETE /api/media/{shortId}` |
| `sources` | `PATCH/DELETE /api/sources/{id}` |
| `tags` | `PATCH/DELETE /api/tags/{id}` |
| `topics` | `PATCH/DELETE /api/topics/{id}` |
| `apikey` | `DELETE /api/system/agent-keys/{id}` |

21 operasi. **Sengaja dikecualikan:** `DELETE /api/mcp` (tidak menyentuh baris) dan
`PATCH /api/settings` (singleton — semantik "tulis terakhir menang" memang yang
diinginkan untuk pengaturan admin). Pembuatan baris (`POST`) tidak butuh `If-Match`:
tidak ada versi sebelumnya untuk dilindungi.

### Tiga hal yang membuat ini benar

1. **Kenaikan versi di trigger, bukan di kode.** Satu fungsi `bump_version()` +
   satu trigger `BEFORE UPDATE` per tabel (`drizzle/manual/db_safety.sql` §8).
   Penulisnya banyak: service, skrip seed, ingest, SQL manual. Satu UPDATE yang
   lupa menaikkan `version` membuat ETag basi selamanya dan `If-Match` berubah
   dari proteksi menjadi jebakan.
2. **`version` dari klien SELALU ditimpa.** Trigger menulis `NEW.version :=
   OLD.version + 1`. Klien yang mengirim `version: 999` di body tidak dapat
   mematikan proteksi — nilai itu bukan masukan, melainkan otoritas server.
3. **Perbandingan ada di `WHERE`, bukan di memori.** `UPDATE … WHERE id = ? AND
   version = ? RETURNING id`; 0 baris → 412. Membandingkan hasil `SELECT` lalu
   menulis tanpa syarat menyisakan jendela antara baca dan tulis — persis kelas
   bug yang CONSTRAINT #36 sudah tutup untuk status.

### Kontrak HTTP

| Keadaan | Status | `error.code` |
|---|---|---|
| `If-Match` tidak dikirim | **428** | `PRECONDITION_REQUIRED` |
| `If-Match` tidak cocok | **412** | `PRECONDITION_FAILED` (+ `details.currentVersion`) |
| Bentuk header tak dikenal / weak validator | **400** | `INVALID_IF_MATCH` |
| Cocok | 200/204 | — |

`GET` satu sumber daya memancarkan `ETag: "<version>"` dan menyertakan `version`
di body. `If-Match: *` diterima (berarti "apa pun versinya"), tetapi `W/"3"`
**ditolak**: RFC 9110 §13.1.1 mensyaratkan perbandingan kuat, dan menerima weak
validator akan memberi rasa aman yang palsu.

### Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| `updated_at` sebagai ETag | Resolusi bisa bertabrakan; klien tidak punya nomor revisi yang bisa dioper. |
| `If-Match` opsional (hanya diperiksa bila dikirim) | Tidak ada yang berubah untuk klien lama — proteksinya nol, karena klien lama justru yang paling berbahaya. |
| Kenaikan versi di kode aplikasi | Semua penulis harus ingat; satu yang lupa merusak invarian secara permanen dan senyap. |
| Baca dulu, bandingkan di memori, lalu tulis | Jendela balapan tetap ada; ini yang diperbaiki, bukan diulang. |
| Kolom `revision` per tabel anak (`bundle_items`) | ETag yang bermakna adalah versi AGREGAT; anak yang berubah harus membatalkan ETag induk. |
| 409 untuk versi basi | 409 sudah dipakai untuk konflik domain/FSM (CONSTRAINT #36); mencampurnya membuat klien tak bisa membedakan "coba lagi" dari "perbaiki isinya". |

## Konsekuensi

- **Breaking change.** Setiap klien yang memanggil `PATCH`/`DELETE` tanpa
  `If-Match` kini menerima 428. Ini disengaja dan disetujui: dirilis bersama
  langkah pertama, bukan ditambahkan belakangan.
- **`wrapRoute` bertambah dua opsi**: `ifMatch` (menuntut header) dan `etagFrom`
  (memancarkan ETag). Keduanya ikut tercatat di deklarasi route, sehingga
  `public/openapi.json` memuat parameter `If-Match` + respons 412/428 secara
  otomatis — dokumentasi tidak bisa menyimpang dari perilaku.
- **`RouteContext.expectedVersion` menyempit secara tipe**: pada route ber-
  `ifMatch: true` nilainya `number | "*"`, bukan `number | "*" | undefined`.
  Service tetap menerima `undefined` untuk pemanggil internal (bulk, seed, tes).
- **Delapan trigger baru** → `schema-expectations.ts` naik 26 → 34, dan
  `REQUIRED_TRIGGERS` menyebut kedelapan namanya.
- **Setiap UPDATE pada tabel berversi menaikkan versi**, termasuk perubahan yang
  datang dari trigger lain (mis. `sync_question_grades`). Itu benar: isi soal
  memang berubah, jadi ETag-nya harus berubah.
- **Biaya penyimpanan & tulis kecil**: satu integer per baris, satu operasi
  penambahan di trigger per UPDATE.

## Verifikasi

| Perintah | Hasil |
|---|---|
| `pnpm db:generate` | `drizzle/0025_good_slipstream.sql` — 8 `ALTER TABLE … ADD COLUMN`, tanpa baris hantu |
| `pnpm db:migrate` + DB uji | keduanya lulus; `db_safety.sql` §8 memasang 8 trigger |
| `pnpm db:verify` di kedua DB | `✓ Skema OK — tak ada drift` (28 tabel, 34 trigger) |
| `src/lib/api/version.test.ts` | **14/14** — parsing header, weak ditolak, 412 membawa `currentVersion` |
| `src/lib/api/version-if-match.db.test.ts` | **8/8** — 428 tanpa header, 412 basi, ETag↔version, dua penulis paralel → tepat satu 200 |
| `pnpm test:db` | **306 lulus** (27 berkas) |
| `pnpm openapi:check` | 76 operasi / 51 path; 21 operasi ber-`If-Match`, 4 ber-`ETag` |

**Catatan proses:** `pnpm typecheck` sempat melaporkan bersih padahal `etagFrom`
menyimpulkan `TResult = unknown`. Penyebabnya sama seperti ADR-0029 —
`tsconfig.tsbuildinfo` basi. Pelajaran yang sama berlaku: setelah mengubah tanda
tangan generik di `wrapRoute`, hapus cache sebelum percaya hasil `tsc`.
