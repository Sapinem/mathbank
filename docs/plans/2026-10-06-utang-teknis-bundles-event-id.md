# UTANG TEKNIS — `bundles.event_id` harus dihapus (event hanya milik SOAL)

- **Status:** ⏳ **UTANG TEKNIS — BELUM DIPERBAIKI** (keputusan pemilik, 2026-10-06)
- **Prioritas:** sedang (data sudah benar di `questions`; ini soal kebersihan skema)
- **Keputusan pemilik:** *"Event id hanya milik soal, bundle gak punya event_id."*

## Masalah

`event_id` saat ini ada di **dua** tabel:

| Tabel | Kolom | Status |
|---|---|---|
| `questions` | `event_id`, `event_year`, `event_subtest`, `event_item_number`, `event_notes` | ✅ **BENAR** — sesuai ADR-0010 |
| `bundles` | `event_id`, `year` | ❌ **SALAH** — harus dihapus |

ADR-0010 menyatakan **soal** yang menyimpan provenance (event + tahun), karena:

1. **Satu soal bisa dipakai di banyak paket** (dedup via `content_hash`).
   Terbukti di data: **112 soal** dipakai di >1 bundle.
2. **Satu paket bisa memuat soal dari asal berbeda** → event di paket jadi ambigu.
3. Event melekat pada **butir soal**, bukan pada wadah paket.

## Bukti dari data (2026-10-06)

- `questions.event_id` terisi: **1.325 / 3.201**
- `bundles.event_id` terisi: **49 / 116** ← terlanjur diisi oleh backfill
- **91 soal** punya `event_id` berbeda dari bundle-nya → **semuanya wajar**
  (91/91 soal itu memang dipakai di >1 bundle; 0 kasus aneh). Verifikasi:
  `scripts/dev/verify-event-sharing.ts`.

Contoh: satu soal Integral Tentu dipakai di **"Soal Integral Tentu… (latihan,
tanpa event)"** *dan* **"Soal TKA Matematika SAINTEK UTBK-SBMPTN 2019
(UTBK-SNBT)"**. Event di **soal** = benar.

## Rencana perbaikan (nanti)

1. Hapus kolom `bundles.event_id` dari skema (`src/lib/db/schema/bundle.ts`),
   index `idx_bundles_event_id`, dan relasi `event: one(events, …)`.
2. Migrasi: `ALTER TABLE bundles DROP COLUMN event_id` (backup dulu).
3. Bersihkan pemakaian `bundles.eventId` di service/UI/API.
4. Pertimbangkan `bundles.year` (juga ada di bundle) — tinjau apakah ikut
   dihapus atau dipertahankan sebagai metadata paket.
5. Perbarui ADR-0010 / buat ADR baru bila perlu.

## Catatan data yang "terlanjur"

- `bundles.event_id` **49 baris** terisi — **tidak** dibatalkan sekarang
  (keputusan pemilik: *"Yaudah deh yang udah terlanjur banyak"*).
- Data **soal sudah benar** dan tidak terpengaruh; `questions.event_id` adalah
  sumber kebenaran.
- Backfill (`scripts/dev/backfill-event.ts`) menulis ke **keduanya**; saat
  perbaikan dilakukan, hentikan penulisan ke `bundles`.

## Berkas terkait
- Skema: `src/lib/db/schema/bundle.ts` (baris 32, 51, 82)
- Backfill: `scripts/dev/backfill-event.ts`
- Verifikasi: `scripts/dev/verify-event-sharing.ts`
- Temuan: `docs/plans/2026-10-06-temuan-event-dan-wacana-defantri.md`
- ADR: `docs/ADR/0010-*.md`
