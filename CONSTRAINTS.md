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

## Aturan React (konvensi memoization)

6. **Dilarang `useMemo` / `useCallback`** — konvensi proyek demi kesederhanaan (komputasi langsung saat render).
   - **Pengecualian: `src/components/ui/**`** (komponen **vendor** shadcn — bukan kode kita). Aturan ini berlaku untuk kode yang kita tulis; vendor dibiarkan apa adanya agar mudah di-update dari registry.
   - **Alasan jujur (dikoreksi 2026-09-30):** React Compiler **BELUM aktif** di proyek ini (tak ada `reactCompiler` di `next.config.ts`, `babel-plugin-react-compiler` tak terpasang) — jadi larangan ini **konvensi**, bukan efek compiler. Bila React Compiler diaktifkan kelak (saat terukur ada masalah performa render), alasannya jadi benar otomatis. **`useMemo` boleh dipakai bila terukur ada masalah & didokumentasikan.**
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
28b. **Nama file, folder, route (URL), & identifier teknis: INGGRIS — TANPA KECUALI.** Label teks yang dilihat pengguna tetap Indonesia (mis. `STATUS_LABELS = { draft: "Draf" }`). Contoh benar: folder `src/app/(app)/questions/`, URL `/questions`, komponen `question-bank-view.tsx`, fungsi `createQuestion`. Contoh **SALAH**: `pengaturan-view.tsx`, `telaah-view.tsx`, `bank-soal-view.tsx`, URL `/pengaturan`. **Tidak ada pengecualian** "boleh dipertahankan" — file/route lama yang berbahasa Indonesia WAJIB diganti. Dijaga otomatis oleh `pnpm lint:names` (skrip `scripts/check-names.mjs`) yang gagal bila ada nama file/folder/route ber-kata Indonesia. **Aturan berlaku untuk nama baru DAN perbaikan nama lama.**
29. **KaTeX: `\( ... \)` inline, `\[ ... \]` display** — dilarang `$`/`$$` di konten soal baru.
30. **Nama tabel & kolom: snake_case** (Drizzle).
31. **Setiap dokumen wajib terdaftar di `docs/PETA-DOKUMEN.md`** — dengan status (✅/🟡/🔴/🟠/🟢/📦). Tak ada dokumen berstatus implisit.
32. **Keputusan arsitektural besar → ADR** di `docs/ADR/` (satu keputusan = satu berkas; jangan hapus, tandai "digantikan").
33. **Endpoint mutasi & daftar wajib punya rate limit** — set opsi `rateLimit` di `wrapRoute` (`src/lib/api/rate-limit.ts`). Route publik tanpa batas = cacat keamanan.
34. **Jangan `.select()` tanpa kolom di jalur baca API** — itu `SELECT *`, yang membocorkan `answer_key`, `embedding*`, `aiTagged*`. Pakai proyeksi `questionColumns()`/`optionColumns()` (`src/lib/db/projections/question.ts`). Kunci hanya untuk viewer berwenang (`canSeeAnswerKey`).
35. **JANGAN pasang izin ber-`own` di gerbang `permission` route** tanpa `ownerId` — `assertCan(actor, perm)` tanpa `ownerId` **selalu menolak** peran ber-`own` (guru/penelaah/agen). Untuk operasi yang izinnya bergantung objek (mis. transisi status soal: `setReady`/`archive`/`edit`+owner), **jangan** gerbang di route — tegakkan **di service** yang punya `ownerId`. Bug kelas ini (T-M4-3) mematikan alur telaah tanpa terdeteksi karena tes umumnya memanggil service, bukan route. **KAMBUH (2026-10-01, audit MathBankAuditor)**: `questions/[id]/route.ts` memasang `question:edit`/`question:delete` → guru 403 pada soal sendiri; diperbaiki + dikunci tes regresi `src/lib/api/question-authz.db.test.ts`. **Cek tiap kali menambah `permission:` di route: apakah izinnya ber-`own`?**

    **Diperluas (2026-10-26, Fase A audit API):** otorisasi kini **dideklarasikan**, bukan
    disimpulkan dari komentar. Setiap method `wrapRoute` **wajib** memuat `authz` — tanpa itu
    `typecheck` gagal — dengan empat bentuk:
    - `{ kind: "route", permission }` — gerbang izin di route (izin **tidak boleh** ber-`own`
      untuk peran mana pun; dicek terhadap matriks, bukan daftar statis);
    - `{ kind: "service", enforcedIn, routeGate? }` — otoritas di service yang punya `ownerId`;
      `enforcedIn` = `path.ts:namaFungsi` dan **diverifikasi** memuat `assertCan(`/
      `assertBundle*`/`hasRole(`/`ForbiddenError` supaya komentar tak bisa basi;
    - `{ kind: "authenticated" }` — cukup login, tanpa izin khusus;
    - `{ kind: "public", reason }` — tanpa login, **wajib** beralasan dan path-nya disetujui
      di `PUBLIC_ROUTES` (`src/lib/api/route-inventory.ts`).
    Route yang sengaja tidak memakai `wrapRoute` wajib terdaftar di `MANUAL_ROUTES` dengan
    alasan. Semua ini ditegakkan `pnpm lint:authz` (`scripts/check-authz.ts`) — masuk
    `pnpm check`. **Dua bug hidup ditutup bersamaan:** (a) `taxonomy:manage` &
    `reference:manage` bernilai `own` padahal tabel `topics`/`tags`/`sources`/`events` tak
    punya kolom pemilik → 14 endpoint 403 ke guru/penelaah/agen; kini `yes`; (b) `machine`
    403 pada antrean ingest sendiri karena memakai `question:view` (`machine: "no"`) → izin
    khusus `ingest:queue:read`, `question:view` tetap tertutup untuk mesin.
