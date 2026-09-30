# Changelog — MathBank

Semua perubahan penting proyek ini dicatat di sini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
versi mengikuti [Semantic Versioning](https://semver.org/lang/id/).

---

## [Belum Dirilis]

### Dokumentasi
- **📝 Catatan Verifikasi seragam di SELURUH dokumen `docs/audit/`** (CONSTRAINTS #44):
  tiap dokumen audit (M1–M7, Pustaka, Enterprise) kini punya blok **§Catatan Verifikasi**
  di akhir + status baris ditandai (✅/⚠️) — merujuk temuan nyata & perbaikannya. M6
  diperdalam: §1.2/§1.3 dikoreksi + kesimpulan lama "LULUS 100%" diberi peringatan.
  `README` audit diperbarui: tabel status verifikasi per-milestone + metrik terkini
  (274 unit / 86 DB / 30 halaman — ganti angka basi 229/80/28). M7 ditandai **belum
  diverifikasi** (jujur).

### Diperbaiki
- **🔎 Audit M6 — logika ambang dedup diperbaiki + status jujur** (`docs/VERIFIKASI-AUDIT-M6.md`):
  - **T-M6-1 (fix):** `dedup()` (`src/lib/search/fusion.ts`) menyatakan "exact (0.98)
    **ATAU** near (0.85) + penalaran sama", tapi kode faktual `s >= exact || (s >= near
    && …)` → karena `exact > near`, syarat `near` **menelan** `exact` → ambang exact
    **logika mati** & pasangan "near" dibuang **tanpa** cek penalaran. Diperbaiki:
    `≥exact` → duplikat (apa pun); zona near → duplikat **hanya bila penalaran sama**
    (`Candidate.reasoning` + `lookupReasoning` + `normReasoning`). **Terbukti:** pasangan
    s=0.857 penalaran-beda → dulu dibuang, kini **bertahan**. Tes 11 → **16** (+5).
  - **T-M6-2 (dokumen):** status `rrfFuse`/`dedup` di `docs/audit/M6-*.md` dari "✅ Lulus"
    → "⚠️ belum terintegrasi (dipakai M10)" — nol konsumen produksi.
  - **Koreksi:** klaim operator `word_similarity` keliru — kode memakai `%` (=`similarity()`).
  - **Jalur live SEHAT ✅** (trigram/typo/multi-kata/urut relevansi/filter subtree) —
    diverifikasi live; "multi-kata gagal" ternyata artefak shell (encoding), bukan bug.
  - **Pelajaran → `CONSTRAINTS.md` #42–43.**
- **🏢 Catatan Enterprise — penerapan selektif (verifikasi dulu, bukan asal ikut)**
  (`docs/VERIFIKASI-CATATAN-ENTERPRISE.md`):
  - **#2 (fix nyata):** `slugify(name, maxLength=255)` — NFKD bisa **memperpanjang**
    nama (ligatur `ﬃ`→`ffi`) sehingga `slice(0,255)` menulis ke kolom `varchar(100)`
    → **500**. Batas per-kolom (`tags`=100, `events.code`=50) + buang `-` ekor sesudah potong.
    **Terbukti live: 500 → 409/201.**
  - **#6:** `X-Request-ID` di semua respons `wrapRoute` (sukses/error) + log 500.
  - **#4:** `Idempotency-Key` (modul `src/lib/api/idempotency.ts`, siap-swap Redis) +
    opsi `idempotent: true` di `wrapRoute`; aktif di `POST /api/questions` & `/api/bundles`.
    **Terbukti live:** 2× POST key sama → id sama + `Idempotent-Replay`.
  - **#3 `"use cache"` DIBATALKAN** (keputusan sadar): `revalidateTag(t,'max')` = SWR →
    **data basi ~2–5 dtk** (terbukti live); `updateTag` hanya di Server Action;
    guard di `<Suspense>` menghilangkan **307 server**. **Revert** — dicatat kandidat M8+.
  - **Pelajaran → `CONSTRAINTS.md` #40–41.**
- **📚 Audit Pustaka — kedua temuan "redundan" SALAH** (`docs/VERIFIKASI-AUDIT-PUSTAKA.md`):
  paket `cn` = `shadcn-ui/cn` (drop-in clsx+tailwind-merge, ~22 file) → jangan ditukar;
  `tw-animate-css` dipakai (`globals.css`) → jangan di-prune. Versi & kesimpulan "bersih"
  akurat. **Tak ada perubahan kode.**
- **🌳 Audit M5 — integritas data pohon taksonomi (T-M5-2)** — verifikasi audit M5
  menemukan **re-parent topik TIDAK mempropagasi `level` ke keturunan**: memindah
  Kategori (L1) berisi Topik (L2) → induk jadi L2 tapi **anak tetap L2** (harus 3) →
  `listTopicsByLevel` & pemilih topik salah. **Perbaikan:** `updateTopic` kini
  menghitung `delta` dan meng-update **seluruh subtree** `level = level + delta`
  dalam **satu transaksi**. Terbukti live: A→L2, A1→L3.
  - **T-M5-1:** audit `updateTopic` salah label `create` → kini `update`
    ("Topik diperbarui"). Live: entri audit benar.
  - **T-M5-3:** endpoint `POST /api/tags/clean-unused` (diklaim dokumen audit tapi
    405) → **diimplementasikan** (`cleanUnusedTags`), hapus label `usage_count=0`.
    Live: `200 {removed:1}`.
  - **Pelajaran → `CONSTRAINTS.md` #38–39** (propagasi turunan hierarki + transaksi;
    audit `update` ≠ `create`).
  - **+2 tes DB** (86 total).
- **🚨 Audit M4 — bug KRITIS alur telaah (T-M4-3)** — verifikasi audit M4 menemukan
  **penelaah TIDAK BISA menyetujui/mengarsipkan soal** (`review→ready` → **403
  `Tidak punya izin: question:edit`**). Akar: gerbang route `[id]/status` memakai
  `permission: "question:edit"` → `assertCan` **tanpa `ownerId`** → semua peran
  ber-`own` ditolak. **Perbaikan:** hapus gerbang route; izin per-tujuan
  (`setReady`/`archive`/`edit`+owner) ditegakkan di service. **Terbukti live:**
  penelaah approve → **HTTP 200, status `ready`**.
  - **T-M4-4:** izin `question:hardDelete` (dulu MATI) kini dipakai —
    `DELETE /api/questions/[id]/permanent` + `hardDeleteQuestion()`; hanya soal
    soft-deleted; RESTRICT paket. Live: 409 tanpa soft-delete, 200 setelahnya.
  - **T-M4-5:** `changeQuestionStatus` kini penjagaan balapan
    (`WHERE id AND status=from` + `.returning()` → `ConflictError` 409).
  - **T-M4-1/T-M4-2:** dead links `/bank-soal/*` → **selesai** (M4c/M4d dibangun;
    rute `/questions/new`, `/questions/[id]`).
  - **Pelajaran → `CONSTRAINTS.md` #35–#37** (jangan izin `own` di gerbang route;
    penjagaan balapan; tes wajib lewat-route per peran).
  - **+4 tes DB** (84 total) untuk T-M4-3/4/5.

### Ditambahkan
- **M5 — Taksonomi (Referensi) selesai**:
  - **Topik** — pohon 3-level (`/referensi/topik`): CRUD, anti-siklus,
    hapus RESTRICT (tolak bila ada anak/dipakai soal).
  - **Sumber & Asal** (`/referensi/sumber`) — Buku/Situs/Sekolah/Kompetisi,
    slug otomatis, kolom "Dipakai" (usageCount nyata), hapus RESTRICT.
  - **Event** (`/referensi/event`) — UTBK/OSN dll + subtes & alias.
  - **Label** (`/referensi/label`) — tag lintas-topik + usageCount.
  - Service `taxonomy-service.ts` + API CRUD (`/api/{sources,events,tags}[/id]`).
  - Guard RESTRICT mencegah hapus entitas yang masih dipakai soal (409).
- **M4d — Telaah & Pengaturan** — **Telaah**: tab *Perlu Telaah* (`status=review`) & *Ditandai* (`flagged=1`); aksi penelaah setujui→`ready`, tolak→`draft` (+catatan), lepas tanda. **Pengaturan**: bagian *Umum* (nama org, jenjang & kesulitan bawaan) tersimpan ke `app_settings` via `GET/PATCH /api/settings`. Bagian AI ditandai "menyusul M10". **Keamanan:** service settings **memask nilai `is_secret`** (tak pernah dikembalikan) & endpoint umum **ber-allowlist** (kunci AI tak bisa ditulis dari sini — diuji). e2e 10/10. **Menutup M4 penuh.**

- **`MILESTONE.md` v2.0 — rombak menyeluruh** agar meng-cover semua sisa pekerjaan:
  - **3 fase eksplisit:** MVP (M1–M8) · Lanjut (M9–M12) · **Operasional/Hardening (M13–M17, baru)** — utang keamanan belum tertutup (S4–S9), kualitas tes, UI/UX polish, observabilitas, dokumentasi rilis 1.0.
  - **M4 dipecah 4 sub** (a/b ✅ · c/d ⬜) dengan task konkret per bagian.
  - **M5–M8 diperluas** (task nyata + dokumen pendukung yang belum ditulis).
  - **P1–P13** diperbarui (audit Base UI, fix akses LAN).
  - Tabel dokumen per-milestone + status; risiko jadwal; Langkah Berikutnya berurutan prioritas.
  - Disinkronkan: `KAMUS-DATA.md` (M0–M17), `PETA-DOKUMEN.md` (v2.0).
- **Skrip `pnpm start:lan`** (`next start -H 0.0.0.0`) — untuk menguji aplikasi dari HP/perangkat lain lewat LAN. Mode **dev** (Turbopack) mengirim ~8,8 MB JS + kompilasi on-demand → HP tampak "freeze" saat memuat; produksi hanya ~1,4 MB (6,3× lebih kecil). Didokumentasikan di `RENCANA-UI-MOBILE.md` §11.4.

### Ditambahkan
- **M4c — Editor soal & halaman detail** — rute `/bank-soal/baru` (buat) & `/bank-soal/[id]` (detail + sunting). Editor satu-komponen untuk **11 tipe** (kunci opsi vs teks), pratinjau KaTeX langsung, penandaan kunci (tunggal/multi), `distractor_rationale`, metadata (tipe/jenjang/kesulitan/kognitif), simpan draf atau kirim telaah. Detail: FSM (Kirim Telaah), hapus lunak + konfirmasi. **(Dahulu desktop-saja; kini responsif penuh — lihat M7.)** Menutup dead-link T-M4-1 (`/bank-soal/baru` & `/[id]` kini 200).
- **`docs/RENCANA-SOAL.md`** — 11 tipe final + pemetaan `answer_key`/`data_payload`.
- **Perbaikan tipe**: `PublicQuestion.answerKey` kini `AnswerKey` (dulu `Record<string, unknown>` longgar) — menutup ~15 error tipe tersembunyi.
- **🛡 Pengerasan Enterprise (P1–P5)** — atas analisis pemilik; **semua klaim
  diverifikasi ke codebase nyata** (semuanya valid):
  - **P1 — `/api/health`**: lapor koneksi DB + invarian (trigger/CHECK/HNSW/uuidv7);
    `200` sehat / `503` rusak. Modul `src/lib/db/invariants.ts` (sumber tunggal).
  - **P2 — Guard startup** (`src/instrumentation.ts`): saat server menyala, invarian
    diverifikasi → log ERROR bila hilang; `STRICT_INVARIANTS=true` menggagalkan startup.
  - **P3 — `audit_logs` append-only** (trigger DB `reject_audit_mutation`): UPDATE/DELETE
    ditolak di level DB (uji: INSERT ok, UPDATE/DELETE → error). Tahan manipulasi via
    DBeaver/pgAdmin, bukan hanya lewat app.
  - **P4 — `drizzle/manual/provision-prod.sql`**: provisioning 2-tahap (admin:
    ekstensi; app: role NOSUPERUSER + GRANT CRUD + audit append-only) — menutup S10.
  - **P5 — `docs/RENCANA-DEPLOY.md`**: langkah rilis dua-tahap + §5b guard/health.
  - **P6 (audit trigger DB di `questions`) DITUNDA** — butuh mekanisme aktor
    (`SET LOCAL app.actor`); lihat `RENCANA-ENTERPRISE.md` §E2.
  - Bukti: log `[invarian] OK — 26 trigger, 2 CHECK, 1 HNSW, uuidv7 ✓`; `/api/health` 200;
    immutability diuji; `db:verify` hijau. Tes: +3 (`health/route.test.ts`).
- **M7 — Paket Soal selesai** 🎉:
  - **Service** `bundle-service.ts` — CRUD paket + item (tambah/hapus/urut),
    validasi (soal tanpa kunci = peringatan), duplikasi, arsip (soft-delete),
    **RESTRICT** (soal dipakai paket → 409 saat dihapus). **Stimulus 1×**.
  - **API** `/api/bundles/**` (7 route) — semua ber-`rateLimit` + izin.
  - **UI responsif** (`/paket`, `/paket/[id]`, `/paket/[id]/sunting`) — daftar,
    detail + pratinjau KaTeX, **penyusun drag-and-drop** (`@dnd-kit/react`,
    keyboard-accessible). Panel bank soal: 2 kolom (desktop) / **Sheet** (mobile).
  - Tes: `bundle-service.db.test.ts` (14) + `bundle-api.db.test.ts` (8).
  - Dokumen: **`docs/RENCANA-PAKET.md`**.
- **Perubahan kebijakan responsif**: **`DesktopOnly` DIBUANG** (keputusan pemilik)
  — pola "desktop-saja" diganti **"Pola D′ — panel responsif (Sheet)"**.
  Editor soal & penyusun paket kini **berfungsi penuh di mobile**.
- **Evaluasi menyeluruh** — `docs/EVALUASI-MENYELURUH.md` (audit arsitektur,
  keamanan, a11y, mutu). `docs/EVALUASI-STRATEGI-E2E.md` + `EVALUASI-DESKTOPONLY.md`.

### Diubah
- **🌐 Semua URL/route kini **Bahasa Inggris** (konsistensi teknis). Label UI tetap
  Indonesia. Peta: `/bank-soal`→`/questions`, `/telaah`→`/review`, `/paket`→`/bundles`,
  `/referensi/*`→`/references/*` (`topik`→`topics`, `sumber`→`sources`, `label`→`labels`),
  `/studio/aset`→`/studio/assets`, `/sistem/*`→`/system/*` (`pengaturan`→`settings`),
  sub-route `baru`→`new`, `sunting`→`edit`, `cetak`→`print`. Aturan: `CONSTRAINTS.md #28b`.
  Halaman `/ganti-password`→`/change-password`. URL lama → 404 (belum ada redirect agar
  tak ada kebingungan; proyek pra-rilis).

### Diperbaiki
- **🧹 Perbaikan SELURUH temuan terkumpul (M2+M3+evaluasi)** — atas permintaan pemilik
  ("perbaiki seluruh temuan yang terkumpul"). Rencana: `RENCANA-PERBAIKAN-TEMUAN.md`.
  - **Keamanan:** NEW2 (`quick-login` tak bocorkan `detail`); NEW3 (`apikey.key` →
    `uq_apikey_key` UNIQUE; **koreksi: nilai = HASH**, bukan plaintext); NEW4
    (`listBundleItems` teruskan `actor`); D7 (`reference:manage` kini dipakai
    sources/events); D8 (`withUniqueGuard` → 409, bukan 500); D9 (JSON rusak →
    400 `INVALID_JSON`).
  - **A11y:** A2 (`aria-label` 2 input pencarian + 1 Select filter); A3
    (`TableCaption` 4 tabel + `scope="col"` default di `TableHead`).
  - **Mutu:** C1 (audit log untuk sumber/event/label/topik); C3 (helper `api<T>`
    diekstrak ke `src/lib/api/fetcher.ts`).
  - **S4 FK `author_id` sengaja TIDAK dikerjakan** — `author_id` sah menyimpan
    identitas non-user (`dev-user`, agen); FK akan memecah dev-bypass. Bukan batas
    kepercayaan (izin dari roles). Dicatat sebagai keputusan.
- **🎨 Warna status tema (T-M3-3) — perbaikan arsitektural** (verifikasi audit M3):
  - Warna status dipindah dari **hardcode di `build.ts`** → `tokens.ts` (`STATUS_TOKENS`,
    sumber kebenaran tunggal) → tak bisa lagi luput dari `theme:check`.
  - `theme:check` diperluas **16 → 34 pasangan** (kini mencakup `success/warning/error/info`
    & aksen di latar+kartu, 2 mode).
  - Nilai digelapkan agar **≥4.5:1 (AA)** di mode terang: success 3.70→**4.91**,
    warning 2.25→**4.92**, gold 2.47→**4.88**, info 3.94→**4.90**.
  - **Bug mode gelap**: `text-gold-fg` di atas `bg-gold/15` = **1.27:1** (badge "perlu
    perhatian" tak terbaca) → `accent-fg` gelap dibalik jadi terang (**lolos**).
  - Tes regresi `src/lib/theme/tokens-contrast.test.ts` (**+11 tes**).
  - Pasangan teoretis `accent-fg`-di-`accent` (tak dipakai UI) dihapus — verifikasi
    nyata, bukan teoretis.
- **🔐 Verifikasi audit M2 (Auth & Peran) — T1–T3** — atas laporan pemilik; semua
  klaim arsitektur **diverifikasi** (75 sel matriks ✅, 5 peran ✅, guard ✅).
  - **T1**: komentar `resolve.ts:10` basi ("session → API key", 2 jalur) → dikoreksi
    jadi 3 jalur (session → dev bypass → API key).
  - **T2**: dev bypass kini **3 pagar** — tambah gerbang **`APP_ENV`** (tolak
    `production`/`staging`). Menutup kebocoran hak admin di UAT/staging (NODE_ENV
    sering dibiarkan non-production).
  - **T3 (paling penting)**: `apiKeyPermissions` **dulu disimpan tapi TAK ditegakkan**
    → `can()` kini **menyempitkan** izin API key (tak pernah memperluas). Sebelumnya
    API key "berizin terbatas" tetap dapat seluruh izin peran = pembatasan kosmetik.
  - **+9 tes** (auth total **72**, dari 63).
  - **Koreksi penting:** temuan "login tanpa rate-limit" **sebagian besar salah** —
    rate-limit login **aktif otomatis** di produksi (rule bawaan Better Auth
    `/sign-in` 3 req/10 s), IPv6 sudah dinormalisasi, header default jalan. Dugaan
    "perlu `customRules`/`ipv6Subnet`" **dibatalkan** setelah verifikasi ke docs
    resmi 1.7.6 + kode library (pelajaran: verifikasi ke sumber primer).
  - **Yang nyata diperbaiki:**
    - **R1** — IP asli di balik **Cloudflare** ada di `cf-connecting-ip`; set
      `ipAddressHeaders: ["cf-connecting-ip"]` → tahan spoof (uji: `x-forwarded-for`
      palsu → bucket `no-trusted-ip`, header CF → IP betul).
    - **R2** — `storage: "database"` + tabel `rate_limit` (migrasi `0004`) →
      counter **persisten** & dibagi antar-proses (default `memory` hilang saat restart).
    - **R3** — `BETTER_AUTH_URL`/`APP_URL` = domain (systemd produksi); `.env`
      diperbaiki dari `http://localhost:3000`.
  - **Verifikasi:** 4 login → 3×400 lalu **429**; counter di DB; smoke 7/7; login
    demo via domain tetap jalan. Dokumen: `docs/RENCANA-RATE-LIMIT.md`.
- **Keamanan #33**: 3 route GET tanpa rateLimit (`auth/me`, `questions/[id]`,
  `settings`) → ditambah `rateLimit`.
- **Duplikasi**: ekstrak `bundleColumns()` di `bundle-service.ts`.
- **Dokumen**: 7 dokumen didaftarkan di `PETA-DOKUMEN.md` (langgar #31); perjelas
  pagar `DEMO_LOGIN` di `demo-users.ts`.
- **🔴 Review M3 — klaim "Verifikasi WCAG otomatis" palsu (tak ada kode)** — `A11Y.md` mencentang "kontras terverifikasi mesin" padahal `scripts/theme/` hanya konversi OKLCH. **Dibangun:** `src/lib/theme/color.ts` (konversi OKLCH↔sRGB + `contrastRatio` WCAG), `scripts/theme/tokens.ts`, `scripts/theme/check.ts` (`pnpm theme:check`, 16 pasangan × 2 mode, exit 1 bila gagal), tes `color.test.ts` (9), masuk gate `pnpm check`. **Hasil 16/16 lulus.**
- **🟢 Review M3 — optimasi shadcn** — audit aturan resmi: `SelectGroup` (bank-soal-view), `space-y-*`→`gap-*`, `dark:text-gold`→token, `<button>` kustom→`Button` resmi, buang `size-*` manual ikon, `role="img"` ikon Flag. e2e tema 10/10 + responsif 6/6.
- **🟡 Review M3 — nama variabel font** `--font-geist-mono` → `--font-roboto-mono`.
- **🟠 Review M2 — matriks izin dokumen vs kode menyimpang (3 sel)** — tabel "Matriks Izin Final" di `DESAIN-PER-LAPISAN-MATHBANK.md` berbeda dengan `permissions.ts` (sumber kebenaran). Diselaraskan: taksonomi (`own`/machine `yes`), enrichment (teacher/reviewer `no`, machine `yes`), buat soal (machine `yes` untuk ingest). Ditambah peringatan "kode menang bila berbeda". Ditemukan juga: **halaman login & forbidden belum ada** (MILESTONE salah centang) → dicatat sebagai utang **M15**; jumlah permission dikoreksi 16→**15** (75 sel).
- **🔴 Review M1 — migrasi dari nol RUSAK (ekstensi tak dimuat)** — `drizzle/0000_*.sql` memakai `vector(1024)` & `gin_trgm_ops` **tanpa** `CREATE EXTENSION` → di DB bersih `CREATE TABLE questions` gagal → **0 tabel**. Klaim "`db:migrate` mereproduksi skema penuh" tak terpenuhi. **Perbaikan:** `drizzle/manual/00-extensions.sql` (BARU) + `scripts/db-ensure-extensions.ts` (pra-migrasi, pesan jelas bila butuh superuser); `db:migrate` = ensure-extensions → migrate → safety. **Terverifikasi end-to-end:** migrasi DB kosong → skema **identik** DB asli (27 tabel, 14 enum, 81 index, 23 FK, 2 CHECK, 29 trigger, 1 HNSW, `uuidv7()`) + invarian menegakkan. Laporan: **`REVIEW-PER-MILESTONE.md`** (BARU). **+S10** (`KEAMANAN.md`): role DB produksi harus non-superuser.
- **🐛 Halaman tampil tanpa CSS saat diakses via HTTP (LAN)** — CSP `upgrade-insecure-requests` memaksa browser menaikkan semua request `http://` → `https://`. Di `localhost` browser mengecualikannya (secure context), tapi via **LAN** (`http://192.168.x.x:3001`, tanpa TLS) seluruh CSS/JS/font gagal dimuat → halaman tampil HTML polos. **Perbaikan:** directive itu **dan** HSTS kini hanya dikirim bila env **`APP_HTTPS=true`** (app di balik reverse-proxy TLS). Ini juga menutup kasus mode produksi yang diakses via HTTP. Terverifikasi via LAN (dev & produksi-HTTP): CSS/JS/font termuat, halaman bergaya penuh. Regresi dijaga e2e (`security-headers.spec.ts`). Didokumentasikan di `docs/KEAMANAN.md` §8 + `.env.example`.
- ~~Akses via LAN tampil tanpa CSS (perbaikan pertama: pindah ke CSP produksi saja)~~ — **kurang tepat** (produksi-HTTP masih kena); digantikan oleh kendali env `APP_HTTPS` di atas.

### Diubah
- **🎨 Basis primitif UI bermigrasi penuh: Radix UI → Base UI** (`@base-ui/react` 1.8.0) — menutup ambiguitas dokumen-vs-kode (ADR-0005 → **ADR-0008**). shadcn style kini **`base-nova`**:
  - **14 komponen `ui/**` di-regenerate** dari registry `base-nova` (button, badge, dialog, dropdown-menu, select, sheet, sidebar, tooltip, avatar, checkbox, label, separator, switch, tabs) — **nol impor `radix-ui`** di seluruh kode.
  - **9 penggunaan `asChild` → prop `render`** (cara Base UI) di 5 file: `app-sidebar` (2), `sidebar-user` (3), `header` (1), `desktop-only` (1), `bank-soal-view` (2).
  - **`nativeButton={false}`** pada `<Button render={<Link/>}>` — Base UI memerlukan ini saat elemen render bukan `<button>` (perbaikan peringatan a11y "expected a native `<button>`").
  - **`DropdownMenuLabel` dibungkus `DropdownMenuGroup`** — Base UI mewajibkan `Menu.GroupLabel` berada dalam `Menu.Group` (sebelumnya crash `MenuGroupContext is missing`).
  - **`tooltip` `delayDuration` → `delay`**; `command.tsx` `children` di-tipe ulang (`Omit<…,"children">`) karena `Dialog` Base UI menerima render-function.
  - **`radix-ui` + 44 paket `@radix-ui/*` di-uninstall** (bekas Radix bersih: `src/`, `components.json`, `package.json`).
  - Regresi yang dipulihkan saat regenerate: `src/hooks/use-mobile.ts` (kembali ke `useSyncExternalStore`, sesuai CONSTRAINT #6) & teks a11y Indonesia `sidebar.tsx` ("Buka/tutup sidebar").
  - Tes disesuaikan: `desktop-only.test.tsx` — `<Link>` kini `role="button"` + `href` (semantik Base UI).
  - Verifikasi: tsc 0 · lint 0 · unit **206** · e2e **41** · build 0 · browser bersih (nol error konsol; KaTeX + tema terang/gelap OK). Keputusan tercatat di **`docs/ADR/0008-basis-ui-base-ui.md`**.
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
- **Tes komponen kustom** (2026-09-29): 7 berkas tes baru (**45 tes**) menutup celah cakupan UI yang ditemukan audit —
  - `src/components/questions/bank-soal-view.test.tsx` (**21**) — keadaan render (muat/galat/kosong/data), pencarian & filter (URL = sumber kebenaran), reset, paginasi (prev/next/nonaktif), panel filter mobile. Radix `Select` diganti `<select>` agar handler filter tercakup.
  - `src/components/questions/question-card.test.tsx` (9) — status/tipe/grade, seleksi, **gating `isCorrect`** (terkait S3), pemangkasan konten.
  - `src/components/layout/desktop-only.test.tsx` (3), `sidebar-user.test.tsx` (4), `page-header.test.tsx` (3), `skip-link.test.tsx` (2).
  - `src/lib/hooks/use-media-query.test.ts` (4) — subscribe/notify/cleanup via `matchMedia` tiruan.
  - `vitest.setup.ts`: stub `window.matchMedia` (jsdom tak punya).
  - Coverage: **17 file** terukur (dari 10) — **96,01%** statements, **90,12%** functions; unit **206** (dari 161).
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
