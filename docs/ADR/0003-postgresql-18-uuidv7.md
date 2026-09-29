# ADR-0003 — PostgreSQL 18 + `uuidv7()` sebagai Primary Key

- **Status:** Diterima
- **Tanggal:** 2026-09-29
- **Pengambil keputusan:** Arsitek
- **Terkait:** `SKEMA-DB-DETAIL.md` §Konvensi, `L7-TINJAUAN-KRITIS-DATA.md`

## Konteks

QBank memakai `defaultRandom()` = `gen_random_uuid()` (UUIDv4). UUIDv4 acak penuh membuat penyisipan B-tree tersebar → index kurang rapi seiring pertumbuhan. PostgreSQL 18 menyediakan `uuidv7()` (berurutan waktu).

## Keputusan

- **Target database: PostgreSQL 18** (dev `:5433`).
- **PK `uuid` DEFAULT `uuidv7()`** untuk semua tabel domain.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| `bigserial` | Membocorkan jumlah entitas; sulit digabung lintas-sumber |
| UUIDv4 | Penyebaran index acak; urutan tak bermakna |
| ULID di aplikasi | Butuh dependensi & konvensi tambahan; PG 18 sudah punya native |

## Konsekuensi

**Positif:**
- Index B-tree lebih ramai-padat (better locality), insert lebih efisien.
- ID unik lintas-sumber tanpa koordinasi pusat.
- Urutan kronologis terbaca dari ID.

**Negatif / utang:**
- **Mengikat ke PG 18** — `uuidv7()` tak ada di versi lebih lama.
- **✅ DITERAPKAN 2026-09-29** (migrasi `0003_cloudy_thunderbolt.sql`): kode & DB kini `uuidv7()` (helper `uuidPk()` di `schema/_columns.ts`); `pnpm db:verify` memeriksa agar tak regresi.
- ID menyiratkan waktu pembuatan (minor info leak).

## Catatan

Perubahan dari QBank (temuan T17). Bila `uuidv7()` diadopsi, wajib lewat migrasi + `pnpm db:verify`.
