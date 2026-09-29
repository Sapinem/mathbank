# CONSTRAINTS.md — Batas Mutu MathBank

> Batas mekanis yang **wajib** dipenuhi. Exit gate: `pnpm check` harus **exit 0**.

## Kualitas Kode

1. **Zero type errors** — `pnpm typecheck` (tsc --noEmit) harus 0 error.
2. **Zero lint errors** — `pnpm lint` bersih (0 error, 0 warning).
3. **Coverage ≥ 85% statements** — untuk logika inti (service, engine, parser).
4. **Build sukses** — `pnpm build` exit 0.
5. **Install library saat perlu saja** — paket hanya dipasang saat milestonenya tiba (lihat `TUMPUKAN-TEKNOLOGI.md`). Tak menumpuk dependency di awal.

## Aturan React (React Compiler aktif)

6. **Dilarang `useMemo` / `useCallback`** — serahkan pada React Compiler.
7. **Dilarang `space-y-*`** — wajib `flex flex-col gap-*`.
8. **Dilarang manual `z-index`** — pakai token/layer.
9. Form wajib pakai `FieldGroup` + `Field`.

## Responsif (dari RENCANA-UI-MOBILE.md)

10. **UI wajib benar di desktop, tablet, DAN mobile** — bukan desktop saja.
11. **Touch target ≥ 44×44px**; jangan andalkan `hover:` (pakai `active:`/`focus-visible:`).
12. **`MathContent` wajib punya `overflow-x-auto`** — rumus lebar jangan memecah layout.
13. **Input mobile ≥ 16px** — cegah auto-zoom iOS.
14. **Batas kunci `lg`** — gaya mobile ditulis dulu (base), naikkan via `sm:`/`lg:`.

## Arsitektur (dari DESAIN-PER-LAPISAN-MATHBANK.md)

15. **L6 (engine) = fungsi murni** — tanpa DB, tanpa network.
16. **L5 (service) = fungsi biasa**, maks ~300 baris/file, tanpa repo layer.
17. **API = pembungkus route**, format respons tunggal (`{data}` / `{error:{code,message}}`).
18. **AI = konfigurasi** (di `app_settings`), bukan hard-code.
19. **Tak ada kode mati** — dibuat = dipakai & diuji.

## Keamanan

20. **LaTeX: `openin_any='p'`** (mitigasi LFI) — jangan diubah.
21. **Rahasia tidak di kode** — lewat ENV / `app_settings` terenkripsi.
22. **Validasi input via Zod** di semua boundary (API, MCP).
23. **`AUTH_DEV_BYPASS` hanya untuk dev** — default `false`; jangan diaktifkan di produksi.

## Konvensi

24. **Bahasa dokumen & komentar UI: Indonesia** (konvensi proyek).
25. **KaTeX: `\( ... \)` inline, `\[ ... \]` display** — dilarang `$`/`$$` di konten soal baru.
26. **Nama tabel & kolom: snake_case** (Drizzle).
