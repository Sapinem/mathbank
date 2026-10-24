Audit selesai. Laporan ada di `MathBankAuditor/reports/2026-10-18/audit-react-19-actions-and-optimistic-ui.md`, terdaftar di `docs/PETA-DOKUMEN.md` (#31). Tidak ada kode aplikasi yang diubah.

## Verdict singkat

**Kepatuhan literal terhadap skill: rendah — tetapi sebagian besar bukan cacat.** Ada dua konflik kontrak yang harus disadari sebelum membaca laporan:

1. **§1 skill tidak berlaku.** Skill mengklaim "Next.js 16 punya React Compiler otomatis". Tidak benar di proyek ini: `babel-plugin-react-compiler` **tidak terpasang** (hanya *optional peer* di lockfile) dan `next.config.ts` tanpa `reactCompiler`. Larangan `useMemo` di `CONSTRAINTS #6` karena itu murni konvensi — constraint-nya sendiri sudah mengakui ini.
2. **§2/§3 (`useActionState`/`useFormStatus`) dilarang** oleh `ADR-0022`. Nol `'use server'` di seluruh `src/` adalah **kepatuhan**, bukan kelalaian. Memaksakannya ke MathBank akan membuang pipa `resolveActor → assertCan → rateLimit → Zod → audit`.

Jadi saya menilai *spirit*-nya (§4 + §5) — dan di sana ada temuan nyata.

## Temuan HIGH

- **R-01** — `Idempotency-Key`: server sudah lengkap mendukungnya (`wrapRoute({ idempotent: true })`), tapi **klien tidak pernah mengirim header itu (0 hasil grep)**. Editor soal dan aksi massal bisa membuat **data ganda**.
- **R-02** — Drag reorder paket **tidak** punya optimistic update. `onDragEnd` hanya memanggil `reorder.mutate()`; baris "melompat kembali" ke posisi lama selama round-trip. Ini justru kasus yang `useOptimistic`/`setQueryData` sasar — dan **diizinkan** (bukan Server Action).
- **R-04** — `setState` saat *render* di `BundleBuilder`, dengan guard hanya `bundle.id` → draft `instructions` bisa basi dan **menimpa perubahan server**.
- **R-10** — Tidak ada `<form>`/`type="submit"` untuk login & ganti-sandi: **Enter tidak mengirim**.

Ditambah 6 MEDIUM (kegagalan mutasi senyap, `ApiError` yang membuang `code`, dialog enrich yang bisa menampilkan proposal soal lain, dll.) dan LOW.

## Yang sudah baik — jangan disentuh
`wrapRoute` sebagai choke point tunggal, proyeksi anti-bocorkan `answer_key`, dan distribusi `isPending` per-baris di antrean telaah.

## Yang perlu Anda ketahui
- `pnpm typecheck` **lulus**. `pnpm lint` **gagal**: 7 error, **semuanya di `scripts/dev/**`**, bukan `src/**` — saya laporkan apa adanya, tidak dibulatkan.
- Saya **tidak** menjalankan `test`, `test:db`, `db:verify`, atau `build`; laporan tidak mengklaim hijau untuk gerbang itu.
- R-11/R-12 bergantung pada perilaku runtime TanStack Query yang saya baca dari dokumentasi pustaka, bukan direproduksi lewat tes.

Satu koreksi terhadap diri sendiri yang sudah saya tulis di temuan: klaim awal saya bahwa `bulk.isPending` "salah" **tidak akurat** — risiko sesungguhnya adalah absennya guard `if (isPending) return` dan absennya `Idempotency-Key`, bukan disabled-state yang keliru.