36. **Transisi status/operasi baca-lalu-tulis wajib penjagaan balapan** — `UPDATE … WHERE id = ? AND status = <from>` + cek baris terpengaruh (`.returning()`); 0 baris → `ConflictError` 409. Jangan baca-lalu-tulis tanpa syarat status.
37. **Tes wajib menyentuh JALUR NYATA, bukan hanya service** — uji lewat-route per peran (admin/guru/penelaah) untuk alur multi-peran. Bug gerbang otorisasi hanya muncul di jalur route.
38. **Ubah `parentId` pada hierarki → WAJIB propagasi kolom turunan (`level`) ke SELURUH subtree**, dalam **satu transaksi**. Jangan hanya update node yang dipindah (T-M5-2). Pakai snapshot in-memory + `db.transaction`.
39. **Audit log operasi update WAJIB `action: "update"`** — jangan copy-paste dari create (`action: "create"`, "…dibuat"). Kesalahan label merusak audit trail (T-M5-1).
40. **`slugify(name, maxLength)` WAJIB menyertakan batas kolom tujuan** — `NFKD` bisa **memperpanjang** nama (ligatur `ﬃ`→`ffi`), jadi `slice(0,255)` bisa menulis ke kolom `varchar(100)` → error PG 500. Batas: `tags`=100, `events.code`=50, lain 255. Buang `-` ekor **sesudah** potong.
41. **`"use cache"`/`cacheComponents` = HANYA untuk data yang boleh basi** — `revalidateTag(t,'max')` bersifat *stale-while-revalidate* (jendela basi beberapa detik); `updateTag` (read-your-own-writes) hanya di Server Action. **JANGAN** cache daftar referensi yang dimutasi via Route Handler. Guard auth **jangan** dibungkus `<Suspense>` (menghilangkan 307 server).
42. **Ambang dedup dua-tingkat WAJIB benar secara logika** — bila `near < exact`, syarat `s ≥ exact` **selalu disubsumsi** `s ≥ near` → ambang `exact` jadi **logika mati**. Zona *near* (mis. 0.85–0.98) = duplikat **hanya bila penalaran sama** (`normReasoning(a)===normReasoning(b)`); penalaran beda → **pertahankan keduanya**. Jangan tulis kondisi yang membuat salah satu ambang tak berpengaruh (T-M6-1).
43. **Pustaka tanpa konsumen produksi = "belum terintegrasi", bukan "Lulus"** — `fusion.ts` (RRF+dedup) dibangun mendahului M10; audit yang menandainya ✅ menyesatkan. Nyatakan status apa adanya (T-M6-2).
44. **Setiap dokumen di `docs/audit/` WAJIB punya §Catatan Verifikasi** — blok di akhir dokumen berisi: verifikator, metode, yang terverifikasi benar, & koreksi (bila ada), menautkan dokumen `docs/VERIFIKASI-*.md`. Status baris dokumen juga ditandai (✅/⚠️) bila ada koreksi. Jangan biarkan kesimpulan lama ("LULUS 100%") berdiri tanpa catatan.
45. **`reorderItems` (atau setara) WAJIB daftar LENGKAP** — jangan terima subset atau id duplikat; bila tidak, `order_index` bisa bentrok (mis. `[1,1,2,2]`) → urutan ambigu. Selalu **tolak subset** (409/400) & bungkus penulisan ulang urutan dalam **transaksi** (T-M7-2).
46. **RESTRICT (blokir hapus) WAJIB hanya menghitung induk AKTIF** — `isQuestionUsedInBundles`/`bundlesUsingQuestions` (dan kueri inline di `deleteQuestion`/`hardDeleteQuestion`) **harus** `innerJoin bundles + isNull(deletedAt)`. Jika tidak, entitas terarsip **menyandera** anaknya → anak mustahil dihapus (dead-end) (T-M7-3).
