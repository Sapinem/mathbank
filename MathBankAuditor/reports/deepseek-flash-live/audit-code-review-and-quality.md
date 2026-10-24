## Hasil audit singkat — MathBank v2

**Status: ⚠️ Lulus dengan catatan.** Kode produksi (`src/`) sehat, tetapi exit gate `pnpm check` dan CI **merah**. Tidak ada kode target yang saya ubah (sesuai peran auditor).

| Pemeriksaan | Hasil |
|---|---|
| `pnpm typecheck` | ✅ 0 error |
| `npx eslint src` | ✅ 0 error (4 warning) |
| `pnpm lint` (repo penuh) | 🔴 7 error, 42 warning |
| `pnpm lint:names` | 🔴 50 pelanggaran nama |
| `pnpm test:coverage` | 🔴 960 lulus / 1 gagal |
| `any`, `useMemo`, `space-y-*` di luar `ui/` | ✅ nol |

### Temuan utama

1. **P1 — Gate & CI diblokir `scripts/dev/` (342 skrip scratch).** Semua 7 error lint (`prefer-const`, `no-require-imports`) dan semua 50 pelanggaran nama (#28b: `cari-*.ts`, `lihat-soal.ts`, …) ada di sana. Tes `check-names.test.ts` gagal karenanya, sehingga `pnpm check` berhenti sebelum typecheck/build → push ke `main` gagal. Hanya 9 berkas yang ter-track git; sisanya untracked tanpa ignore. Perbaikan cepat: ignore `scripts/dev/` di `eslint.config.mjs` + `SKIP_DIRS` di `check-names.mjs`, atau pindahkan keluar repo.
2. **P2 — Dua himpunan hook referensi paralel.** `use-reference.ts` (`["reference","sources"]`) vs `use-taxonomy-refs.ts` (`["sources"]`) mendefinisikan `useSources`/`useEvents` untuk data yang sama. Mutasi sumber/event tidak meng-invalidate cache filter soal → daftar basi hingga 30 menit. `apiFetch` lokal juga menduplikasi `api()` di `fetcher.ts`.
3. **P2 — Sisa dead code MAT-39.** `collection-service.ts`, `contracts/collection.ts` (0 importer; merujuk `use-collections.ts` yang sudah tidak ada) dan 3 route `/api/collections*` yang hanya 410.
4. **P3 — Berkas besar**: `question-editor.tsx` 1.023, `enrich.ts` 900, `clean.ts` 841 baris; `z-10` manual masih ada (pelanggaran #8).

### Yang membaik sejak audit 5 Okt
SSRF (`dns.lookup` + redirect manual), rate-limit `/api/mcp`, `slugify` terpusat, dan `taxonomy-service.ts` (kini 44 baris) sudah ditutup. Nol `any`.

Laporan lengkap dengan bukti: `MathBankAuditor/reports/AUDIT-KUALITAS-KODE-SINGKAT-2026-10-17.md` (terdaftar di indeks README).
