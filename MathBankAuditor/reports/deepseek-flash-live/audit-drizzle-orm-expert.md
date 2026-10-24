Audit selesai. Laporan lengkap tersedia di:

**`MathBankAuditor/reports/2026-10-17/AUDIT-DRIZZLE-ORM.md`** (597 baris, 22 temuan)

## Ringkasan

Pendekatan: saya membaca seluruh lapisan data (13 file skema, client, helper, 16 migrasi + snapshot, `drizzle/manual/*.sql`, ~20 service, route API), lalu **memverifikasi empiris** ke DB hidup PostgreSQL 18.6 (11.889 soal), ke `PgDialect` Drizzle, dan `tsc --noEmit` (0 galat). Setiap temuan diberi label bukti 🟢 empiris / 🟡 kode / ⚪ teoretis.

**Yang sudah baik:** tidak ada celah SQL injection (semua nilai ter-*bind* `$n`), proyeksi kolom mencegah kebocoran `answer_key`, transaksi di jalur utama, penjagaan balapan optimistik, pemetaan 23505→409, *partial unique index* untuk `contentHash`.

**Temuan paling penting:**

| ID | Tingkat | Inti |
|---|---|---|
| R-01 | 🔴 Kritis | **Data korup terverifikasi:** 57 soal dengan label opsi duplikat (`A,B,C,D,D`) dan 16 soal `single_choice` ber-kunci ganda. Skema tidak punya `UNIQUE(question_id,label)`; Zod juga tidak memvalidasi. |
| R-02 | 🔴 Kritis | Drift skema↔DB↔migrasi: `chk_media_assets_short_id` & `uq_media_short_id` hanya di skrip manual (bentuk constraint vs index berbeda). `pnpm db:push` yang diekspos dapat **menghapus** jaminan itu. |
| R-03/04 | 🟠 Tinggi | `onConflictDoNothing` tanpa `returning()` menelan kegagalan tautan bundle (soal dibuat tapi tak tertaut); `MAX(order_index)+1` tanpa UNIQUE → urutan bentrok saat konkuren. |
| R-05/06/07 | 🟠 Tinggi | TOCTOU `uniqueSlug`, `duplicateBundle` tak atomik, status paket lewat PATCH tanpa FSM/`validateBundle`. |
| R-08–R-22 | 🟡/🟢 | Validasi `parentId` hilang saat update, solusi di-reset (metadata verified hilang), trigger `usage_count` O(n²), 0/11.889 soal ber-embedding (mode semantik diam-diam tanpa filter), paginasi tanpa tiebreak, pool tanpa timeout, index tak terpakai. |

Skor kepatuhan terhadap skill: **±78%**. Bagian 5 laporan memuat urutan perbaikan per sprint beserta kode/snippet SQL yang disarankan, dan Bagian 6 mencatat semua perintah verifikasi agar temuan dapat direproduksi.
