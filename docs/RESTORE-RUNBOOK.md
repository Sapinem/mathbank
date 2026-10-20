# RESTORE-RUNBOOK.md — Prosedur Pemulihan & Latihan Restore Drill

> **Status:** ✅ terbukti — latihan restore penuh **exit 0** (20 Okt 2026, dump 15,07 MB,
> 218 objek, 26 tabel, 11.889 soal pulih). Bukti mentah:
> `backups/restore-drill-<stamp>.json`.
> **Sifat:** dokumen hidup — perbarui bila mekanisme/skema berubah.
> **Prinsip:** *backup yang belum diuji-restore = bukan backup.*

Dokumen ini dipakai **saat insiden** (DB hilang/korup) dan **saat latihan berkala**.
Tidak perlu bertanya ke siapa pun: setiap langkah punya perintah + ekspektasi keluaran.

---

## 0. Ringkasan cepat

| Situasi | Perintah |
|---|---|
| Latihan rutin / bukti backup sehat | `pnpm restore:check` |
| Latihan + cek drift skema lengkap | `node scripts/restore-check.mjs --with-db-verify` |
| Pulihkan ke DB baru (insiden) | §3 (manual), lalu arahkan `DATABASE_URL` ke DB itu |
| Pulihkan **menimpa** DB produksi | §4 (hati-hati, ada gerbang konfirmasi) |

Waktu terukur di host ini (8 vCPU, load 9–14, disk SATA): **±6,4 menit** total
(createdb 13–96 s, `pg_restore` 39–125 s, verify 0,4–22 s). Jadi RTO database
untuk dump 15 MB realistis **< 10 menit**, bukan jam-jaman.

---

## 1. Prasyarat

| Kebutuhan | Cek |
|---|---|
| Klien PostgreSQL **≥ mayor server** | `pg_restore --version` harus ≥ versi server (server kini **18.6**) |
| `psql` di PATH | `psql --version` |
| Akses tulis ke server (boleh `CREATE DATABASE`) | role di `DATABASE_URL` |
| Ruang disk ≥ 3× ukuran DB | `df -h` (DB 88 MB, dump 15 MB) |
| `DATABASE_URL` di `.env` | `grep -c DATABASE_URL .env` |

> **Jebakan nyata di host ini:** `/usr/bin/pg_restore` = **17**, server = **18**.
> Klien 17 bisa membaca header arsip v18 tetapi **tidak** aman untuk restore penuh.
> `scripts/restore-check.mjs` otomatis memilih `/usr/lib/postgresql/18/bin/pg_restore`
> (mayor tertinggi). Saat manual, **pakai path lengkap** — jangan andalkan PATH.

---

## 2. Prosedur otomatis (disarankan)

```bash
cd /home/hari/projects/mathbank
node scripts/restore-check.mjs                     # arsip .dump terbaru di backups/
node scripts/restore-check.mjs backups/<file>.dump # arsip tertentu
node scripts/restore-check.mjs --with-db-verify    # + `pnpm db:verify` pada DB hasil restore
```

Yang dilakukan skrip:

| Fase | Aksi | Ekspektasi |
|---|---|---|
| 0. sapu | hapus sisa DB `mathbank_restore_*` | `· sisa DB sementara: … — dibersihkan` |
| 1. preflight | `pg_restore --list` | `218 objek` (dump 20 Okt 2026) |
| 2. createdb | `CREATE DATABASE mathbank_restore_<epoch>` | `✓ createdb` |
| 3. pg_restore | `--no-owner --no-acl --exit-on-error` | `✓ pg_restore`, tanpa keluaran galat |
| 4. verify | invarian SQL (lihat §5) | semua baris `✓` |
| 4b. banding | hitung baris di DB sumber | `11/11 tabel sama` |
| 5. cleanup | `DROP DATABASE … WITH (FORCE)` + cek sisa | `✓ Tak ada DB sementara tertinggal.` |

