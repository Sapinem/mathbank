# PROGRES OTONOM — Review per-Milestone

> **Konteks:** pemilik produk minta agent melanjutkan review M3→M12 otonom
> ("nanti kalau green lanjutin aja sampai milestone terakhir").
> Aturan main: tiap milestone **diverifikasi terhadap kenyataan** (kode/DB/tes/e2e),
> temuan dicatat di `REVIEW-PER-MILESTONE.md`, diperbaiki bila jelas, gate wajib
> hijau (tsc 0 · lint 0 · unit · e2e bila relevan) sebelum commit.
> **JANGAN** ubah schema/arsitektur tanpa persetujuan (AGENTS.md §2).

## Status

| Milestone | Review | Catatan |
|-----------|:------:|---------|
| M1 Skema DB | ✅ LULUS | 🔴 migrasi dari nol diperbaiki & terverifikasi |
| M2 Auth & Peran | ✅ LULUS | 🟠 matriks diselaraskan; 🟡 login/forbidden → utang M15 |
| M3 Tema & Shell | 🔄 berjalan | lihat temuan di bawah |
| M4 Bank Soal | ⏳ | |
| M5–M12 | ⏳ | |

## M3 — temuan sementara

- ✅ Mesin tema (`theme:build`) jalan; `defaultTheme="system"` + anti-flash benar
- ✅ Radix → Base UI **bersih total** (0 sisa, 18 file)
- ✅ Responsif **satu kode** (sidebar shadcn resmi, bukan kode terpisah);
  `useMediaQuery`/`useIsMobile` pakai `useSyncExternalStore` (hydration-safe)
- ✅ e2e tema 10/10 + responsif 6/6 lulus
- 🔴 **T-M3-1: klaim "Verifikasi WCAG otomatis" TIDAK ADA** — `scripts/theme/`
  hanya `build.ts` (konversi OKLCH), **tak ada** hitung kontras. `A11Y.md:23`
  & `:32` mencentang `[x]` "kontras terverifikasi mesin" tapi `:79` mengaku
  `[ ]`. **Perlu:** implementasi `theme:check` (hitung rasio kontras WCAG).
- 🟡 **T-M3-2:** variabel font mono dinamai `--font-geist-mono` padahal Roboto Mono.
- (audit shadcn selesai → commit `b05780c`)
