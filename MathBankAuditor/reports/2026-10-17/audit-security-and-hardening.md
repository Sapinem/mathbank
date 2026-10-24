# Laporan Audit Keamanan — MathBank v2

> **Skill yang dipakai:** `security-and-hardening` (threat-model first → tiga tingkat
> kendali → *Review Checklist* → *Verification*)
> **Tanggal audit:** 17 Oktober 2026
> **Basis kode:** HEAD `7c4df34` + perubahan kerja belum di-commit (lihat §1.3)
> **Metode:** pembacaan kode pada jalur nyata (bukan hanya service), reproduksi
> eksploitasi lewat tes yang dapat dijalankan, `pnpm audit` terhadap lockfile,
> penelusuran konfigurasi deploy (Docker/compose/Caddy/CI/ENV).
> **Sifat:** *read-only audit* — **tidak ada kode aplikasi yang diubah**. Satu
> berkas tes bukti ditambahkan (§Lampiran A) agar setiap temuan HIGH dapat
> direproduksi, bukan sekadar diklaim.

---

## Ringkasan Eksekutif

MathBank v2 memiliki fondasi keamanan yang **jauh di atas rata-rata proyek seukurannya**:
matriks izin terpusat (L1), gerbang route tunggal (`wrapRoute`), proyeksi kolom yang
membuang `answer_key`/`embedding`, FSM dengan penjagaan balapan, audit log, pemindai
rahasia pre-commit, dan CI yang memasang ulang dependency dengan lockfile beku.
Namun audit menemukan **6 temuan HIGH**, termasuk **kontrol yang sudah dirancang
tetapi tak tersambung / dapat dilewati** — bukan karena kontrolnya tak ada.

Dua di antaranya wajib diselesaikan **sebelum** rilis v2 apa pun:

1. **SEC-01 — `question:flag` tanpa `ownerId`**: aturan `own` tak dievaluasi →
   guru **tidak bisa** menandai soal apa pun (alur mati), dan izin `flag`
   kehilangan semantik kepemilikan seluruhnya (pelanggaran #35 — kelas bug T-M4-3
   yang menurut `CONSTRAINTS.md` pernah mematikan telaah tanpa terdeteksi). Tanpa tes.
2. **SEC-02 — rate limit memakai `X-Forwarded-For` mentah**: penyerang memalsukan
   header itu dan melewati **semua** limiter berbasis IP (`/img`, `/api/mcp`,
   route anonim). Sudah direproduksi: 400 permintaan tanpa satu pun 429.
   Bertentangan langsung dengan klaim *"tahan spoof"* di `docs/KEAMANAN.md` S1.

Selain itu: **path traversal `corpus://` masih hidup** (rekomendasi laporan audit
sebelumnya tidak diterapkan — lihat §4), **SSRF TLS** pada host *relaxed*, **root
ekspor GitSync bebas** (bisa `rm -r` + `git add -A` di folder yang dikonfigurasi), dan
**SSRF tak terbatas lewat `ai.base_url`**.

| Tingkat | Jumlah | Harus selesai sebelum |
|---|---:|---|
| 🔴 **CRITICAL** | 0 | — |
| 🟠 **HIGH** | 6 | Rilis v2 / deploy produksi |
| 🟡 **MEDIUM** | 9 | Sprint berjalan |
| 🔵 **LOW** | 7 | Backlog terencana |
| ⚪ **INFO** | 4 | Dokumentasi/pemantauan |

**Kepatuhan ringkas terhadap `CONSTRAINTS.md`:** • #20 (**LaTeX `openin_any='p'`**)
**tidak dapat diverifikasi** — proyek tidak memuat engine LaTeX sama sekali; •
#21 ✅ (rahasia dari ENV/`app_settings` terenkripsi; `.env` tak dilacak git); •
#22 sebagian (satu endpoint tanpa skema Zod — SEC-02/MS-04); • #23 ⚠️ pagar
`AUTH_DEV_BYPASS` benar, tetapi **env dev saat ini `AUTH_DEV_BYPASS=true`** dan
`BETTER_AUTH_URL` di `.env` menunjuk domain produksi (§1.3); • #33 sebagian
(beberapa route mutasi tanpa rate limit — MS-04); • #34 ✅ (proyeksi konsisten);
• #35 **dilanggar** oleh `setQuestionFlag` (SEC-01); • #36 ✅ (CAS `returning()`
di FSM & antrean ingest).

---

## 1. Metodologi

### 1.1 Langkah yang dijalankan (sesuai SKILL.md)

1. **Petakan batas kepercayaan** (§1.2) — siapa yang menulis nilai, bukan kanal.
2. **Namai aset** — `answer_key`/pembahasan, kredensial (password hash, sesi, API key,
   `ai.api_key`), PII (email, IP, user-agent), audit log, integritas skema.
3. **Jalankan STRIDE** per batas (tabel §1.2).
4. **Tulis kasus penyalahgunaan** — setiap temuan HIGH punya PoC berupa tes yang
   dijalankan (`src/lib/security/audit-2026-10-17.proof.test.ts`).
5. **Verifikasi** lewat *Review Checklist* skill (auth, authz, input, data, header/CORS,
   dependency, AI/LLM, error handling) dan *Verification* di akhir (§8).

### 1.2 Peta batas kepercayaan & STRIDE

| Batas | Penulis | Aset berisiko | S / T / R / I / D / E | Status |
|---|---|---|---|---|
| HTTP API `/api/**` | klien apa pun | semua; `answer_key` | auth sesi/API key; otorisasi per-objek; Zod | ⚠️ SEC-01, SEC-04 |
| Sesi/cookie (Better Auth) | browser | sesi, peran | `sameSite`, `secure`, secret dari ENV | ⚠️ MS-03 |
| Ingest `POST /api/v1/ingest/upload` | `machine`/`agent` | disk (media), DB (queue) | panjang `rawContent` tak dibatasi | 🟡 MS-07 |
| Media remote (`fetchImage`) | URL dari korpus pihak ketiga | jaringan internal, TLS | SSRF allowlist; TLS verify | 🔴 SEC-03 |
| `corpus://` lokal | jalur dari parser/DB | **filesystem host** | traversal, allowlist root | 🔴 SEC-05 |
| LLM / Ollama (`ai.base_url`, `BGE_M3_SERVICE_URL`) | admin via `app_settings` / ENV | jaringan internal, kredensial LLM | allowlist, **output LLM = data** | 🟠 SEC-08 |
| Ekspor GitSync | judul paket (data pengguna) | filesystem + riwayat git | root allowlist, kedalaman, kepemilikan | 🟠 SEC-06 |
| MCP `/api/mcp` | agen (`x-api-key`) | `answer_key`, kuota LLM | policy.ts (satu pintu) | ✅ (catatan MS-08) |
| Dependency/CI | registry npm | RCE build/deploy | lockfile beku, `--ignore-scripts`, audit | ⚠️ MS-01/MS-02 |