**Exit code:** `0` = dump terbukti dapat dipulihkan. `≠0` = jangan anggap backup sehat.

Bukti ditulis ke `backups/restore-drill-<stamp>.json` (durasi tiap fase, load average,
angka invarian, sisa DB). Lampirkan berkas ini saat melaporkan latihan.

---

## 3. Prosedur manual langkah-demi-langkah (insiden)

Semua perintah di bawah memakai `PGPASSWORD` lewat env, **bukan** argumen, agar
password tidak muncul di `ps`/history.

### 3.1 Siapkan variabel

```bash
cd /home/hari/projects/mathbank
set -a; . ./.env; set +a          # memuat DATABASE_URL
export PGHOST=$(node -e 'console.log(new URL(process.env.DATABASE_URL).hostname)')
export PGPORT=$(node -e 'console.log(new URL(process.env.DATABASE_URL).port||5432)')
export PGUSER=$(node -e 'console.log(decodeURIComponent(new URL(process.env.DATABASE_URL).username))')
export PGPASSWORD=$(node -e 'console.log(decodeURIComponent(new URL(process.env.DATABASE_URL).password))')
export PGRESTORE=/usr/lib/postgresql/18/bin/pg_restore
```

Ekspektasi: tidak ada keluaran. `echo $PGHOST $PGPORT $PGUSER` → `localhost 5433 mathbank`.

### 3.2 Pilih arsip & pastikan terbaca

```bash
DUMP=$(ls -t backups/*.dump | head -1); echo "$DUMP"
$PGRESTORE --list "$DUMP" | grep -vc '^;'
```

Ekspektasi: baris pertama menunjuk `.dump` terbaru; angka kedua **≥ 200**
(dump 20 Okt 2026 = **218**). Angka 0 / galat `could not read` = **arsip rusak**,
coba arsip sebelumnya di `backups/archive/`.

### 3.3 Buat DB kosong

```bash
TMP=mathbank_restore_$(date +%s); echo "$TMP"
psql -X -d postgres -c "CREATE DATABASE \"$TMP\""
```

Ekspektasi: `CREATE DATABASE`. Galat `already exists` → pakai nama lain.
Galat `permission denied` → role tidak punya hak createdb; minta DBA.

### 3.4 Restore

```bash
time $PGRESTORE -d "$TMP" --no-owner --no-acl --exit-on-error "$DUMP"
```

Ekspektasi: selesai tanpa keluaran galat dalam **39–125 detik** pada host ini.
`--exit-on-error` penting: tanpa itu `pg_restore` bisa selesai dengan exit 0
padahal sebagian objek gagal.

### 3.5 Verifikasi invarian inti

```bash
psql -X -d "$TMP" -tA -F'|' -c "
SELECT 'tables' k, count(*)::text v FROM information_schema.tables
 WHERE table_schema='public' AND table_type='BASE TABLE'
UNION ALL SELECT 'fks', count(*)::text FROM pg_constraint
 WHERE contype='f' AND connamespace='public'::regnamespace
UNION ALL SELECT 'indexes', count(*)::text FROM pg_indexes WHERE schemaname='public'
UNION ALL SELECT 'hnsw', count(*)::text FROM pg_indexes WHERE indexdef ILIKE '%hnsw%'
UNION ALL SELECT 'triggers', count(*)::text FROM pg_trigger WHERE NOT tgisinternal
UNION ALL SELECT 'questions', count(*)::text FROM questions
UNION ALL SELECT 'bundles', count(*)::text FROM bundles
UNION ALL SELECT 'pk_default', COALESCE((SELECT column_default FROM information_schema.columns
 WHERE table_name='questions' AND column_name='id'),'-')
UNION ALL SELECT 'orphan_options', (SELECT count(*)::text FROM question_options o
 LEFT JOIN questions q ON q.id=o.question_id WHERE q.id IS NULL);"
```

Ekspektasi (dump 20 Okt 2026):

