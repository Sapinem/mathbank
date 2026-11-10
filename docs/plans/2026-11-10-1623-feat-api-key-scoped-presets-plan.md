---
title: Preset Izin API Key Read-Only dan Manajemen Hak Akses
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

## Goal Capsule

- **Objective:** Administrator dapat menerbitkan dan mengelola API Key dengan preset izin terarah (Read-Only Tamu tanpa kunci jawaban, Read-Only Pendidik dengan kunci jawaban, dan Agen MCP penuh) melalui antarmuka web dan API sistem, sehingga integrasi pihak ketiga dapat mengakses katalog soal dan paket secara aman tanpa risiko kebocoran kunci jawaban atau mutasi data yang tidak diinginkan.
- **Means:** Menambahkan pilihan preset izin berbasis token scoping pada form pembuatan API Key (`AgentKeysCard` / `createAgentKey`) serta dedicated service accounts (`guest-reader@mathbank.local`, `reader-educator@mathbank.local`), memanfaatkan mekanisme `apiKeyAllows` dan `canSeeAnswerKey` yang sudah ada di L1 (KTD1).
- **Product Authority:** Mengembangkan sistem API key Better Auth (`apikey.permissions` dan `metadata`) tanpa migrasi skema database PostgreSQL.
- **Open Blockers:** Tidak ada.

<!-- Product Contract unchanged; enriched with Planning Contract, Implementation Units, Verification Contract, and Definition of Done per ce-plan. -->

## Product Contract

### Summary
Fitur ini menyediakan pilihan preset hak akses saat Administrator membuat API Key di MathBank. Tersedia tiga preset utama: Read-Only Tamu (aman untuk publik/siswa karena kunci jawaban disembunyikan), Read-Only Pendidik (akses baca penuh mencakup kunci jawaban untuk integrasi LMS/auditor), dan Agen MCP (akses pembuatan dan kurasi soal untuk agen AI). Kartu antarmuka di Pengaturan Sistem diselaraskan menjadi manajemen API Key terpadu.

### Problem Frame
Saat ini pembuatan API Key di Pengaturan Sistem hanya memiliki preset tunggal untuk Agen MCP. Kunci tersebut secara otomatis membawa izin tulis/edit dan terikat pada peran agen yang tidak dapat melihat kunci jawaban. Administrator yang ingin memberikan akses baca saja (*read-only*) bagi sistem eksternal, pengembang tamu, atau integrasi kurikulum belum memiliki opsi di antarmuka web maupun backend untuk menentukan cakupan izin dan visibilitas kunci jawaban secara aman.

### Key Decisions
- **Token Scoping / Credential Attenuation:** Pilihan izin disematkan pada kredensial API key (`apikey.permissions`) dan jenis preset dicatat di kolom `apikey.metadata`, tanpa menambah Role baru di database PostgreSQL. `(session-settled: user-directed — chosen over role-baru: token scoping merupakan best practice API key dan menghindari role explosion serta migrasi DB)`. Governs R1, R2, R3, R4.
- **Dedicated Service Account per Profil:** Memisahkan akun teknis untuk masing-masing peruntukan (`guest-reader@mathbank.local` untuk tamu, `reader-educator@mathbank.local` untuk pendidik, dan `agent@mathbank.local` untuk agen AI) agar batas identitas audit dan visibilitas kunci jawaban bersih. Governs R2, R3, R4.
- **Kontrak OpenAPI: enum publik, bukan matriks izin.** `preset` masuk kontrak sebagai enum publik — opsional ber-default `read_only_guest` pada `POST`, dan wajib pada setiap item `GET` (kunci lama tanpa metadata dilaporkan `agent_full`). Deskripsi field hanya menyebut konsekuensi izin tiap nilai dalam satu kalimat; matriks izin internal, nama akun teknis, dan detail `apikey.permissions` tidak dipublikasikan ke spec. Tidak ada skema bernama baru maupun ekstensi `x-`; artefak `public/openapi.json` + tabel §4 diregenerasi dari kode (ADR-0027), bukan disunting tangan. Governs R1, R5, R10.

### Actors
- **A1. Administrator:** Pengguna dengan izin `user:manage` yang mengelola siklus hidup API Key di antarmuka MathBank.
- **A2. Klien Tamu (Guest Reader):** Aplikasi atau pengembang pihak ketiga yang mengakses REST API dengan key Read-Only Tamu.
- **A3. Klien Pendidik (Educator Reader):** Sistem LMS atau auditor kurikulum yang mengakses REST API dengan key Read-Only Pendidik.
- **A4. Agen AI (MCP Agent):** Agen kecerdasan buatan yang berinteraksi dengan MathBank untuk pembuatan dan pengayaan soal.

