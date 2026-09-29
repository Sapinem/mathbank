# ADR-0007 — DB wajib direproduksi dari file migrasi

- **Status:** Diterima
- **Tanggal:** 2026-09-29
- **Pengambil keputusan:** Lead engineer
- **Terkait:** `drizzle/`, `scripts/db-verify.ts`, `CONSTRAINTS.md` #24–26

## Konteks

Audit 2026-09-29 menemukan objek DB yang **hanya ada di DB lokal, bukan di file migrasi**:
- 21 trigger `updated_at` ada di DB, **nol** di file migrasi.
- 0 CHECK constraint & 0 index HNSW padahal dokumen mengklaimnya ada.

Akibatnya, `pnpm db:migrate` di DB **bersih** (CI/staging/prod) menghasilkan skema **tanpa invarian** — rusak diam-diam.

## Keputusan

**DB harus dapat direproduksi sepenuhnya dari file.** Aturan:

1. **Objek apa pun** (tabel, trigger, constraint, index) yang dibutuhkan DB **wajib ada di file** — jika tidak, itu **cacat**.
2. **`pnpm db:verify`** memeriksa jumlah tabel/CHECK/trigger/HNSW + objek kritis; **gagal bila drift**.
3. **SQL tulis-tangan** (yang tak punya snapshot drizzle-kit) diletakkan di **`drizzle/manual/`**, diterapkan lewat skrip idempotent (`pnpm db:safety`), **di-chain** dari `pnpm db:migrate`.
4. Migrasi drizzle-kit (`drizzle/*.sql`) **wajib punya** `meta/<tag>_snapshot.json` — kalau tidak, drizzle-kit crash diam-diam (pelajaran mahal).

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| Biarkan objek hanya di DB | Tak repro; CI/prod rusak; "works on my machine" |
| Semua lewat drizzle-kit | Trigger/fungsi kompleks tak nyaman di-generate; butuh SQL tangan |
| Dump penuh DB sebagai migrasi | Rapuh; tak terlacak sebagai perubahan |

## Konsekuensi

**Positif:**
- DB bersih + `pnpm db:migrate` → skema **lengkap** (terbukti: 27 tabel, 2 CHECK, 1 HNSW, 25 trigger, `db:verify` hijau).
- Drift terdeteksi **sebelum** jadi masalah.

**Negatif / utang:**
- Dua jalur migrasi (drizzle-kit + manual) → perlu disiplin & dokumentasi (dilakukan).
- `db:verify` butuh DB hidup (tak jalan di CI tanpa PG).
- Objek baru wajib diperbarui di **tiga** tempat: schema Drizzle, `drizzle/manual/db_safety.sql`, dan `scripts/db-verify.ts` (expectations).

## Catatan

Pelajaran teknis: `drizzle-kit migrate` **diam-diam gagal** bila ada entry `_journal.json` tanpa snapshot. Karena itu file tulis-tangan dipisah ke `drizzle/manual/`.