| kunci | nilai | arti bila berbeda |
|---|---|---|
| `tables` | **26** | skema tak lengkap / arsip salah |
| `fks` | **20** | relasi hilang |
| `indexes` | **87** | indeks tak terpasang (restore terpotong) |
| `hnsw` | **1** | pgvector/HNSW hilang → pencarian vektor mati |
| `triggers` | **24** | invarian `updated_at`/audit/usage hilang |
| `questions` | **≥ 11.000** | isi tidak pulih |
| `bundles` | **≥ 500** | isi tidak pulih |
| `pk_default` | **uuidv7()** | regresi generator PK |
| `orphan_options` | **0** | integritas FK rusak |

Opsional, cek drift skema penuh:

```bash
DATABASE_URL="postgresql://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/$TMP" pnpm db:verify
```

Ekspektasi: `✓ Skema OK — tak ada drift.` (≈3–7 detik).

### 3.6 Bersihkan DB sementara

```bash
psql -X -d postgres -c "DROP DATABASE IF EXISTS \"$TMP\" WITH (FORCE)"
psql -X -d postgres -tAc "SELECT datname FROM pg_database WHERE datname LIKE 'mathbank\_restore\_%'"
```

Ekspektasi: `DROP DATABASE`; kueri kedua **tidak mengeluarkan baris apa pun**.
Kalau ada sisa, ulangi `DROP … WITH (FORCE)` — DB latihan yang tertinggal
memakan disk dan mengacaukan drill berikutnya.

---

## 4. Memulihkan **menimpa** DB produksi (insiden nyata)

> Hanya setelah §3 lulus pada DB sementara. Ini operasi merusak: data setelah
> dump akan hilang.

1. **Hentikan penulis** — hentikan aplikasi/worker (`pnpm dev`/systemd unit) agar
   tidak ada tulis selama restore.
2. **Simpan keadaan sekarang dulu** (walau korup):
   `pg_dump -Fc -d mathbank -f backups/pre-restore-$(date +%F-%H%M).dump`
3. **Rename, jangan drop**: `ALTER DATABASE mathbank RENAME TO mathbank_broken_<tanggal>`
   lalu `CREATE DATABASE mathbank`.
4. Jalankan §3.4–§3.5 dengan `-d mathbank`.
5. Nyalakan aplikasi, cek `/api/health`, lalu `pnpm db:verify`.
6. Setelah yakin, baru `DROP DATABASE mathbank_broken_<tanggal>`.

Perkiraan total downtime: **5–10 menit** untuk dump 15 MB (didominasi `pg_restore`).

---

## 5. Apa yang diperiksa (dan mengapa)

| Invarian | Kenapa penting |
|---|---|
| 26 tabel | Skema hasil restore sama dengan yang dipakai aplikasi |
| 20 foreign key | Relasi soal↔opsi↔bundel utuh, bukan data yatim |
| 87 indeks, 1 HNSW | Pencarian (termasuk vektor) tetap cepat setelah pulih |
| 24 trigger | Invarian `updated_at`, audit-immutable, usage-count tetap aktif |
| 3 CHECK | Batasan domain (`difficulty`, `level`) tidak hilang |
| PK `uuidv7()` | ID baru tetap time-ordered (PG 18) |
| 11 tabel berisi | Isi benar-benar pulih, bukan hanya kerangka kosong |
| Orphan = 0 | Integritas referensial hasil restore |
| Ekstensi `vector, pg_trgm, pgcrypto` | Fitur pencarian/trigram/enkripsi tersedia |

Catatan data: `question_topics` dan `question_tags` **0 baris di produksi**
(bukan akibat restore — DB sumber juga 0). Skrip melaporkannya tanpa menggagalkan
drill, tetapi angka itu perlu ditindaklanjuti sebagai isu data terpisah.

---

## 6. Jadwal drill yang diusulkan

Restore penuh butuh **±6 menit** CPU/IO nyata. Menjalankannya tiap hari
memboroskan kapasitas host bersama, jadi usulan:

| Drill | Frekuensi | Cara |
|---|---|---|
| Otomatis (arsip terbaru) | **bulanan**, tanggal 1 pukul 03:00 | cron di bawah |
| Manual penuh + `--with-db-verify` | sebelum migrasi berisiko & tiap rilis mayor | §2 |
| Uji arsip mingguan | triwulanan (pilih satu arsip `backups/archive/`) | §2 dengan argumen |

Contoh entri cron (belum dipasang — menunggu persetujuan pemilik host):

```cron
0 3 1 * * cd /home/hari/projects/mathbank && PATH=/home/hari/.local/bin:/usr/local/bin:/usr/bin:/bin BACKUP_LOG=/home/hari/projects/mathbank/backups/restore-drill.log /home/hari/.local/bin/node scripts/restore-check.mjs >>/home/hari/projects/mathbank/backups/restore-drill-cron.log 2>&1
```

Alasan **tidak** harian: (a) biaya ±6 menit CPU pada host 8 vCPU yang sudah
jenuh, (b) dump harian identik isinya sehingga drill harian tidak menambah
informasi, (c) yang perlu sering diuji adalah **prosedur**, dan prosedur berubah
hanya saat skema/migrasi berubah.

---

## 7. Troubleshooting

| Gejala | Sebab | Tindakan |
|---|---|---|
| `pg_restore: error: unsupported version (1.16) in file header` | klien lebih tua dari arsip | pakai `/usr/lib/postgresql/18/bin/pg_restore` |
| `FATAL: password authentication failed` | `PGPASSWORD` tak ter-set / salah decode | ulangi §3.1 |
| `could not connect … port 5433` | server mati | `systemctl status postgresql` / cek container |
| `CREATE DATABASE` menggantung lama (13–96 s) | I/O host jenuh (load > 10) | tunggu; bukan kegagalan |
| `pg_restore` sukses tapi tabel kosong | arsip dari DB lain / `-t` salah | cek `--list`, pakai arsip benar |
| `database "mathbank_restore_*" is being accessed` | koneksi menggantung | `DROP DATABASE … WITH (FORCE)` |
| Verify `tables: 25` | migrasi belum ikut ter-dump | jalankan `pnpm db:migrate` di DB hasil, lalu laporkan |

---

## 8. Riwayat latihan

| Tanggal | Arsip | Ukuran | Objek | Durasi | Load avg | Hasil | Catatan |
|---|---|---|---|---|---|---|---|
| 2026-10-20 11:54 WIB | `mathbank_2026-10-20-04-42-26.dump` | 15,07 MB | 218 | **384 s** (6,4 m) | 9,8–14,5 | **exit 0** | createdb 96 s, pg_restore 125 s, verify 22 s, db:verify 7 s; 11/11 tabel sama dengan sumber; tanpa sisa DB |
| 2026-10-20 11:48 WIB | idem | 15,07 MB | 218 | 223 s | 5,9–13,9 | exit 1 | gerbang baris kosong keliru menandai `question_topics`/`question_tags` (0 baris di sumber) — skrip diperbaiki |
| 2026-10-20 11:44 WIB | idem | 15,07 MB | 218 | 187 s | 7,0–15,9 | exit 1 | `users` bukan nama tabel (Better-Auth: `"user"`) — skrip diperbaiki |
| (sebelumnya) | — | 15 MB | — | >7 m lalu dihentikan | jenuh | tidak selesai | klien `pg_restore` 17 + `DATABASE_URL` password literal `***` |

---

## 9. Rujukan

- Skrip drill: `scripts/restore-check.mjs` (`pnpm restore:check`)
- Skrip backup: `scripts/backup-db.mjs` (`pnpm backup:db`), retensi 7 harian + arsip 30 hari
- Verifikasi skema: `scripts/db-verify.ts` (`pnpm db:verify`), `ADR-0007`
- Kebijakan backup & RPO/RTO: `docs/BACKUP-RECOVERY.md`
- Skenario insiden lain: `docs/RUNBOOK.md`