### Requirements

#### Pembuatan dan Konfigurasi Kunci
- R1. Endpoint `POST /api/system/agent-keys` menerima parameter opsional `preset` bertipe enum (`"read_only_guest"`, `"read_only_full"`, `"agent_full"`), dengan nilai bawaan `"read_only_guest"`.
- R2. Kunci dengan preset `"read_only_guest"` diikat ke akun teknis ber-peran `agent` (`guest-reader@mathbank.local`) dengan `permissions: { question: ["read"], taxonomy: ["read"] }`, dan `metadata: { preset: "read_only_guest" }`.
- R3. Kunci dengan preset `"read_only_full"` diikat ke akun teknis ber-peran `teacher` (`reader-educator@mathbank.local`) dengan `permissions: { question: ["read"], taxonomy: ["read"] }`, dan `metadata: { preset: "read_only_full" }`.
- R4. Kunci dengan preset `"agent_full"` diikat ke akun teknis ber-peran `agent` (`agent@mathbank.local`) dengan `permissions: { question: ["create", "read", "edit", "flag"], taxonomy: ["read"], enrichment: ["run"] }`, dan `metadata: { preset: "agent_full" }`.

#### Penyajian Daftar dan Metadata
- R5. Endpoint `GET /api/system/agent-keys` membaca seluruh kunci milik akun-akun teknis (`agent@mathbank.local`, `guest-reader@mathbank.local`, `reader-educator@mathbank.local`), dan menyertakan field `preset` pada setiap item daftar kunci.
- R6. Antarmuka `AgentKeysCard` menampilkan badge visual penanda preset (`Read-Only Tamu`, `Read-Only Pendidik`, atau `Agen MCP`) pada tabel daftar kunci.

#### Kontrak OpenAPI
- R10. `preset` terbit di kontrak OpenAPI sebagai enum publik: field opsional ber-default `read_only_guest` pada body `POST /api/system/agent-keys`, dan field wajib pada setiap item respons `GET /api/system/agent-keys`. `public/openapi.json` dan tabel §4 `docs/KONTRAK-API.md` diregenerasi lewat `pnpm openapi:generate` (ADR-0027); karena itu nilai preset diperlakukan sebagai bagian API publik — mengganti namanya kelak adalah breaking change dan butuh ADR.

#### Antarmuka Pengguna
- R7. Dialog pembuatan kunci pada `AgentKeysCard` menyediakan pilihan preset (Read-Only Tamu, Read-Only Pendidik, Agen MCP) disertai ringkasan izin masing-masing opsi, serta label judul kartu diperbarui menjadi "Manajemen API Key & Akses Agen".

#### Penegakan Hak Akses Gateway
- R8. Permintaan API dengan header `x-api-key` dari preset `"read_only_guest"` dapat membaca data katalog soal dan paket tanpa menyertakan kunci jawaban atau status benar opsi (`canSeeAnswerKey: false`), dan ditolak saat mencoba mutasi (POST, PATCH, DELETE) dengan HTTP 403 `FORBIDDEN`.
- R9. Permintaan API dengan header `x-api-key` dari preset `"read_only_full"` dapat membaca data katalog soal dan paket beserta kunci jawaban dan status benar opsi (`canSeeAnswerKey: true`), dan ditolak saat mencoba mutasi (POST, PATCH, DELETE) dengan HTTP 403 `FORBIDDEN`.

### Key Flows
- F1. Pembuatan Kunci API Berbasis Preset
  - **Trigger:** Administrator membuka kartu Akses API di Pengaturan Sistem dan mengklik "Buat Kunci".
  - **Actors:** A1
  - **Steps:** Admin mengisi nama kunci, masa berlaku (hari), dan memilih salah satu preset izin (Read-Only Tamu, Read-Only Pendidik, atau Agen MCP). Admin menekan "Buat Kunci". Sistem membuat atau memastikan akun teknis yang sesuai telah ada, membuat API key melalui Better Auth dengan permission terarah, mencatat preset ke metadata, dan menampilkan token rahasia satu kali.
  - **Covered by:** R1, R2, R3, R4, R7