### 1.3 Catatan basis kode & konfigurasi mesin (redaksi: nilai rahasia tidak dicetak)

- `.env` **tidak dilacak git** (`.gitignore`: `.env*` dengan pengecualian `*.example`);
  riwayat tidak memuat `.env` (`git log --all -- .env` kosong). ✅
- ⚠️ **`AUTH_DEV_BYPASS=true` tertulis di `.env` kerja**, sementara
  `BETTER_AUTH_URL`/`APP_URL` menunjuk domain produksi `b.iyo.my.id`.
  Pagar kode (`NODE_ENV`/`APP_ENV`/`"true"`) benar — tetapi konfigurasi ini berarti
  **siapa pun yang menjalankan dev server di mesin ini menjadi admin penuh** dan
  (bila `APP_URL` produksi) Better Auth memberlakukan cookie `Secure` di origin
  `https://b.iyo.my.id` (lihat MS-03). Ini konfigurasi operator, bukan cacat kode —
  tetapi termasuk *red flag* "secret/config hygiene".
- Perubahan kerja belum di-commit yang **menyentuh keamanan**:
  `src/lib/ingest/media/fetch.ts` (± perbaikan SSRF), `src/lib/ingest/commit.ts`,
  `commit/route.ts`. Audit membaca versi di disk (yang akan dirilis), bukan HEAD.
- **Artefak audit sebelumnya bermasalah** (`MathBankAuditor/reports/17.10.2026/`):
  laporan `audit-security-and-hardening.md` menyatakan 0 CRITICAL/2 HIGH **tanpa
  bukti eksekusi**, dan beberapa laporan lain memberikan ✅ pada **#20 LaTeX**
  padahal aplikasi tidak memanggil engine LaTeX. Lihat §4.

---

## 2. Temuan — HIGH (wajib sebelum rilis)

### 🟠 SEC-01 — Pelanggaran otorisasi: `question:flag` ditegakkan tanpa `ownerId`

- **Lokasi:** `src/lib/services/question-write.ts` — `setQuestionFlag()`
  (≈ baris 228–255: `assertCan(actor, "question:flag");`),
  dipanggil oleh `src/app/api/questions/[id]/flag/route.ts` dan
  `src/app/api/questions/batch/route.ts` → `question-bulk.ts` (aksi `flag`/`unflag`).
- **CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key) / CWE-863.
- **Bukti (dijalankan):** `audit-2026-10-17.proof.test.ts` › `BUG-01` — matriks
  memberi `teacher → question:flag = "own"`; `can(teacher, "question:flag")` **false**,
  sehingga `assertCan` **tanpa** `ownerId` **selalu menolak**. Service justru
  memanggilnya **tanpa** `ownerId` (`question-write.ts` → `setQuestionFlag`) —
  aturan `own` jadi **tak berfungsi**: `can()` mengembalikan `false` untuk
  `teacher` pada **setiap** soal, sehingga penandaan soal oleh guru (termasuk
  soal miliknya sendiri) **ditolak 403**; semantik `own` hilang dan perilaku
  bergantung pada peran yang kebetulan `yes` (`admin`/`reviewer`/`agent`).
  Bullet BUKTI di bawah menjalankan `can()` untuk ketiga kasus.
- **Dampak:** pelanggaran `CONSTRAINTS.md` #35 tepat pada pola yang pernah
  menyerang proyek (T-M4-3: gerbang `own` tanpa `ownerId` mematikan alur telaah).
  (a) **Fungsional:** guru tak bisa menandai soal apa pun — jalur "tandai perlu
  perhatian" mati untuk peran yang justru paling membutuhkannya; (b) **keamanan
  semantik:** izin `own` tak lagi berarti "milik sendiri" untuk `flag`, sehingga
  perubahan matriks/global `can()` di masa depan dapat dengan mudah berubah menjadi
  eskalasi horizontal tanpa terdeteksi — persis kelas bug yang dilarang #35;
  (c) audit mencatat aksi tanpa objek kepemilikan yang diverifikasi (*repudiation*).
