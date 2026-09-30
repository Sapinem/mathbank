# CONSTRAINTS.md — Batas Mutu MathBank

> Batas mekanis yang **wajib** dipenuhi. Exit gate: `pnpm check` harus **exit 0**.

## Kualitas Kode

1. **Zero type errors** — `pnpm typecheck` (tsc --noEmit) harus 0 error.
2. **Zero lint errors** — `pnpm lint` bersih (0 error, 0 warning).
3. **Coverage ≥ 85% statements** — diukur via `pnpm test:coverage` (bagian dari `pnpm check`).
   - Cakupan diskop ke **logika murni + keamanan + komponen kustom teruji** yang dapat diuji tanpa DB/HTTP: `auth/**`, `fsm/question-fsm`, `contracts/question`, `display/labels`, `api/route-wrapper`, `api/rate-limit`, `db/projections/question`, `hooks/use-media-query`, dan komponen kustom teruji (`question-card`, `page-header`, `skip-link`, `sidebar-user`).
   - **Ini sengaja bukan angka proyek keseluruhan**: service/route/hook/komponen (butuh DB/HTTP) diuji lewat **integrasi DB** (`pnpm test:db`, 21 tes) + **e2e** (`e2e/`, 41 tes). Ketika mengutip angka coverage, **sebutkan lingkupnya** (mis. "97,7% pada 10 file logika murni") — jangan klaim "coverage proyek".
   - **Jangan turunkan ambang**; naikkan bertahap saat cakupan bertambah.
4. **Build sukses** — `pnpm build` exit 0.
5. **Install library saat perlu saja** — paket hanya dipasang saat milestonenya tiba (lihat `TUMPUKAN-TEKNOLOGI.md`). Tak menumpuk dependency di awal.

## Aturan React (React Compiler aktif)

6. **Dilarang `useMemo` / `useCallback`** — serahkan pada React Compiler.
   - **Pengecualian: `src/components/ui/**`** (komponen **vendor** shadcn — bukan kode kita). Aturan ini berlaku untuk kode yang kita tulis; vendor dibiarkan apa adanya agar mudah di-update dari registry.
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
23. **`AUTH_DEV_BYPASS` hanya untuk dev** — default `false`; pagar keras `NODE_ENV !== "production"` di `resolve.ts` menjamin bypass **mati total** di produksi.

## Database (integritas & reproduktibilitas)

24. **DB harus bisa direproduksi dari file** — `pnpm db:migrate` di DB kosong wajib menghasilkan skema penuh (tabel + trigger + invarian + index). Objek yang hanya ada di DB lokal (bukan di file) = **cacat**.
25. **`pnpm db:verify` harus hijau** — memeriksa jumlah tabel/CHECK/trigger/HNSW & objek kritis; jalankan setelah perubahan skema. Gagal = drift.
26. **Migrasi drizzle-kit wajib punya snapshot** — file `.sql` yang ditulis tangan ditaruh di `drizzle/manual/` dan diterapkan lewat skrip (`pnpm db:safety`), JANGAN dicampur ke alur drizzle-kit.
27. **Invarian "lunak" (bergantung keadaan/transisi) dijaga di service**, bukan CHECK keras — mis. `ready` wajib `answer_key` adalah guard `assertReady` (422), bukan constraint, agar soal tetap boleh dibuat tanpa kunci.

## Konvensi

28. **Bahasa dokumen & komentar UI: Indonesia** (konvensi proyek).
28b. **Nama file, folder, route (URL), & identifier teknis: INGGRIS.** Label teks yang dilihat pengguna tetap Indonesia. Contoh: folder `src/app/(app)/questions/`, URL `/questions`, komponen `bank-soal-view.tsx` boleh dipertahankan bila belum dirapikan; **route baru wajib Inggris** (mis. `/change-password`, `/bundles/[id]/print`).
29. **KaTeX: `\( ... \)` inline, `\[ ... \]` display** — dilarang `$`/`$$` di konten soal baru.
30. **Nama tabel & kolom: snake_case** (Drizzle).
31. **Setiap dokumen wajib terdaftar di `docs/PETA-DOKUMEN.md`** — dengan status (✅/🟡/🔴/🟠/🟢/📦). Tak ada dokumen berstatus implisit.
32. **Keputusan arsitektural besar → ADR** di `docs/ADR/` (satu keputusan = satu berkas; jangan hapus, tandai "digantikan").
33. **Endpoint mutasi & daftar wajib punya rate limit** — set opsi `rateLimit` di `wrapRoute` (`src/lib/api/rate-limit.ts`). Route publik tanpa batas = cacat keamanan.
34. **Jangan `.select()` tanpa kolom di jalur baca API** — itu `SELECT *`, yang membocorkan `answer_key`, `embedding*`, `aiTagged*`. Pakai proyeksi `questionColumns()`/`optionColumns()` (`src/lib/db/projections/question.ts`). Kunci hanya untuk viewer berwenang (`canSeeAnswerKey`).