- F2. Pembacaan Katalog Soal oleh Klien Tamu
  - **Trigger:** Klien Tamu mengirimkan permintaan `GET /api/questions` atau `GET /api/bundles/{id}` dengan header `x-api-key`.
  - **Actors:** A2
  - **Steps:** Pipa `wrapRoute` memvalidasi kunci, mengidentifikasi aktor dengan peran `agent` dan izin `question:read`. Service memproyeksikan data soal dengan `canSeeAnswerKey: false` sehingga seluruh kunci jawaban dan boolean `isCorrect` disaring.
  - **Covered by:** R8

### Acceptance Examples
- AE1. Klien Tamu Ditolak Melakukan Mutasi
  - **Covers:** R8
  - **Given:** Klien memiliki API Key dengan preset `read_only_guest`.
  - **When:** Klien mengirimkan `POST /api/questions` dengan payload soal baru.
  - **Then:** Gateway merespons dengan HTTP 403 `FORBIDDEN`.
- AE2. Klien Tamu Membaca Soal Tanpa Kunci Jawaban
  - **Covers:** R8
  - **Given:** Klien memiliki API Key dengan preset `read_only_guest`.
  - **When:** Klien mengirimkan `GET /api/questions/{id}`.
  - **Then:** Respons HTTP 200 `{ data: { ... } }` tidak memuat properti `answerKey`, dan opsi jawaban tidak memuat `isCorrect`.
- AE3. Klien Pendidik Membaca Soal Beserta Kunci Jawaban
  - **Covers:** R9
  - **Given:** Klien memiliki API Key dengan preset `read_only_full`.
  - **When:** Klien mengirimkan `GET /api/questions/{id}`.
  - **Then:** Respons HTTP 200 `{ data: { ... } }` memuat properti `answerKey` dan `options[].isCorrect`.
- AE4. Klien Pendidik Ditolak Melakukan Mutasi
  - **Covers:** R9
  - **Given:** Klien memiliki API Key dengan preset `read_only_full`.
  - **When:** Klien mengirimkan `PATCH /api/questions/{id}`.
  - **Then:** Gateway merespons dengan HTTP 403 `FORBIDDEN`.

### Scope Boundaries
- **In Scope:**
  - Penambahan parameter `preset` pada skema input dan service pembuatan API Key.
  - Penyediaan akun teknis pendukung `guest-reader@mathbank.local` dan `reader-educator@mathbank.local`.
  - Penyesuaian `listAgentKeys` untuk memuat semua kunci agen/reader beserta field `preset` dari metadata.
  - Penambahan pilihan preset dan badge pada komponen antarmuka `AgentKeysCard`.
  - Pengujian integrasi DB (`agent-key.db.test.ts`) dan pengujian unit otorisasi API key.
- **Out of Scope:**
  - Penambahan enum peran baru di PostgreSQL.
  - Endpoint publik anonim tanpa API Key.
  - Pembuatan API key secara mandiri oleh pengguna non-admin.

---

## Planning Contract

### Key Technical Decisions
- **KTD1. Dedicated Service Accounts via Helper Tunggal:** Menggeneralisasi fungsi `ensureAgentUser()` menjadi fungsi helper `ensureTechnicalUser(email, name, role)` di `src/lib/services/agent-key-service.ts` yang membuat akun teknis tanpa password secara idempoten. `(session-settled: user-directed — chosen over berbagi-satu-akun-agent: pemisahan akun teknis menjaga kebersihan audit trail dan memisahkan identitas agen AI dari tamu pembaca)`. Governs R2, R3, R4.
- **KTD2. Metadata JSON Serialization & Backward Compatibility:** Kolom `apikey.metadata` (tipe `text`) diisi string JSON `{ "preset": input.preset }`. Saat membaca di `listAgentKeys()`, parser melakukan JSON.parse defensif; jika kunci tidak memiliki `metadata` atau gagal di-parse, nilainya otomatis fallback ke `"agent_full"`. Governs R1, R5.
- **KTD3. Multi-User Key Lookup:** `listAgentKeys()` mengambil daftar `referenceId` dari ketiga akun teknis dan melakukan query dengan klausa `inArray(apiKey.referenceId, userIds)`, lalu mengurutkannya berdasarkan `apiKey.createdAt DESC`. Governs R5.
- **KTD4. UI Form & Badge UX:** Menambahkan kontrol RadioGroup / Select pada `AgentKeysCard` dengan 3 opsi terstruktur, serta komponen Badge dengan varian warna berbeda di tabel: `Tamu (Read-Only)` (badge abu-abu/secondary), `Pendidik (Read-Only)` (badge biru/outline), dan `Agen MCP (Penuh)` (badge ungu/default). Governs R6, R7.

