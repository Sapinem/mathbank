# RENCANA — Migrasi TypeScript 7 (ditunda)

> **Status:** 🔴 DITUNDA · **Milestone:** M14 (dicatat terpisah) · **Tanggal:** 2026-09-30
> **Keputusan:** user — "Tunda — TS7 terlalu baru/berisiko untuk app produksi".

---

## 1. Ringkasan

TypeScript **7.0.2** adalah rilis `latest` (per 2026-09-30); proyek ini memakai
**5.9.3**. TS 7 adalah **port native Go** ("tsgo") — beda mesin dari TS 5/6:

| Aspek | TS 5.9 (kini) | TS 7.0 |
|---|---|---|
| Implementasi | JS/TS (Node) | **Go** (native binary) |
| Kecepatan | baseline | klaim **~10×** lebih cepat |
| Perilaku tipe | acuan | **potensi beda** (rilis mayor) |
| Ekosistem | matang | lebih baru; sebagian tool/plugin menyusul |

## 2. Alasan DITUNDA

1. **Rilis mayor** — perilaku tipe bisa berubah; app produksi berisiko.
2. **Toolchain** — `eslint-config-next`, `vitest`, `tsx`, drizzle-kit perlu
   diverifikasi satu per satu.
3. **Nol manfaat langsung** — build/`tsc` saat ini tidak menjadi bottleneck nyata.
4. Prinsip proyek: **"praktik terbaik ≠ selalu versi terbaru"**.

## 3. Rencana bila dijalankan nanti (checklist)

1. Buat **branch** `chore/ts7` (jangan di `main`).
2. Bump `typescript` → `^7`; `pnpm install`.
3. Jalankan **seluruh gate**: `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage`,
   `pnpm test:db`, `pnpm build`.
4. Perbaiki error tipe baru (bila ada) — dokumentasikan tiap perubahan.
5. Bila **100% hijau**: merge. Bila tidak: **revert branch** & perbarui dokumen ini.

## 4. Pemicu evaluasi ulang

- TS 7.1+ stabil & ekosistem (ESLint/vitest/drizzle) menyatakan dukungan resmi.
- Ada kebutuhan nyata (mis. waktu `tsc` jadi penghambat).