- **Mengapa lolos:** tak ada tes **lewat route** untuk peran `teacher` pada
  `PATCH /api/questions/[id]/flag` — tes authz yang ada menyasar
  `question:edit/delete` (regresi T-M4-3), bukan `flag` (#37).
- **Perbaikan (CONSTRAINTS #35):**

```ts
// question-write.ts — setQuestionFlag
assertCan(actor, "question:flag", { ownerId: existing.authorId });
// route: hapus `permission: "question:flag"` dari gerbang (ber-`own`), tegakkan di service.
```

  Tambahkan tes regresi lewat route (peran `teacher`, soal `authorId` lain → 403).

---

### 🟠 SEC-02 — Rate limit di-bypass dengan `X-Forwarded-For` palsu (semua limiter berbasis IP)

- **Lokasi:** `src/lib/api/route-wrapper.ts` › `clientIp()` **dan**
  `src/app/api/mcp/route.ts` › `clientIp()` **dan** `src/app/img/[shortId]/route.ts` › `clientIp()`.
  Pola identik: `xff.split(",")[0]` dari header yang dikirim klien.
- **CWE:** CWE-290 (Authentication Bypass by Spoofing) / CWE-770 (limiting tak efektif).
- **Bukti (dijalankan):** `audit-2026-10-17.proof.test.ts` › `SEC-07` —
  400 permintaan ke `GET /img/AbCd1234`, masing-masing dengan
  `X-Forwarded-For: 10.0.x.y, 1.1.1.1` berbeda → **tidak satu pun 429**
  (kebijakan `IMAGE_POLICY` seharusnya menolak setelah 300 dalam satu jendela).
  Jalur MCP memakai `rateLimitKey(actor.id, …)` sehingga aman selama
  kredensialnya sah; tetapi `checkRateLimit` untuk **anonim** (`/img`, route
  `wrapRoute` tanpa aktor) sepenuhnya bergantung pada IP.
- **Konteks deploy:** Caddy (`Caddyfile`) **tidak** menimpa `X-Forwarded-For`;
  `reverse_proxy` Caddy **menambahkan** IP klien ke akhir header, sehingga segmen
  pertama adalah nilai kiriman klien. `docs/KEAMANAN.md` S1 mengklaim
  "IP asli via `cf-connecting-ip` → tahan spoof" — klaim itu benar **hanya** untuk
  rate limit Better Auth (`server.ts` → `ipAddressHeaders`), **bukan** untuk
  limiter aplikasi.
- **Dampak:** (a) enumerasi `/img/<shortId>` dan pengunduhan massal gambar tanpa
  batas (kimia: biaya bandwidth/IO); (b) banjir panggilan MCP anonim dan route
  umum → DoS; (c) bila limiter di masa depan dipakai untuk perlindungan
  brute-force, kontrol itu ilusi.
- **Perbaikan:**
  1. Satu helper bersama, mis. `src/lib/api/client-ip.ts`:
     jika ada `cf-connecting-ip` (deployment Cloudflare) → pakai itu; selain itu
     pakai **hop terakhir** dari XFF yang **ditambahkan** proxy tepercaya
     (atau `x-real-ip` yang di-set Caddy), dengan **jumlah hop tepercaya tetap**.
  2. Caddy: `header_up X-Real-IP {remote_host}` dan/atau
     `@trusted remote_ip 10.0.0.0/8` + hapus XFF kiriman klien.
  3. Ganti limiter publik berbasis IP dengan **store bersama** (Redis) — lihat MS-05.
  4. Tes: 400 XFF berbeda → 429 muncul setelah kapasitas.

---

### 🟠 SEC-03 — SSRF TLS: verifikasi sertifikat dimatikan untuk host *relaxed* **dan semua host yang di-redirect**

- **Lokasi:** `src/lib/ingest/media/fetch.ts` — `TLS_RELAXED_HOSTS`,
  `assertPublicTarget()` (`if (isTlsRelaxed(rawUrl, relaxedHosts)) return;`),
  `downloadRelaxed()` (`rejectUnauthorized: false`), dan redirect di
  `downloadRelaxed` yang memanggil `isTlsRelaxed(next, relaxedHosts)`.
- **CWE:** CWE-295 (Improper Certificate Validation) / CWE-918 (SSRF — memungkinkan
  MITM ke host internal).
- **Bukti (dijalankan):** `SEC-03` — `fetchImage("https://pusmendik.kemendikdasmen.go.id/…")`
  **tidak memanggil `fetch`** (yang memverifikasi TLS); yang dipakai adalah jalur
  `https.request({ rejectUnauthorized: false })`. Selain itu, begitu satu hop
  berasal dari host relaxed, redirect **ke host apa pun** diloloskan
  (`!isTlsRelaxed(next, relaxedHosts)` ⇒ aman) lalu diunduh **tanpa verifikasi
  sertifikat**. Host internal dengan sertifikat self-signed/salah kini dapat
  dibaca (SSRF via cert bypass).
- **Dampak:** pengguna yang mengontrol korpus ingest (agen `machine`, atau halaman
  yang di-ingest dari sumber tak tepercaya) dapat membaca layanan internal ber-TLS,
  serta MITM pasif pada lalu lintas sumber.
- **Perbaikan:**
  1. Hapus `TLS_RELAXED_HOSTS`; sertifikat rusak di sumber = sumber tak layak
     diunduh otomatis — laporkan sebagai kegagalan media (sudah ada mekanismenya).
  2. Bila mutlak perlu: pin **SPKI/publik kunci** host tsb (`checkServerIdentity`
     kustom), bukan mematikan verifikasi; dan **hanya untuk host persis**
     (bukan redirect).
  3. Redirect dari host relaxed → tolak kecuali host tujuan persis sama.

---

### 🟠 SEC-04 — Path traversal `corpus://` masih terbuka (klaim perbaikan sebelumnya tidak benar)

- **Lokasi:** `src/lib/ingest/media/fetch.ts` › `fetchCorpusImage()` —
  `const safe = /^[A-Za-z0-9._\-]+$/; … join(CORPORA_BASE, sumber!, "images", ...sisa)`.
- **CWE:** CWE-22.
- **Bukti (dijalankan):** `SEC-05` —
  `fetchImage("corpus://defantri/../../../../etc/passwd")` menghasilkan
  `corpus:// berkas tidak ditemukan: /home/hari/projects/qbank/etc/passwd`:
  path telah **keluar** dari `…/corpora/defantri/images`. Segmen `".."` lolos
  regex karena `.` diizinkan. (Berkas yang lolos syarat mime/ekstensi — `.svg`,
  `.png`, `.jpg`, … — akan **dibaca** dan disajikan kembali lewat `/img/<shortId>`.)
- **Dampak:** pembacaan berkas host yang berekstensi gambar/SVG di luar korpus
  (mis. `~/.config/**/*.svg`, unggahan aplikasi lain, `backups/` bila berisi aset
  gambar) oleh pemanggil `commit` ingest.
- **Catatan kejujuran:** laporan `MathBankAuditor/reports/17.10.2026/audit-security-and-hardening.md`
  menyebut ini **HIGH SEC-01** dengan perbaikan yang disarankan — kode belum
  diperbaiki, dan `src/lib/ingest/media/media-io.test.ts` **tidak memuat** tes
  corpus traversal. → §4.
- **Perbaikan:**

```ts
const parts = rest.split("/");
if (parts.some((p) => p === "" || p === "." || p === "..")) return { ok:false, error:"…traversal" };
const [sumber, ...sisa] = parts;
if (!/^[A-Za-z0-9_-]+$/.test(sumber!)) return { ok:false, … };
const root = resolve(CORPORA_BASE, sumber!, "images");
const absPath = resolve(root, ...sisa);
if (absPath !== root && !absPath.startsWith(root + sep)) return { ok:false, … };
```

  Uji: `corpus://defantri/../../etc/passwd`, `corpus://../x.png`, `%2e%2e`.

---

### 🟠 SEC-05 — Root ekspor GitSync tak dibatasi: penghapusan rekursif & `git add -A` di sembarang folder

- **Lokasi:** `src/lib/export/gitsync-writer.ts` — `exportRoot()` menerima
  `MATHBANK_EXPORT_DIR` **apa adanya** (`resolve(fromEnv)`), lalu
  `writeGitsyncFolder()` menjalankan `rm(join(dir, "top"), { recursive: true, force: true })`
  dan `git add -A` + `git commit` di `dir`.
- **CWE:** CWE-22 (destructive operation on derived path — pola di
  `references/hardening-patterns.md#destructive-operations-on-derived-paths`).
- **Bukti (dijalankan):** `SEC-06` — `MATHBANK_EXPORT_DIR=$(pwd)` diterima
  `exportRoot()`. Bila `MATHBANK_EXPORT_DIR` diarahkan ke working tree proyek
  (`/home/hari/projects/mathbank`), setiap ekspor paket berjudul X akan:
  `rm -r <repo>/<slug>/top` (jika ada) lalu `git init/add -A/commit` di
  `<repo>/<slug>` — **repo bersarang di dalam repo sumber**; berkas paket
  (termasuk **kunci jawaban**) ter-commit di repo bersarang dan dapat ikut
  ter-`git push` bila pengguna menjalankannya. Skenario yang **paling mudah**
  terjadi bukan "root = repo", melainkan root diarahkan ke folder data lain
  (mis. `~/`, `/srv/backups`, folder proyek kedua): `rm -r <root>/<slug>/top`
  lalu `git add -A` berjalan di sana tanpa syarat kepemilikan apa pun.
- **Dampak:** penghapusan data (folder `top` milik aplikasi lain), kebocoran
  `answer_key` ke riwayat git/push, dan eksekusi git di lokasi tak diharapkan.
- **Perbaikan (tiga syarat skill):** root allowlist eksplisit (mis.
  `~/mathbank-export`, realpath), target harus **≥1 level di bawah** root,
  dan **tolak** bila root berada di dalam `process.cwd()`, sama dengan `homedir()`,
  `/`, atau mount point sistem; tambahkan penanda `.mathbank-export` yang dibuat
  sebelum operasi apa pun; tolak `..` setelah `resolve()`.

---

### 🟠 SEC-06 — SSRF tak terbatas lewat `ai.base_url` (dan `BGE_M3_SERVICE_URL`)

- **Lokasi:** `src/lib/ai/client.ts` (`fetch(\`${apiBase(cfg.baseUrl)}/chat/completions\`)`),
  `src/lib/embedding/bge-m3.ts`; sumber nilai `app_settings.ai.base_url`
  (`src/app/api/ai/settings/route.ts` → `saveAiSettings`, hanya `z.string().max(500)`).
- **CWE:** CWE-918.
- **Bukti (dijalankan):** `SEC-08` — dengan `baseUrl = http://127.0.0.1:<port>`,
  `chat()` benar-benar **membuka koneksi** ke loopback (`hit === "/chat/completions"`).
- **Dampak:** admin yang sah (atau **akun yang berhasil diambil alih** — `admin`
  adalah akun demo publik saat `DEMO_LOGIN=enabled`, `DEMO_PASSWORD` dibagikan di
  UI) dapat memakai server sebagai proxy ke jaringan internal / metadata cloud,
  mengeksfiltrasi respons lewat pesan galat (`HTTP 200: <body.slice(0,200)>`
  diteruskan ke respons `/api/ai/models`, `/api/ai/health`) dan lewat isi jawaban
  LLM. `BGE_M3_SERVICE_URL` juga tak divalidasi (ENV; dampak lebih kecil).
- **Perbaikan:** validasi saat **simpan** dan saat **pakai**: hanya `https`
  (opsional: izinkan `http` hanya untuk host loopback **eksplisit** di dev),
  tolak IP privat/loopback/link-local (pakai `assertPublicTarget` yang sudah ada),
  batasi daftar host bila memungkinkan (`AI_ALLOWED_HOSTS`). Jangan mengembalikan
  potongan body galat ke klien — log saja.

---

## 3. Temuan — MEDIUM

### 🟡 MS-01 — Paket rentan tanpa keputusan triage tertulis (`pnpm audit`: 3 HIGH)

- **Bukti:** `pnpm audit --prod` → **3 high**:
  - `source-map-js < 1.2.2` (GHSA-68fv-2mgg-jv7q, DoS) — jalur
    `@better-auth/api-key > better-auth > next > postcss > source-map-js`
    (build-time; perlu triage "tak terjangkau saat runtime" **tertulis**).
  - `@modelcontextprotocol/sdk < 1.31.0` (GHSA-6qxp-vccf-f47h, OAuth client
    mengirim kredensial ke AS yang dipilih server MCP) — jalur `shadcn` (dev),
    sementara **`@modelcontextprotocol/sdk@1.32.0` langsung** sudah di atas versi
    rentan. Reachability: kode kita **tidak** memakai OAuth client MCP.
  - Laporan `pnpm security:advisories` mencetak `⚠️ high: 3` tetapi **tidak gagal**
    dan **tidak** menulis catatan triage.
- **Perbaikan:** pin `source-map-js ≥1.2.2` via `pnpm.overrides`; tambahkan
  `pnpm audit --prod --audit-level=high` sebagai gate CI dengan allowlist
  eksplisit + tanggal tinjauan (skill: *dependency audit triage*).

### 🟡 MS-02 — CI tidak menjalankan audit dependency; `--ignore-scripts` tidak diverifikasi ulang

- **Lokasi:** `.github/workflows/ci.yml` — `pnpm install --frozen-lockfile`
  (tanpa `--ignore-scripts`), tidak ada langkah `pnpm audit`; policy
  `allowBuilds` (pnpm-workspace) hanya dihormati oleh pnpm 10.4+; `Dockerfile`
  memakai `--ignore-scripts` (baik) tetapi tidak ada pemeriksaan bahwa skrip
  build yang dibutuhkan (mis. `sharp`) tak diam-diam hilang.
- **Perbaikan:** langkah CI: `pnpm install --frozen-lockfile --ignore-scripts` →
  review skrip pending secara eksplisit (`pnpm approve-builds` di repo, commit
  `onlyBuiltDependencies`) → `pnpm rebuild` terkontrol → `pnpm audit --prod`.

### 🟡 MS-03 — Cookie sesi tak dipaksa `Secure`; `sameSite` diwarisi default

- **Lokasi:** `src/lib/auth/server.ts` (`advanced` hanya mengatur `ipAddress`;
  `useSecureCookies` tak diset), `next.config.ts` (HSTS hanya bila `APP_HTTPS=true`).
- **Analisis:** di produksi Better Auth menurunkan `Secure` dari `baseURL`
  (https di `b.iyo.my.id` → aman). Namun bila `BETTER_AUTH_URL` lupa diset/di-set
  `http://` (mis. compose default `http://localhost`!), cookie terbit **tanpa
  `Secure`**, dan `docker-compose.yml` default `APP_HTTPS=false` → **tanpa HSTS**.
  `sameSite` default (`lax`) tetap memberi CSRF dasar, tetapi sebaiknya eksplisit.
- **Perbaikan:** set eksplisit `advanced.useSecureCookies: isProductionRuntime(process.env)`,
  `defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: true }`,
  dan jadikan `APP_HTTPS=true` wajib di compose produksi (gagal-cepat bila
  domain publik + `APP_HTTPS≠true`).

### 🟡 MS-04 — Route mutasi tanpa rate limit / tanpa Zod (CONSTRAINTS #33, #22)

| Route | Masalah |
|---|---|
| `POST /api/bundles/[id]/export/moodle` | tak lewat `wrapRoute`. Otorisasi **ada** di service (`assertBundleWrite`), tetapi: **tanpa rate limit** (DoS: git + IO disk berulang), **tanpa cek `mustChangePassword`**, `params.id` **tanpa validasi UUID** (string acak → galat PG 500), dan pemetaan galat dilakukan manual (satu tempat lagi yang bisa menyimpang dari `errorResponse`). |
| `POST /api/dev/quick-login` | **tanpa rate limit aplikasi** (hanya rate limit Better Auth per `cf-connecting-ip` — di dev/LAN header itu tak ada → `req.ip` kosong). `z.string()` untuk `key` tanpa `.max()`. |
| `GET /api/dev/demo-status`, `GET /api/health`, `GET /api/ready` | publik; `/api/health` & `/api/ready` menjalankan kueri skema (invarian) tiap panggilan → **amplifikasi DB** oleh siapa pun; tanpa cache/TTL. `demo-status` juga membocorkan status lingkungan (minor). |
| `PATCH/DELETE /api/questions/[id]`, `/status`, `/flag`, `/permanent`, dan route `/api/bundles/[id]/*` | `params.id` tidak divalidasi **UUID** sebelum dipakai di kueri Drizzle (`eq(col, id)`). **Diverifikasi** ke DB: PostgreSQL menolak dengan `invalid input syntax for type uuid: "abc"` (SQLSTATE `22P02`) → **500** (respons generik `INTERNAL_ERROR`, tetapi log `status:500` & metrik galat terisi sampah; mudah di-trigger pemindai). **Bukan injeksi** — parameterisasi Drizzle terbukti (nilai masuk sebagai parameter, bukan konkatenasi). |

- **Perbaikan:** bungkus dua route manual dengan `wrapRoute` (atau tambahkan
  limiter + cek `mustChangePassword` di dalamnya); tambahkan `isUuid(params.id)`
  guard → 404; beri TTL singkat pada health/ready (mis. 5 s) atau perlakukan sebagai
  info non-rahasia yang dibatasi laju.

### 🟡 MS-05 — Limiter in-memory: rapuh di multi-instance, bocor memori, tanpa eviction

- **Lokasi:** `src/lib/api/rate-limit.ts` (`MemoryStore` di modul-level; `prune()`
  **tidak pernah dipanggil** oleh kode produksi — hanya tes), `idempotency.ts`
  (Map yang hanya dibersihkan saat `get`/`prune`).
- **Analisis (skill: *rate limiting — count in a shared store*):** dengan
  `docker compose … --scale app=N`, Batas efektif = `capacity × N`; pada
  serverless, limiter tak pernah menyala. `MemoryStore` menambah satu entri per
  IP palsu (§SEC-02) → **unbounded growth** (DoS memori). Idempotency store juga
  in-memory sehingga replay lintas instance tidak berfungsi.
- **Perbaikan:** implementasi `RateLimitStore`/`IdempotencyStore` di atas
  `rate_limit` Postgres (sudah ada untuk Better Auth) atau Redis; panggil `prune`
  terjadwal (interval 60 s) & batasi jumlah key (LRU).

### 🟡 MS-06 — Respons 500/503 membocorkan detail internal

- `GET /api/health` & `GET /api/ready` mengembalikan `error: err.message`
  (pesan tetap PG — host name, nama constraint, detail koneksi) ke **publik**.
- `GET /api/ai/models` & `/api/ai/health` (admin) meneruskan
  `HTTP <status>: <body 200 char>` dan `err.message` fetch — dapat memuat URL internal.
- `logger.redact()` hanya meredaksi berdasarkan **nama kunci**; nilai berbentuk
  string yang memuat rahasia di dalamnya (mis. `DATABASE_URL` dalam pesan error
  postgres, `Bearer sk-…` dalam body galat LLM) **tidak** diredaksi.
- **Perbaikan:** health publik → `{ status: "degraded" }` tanpa `message`;
  detail ke log. Tambahkan pola redaksi nilai (`postgres(ql)?://…@`,
  `Bearer …`, `sk-[A-Za-z0-9]{20,}`) di `redact`.

### 🟡 MS-07 — `rawContent` ingest tanpa batas ukuran (DoS penyimpanan)

- `ingestUploadSchema.rawContent = z.string().min(1)` — tanpa `.max`.
  `wrapRoute` membaca body via `req.text()` **tanpa** batas, lalu menulis ke
  `ingest_queue.raw_content` (TEXT) dan memprosesnya dengan regex parser O(n).
- **Dampak:** satu agen/API-key `machine` (atau sesi guru) dapat mengisi disk &
  memicu CPU spike; `enqueue` juga memindai hingga 500 baris terakhir dengan
  hash `rawContent` (biaya kuadratik terhadap ukuran antrean).
- **Perbaikan:** `z.string().max(2_000_000)`; cek `content-length` di wrapper
  sebelum `text()` (mis. 5 MB); simpan hash di kolom sendiri (unique index) alih-alih
  membandingkan ulang 500 baris.

### 🟡 MS-08 — Pemisahan pemanggil API key vs peran `agent`

- `actorFromApiKey()` memetakan API key **apa pun** ke `id = key.referenceId` lalu
  membaca `user_roles` akun itu. `createAgentKey` membuat **satu akun `agent`
  bersama** (`ensureAgentUser`) dan semua API key agen menempel padanya. Artinya
  `question:edit` (`own`) untuk **semua** key agen menunjuk ke **satu** identitas →
  (a) agen A dapat mengedit soal yang dibuat agen B (tidak ada isolasi antar-kunci);
  (b) **mencabut satu key tidak memengaruhi yang lain** (baik), tetapi **audit log
  tak dapat membedakan** agen mana yang bertindak (`actorId` sama) → melemahkan
  *R* pada STRIDE.
- **Perbaikan:** satu akun per key (atau `actor.id = apikey.id` dan
  `ownerId` per key), serta `name` key di audit.

### 🟡 MS-09 — `mustChangePassword` dapat "dilepas" sendiri lewat endpoint plugin

- `mustChangePassword` dideklarasikan `input: true` di `additionalFields`
  (`server.ts`), sehingga `POST /api/auth/update-user` (handler Better Auth,
  di luar `wrapRoute`) menerima `mustChangePassword: false` dari sesi pengguna
  itu sendiri. Blokir 403 `PASSWORD_CHANGE_REQUIRED` jadi tidak mengikat.
- **Perbaikan:** `input: false` dan ubah flag hanya dari service admin / setelah
  `change-password` sukses (dengan verifikasi password lama oleh Better Auth).

---

## 4. Temuan — LOW

| Kode | Temuan | Lokasi | Perbaikan |
|---|---|---|---|
| LS-01 | **Banyak route tak memakai `wrapRoute`** (`/img`, `/api/mcp`, `/api/health`, `/api/ready`, `/api/metrics`, `export/moodle`, `dev/quick-login`, `dev/demo-status`, `/api/auth/*`) → tak ada **tes/gerbang tunggal** untuk `X-Request-ID`, format galat, `mustChangePassword`, dan rate limit; header keamanan aplikasi tetap terpasang lewat `next.config headers()` (`/:path*`), **kecuali** respons `/img` yang hanya mengirim `nosniff` + (SVG) CSP. Tidak ada temuan eksploitasi langsung, tetapi ini jalur "aturan tersebar" yang dilarang `CONSTRAINTS #17` | `src/app/**/route.ts`, `next.config.ts`, `src/app/img/[shortId]/route.ts` | tambah tes header/format untuk route non-wrapper; pertimbangkan helper `rawRoute()` |
| LS-02 | **CSP `script-src 'unsafe-inline'`** — diterima sebagai utang (S9), tetapi berarti XSS di DOM akan langsung eksekusi; `style-src 'unsafe-inline'` juga | `next.config.ts` | aktifkan nonce bila bug Turbopack ditutup; sampai saat itu pertahankan sanitasi ketat (lihat LS-03) |
| LS-03 | **Markdown/KaTeX renderer kustom** — `renderText()` meng-escape `& < >` **tanpa `"` `'`**; aman karena hanya menghasilkan tag tanpa atribut dari input, tetapi satu perubahan template (`href="$1"`) saja akan menjadi XSS. Tidak ada tes kekebalan XSS untuk harga `"`/`'`/`javascript:` | `src/components/math/math-content.tsx` (`escapeHtml`, `renderText`) | escape kutip; tambah tes `renderText('<img onerror="x">')` & `renderText('" onmouseover="')` |
| LS-04 | **Validasi mime upload hanya dari header klien** (`file.type`); SVG diterima → disajikan dengan CSP `default-src 'none'` (baik), tetapi `/img` menyajikan **SVG remote hasil ingest** juga dengan CSP yang sama — pastikan CSP itu tak pernah dilonggarkan | `src/app/api/media/upload/route.ts`, `/img` route | verifikasi magic bytes (`sniffMime`) sebelum simpan; tolak SVG untuk upload manual bila tak dibutuhkan |
| LS-05 | **`--ignore-scripts` di Docker + `sharp: false`** — bila `sharp` dibutuhkan Next untuk optimasi gambar, build prod diam-diam memakai fallback; bukan celah, tetapi deviasi perilaku dev↔prod | `pnpm-workspace.yaml`, `Dockerfile` | dokumentasikan; uji image |
| LS-06 | **`/api/mcp` menerima API key lewat header dari browser** tanpa CORS — aman (tanpa `*`, jadi browser memblokir lintas-origin), tetapi key di sisi browser dapat dicuri oleh XSS karena `script-src 'unsafe-inline'` (LS-02). Rekomendasi: larang pembuatan key untuk dipakai di browser, dokumentasikan | `src/app/api/mcp/route.ts`, `docs/KEAMANAN.md` | dokumentasi + arahan agen server-side |
| LS-07 | **Laporan audit lama memuat ✅ yang tidak dapat diverifikasi** (mis. #20 LaTeX `openin_any='p'` padahal tak ada engine LaTeX; SEC-01 corpus disebut "HIGH" tetapi tak dikerjakan & tak bertes) | `MathBankAuditor/reports/17.10.2026/*` | tandai laporan lama sebagai *superseded*; hapus klaim tanpa bukti (lihat §Catatan Verifikasi) |

---

## 5. Info & observasi positif

| Kode | Observasi |
|---|---|
| IN-01 | **Proyeksi kolom** (`questionColumns`, `optionColumns`) konsisten di `/api/questions`, paket, MCP; `canSeeAnswerKey` mengecualikan `agent`/`machine`. `embedding*`/`aiTagged*` selalu dibuang. ✅ |
| IN-02 | **`wrapRoute`** memberi otorisasi, rate-limit, idempotensi, `X-Request-ID`, logging terstruktur & pesan galat generik untuk 500. Mapper error→status rapi. |
| IN-03 | **FSM + CAS** (`UPDATE … WHERE status = from` + `.returning()`) → 409 saat balapan; `markProcessing` antrean ingest juga CAS. ✅ |
| IN-04 | **Rahasia**: `ai.api_key` AES-256-GCM at-rest, dimask `***` saat dibaca UI; `BETTER_AUTH_SECRET` wajib di produksi (gagal-cepat); `.env` tak dilacak; pemindai rahasia pre-commit + tes kalibrasi. ✅ |
| IN-05 | **MCP**: `policy.ts` satu pintu; tool yang tak diizinkan tak didaftarkan; `create_question` memaksa `status: "draft"`; proyeksi tanpa `answer_key`; rate limit per aktor. ✅ |
| IN-06 | **AI output diperlakukan sebagai data**: `chatJson` → `parseJsonLoose` → `normalizeProposal` (validasi enum/rentang); `answer_key` tak pernah dikirim ke LLM. Prompt berisi konten soal (dapat berisi instruksi jahat) — lihat rekomendasi §6.4. |
| IN-07 | `npm`-level: `overrides` untuk `esbuild` rentan, patch `braces@3.0.3`, `auditConfig.ignoreGhsas` didokumentasikan. |
| IN-08 | Header aplikasi: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS saat HTTPS; `proxy.ts` membuang CSP kiriman klien (CVE-2026-44581). ✅ |

---

## 6. AI / LLM (OWASP LLM Top 10 2025)

| Risiko | Kondisi | Penilaian |
|---|---|---|
| **LLM01 Prompt injection** | Teks soal (dari korpus web milik pihak ketiga) masuk prompt. Instruksi di dalam korpus dapat "membajak" enrichment. | 🟡 Dampak terbatas: output hanya divalidasi & diterapkan ke field metadata; `answer_key` tak disentuh AI. Tambahkan penanda "konten adalah data, bukan instruksi" di prompt sistem dan **tolak** usulan yang menyimpang (mis. tag di luar daftar). |
| **LLM02/LLM07 Info disclosure** | System prompt + daftar topik/tag dikirim ke provider `ai.base_url`; **`answer_key` tidak** dikirim; `AiConfig.apiKey` dikirim sebagai header. | ✅ (tanpa PII) |
| **LLM05 Output handling** | Output → `normalizeProposal` → kolom DB → dirender sebagai markdown lewat **escape kustom**. Tak masuk SQL/shell/`eval`. | ⚠️ Lindungi `escapeHtml` (LS-03) sebagai batas tunggal; tambah tes. |
| **LLM06 Excessive agency** | Tool MCP tulis ada (`create_question`, `enrich`, `embed`), tanpa aksi destruktif. | ✅ |
| **LLM08 RAG** | Embedding per-soal (single tenant); dokumen di-ingest lewat parser. | ✅ |
| **LLM10 Unbounded consumption** | Rate limit per aktor ✅, tetapi batch enrichment 200 soal/req × `capacity 20` burst → biaya besar; MCP `enrich_question` tanpa batas token panggilan di `MCP_RATE_POLICY` (2/detik) + timeout 60 s. | 🟡 turunkan `max` batch & tambah kuota harian per aktor. |
| **Kebijakan PII/consent** | Soal matematika = konten publik; tak ada PII di prompt. `docs/KEPATUHAN-PRIVASI.md` mencatat pengiriman ke vendor LLM butuh DPA. | ⚠️ catat vendor di DPA. |

---

## 7. Kepatuhan (CONSTRAINTS & dokumen)

| # | Aturan | Status | Catatan |
|---|---|:--:|---|
| 20 | LaTeX `openin_any='p'` | ❔ **N/A — tidak dapat diverifikasi** | Tidak ada engine LaTeX/`\write18` di repo; hanya KaTeX (tanpa I/O). Klaim ✅ di laporan lama **tak berdasar**. |
| 21 | Rahasia tak di kode | ✅ | ENV + `app_settings` terenkripsi; `.env` gitignored |
| 22 | Validasi Zod di semua boundary | ⚠️ | `/api/dev/quick-login` (JSON manual, `key` tanpa max), `/api/health`, `/api/meta`; MCP pakai Zod ✅ |
| 23 | `AUTH_DEV_BYPASS` dev-only | ✅ kode / ⚠️ env | 3 pagar benar; `.env` kerja = `true` + URL produksi |
| 33 | Mutasi/daftar ber-rate-limit | ⚠️ | `export/moodle`, `dev/quick-login` tanpa limiter |
| 34 | Tak ada `SELECT *` pada jalur baca | ✅ | proyeksi dipakai; `getQuestionInternal` internal & tak dikirim |
| 35 | Izin `own` tak di gerbang tanpa `ownerId` | ❌ | SEC-01 (`setQuestionFlag`) |
| 36 | Penjagaan balapan baca-lalu-tulis | ✅ | FSM, antrean, reorder (transaksi) |
| 37 | Tes menyentuh jalur nyata per peran | ⚠️ | ada `question-authz.db.test.ts`, `bundle-authz.db.test.ts`; **celah** guru-menandai soal orang lain |
| — | KEAMANAN.md S1 "tahan spoof" | ❌ | benar untuk auth; **salah** untuk limiter aplikasi (SEC-02) |
| — | KEAMANAN.md S3 "kunci hanya viewer berwenang" | ✅ | termasuk paket (NEW4 diperbaiki) |
| — | PETA-DOKUMEN #31 | ❌ | MathBankAuditor tidak terdaftar |

---

## 8. Rencana remediasi (urut prioritas)

| # | Aksi | Temuan | Perkiraan |
|---|---|---|---|
| 1 | `assertCan(actor,"question:flag",{ ownerId: existing.authorId })` (panggilan per-soal, bukan pool) + hapus gerbang `permission` di route + tes route per peran (`teacher` milik sendiri → 200; milik orang lain → 403) | SEC-01 | ½–1 jam |
| 2 | Helper `clientIp()` tunggal + konfigurasi Caddy `X-Real-IP`/strip XFF + tes 429 | SEC-02 | 2 jam |
| 3 | Hapus `TLS_RELAXED_HOSTS`; redirect ketat | SEC-03 | 1 jam |
| 4 | `fetchCorpusImage`: tolak `.`/`..`, `resolve` + containment; tes | SEC-04 | 1 jam |
| 5 | `exportRoot()` allowlist + penanda + tolak cwd/home/root | SEC-05 | 2 jam |
| 6 | Validasi `ai.base_url` (https + non-privat) di simpan & pakai; jangan bocorkan body galat | SEC-06 | 1 jam |
| 7 | Triage `pnpm audit` (override source-map-js), gate CI | MS-01/02 | 2 jam |
| 8 | Cookie eksplisit + `APP_HTTPS` wajib di compose produksi | MS-03 | 1 jam |
| 9 | Bungkus route manual, UUID guard, TTL health | MS-04 | 2 jam |
| 10 | Store bersama (PG/Redis) + `prune` terjadwal | MS-02/05 | 1 hari |
| 11 | Redaksi nilai di logger + pesan health generik | MS-06 | 2 jam |
| 12 | Batas `rawContent` + hash kolom | MS-07 | 3 jam |
| 13 | Identitas per-API-key | MS-08 | ½ hari |
| 14 | `mustChangePassword: input:false` | MS-09 | ½ jam |
| 15 | Hardening renderer & tes XSS | LS-03/04 | 3 jam |

---

## Lampiran A — Bukti eksekusi

```
$ npx vitest run src/lib/security/audit-2026-10-17.proof.test.ts --reporter=verbose
 ✓ SEC-05 > segmen '..' diterima regex & path keluar dari CORPORA_BASE (CACAT)
   [SEC-05] error = corpus:// berkas tidak ditemukan:
     /home/hari/projects/qbank/etc/passwd (ENOENT …)
 ✓ SEC-03 > host relaxed memakai jalur https mentah, bukan fetch yang memverifikasi TLS
 ✓ SEC-07 > setiap XFF berbeda → bucket baru → tak pernah 429 (CACAT)
   [SEC-07] jumlah permintaan = 400 tanpa 429
 ✓ SEC-08 > server menjalin koneksi ke 127.0.0.1 sesuai konfigurasi
 ✓ SEC-06 > MATHBANK_EXPORT_DIR=cwd diterima
 ✓ BUG-01 > tanpa ownerId: can() false, dengan owner lain: false, dengan owner: true
```

```
$ pnpm audit --prod
3 vulnerabilities found — Severity: 3 high (1 ignored)
  source-map-js   <1.2.2  GHSA-68fv-2mgg-jv7q
  @modelcontextprotocol/sdk <1.31.0 GHSA-6qxp-vccf-f47h
  (+1 jalur duplikat yang di-ignore via auditConfig)
```

## Lampiran B — Berkas yang diperiksa (ringkas)

`src/lib/auth/*`, `src/lib/api/{route-wrapper,rate-limit,idempotency}.ts`,
`src/app/api/**/route.ts` (38 route), `src/lib/services/{question-read,question-write,question-status,
question-bulk,bundle-query,bundle-items,media/*,enrichment/*,settings-service,agent-key-service,moodle-export-service}.ts`,
`src/lib/{ai,embedding,mcp,export,ingest}/*`, `src/app/img/[shortId]/route.ts`,
`src/components/math/math-content.tsx`, `next.config.ts`, `src/proxy.ts`,
`Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.github/workflows/ci.yml`,
`pnpm-workspace.yaml`, `scripts/{secret-scan,security-advisories,smoke-prod,seed-users}.mjs`,
`docs/KEAMANAN.md`, `docs/KEPATUHAN-PRIVASI.md`, `CONSTRAINTS.md`.

---

## §Catatan Verifikasi (CONSTRAINTS #44)

| Butir | Isi |
|---|---|
| **Verifikator** | Audit otomatis berbasis skill `security-and-hardening` |
| **Metode** | Analisis kode pada jalur nyata + tes PoC yang dijalankan (`src/lib/security/audit-2026-10-17.proof.test.ts`, 6/6 lulus sebagai *bukti cacat*) + `pnpm audit --prod` + `pnpm security:advisories` + penelusuran konfigurasi deploy |
| **Terverifikasi benar (kontrol berjalan)** | Otorisasi proyeksi `answer_key` (IN-01), `wrapRoute` (IN-02), CAS FSM/antrean (IN-03), rahasia & enkripsi (IN-04), kebijakan MCP (IN-05), LLM output sebagai data (IN-06) |
| **Tidak dapat diverifikasi** | CONSTRAINTS #20 (LaTeX `openin_any`) — tak ada engine LaTeX di repo. Klaim ✅ pada laporan `MathBankAuditor/reports/17.10.2026/*` untuk #20 **tidak sah** dan harus dicabut. |
| **Koreksi atas laporan sebelumnya** | (1) Laporan `audit-security-and-hardening.md` (17.10.2026) menyatakan *"Critical 0 / High 2"* tanpa bukti eksekusi dan **tidak menyebut** SEC-01 (`question:flag`), SEC-02 (XFF), SEC-03 (TLS), SEC-05 (GitSync) — laporan ini menggantikannya. (2) Rekomendasi traversal corpus pada laporan itu **belum diterapkan** — bukti §SEC-04. (3) Klaim `docs/KEAMANAN.md` S1 "IP asli → tahan spoof" berlaku **hanya** untuk rate limit Better Auth. |
| **Batas audit** | Tidak menjalankan `pnpm build` penuh; tidak ada uji penetrasi jaringan nyata terhadap `b.iyo.my.id`. |
| **Gerbang mutu yang dijalankan** | `tsc --noEmit` → **0 error**; `eslint` berkas bukti → bersih; `pnpm test` → **966/967 lulus**. Satu kegagalan (`src/lib/telemetry/check-names.test.ts`) **preexisting & tak terkait**: 342 skrip `scripts/dev/*` berbahasa Indonesia (untracked, di luar indeks git). Dibuktikan dengan memindahkan sementara `scripts/dev/` → `node scripts/check-names.mjs` **hijau**; dipulihkan tanpa perubahan. `pnpm lint:names` gagal karena hal yang sama. |
| **Perubahan kode** | **Tidak ada** kode aplikasi diubah. Satu berkas tes baru: `src/lib/security/audit-2026-10-17.proof.test.ts` (hapus blok `it()` terkait setelah masing-masing temuan diperbaiki, ganti dengan tes positif di berkas tes asal). |