### High-Level Technical Design

```
+---------------------------------------------------------------------------------------------------+
|                                        Admin UI (Pengaturan)                                      |
|                                       src/components/system/                                      |
|                                         AgentKeysCard.tsx                                         |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                    POST /api/system/agent-keys   |   GET /api/system/agent-keys
                    { name, expiresInDays, preset }|   Returns: { items: AgentKeyInfo[] }
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                 L2 API Gateway (src/app/api/...)                                  |
|                                       wrapRoute() validation                                      |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                L3 Service: agent-key-service.ts                                   |
|                                                                                                   |
|  createAgentKey()                                                  listAgentKeys()                |
|  ├─ 1. Tentukan target teknis:                                     ├─ 1. Ambil 3 service account  |
|  │    • read_only_guest -> guest-reader@mathbank.local [agent]     │     [agent, guest, educator] |
|  │    • read_only_full  -> reader-educator@mathbank.local [teacher]│                              |
|  │    • agent_full      -> agent@mathbank.local [agent]            ├─ 2. Query apikey WHERE       |
|  ├─ 2. Set permissions:                                            │     reference_id IN (...)    |
|  │    • read_only: { question: ["read"], taxonomy: ["read"] }     │                              |
|  │    • agent_full: { question: [...], taxonomy: [...], etc }      ├─ 3. Parse metadata.preset    |
|  └─ 3. Simpan ke Better Auth + metadata { preset }                 └─ 4. Return list ke UI        |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                      L1 Auth Guard Enforcement                                    |
|                                                                                                   |
|  Incoming HTTP Request (Header: x-api-key: ...)                                                   |
|  ├─ resolveActor() -> actor.roles dari user_roles + actor.apiKeyPermissions dari apikey           |
|  ├─ wrapRoute -> assertCan():                                                                     |
|  │    └─ apiKeyAllows() menolak mutasi (POST/PATCH/DELETE) jika permissions cuma ["read"] -> 403  |
|  └─ questionColumns() / listBundleItems():                                                        |
|       └─ canSeeAnswerKey() memeriksa actor.roles:                                                 |
|            • guest-reader (agent)   -> canSeeAnswerKey = FALSE -> kunci jawaban disaring (S3)    |
|            • reader-educator (teacher) -> canSeeAnswerKey = TRUE  -> kunci jawaban disertakan     |
+---------------------------------------------------------------------------------------------------+
```

---

## Implementation Units

### U1. Backend Dedicated Technical Users, Preset Service, & API Route
- **Goal:** Menambahkan logika penanganan preset pada `agent-key-service.ts` dan route `POST /api/system/agent-keys`.
- **Requirements:** R1, R2, R3, R4, R5, R10, KTD1, KTD2, KTD3
- **Dependencies:** None
- **Files:**
  - `src/lib/services/agent-key-service.ts`
  - `src/app/api/system/agent-keys/route.ts`
  - `src/lib/api/openapi/registry.ts`
  - `public/openapi.json` (dihasilkan)
  - `docs/KONTRAK-API.md` (blok §4 dihasilkan)
  - `src/lib/services/agent-key.db.test.ts`
- **Approach:**
  1. Di `src/lib/services/agent-key-service.ts`:
     - Deklarasikan enum/tipe `ApiKeyPreset = "read_only_guest" | "read_only_full" | "agent_full"`.
     - Perbarui interface `AgentKeyInfo` dengan menambahkan field `preset: ApiKeyPreset`.
     - Buat helper `ensureTechnicalUser(email: string, name: string, role: Role): Promise<string>` yang mengabstraksi pembuatan akun teknis tanpa password secara idempoten.
     - Di `createAgentKey(actor, input)`: terima `preset?: ApiKeyPreset` (default `"read_only_guest"`).
       - Jika `read_only_guest`: target `guest-reader@mathbank.local` (role `agent`), permissions `{ question: ["read"], taxonomy: ["read"] }`.
       - Jika `read_only_full`: target `reader-educator@mathbank.local` (role `teacher`), permissions `{ question: ["read"], taxonomy: ["read"] }`.
       - Jika `agent_full`: target `agent@mathbank.local` (role `agent`), permissions `{ question: ["create", "read", "edit", "flag"], taxonomy: ["read"], enrichment: ["run"] }`.
       - Berikan `metadata: { preset: chosenPreset }` pada panggilan `auth.api.createApiKey`.
     - Di `listAgentKeys(actor)`:
       - Pastikan ketiga akun teknis di-query ID-nya.
       - Query tabel `apikey` dengan `inArray(apiKey.referenceId, [agentId, guestId, educatorId])`.
       - Ekstrak `preset` dari `apiKey.metadata`, fallback ke `"agent_full"` jika kosong.
  2. Di `src/app/api/system/agent-keys/route.ts`:
     - Tambahkan `preset: z.enum(["read_only_guest", "read_only_full", "agent_full"]).optional().default("read_only_guest")` pada `createSchema`.
     - Beri `.describe(...)` satu kalimat pada field itu yang menyebut ketiga nilai dan konsekuensi izinnya — deskripsi inilah yang terbit ke kontrak, bukan matriks izin internal.
  3. Di `src/lib/api/openapi/registry.ts`:
     - Tambahkan `preset: z.enum(["read_only_guest", "read_only_full", "agent_full"])` ke `agentKeySchema` (respons `GET`), dengan `.describe(...)` ringkas.
     - Perbarui `notes` `POST /api/system/agent-keys` agar menyebut nilai bawaan `read_only_guest` dan bahwa kunci lama tanpa metadata dilaporkan `agent_full`.
     - Regenerasi artefak: `pnpm openapi:generate`, lalu pastikan `pnpm openapi:check` hijau. Jangan menyunting `public/openapi.json` atau tabel §4 dengan tangan (ADR-0027).
