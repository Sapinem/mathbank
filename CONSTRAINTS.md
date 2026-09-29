# CONSTRAINTS.md — Batas Mutu MathBank

> Batas mekanis yang **wajib** dipenuhi. Exit gate: `pnpm check` harus **exit 0**.

## Kualitas Kode

1. **Zero type errors** — `pnpm typecheck` (tsc --noEmit) harus 0 error.
2. **Zero lint errors** — `pnpm lint` bersih.
3. **Coverage ≥ 85% statements** — untuk logika inti (service, engine, parser).
4. **Build sukses** — `pnpm build` exit 0.
5. **Install library saat perlu saja** — paket hanya dipasang saat milestonenya tiba (lihat `TUMPUKAN-TEKNOLOGI.md`). Tak menumpuk dependency di awal.

## Aturan React (React Compiler aktif)

5. **Dilarang `useMemo` / `useCallback`** — serahkan pada React Compiler.
6. **Dilarang `space-y-*`** — wajib `flex flex-col gap-*`.
7. **Dilarang manual `z-index`** — pakai token/layer.
8. Form wajib pakai `FieldGroup` + `Field`.

## Arsitektur (dari DESAIN-PER-LAPISAN-MATHBANK.md)

9. **L6 (engine) = fungsi murni** — tanpa DB, tanpa network.
10. **L5 (service) = fungsi biasa**, maks ~300 baris/file, tanpa repo layer.
11. **API = pembungkus route**, format respons tunggal (`{data}` / `{error:{code,message}}`).
12. **AI = konfigurasi** (di `app_settings`), bukan hard-code.
13. **Tak ada kode mati** — dibuat = dipakai & diuji.

## Keamanan

14. **LaTeX: `openin_any='p'`** (mitigasi LFI) — jangan diubah.
15. **Rahasia tidak di kode** — lewat ENV / `app_settings` terenkripsi.
16. **Validasi input via Zod** di semua boundary (API, MCP).

## Konvensi

17. **Bahasa dokumen & komentar UI: Indonesia** (konvensi proyek).
18. **KaTeX: `\( ... \)` inline, `\[ ... \]` display** — dilarang `$`/`$$`.
19. **Nama tabel & kolom: snake_case** (Drizzle).
