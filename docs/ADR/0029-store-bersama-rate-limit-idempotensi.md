# ADR-0029 — Rate limit & idempotensi memakai store PostgreSQL bersama

- **Status:** Diterima
- **Tanggal:** 2026-10-27
- **Pengambil keputusan:** pemilik produk + rencana remediasi API (Fase D)
- **Terkait:** ADR-0022 (`wrapRoute`), CONSTRAINT #4 (idempotensi), `docs/KONTRAK-API.md` §7

## Konteks

Rate limit dan proteksi `Idempotency-Key` disimpan di `Map` **di dalam proses**
(`MemoryStore`). Itu cukup untuk satu proses, tetapi salah begitu server berjalan
lebih dari satu:

1. **Kuota berlipat.** Dua replika = dua bucket terpisah → batas efektif
   `batas × jumlah instance`. Penyerang cukup menyebar permintaan.
2. **Restart mengosongkan bucket.** Deploy atau crash memberi kuota baru
   seketika — tepat saat layanan paling rapuh.
3. **Idempotensi bocor.** Dua klik ganda yang mendarat di dua proses berbeda
   sama-sama lolos klaim dan menjalankan mutasi dua kali. Ini kelas bug yang
   justru ingin dicegah header `Idempotency-Key`.

Antrean ingest memperbesar risikonya: `POST /api/ingest/commit` berat (unduh
gambar, tulis banyak soal), jadi duplikasi di sana mahal.

## Keputusan

**State dipindah ke PostgreSQL** — dua tabel, tanpa dependensi baru:

| Tabel | Isi | Pemilik |
|---|---|---|
| `rate_limit_buckets` | `key` (PK), `tokens`, `updated_at` | `PgRateLimitStore` |
| `idempotency_keys` | `key` (PK), `fingerprint`, `status`, `body`, `in_flight`, `expires_at` | `PgIdempotencyStore` |

Empat hal yang membuat ini benar (bukan sekadar "pindah ke DB"):

1. **Atomik, bukan baca-lalu-tulis.** Token bucket dihitung di dalam
   `INSERT … ON CONFLICT DO UPDATE`: baris yang bentrok dikunci UPSERT, isi ulang
   dihitung dari `updated_at` baris itu, lalu dipotong bila cukup. Tidak ada
   jendela antara "baca" dan "tulis".
2. **Klaim idempotensi satu pemenang.** `INSERT … ON CONFLICT DO NOTHING` +
   `RETURNING`: hanya satu permintaan mendapat baris. Pengambil-alihan entri
   kedaluwarsa juga bersyarat (`WHERE expires_at <= now`), jadi dua pengambil
   tidak bisa sama-sama menang.
3. **Antarmuka jadi async.** `RateLimitStore.take` dan `IdempotencyStore.claim`
   mengembalikan Promise. Ini konsekuensi jujur dari I/O jaringan — bukan
   disembunyikan di balik API sinkron.
4. **Dipasang sekali saat server menyala.** `installSharedStores()` dipanggil
   `src/instrumentation.ts`, bukan saat modul route diimpor. Unit test dan dev
   tanpa `DATABASE_URL` tetap memakai `MemoryStore` yang deterministik; build
   tidak membuka koneksi.

### Perilaku saat DB bermasalah

| Proteksi | Perilaku | Alasan |
|---|---|---|
| Rate limit | **fail-open** (izinkan + log `RATE_LIMIT_STORE_DEGRADED`) | Pagar tambahan, bukan pagar keamanan. Menolak semua permintaan saat DB goyang mematikan layanan lebih parah daripada tanpa batas sementara. |
| Idempotensi | **fail-closed** → **503 `IDEMPOTENCY_UNAVAILABLE`** | Tanpa store, duplikat tak bisa dibuktikan. Menjalankan mutasi buta-buta berisiko menulis dua kali. |

## Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| Redis / Upstash | Keputusan pemilik produk: tanpa layanan tambahan. PostgreSQL sudah ada dan sudah jadi sumber kebenaran. |
| In-memory + sticky session | Mengikat pengguna ke satu instance, merusak load balancing, dan tetap mengosongkan bucket saat restart. |
| `SELECT … FOR UPDATE` + `UPDATE` terpisah | Benar tapi 3 round trip per permintaan di jalur panas. UPSERT mencapai hal yang sama dalam 1 pernyataan. |
| Menyimpan state di `app_settings` | Tabel key-value untuk konfigurasi; mencampur state transien ke sana mengaburkan makna dan mengunci baris yang dibaca aplikasi. |
| Membiarkan per-proses, didokumentasikan saja | Persis pola "jalan tapi tidak benar": batas tampak ada, padahal berlipat tiap replika. |

## Konsekuensi

**Positif**

- Batas berlaku **lintas instance** dan **selamat dari restart**.
- Klaim idempotensi tak bisa dimenangkan dua proses sekaligus — dibuktikan uji
  paralel terhadap PostgreSQL nyata.
- Tak ada layanan baru untuk dioperasikan; backup DB yang ada sudah mencakupnya.

**Biaya & batas**

- **Satu round trip DB tambahan per permintaan ber-rate-limit.** Pada beban
  normal ini kecil, tetapi rate limit kini ikut bergantung pada kesehatan DB.
  Itulah harga fail-open: bila DB mati, pembatasan efektif berhenti.
- **Tabel tumbuh** dan harus dipangkas: `prune()` berjalan tiap 60 detik dari
  `runPruneOnce()` (kini `await`). Tanpa itu, baris mati menumpuk.
- **Batas 255 karakter** untuk `key`; kunci dibentuk dari `scope:aktor|ip`
  sehingga aman, tetapi skema menolak kunci panjang tanpa peringatan.
- `rate_limit_buckets` **tidak** memakai trigger `updated_at` (sengaja) — ditulis
  UPSERT di jalur panas; dicatat di `drizzle/manual/db_safety.sql`.
- Menambah tabel berarti angka invarian berubah (26 → 28) di
  `src/lib/db/schema-expectations.ts`.

## Catatan Verifikasi

| Perintah | Hasil |
|---|---|
| `pnpm backup:db` | dump 72,40 MB, 216 objek terverifikasi `pg_restore` |
| `pnpm db:generate` | `drizzle/0024_closed_talon.sql` — hanya 2 CREATE TABLE + 2 index, tanpa baris hantu |
| `pnpm db:migrate` + `db:migrate` DB uji | keduanya lulus (termasuk `db_safety.sql`) |
| `pnpm db:verify` di kedua DB | `✓ Skema OK — tak ada drift` (28 tabel, 26 trigger) |
| `npx vitest run --config vitest.db.config.mts src/lib/api/stores-pg.db.test.ts` | **13/13 lulus**, termasuk 20 permintaan paralel → tepat 5 lolos, dan 2 klaim paralel → tepat 1 `fresh` |
| `npx vitest run src/lib/api/idempotency.test.ts` | **6/6 lulus** (fail-closed → 503, handler tak dijalankan) |
| `pnpm test:db` | **298 lulus** (26 berkas) |
| `npx vitest run --coverage` | **1365 lulus**, cakupan 90.37 / 81.83 / 92.02 / 92.85 |
| DB baru → `db:migrate` → `db:verify` (CONSTRAINTS #24) | 14 langkah migrasi lulus, `✓ Skema OK — tak ada drift`, lalu DB dibuang |
| `pnpm lint`, `lint:authz` (76/51), `openapi:check`, `theme:check`, `lint:names` | lulus |

**Catatan proses (penting):** `pnpm typecheck` sempat melaporkan **bersih** padahal
lima pemanggil `checkRateLimit` masih memakai bentuk sinkron. Penyebabnya
`tsconfig.tsbuildinfo` basi (`incremental: true`) — cache tidak menganggap
perubahan tanda tangan lintas berkas. Setelah `rm tsconfig.tsbuildinfo`,
kelima error muncul dan diperbaiki (`health`, `ready`, `mcp`, `quick-login`,
`img/[shortId]`). Pelajarannya: setelah mengubah tanda tangan fungsi yang dipakai
lintas lapisan, **hapus cache** atau jalankan `tsc` tanpa incremental sebelum
percaya hasilnya.

Uji atomisitas sengaja memakai PostgreSQL nyata: `MemoryStore` tak bisa
membuktikan apa pun tentang balapan antar-proses.