- **Patterns to follow:** `ensureAgentUser` pattern eksisting di `agent-key-service.ts`, Zod validation di `wrapRoute`.
- **Test scenarios:**
  - *Happy path*: Admin membuat kunci dengan preset `read_only_guest`, verifikasi `referenceId` adalah akun guest, metadata berisi preset, dan muncul di `listAgentKeys`.
  - *Happy path*: Admin membuat kunci dengan preset `read_only_full`, verifikasi `referenceId` adalah akun educator, dan muncul di `listAgentKeys`.
  - *Edge case*: Kunci lama tanpa metadata di-list oleh `listAgentKeys` dan menghasilkan `preset: "agent_full"`.
  - *Failure path*: Input preset tidak valid ditolak oleh validasi Zod (HTTP 400).
- **Verification:** Jalankan `pnpm test:db` untuk `src/lib/services/agent-key.db.test.ts`.

---

### U2. Frontend React Query Hooks & Antarmuka Kartu Pengaturan
- **Goal:** Memperbarui antarmuka pengguna pada `AgentKeysCard` agar admin dapat memilih preset saat membuat kunci dan melihat label preset pada tabel daftar kunci.
- **Requirements:** R6, R7, KTD4
- **Dependencies:** U1
- **Files:**
  - `src/lib/hooks/use-agent-keys.ts`
  - `src/components/system/agent-keys-card.tsx`
- **Approach:**
  1. Di `src/lib/hooks/use-agent-keys.ts`:
     - Perbarui tipe `AgentKeyInfo` agar menyertakan `preset?: "read_only_guest" | "read_only_full" | "agent_full"`.
     - Perbarui mutation input pada `useCreateAgentKey` agar menerima `preset?: "read_only_guest" | "read_only_full" | "agent_full"`.
  2. Di `src/components/system/agent-keys-card.tsx`:
     - Perbarui judul kartu menjadi "Manajemen API Key & Akses Agen" dengan deskripsi yang mencakup akses integrasi read-only dan agen AI.
     - Tambahkan state `preset` pada form dialog pembuatan kunci (default `"read_only_guest"`).
     - Tambahkan kontrol pilihan preset (RadioGroup atau Select/SelectContent) dengan label jelas:
       - **Read-Only Tamu (Publik/Siswa)**: Akses baca soal & paket, kunci jawaban otomatis disembunyikan.
       - **Read-Only Pendidik (LMS/Auditor)**: Akses baca soal & paket lengkap beserta kunci jawaban dan pembahasan.
       - **Agen MCP (Full Access)**: Akses buat, baca, ubah, dan pengayaan soal untuk agen AI.
     - Pada tabel daftar kunci:
       - Tambahkan kolom/badge untuk menampilkan preset kunci dengan visual badge:
         - `read_only_guest` -> Badge abu-abu/secondary: `Tamu (Read-Only)`.
         - `read_only_full` -> Badge outline/biru: `Pendidik (Read-Only)`.
         - `agent_full` -> Badge default: `Agen MCP`.
