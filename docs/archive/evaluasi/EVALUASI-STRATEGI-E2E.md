# EVALUASI STRATEGI TES E2E — MathBank

> **Status:** usulan (menunggu keputusan pemilik produk).
> **Konteks:** e2e Playwright (browser) di dev server menghasilkan *flake*
> berulang di lokal (kegagalan `net::ERR_ABORTED` / "element not found" yang
> berpindah-pindah tiap run). Dokumen ini menimbang ulang pendekatan.

## 1. Masalah yang diamati

Gejala nyata di lingkungan dev (~20 rute, dev server satu proses):

| Percobaan | Hasil |
|-----------|-------|
| Playwright lawan **dev server** (default) | 0 → 12 → 23 → 4 → 2 → 1 gagal (**fluktuatif**) |
| Playwright lawan **build produksi** | 39 gagal (env/guard/CSP tak siap) |

Akar masalah:
1. **Dev server meng-compile rute on-demand.** Saat 2 worker paralel menghantam
   rute yang belum di-compile, request di-abort → `net::ERR_ABORTED`.
2. **Lingkungan lokal berbagi resource** dengan server lain (Hermes dll).
3. Satu proses Next.js dev melayani **semua** tes → titik tunggal kewalahan.

Perbaikan sebagian (bertahap): bug **performa nyata** ditemukan & diperbaiki —
`updateTopic` PATCH **1815 ms → 67 ms** (query loop → snapshot in-memory, 27×).

## 2. Referensi best practice (riset)

- **Next.js resmi:** "We recommend running your tests against your *production
  code*… `npm run build` + `npm run start`." Dev server → flaky.
- **Playwright skill (testdino):** lokal `npm run dev` + `reuseExistingServer`;
  CI `build && start`. **Jangan** build produksi tiap run lokal (lambat).
- **jsmastery:** "Always test against the production build" — dev server punya
  HMR/log yang tak ada di produksi → flaky/menyesatkan.

**Kesimpulan referensi:** browser e2e yang andal = lawan **build produksi**,
bukan dev. Tapi itu menuntut konfigurasi env/guard/CSP yang tepat.

## 3. Referensi QBank (proyek produksi nyata di `q.iyo.my.id`)

Fakta penting (dibaca langsung dari repo `~/projects/qbank`):

- **QBank TIDAK memakai Playwright / browser e2e sama sekali.**
- Validasi kualitas = `npx tsc --noEmit` + `pnpm vitest run` + `gitleaks`.
- **95 file tes Vitest** (`tests/`), termasuk `e2e-workflow.test.ts` yang menguji
  **alur end-to-end lewat service/API langsung** (bukan browser):
  AI ingest → audit log → approval → multi-source → aset → ekspor Moodle.
- Deploy = **systemd user service** (`qbank.service`, port 1906), bukan
  `pnpm start` manual.
- Konfigurasi Vitest: 2 project — `unit` (node) & `components` (jsdom).

**Artinya:** proyek yang sudah terbukti stabil di produksi mengandalkan tes
**alur-via-service + komponen jsdom**, dan **tidak** menanggung beban browser e2e.

## 4. Rekomendasi

### Opsi A — Selaraskan dengan QBank (REKOMENDASI)
Pensiunkan browser e2e; ganti dengan:
1. **Tes alur via Vitest** (seperti `e2e-workflow.test.ts`): panggil service &
   route handler langsung → uji seluruh alur CRUD/FSM/izin lintas-lapisan.
   Sudah sebagian ada (`question-service.db.test.ts`, `topic-service.db.test.ts`).
2. **Tes komponen jsdom** untuk UI kritis (login, editor, tabel).
3. **Smoke test produksi** (read-only) untuk memverifikasi deploy.

*Untung:* andal (tanpa browser), cepat, selaras dengan QBank yang terbukti.
*Rugi:* tak menangkap regresi tata letak/moused di browser sungguhan.

### Opsi B — Pertahankan e2e, tapi lawan build produksi
Perbaiki portal 3100 agar menjalankan `build && start` dengan env lengkap
(`AUTH_DEV_BYPASS`, `DEMO_LOGIN`, guard) + CSP dev yang benar. Lalu set
`retries: 2` di CI.

*Untung:* uji browser sungguhan. *Rugi:* build tiap run (lambat), perlu
menjaga agar env e2e tak bocor ke produksi.

### Opsi C — Hibrida
Opsi A sebagai basis (stabil) + sedikit e2e browser (hanya alur paling kritis:
login + buat soal) dijalankan **jika** build produksi tersedia.

## 5. KEPUTUSAN (2026-09-30): Opsi A dipilih ✅

Pemilik produk memilih **Opsi A — selaras QBank**. Yang sudah dikerjakan:

1. **Tes alur API** `src/lib/api/flow.db.test.ts` (10 tes): memanggil route
   handler langsung — topik CRUD (POST/PATCH/DELETE, siklus 409, hapus ber-anak
   409), autentikasi 401, izin 403, validasi 400, rate-limit 429, soal 200.
   → `pnpm test:db`: **58 lulus** (dari 48), **8,5 detik** (vs e2e berjam-jam).
2. **Smoke produksi** `scripts/smoke-prod.ts`: `pnpm smoke:prod` (7 cek,
   read-only). Terbukti menangkap backend tumbang (502) → lalu 7/7 hijau.
3. **E2E browser dipensiunkan** dari gerbang: `e2e/` → `e2e-manual/`,
   `pnpm e2e` → `pnpm e2e:manual` (manual saja).
4. **Deploy systemd** `~/.config/systemd/user/mathbank.service` (pola QBank,
   port 1234, `Restart=always`) — server tak lagi mudah mati.
5. **Bug performa nyata** diperbaiki: `updateTopic` PATCH **1815 ms → 67 ms**.

## 6. Usulan lanjutan (opsional, bertahap)

1. Tes komponen jsdom untuk halaman kritis (login, editor) — utang T4.
2. Tes hook (L3) — utang T3.
3. Pertahankan sedikit e2e browser (`pnpm e2e:manual`) untuk rilis besar, bila perlu.

## 7. Catatan temuan (tetap berguna terlepas dari pilihan)

- 🐛 **Performa:** `updateTopic` PATCH 27× lebih lambat dari perlu (SUDAH DIPERBAIKI).
- 📌 **Deploy:** pertimbangkan systemd user service (port tetap) mengikuti QBank —
  lebih andal daripada `pnpm start` manual yang server-nya sering tertutup.
