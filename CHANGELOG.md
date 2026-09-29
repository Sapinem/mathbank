# Changelog — MathBank

Semua perubahan penting proyek ini dicatat di sini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
versi mengikuti [Semantic Versioning](https://semver.org/lang/id/).

---

## [Belum Dirilis]

### Diubah
- **`MILESTONE.md` disinkronkan dengan kenyataan (v1.1, 2026-09-29)** — setelah 12 commit terakhir:
  - Header status: "Draft v1, menunggu ratifikasi" → **"aktif — M0–M3 ✅, M4 berjalan"**.
  - Task M1/M2/M3 dicentang `[x]` sesuai kenyataan (⌘K, submenu Referensi, halaman kosong → selesai).
  - **M4 dipecah M4a–M4d**: M4a (service+API) & M4b (halaman daftar) ✅ dengan daftar task nyata; M4c (editor+detail, rute 404) & M4d (telaah+pengaturan) ⬜.
  - Tambah tabel **Pekerjaan Lintas-Milestone** (P1–P9): audit, shell shadcn, integritas DB, strategi tes, pembersihan QBank, uuidv7, dokumen enterprise, pagar keamanan S1/S2, riset Better Auth.
  - **Langkah Berikutnya** diperbarui (rencana lama "M1 dimulai" sudah terlampaui) + tabel riwayat perubahan.
  - `THEME-FRAMEWORK-GUIDE.md` **ditulis ulang** — sebelumnya mendokumentasikan var `--qbank-*` (salah; kode pakai `--mb-*`) dan file yang tak ada (`ThemeContext.tsx`, `ThemeSelector.tsx`, `sources.ts`); kini sesuai `scripts/theme/build.ts` + `--mb-*` + `next-themes`.
  - Judul dibersihkan: `ARSITEKTUR-DATA-FINAL` (QBank v2→MathBank), `CATATAN-INTERVIEW-ARSITEKTUR`, `DESIGN-THEME-FRAMEWORK` (QBank v1.0.0→MathBank, "PALET QBank"→"PALET MathBank"), `ARSITEKTUR-SISTEM-FULL` (→"Referensi (sebelumnya QBank)"), `CETAK-BIRU` (→"Cetak Biru MathBank").
  - ENV salah diperbaiki di `CETAK-BIRU`: `QBANK_*` → `AUTH_DEV_BYPASS`.
  - `MILESTONE.md` M3: task ditandai selesai; frasa "salinan Fase A/B QBank" dihapus.
  - `--qbank-*`, `data-mode=`, `--color-surface/text-*` (arsitektur tema lama): **nol** di seluruh dokumen.
  - Sebutan QBank yang **tersisa = sah** (pembanding "perbaikan dari QBank", arsip, laporan audit historis).
- **`uuidv7()` diterapkan** (Fase 2 audit, ADR-0003): PK semua tabel domain kini `uuidv7()` (PK berurutan waktu) — sebelumnya `gen_random_uuid()` (UUIDv4). Helper `uuidPk()` di `schema/_columns.ts`; migrasi `0003_cloudy_thunderbolt.sql`; `pnpm db:verify` memeriksa agar tak regresi. Terverifikasi di DB bersih.
- **Fase 2 audit — rapikan dokumen** (2026-09-29):
  - `VISION.md` **ditulis ulang untuk MathBank** (sebelumnya QBank-era: MBank-parity, enhancement, multi-tema; kini selaras PRD: bangun-dari-nol, sumber→paket→soal, non-goals).
  - `ROADMAP.md` → **`docs/arsip/ROADMAP-QBANK.md`** (banner arsip); `RENCANA-MIGRASI-DATA.md` → **`docs/arsip/`** (dibatalkan).
  - angka **"18 tabel" → 27** di `MILESTONE.md` (3 tempat), `ARSITEKTUR-DATA-FINAL.md`, `ARSITEKTUR-SISTEM-FULL.md`.
  - `MILESTONE.md`: tabel status milestone + header M1–M3 ditandai ✅ selesai; catatan status 2026-09-29.
  - `ARSITEKTUR-SISTEM-FULL.md`: banner "sebagian QBank-era" (arsitektur aktif = DESAIN-PER-LAPISAN).
  - `CETAK-BIRU-MATHBANK.md`: rujukan migrasi & ROADMAP diperbarui (arsip/dibatalkan).

### Ditambahkan
- **Tes komponen kustom** (2026-09-29): 6 berkas tes baru (**24 tes**) menutup celah cakupan UI yang ditemukan audit —
  - `src/components/questions/question-card.test.tsx` (9) — status/tipe/grade, seleksi, **gating `isCorrect`** (terkait S3), pemangkasan konten.
  - `src/components/layout/desktop-only.test.tsx` (3) — cabang desktop vs pesan ramah.
  - `src/components/layout/sidebar-user.test.tsx` (4) — nama/peran/muat/tamu (mock hook + `SidebarProvider`).
  - `src/components/layout/page-header.test.tsx` (3), `skip-link.test.tsx` (2).
  - `src/lib/hooks/use-media-query.test.ts` (4) — subscribe/notify/cleanup via `matchMedia` tiruan.
  - `vitest.setup.ts`: stub `window.matchMedia` (jsdom tak punya).
  - Coverage: **16 file** terukur (dari 10), **97,05%** statements; unit **185** (dari 161).
- **Security headers (S2)** (2026-09-29): `next.config.ts` `headers()` untuk **semua rute** — CSP (ketat, `frame-ancestors 'none'`, `object-src 'none'`), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control`; **HSTS hanya produksi**. `'unsafe-eval'` hanya di dev (React debug). Terverifikasi: halaman + KaTeX render benar (nol error CSP) + **8 tes e2e** baru (`e2e/security-headers.spec.ts`). Menutup utang **S2**; utang lanjutan **S9** (nonce).
- **Rate limiting (S1) — token bucket** (2026-09-29): `src/lib/api/rate-limit.ts` — in-memory, nol dependensi, **interface siap-swap ke Redis**. Diterapkan di `wrapRoute` (opsi `rateLimit`), di-key per aktor (fallback IP). Kelebihan → **429** + `Retry-After`. Kebijakan: default 60/menit; mutasi lebih ketat (POST 20, DELETE 10). **Terverifikasi live** (20×201 → 429) + **13 tes baru** (`rate-limit.test.ts` 10, `route-wrapper.test.ts` +3). Menutup utang keamanan **S1**.
- **Audit RBAC + riset Better Auth** (2026-09-29):
  - `src/lib/auth/resolve.test.ts` (**16 tes**) — pintu masuk identitas: pagar keras dev-bypass (mati di produksi), prioritas session→API key, pemetaan header, ketahanan error. **`resolve.ts` coverage 0% → 94%**.
  - `src/lib/auth/permissions.test.ts` (**20 tes**) — **kunci exhaustive** seluruh matriks izin (setiap sel 16 aksi × 5 peran) + invarian (machine tak boleh destruktif, agent tak boleh bundle, dll). Perubahan matriks tak sengaja kini **tertangkap tes**.
  - **`docs/RISET-BETTER-AUTH.md`** — evaluasi "Better Auth penuh vs otorisasi sendiri"; **rekomendasi: tetap otorisasi sendiri** (plugin Better Auth tak menjawab kebutuhan `own` + multi-role). Mengukuhkan ADR-0004. §7 memuat **verifikasi postur keamanan**: versi 1.7.6 di atas semua ambang perbaikan CVE 2025–2026; kelas CVE bypass middleware/Server-Action **tak berlaku** (kita pakai route handler, tanpa Server Action). `KEAMANAN.md` +S8.
  - Modul `auth` kini **43 tes** (dari 27).
- **7 dokumen enterprise 🟠 (penting)** (2026-09-29) — melengkapi fondasi enterprise:
  - `KONTRAK-API.md` — 13 endpoint nyata, envelope respons tunggal, peta kode error (400–500), guard kesiapan, rencana versioning.
  - `RENCANA-DEPLOY.md` — lingkungan, prasyarat PG 18, ENV produksi, langkah rilis, checklist pra-produksi.
  - `BACKUP-RECOVERY.md` — RPO/RTO, metode `pg_dump`, uji restore via `db:verify`, skenario pemulihan.
  - `KAMUS-DATA.md` — glosarium 27 entitas + taksonomi + proses + peran + jargon.
  - `A11Y.md` — target WCAG 2.2 AA, status terpenuhi vs utang, aturan pengembangan.
  - `CONTRIBUTING.md` (root) — setup, alur kerja, gate mutu, konvensi commit/kode.
  - `OBSERVABILITAS.md` — logging terstruktur, health check, metrik, alerting (rencana).
- **3 dokumen enterprise 🟢** (2026-09-29) — tak bergantung fitur baru:
  - `PERFORMA.md` — anggaran Core Web Vitals, kondisi nyata (halaman static, 50 index), titik rawan.
  - `SLA-SLO.md` — SLI/SLO usulan (uptime, latensi, RPO/RTO), error budget.
  - `GOVERNANCE.md` — peran, jenis keputusan, alur, kepemilikan dokumen.
  - `KEPATUHAN-PRIVASI.md` — UU PDP 27/2022 + GDPR: data pribadi nyata (user, session ip/user-agent, account token, audit_logs), hak subjek data, retensi, notifikasi pelanggaran 72 jam.
- **`docs/PETA-DOKUMEN.md`** — indeks hidup seluruh dokumen (ada + direncanakan) dengan status & tata kelola; mencegah "dokumen lupa".
- **`docs/KEAMANAN.md`** — model keamanan: aset, threat model (STRIDE), autentikasi, RBAC, permukaan berisiko, utang keamanan (S1–S7), daftar periksa pra-produksi.
- **`docs/ADR/`** — Architecture Decision Records: `README` (indeks), `template`, dan 7 ADR awal (bangun-ulang, lapisan L1–L9, PG18+uuidv7, Better Auth multi-role, shadcn resmi, invarian lunak, DB reproduktif).
- **CONSTRAINTS #31–32** — tata kelola dokumen (wajib terdaftar di PETA) + ADR untuk keputusan besar.
- **`docs/STRATEGI-TES.md`** — kontrak pengujian per-lapisan (L1–L9): jenis tes wajib, Definition of Done per milestone, infrastruktur DB uji, ambang coverage, daftar utang tes.
- **Tes API (`src/lib/api/route-wrapper.test.ts`)** — 22 tes: alur sukses, pemetaan error 401/403/404/409/422/400/500, auth & izin (mock `resolveActor`).
- **Tes integrasi service (`src/lib/services/question-service.db.test.ts`)** — 21 tes terhadap DB uji: transaksi (soal+opsi+topik/label), invarian DB (stimulus depth, difficulty), guard FSM + kesiapan (`ready` wajib `answer_key`), audit.
- **Infrastruktur tes DB** — `vitest.db.config.mts`, `scripts/test-db.ts`, `pnpm test:db` (menyasar `TEST_DATABASE_URL`, memblokir salah sasaran ke DB dev).
- **Integritas & Reproduktibilitas DB** (perbaikan Fase 1 audit):
  - `drizzle/manual/db_safety.sql` — fungsi `set_updated_at`, 21 trigger `updated_at`, trigger `trg_questions_stimulus_depth` (stimulus maks 1 level), `trg_topics_cycle` (cegah siklus taksonomi), `trg_question_{topics,tags}_usage` (`usage_count` akurat), + index **HNSW** `idx_questions_embedding_hnsw`.
  - `scripts/db-apply-safety.ts` + `pnpm db:safety` (di-chain otomatis dari `pnpm db:migrate`).
  - `scripts/db-verify.ts` + `pnpm db:verify` — memeriksa tabel/CHECK/trigger/HNSW, **gagal bila drift**.
  - Migrasi drizzle-kit `0002_naive_nightshade.sql` — CHECK `chk_questions_difficulty` (1–5) & `chk_topics_level` (1–3).
  - **`assertReady`** di `question-fsm.ts` — soal boleh dibuat tanpa `answer_key`, tapi **tak bisa `ready`** (422 `NOT_READY`) & tak bisa diekspor Moodle sampai jawaban diisi (kecuali `stimulus`).
  - **CONSTRAINTS #24–27** — aturan DB (reproduktif, `db:verify` hijau, snapshot drizzle, invarian lunak di service).
- **Fase R — Responsif** (sisipan sebelum M4c):
  - **R1** Navigasi mobile: `MobileNav` (Sheet kiri) + tombol ☰ di header; sidebar desktop `hidden lg:flex`.
  - **R2** Header responsif: mobile (☰ + judul halaman + ikon cari), desktop (breadcrumb penuh + kotak cari).
  - **R3** Bank Soal: filter → Sheet di mobile (badge jumlah aktif); panel tetap di desktop; toolbar & paginasi ringkas.
  - **R5** Dasbor: grid `2 → sm:3 → lg:6` (diverifikasi).
  - **R6** `useMediaQuery` + komponen `DesktopOnly` (pengalih halaman desktop-saja).
- **Rancangan responsif enterprise** — `docs/RENCANA-UI-MOBILE.md` v2 (17 bagian + 2 lampiran, matriks adaptasi 22 elemen).
- **CONSTRAINTS #10–14** — aturan responsif (wajib desktop+tablet+mobile, touch 44px, `MathContent` overflow-x-auto, input ≥16px, batas kunci `lg`).
- **E2E Playwright** (`e2e/`) — tema (5), responsif (3), Bank Soal (5), API (5); proyek `desktop` (1280) & `mobile` (Pixel 5). Skrip `pnpm e2e`.
- **`/api/stats`** + hook `use-stats` — Dasbor kini **nyata** (statistik, aktivitas, distribusi), bukan angka statis.
- **`docs/AUDIT-KODE.md`** — audit menyeluruh (9 temuan: 1 kritis, 1 tinggi, sisanya kecil).

### Diubah
- `MathContent` — dukung `\(...\)` & `\[...\]` (selain `$...$`); pembungkus `overflow-x-auto` (rumus lebar tak memecah layout).
- `CONSTRAINTS.md` — perbaiki duplikasi nomor; aturan responsif ditambahkan; perjelas gerbang coverage.
- **Gerbang mutu diperbaiki** — coverage **kini nyata & terukur** (`@vitest/coverage-v8`); `pnpm check` menjalankan `test:coverage`. Cakupan **98,7% stmt / 97,6% cabang / 100% fungsi**.

### Diperbaiki (audit)
- 🔴 **Coverage palsu** — dulu 9,12% (dependensi absen → ambang tak pernah dievaluasi). Kini diukur nyata.
- 🟠 **`AUTH_DEV_BYPASS`** — kini dijaga `NODE_ENV !== "production"`: bypass **mati total** di produksi.
- 🟡 **Dasbor hardcoded 0** → data nyata dari `/api/stats`.
- 🟡 **`changeQuestionStatus`** — tak lagi tulis DB + audit saat status tak berubah.
- 🟢 **`labels.ts`**, `actor.ts`, `roles.ts`, kelas error guard — sebelumnya 0% tes, kini tertutup.
- 🟢 Hapus `src/lib/search/smoke.test.ts` (placeholder).

### Ditunda
- **R4** (detail soal: app bar + aksi sticky) → digabung ke **M4c** (halaman detail dibangun pertama kali di sana).
- **R7** audit aksesibilitas menyeluruh → menyusul setelah halaman-halaman ada.
- Rute `/bank-soal/baru` & `/bank-soal/[id]` → **M4c** (kini 404; tombol "Buat Soal" & kartu belum aktif).

### Gerbang Mutu
- `tsc` 0 · `lint` 0 · **tes 68/68 · coverage 98,7%** · `build` 0 · **e2e 33 hijau** (desktop 17 / mobile 16).

---

## [0.4.0] — M3: Tema & Shell

### Ditambahkan
- **Mesin tema** — 3 warna sumber (`#0158CA`, `#D5AC1E`, netral) → token OKLCH; skrip `pnpm theme:build` (`scripts/theme/build.ts` → `src/styles/tokens/generated.css`).
- **Komponen UI** — shadcn/ui (13 komponen: button, badge, card, dialog, input, textarea, select, tabs, table, dropdown-menu, separator, tooltip, command, sonner).
- **Komponen keadaan** — `EmptyState`, `LoadingState`, `ErrorState`, `ComingSoon` (`src/components/ui/states.tsx`).
- **Shell aplikasi** — sidebar kiri 4 grup (Kerja/Referensi/Studio/Sistem) yang *collapsible*, header (breadcrumb + ⌘K + toggle tema), command palette.
- **Dasbor informatif** — 6 kartu statistik, aktivitas terbaru, antrean kurasi, 3 kartu sebaran.
- **11 halaman placeholder** — `ComingSoon` jujur per milestone (`/bank-soal` … `/sistem/pengaturan`).
- **Penyedia** — `ThemeProvider` (next-themes, default ikut OS) & `QueryProvider` (React Query).
- **Font** — Roboto Flex (UI) + Roboto Mono (kode).
- Paket M3: `@tanstack/react-query`, `katex`, `lucide-react`, `cmdk`, `sonner`, `next-themes`.
- Tes `nav-config` (5 kasus) — struktur sidebar teruji.

### Diubah
- `layout.tsx` — font Geist → Roboto, `lang="id"`, dibungkus penyedia tema & query.
- `globals.css` — impor token tema; `--primary` dipetakan ke `--mb-brand`; utilitas `bg-brand`/`text-gold`/`text-error` dst.

### Catatan Teknis
- **Tanpa pelanggaran React Compiler** — status sidebar lewat `useSyncExternalStore` (bukan setState-in-effect).
- Menu **Ingest disembunyikan** sampai M9 (`hidden: true` di nav-config).
- Warna status **universal** (tak ikut brand); "Siap" = biru brand.

### Gerbang Mutu
- `tsc` 0 error · `lint` 0 · tes 18/18 · `build` 0.

---

## [0.3.0] — M2: Auth & Peran

### Ditambahkan
- **Peran formal** (5) — `admin`, `teacher`, `reviewer`, `agent`, `machine` (`src/lib/auth/roles.ts`).
- **Matriks izin** — 14 izin × 5 peran, akses `yes`/`own`/`no` (`src/lib/auth/permissions.ts`).
- **Guard** — `can`, `effectiveAccess`, `assertCan`, `hasRole` (`src/lib/auth/guards.ts`).
- **Better Auth** — instance + drizzle adapter + api-key (`src/lib/auth/server.ts`).
- **Actor resolver** — session/apikey → `Actor` (multi-role dari `user_roles`) (`src/lib/auth/resolve.ts`).
- **Pembungkus route (L4)** — `wrapRoute` menghapus boilerplate (aktor, 401, izin, Zod, error) (`src/lib/api/route-wrapper.ts`).
- **Endpoint** — `GET /api/auth/me` (identitas) + catch-all Better Auth.
- Tes matriks izin (12 kasus).

### Diubah
- `vitest.config.mts` — `fileURLToPath` untuk `__dirname` (menghapus peringatan).

### Gerbang Mutu
- `tsc` 0 error · `lint` 0 · tes 13/13 · `build` 0.

---

## [0.2.0] — M1: Skema Database

### Ditambahkan
- **27 tabel** (21 domain + 6 auth) di PostgreSQL 18:
  - **Soal & Asal** (7): `sources`, `books`, `institutions`, `events`, `questions`, `question_options`, `solutions`
  - **Taksonomi & Paket** (7): `topics`, `grades`, `difficulty_levels`, `cognitive_levels`, `tags`, `question_topics`, `question_tags`
  - **Paket & Sistem** (7): `bundles`, `bundle_items`, `media_assets`, `question_media`, `app_settings`, `audit_logs`, `ingest_queue`
  - **Auth** (6): `user`, `session`, `account`, `verification`, `apikey`, `user_roles`
- **15 enum** — `question_type` (11 nilai), `question_status`, `cognitive_level`, `solution_type`, `role`, dll.
- **Trigger `updated_at`** — 21 trigger via fungsi `set_updated_at`.
- **Seeder taksonomi** — `scripts/seed-taxonomy.ts` (19 jenjang, 5 kesulitan, 6 level kognitif) dari `curriculum.yaml`.
- **Invarian** — termasuk RESTRICT (stimulus dengan anak tak bisa dihapus), via Drizzle + trigger.

### Catatan Teknis
- `uuidv7()` (fitur PG 18) sebagai default PK; ekstensi `vector 0.8.6` + `pg_trgm 1.6`.
- Stimulus via `parent_id` (tanpa tabel `passages`); `institutions` anak `sources` (pola B).

---

## [0.1.0] — M0: Fondasi & Perencanaan

### Ditambahkan
- **Scaffold** — Next.js 16.3.6 + React 19.2.8 + Tailwind 4.3.3 + TypeScript 5.9.3.
- **Gerbang mutu** — `CONSTRAINTS.md` (typecheck 0, lint 0, coverage ≥85%, build 0).
- **Perkakas** — Drizzle ORM + postgres, Better Auth, Zod, Vitest, Testing Library, ESLint.
- **Konfigurasi** — `drizzle.config.ts`, `vitest.config.mts`, `.env.example`, skrip npm (dev/build/lint/typecheck/test/db:*/theme:build).
- **Dokumentasi perencanaan** (20 dokumen di `docs/`):
  - Arsitektur 9 lapisan: `DESAIN-PER-LAPISAN-MATHBANK.md`, `ARSITEKTUR-SISTEM-FULL.md`, `ARSITEKTUR-DATA-FINAL.md`, `L7-TINJAUAN-KRITIS-DATA.md`
  - Produk: `PRD.md`, `MILESTONE.md`, `VISION.md`, `ROADMAP.md`, `CETAK-BIRU-MATHBANK.md`
  - Data & UI: `SKEMA-DB-DETAIL.md`, `RENCANA-UI.md`, `STATUS-UI-MENGGANTUNG.md`
  - Teknis: `TUMPUKAN-TEKNOLOGI.md`, `DESIGN-THEME-FRAMEWORK.md`, `THEME-FRAMEWORK-GUIDE.md`
  - Proses: `RIWAYAT-KEPUTUSAN.md`, `CATATAN-PLANNING.md`, `CATATAN-INTERVIEW-ARSITEKTUR.md`

### Keputusan Kunci
- **MathBank dibangun dari kanvas bersih** — menggantikan QBank sepenuhnya; tanpa migrasi data.
- **9 lapisan arsitektur terkunci** (L1–L9).
- **MVP = alur tuntas** — bank soal + paket + ekspor (cetak/PDF).
- **AI = konfigurasi** (`app_settings`), bukan hardcode — untuk 9router dkk.

---

## Konvensi Penomoran Versi

- **MAJOR** — perubahan besar/perombakan tak kompatibel.
- **MINOR** — milestone baru (M1, M2, M3 → 0.1.0, 0.2.0, 0.3.0).
- **PATCH** — perbaikan kecil dalam milestone.

Setiap **milestone selesai** = satu entri versi MINOR. Rujuk `MILESTONE.md`.