- **Patterns to follow:** Komponen Shadcn UI (`Badge`, `Select`, `RadioGroup`, `Dialog`), hook React Query `useCreateAgentKey`.
- **Test scenarios:**
  - *UI State*: Dialog menampilkan ketiga pilihan preset dan mengirimkan nilai preset yang dipilih ke mutasi `useCreateAgentKey`.
  - *UI Render*: Tabel kunci menampilkan badge yang sesuai dengan `preset` pada data item.
- **Verification:** Jalankan `pnpm lint`, `pnpm typecheck`, dan verifikasi render komponen.

---

### U3. Pengujian Integrasi Database & Verifikasi Otorisasi Gateway
- **Goal:** Memastikan pengujian integrasi database mencakup seluruh skenario pembuatan preset serta membuktikan penegakan izin L1 pada kunci yang dihasilkan.
- **Requirements:** R8, R9, AE1, AE2, AE3, AE4
- **Dependencies:** U1
- **Files:**
  - `src/lib/services/agent-key.db.test.ts`
- **Approach:**
  1. Bersihkan technical users saat setup/teardown test: `agent@mathbank.local`, `guest-reader@mathbank.local`, `reader-educator@mathbank.local`.
  2. Tulis skenario pengujian di `src/lib/services/agent-key.db.test.ts`:
     - Buat kunci untuk masing-masing preset (`read_only_guest`, `read_only_full`, `agent_full`).
     - Buktikan bahwa aktor yang dihasilkan dari key `read_only_guest`:
       - `can(actor, "question:view") === true`
       - `can(actor, "question:create") === false`
       - `canSeeAnswerKey(actor) === false` (kunci jawaban disaring)
     - Buktikan bahwa aktor yang dihasilkan dari key `read_only_full`:
       - `can(actor, "question:view") === true`
       - `can(actor, "question:create") === false`
       - `canSeeAnswerKey(actor) === true` (kunci jawaban terlihat)
     - Buktikan bahwa `listAgentKeys` mengembalikan semua kunci dengan preset yang tepat.
     - Buktikan bahwa `revokeAgentKey` berhasil mencabut kunci dari masing-masing preset.
- **Patterns to follow:** `vitest.db.config.mts`, `src/lib/services/agent-key.db.test.ts`.
- **Test scenarios:**
  - Covers AE1: Key `read_only_guest` ditolak izin `question:create` / mutasi.
  - Covers AE2: Key `read_only_guest` menghasilkan `canSeeAnswerKey(actor) === false`.
  - Covers AE3: Key `read_only_full` menghasilkan `canSeeAnswerKey(actor) === true`.
  - Covers AE4: Key `read_only_full` ditolak izin `question:create` / mutasi.
- **Verification:** Jalankan `pnpm test:db` dan pastikan seluruh test hijau.

---

## Verification Contract

### Test Commands
```bash
# 1. Typecheck dan Linter
pnpm typecheck
pnpm lint
pnpm lint:names

# 2. Unit Testing
pnpm test

# 3. Integrasi Database (Wajib DB Uji Nyata)
pnpm test:db

# 4. Validasi OpenAPI Spec
pnpm openapi:generate
pnpm openapi:check

# 5. Production Build
pnpm build
```

### Quality Gates (CONSTRAINTS.md)
- **#28b Penamaan:** Seluruh nama fungsi, file, route, dan variabel berbahasa Inggris (`pnpm lint:names`).
- **#6 React Hooks:** Dilarang menggunakan `useMemo`/`useCallback` pada komponen buatan sendiri.
- **#7 Tailwind:** Dilarang menggunakan `space-y-*`, gunakan `flex flex-col gap-*`.
- **#22 Zod Validation:** Seluruh input boundary di API divalidasi skema Zod.
- **#35 Service Authorization:** Penegakan izin ditegakkan secara tepat pada service layer.

---

## Definition of Done

- [ ] Seluruh unit implementasi (U1, U2, U3) selesai dikerjakan sesuai spesifikasi.
- [ ] Ketiga preset API Key (`read_only_guest`, `read_only_full`, `agent_full`) dapat dibuat melalui UI Pengaturan dan API.
- [ ] Kunci `read_only_guest` terbukti menyembunyikan kunci jawaban dan menolak mutasi.
- [ ] Kunci `read_only_full` terbukti menyertakan kunci jawaban dan menolak mutasi.
- [ ] Seluruh pengujian unit dan database integrasi (`pnpm test:db`) lulus 100%.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm lint:names`, `pnpm openapi:check`, dan `pnpm build` hijau tanpa error.
- [ ] Tidak ada kode uji atau artefak sementara yang tertinggal di working tree.
