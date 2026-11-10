---
title: Preset Izin API Key Read-Only dan Manajemen Hak Akses
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

## Goal Capsule

- **Objective:** Administrator dapat menerbitkan API Key dengan preset izin terarah (Read-Only Tamu tanpa kunci jawaban, Read-Only Pendidik dengan kunci jawaban, dan Agen MCP penuh) melalui antarmuka web dan API sistem, sehingga integrasi pihak ketiga dapat membaca data soal dan paket secara aman tanpa risiko kebocoran kunci jawaban atau mutasi data yang tidak diinginkan.
- **Means:** Menambahkan pilihan preset izin berbasis token scoping pada form pembuatan API Key (`AgentKeysCard` / `createAgentKey`) serta akun teknis pendukung, memanfaatkan mekanisme `apiKeyAllows` dan `canSeeAnswerKey` yang sudah ada di L1.
- **Product Authority:** Mengembangkan sistem API key Better Auth (`apikey.permissions` dan `metadata`) tanpa migrasi skema database PostgreSQL.
- **Open Blockers:** Tidak ada.

## Product Contract

### Summary
Fitur ini menyediakan pilihan preset hak akses saat Administrator membuat API Key di MathBank. Tersedia tiga preset utama: Read-Only Tamu (aman untuk publik/siswa karena kunci jawaban disembunyikan), Read-Only Pendidik (akses baca penuh mencakup kunci jawaban untuk integrasi LMS/auditor), dan Agen MCP (akses pembuatan dan kurasi soal untuk agen AI).

### Problem Frame
Saat ini pembuatan API Key di Pengaturan Sistem hanya memiliki preset tunggal untuk Agen MCP. Kunci tersebut secara otomatis membawa izin tulis/edit dan terikat pada peran agen yang tidak dapat melihat kunci jawaban. Administrator yang ingin memberikan akses baca saja (*read-only*) bagi sistem eksternal, pengembang tamu, atau integrasi kurikulum belum memiliki opsi di antarmuka web maupun backend untuk menentukan cakupan izin dan visibilitas kunci jawaban secara aman.

### Key Decisions
- **Token Scoping / Credential Attenuation:** Pilihan izin disematkan pada kredensial API key (`apikey.permissions`) dan jenis preset dicatat di kolom `apikey.metadata`, tanpa menambah Role baru di database PostgreSQL. `(session-settled: user-directed — chosen over role-baru: token scoping merupakan best practice API key dan menghindari role explosion serta migrasi DB)`. Governs R1, R2, R3, R4.
- **Dua Profil Read-Only Terpisah:** Membedakan Read-Only Tamu (`agent`, tanpa kunci jawaban) vs Read-Only Pendidik (`teacher`, dengan kunci jawaban) untuk mengakomodasi kebutuhan integrasi publik vs integrasi institusional/LMS. Governs R2, R3.

### Actors
- **A1. Administrator:** Pengguna dengan izin `user:manage` yang mengelola siklus hidup API Key di antarmuka MathBank.
- **A2. Klien Tamu (Guest Reader):** Aplikasi atau pengembang pihak ketiga yang mengakses REST API dengan key Read-Only Tamu.
- **A3. Klien Pendidik (Educator Reader):** Sistem LMS atau auditor kurikulum yang mengakses REST API dengan key Read-Only Pendidik.
- **A4. Agen AI (MCP Agent):** Agen kecerdasan buatan yang berinteraksi dengan MathBank untuk pembuatan dan pengayaan soal.

### Requirements

#### Pembuatan dan Konfigurasi Kunci
- R1. Endpoint `POST /api/system/agent-keys` menerima parameter opsional `preset` bertipe enum (`"read_only_guest"`, `"read_only_full"`, `"agent_full"`), dengan nilai bawaan `"read_only_guest"`.
- R2. Kunci dengan preset `"read_only_guest"` diikat ke akun teknis ber-peran `agent` (`agent@mathbank.local`) dengan `permissions: { question: ["read"], taxonomy: ["read"] }`, dan `metadata: { preset: "read_only_guest" }`.
- R3. Kunci dengan preset `"read_only_full"` diikat ke akun teknis ber-peran `teacher` (`reader-educator@mathbank.local`) dengan `permissions: { question: ["read"], taxonomy: ["read"] }`, dan `metadata: { preset: "read_only_full" }`.
- R4. Kunci dengan preset `"agent_full"` diikat ke akun teknis ber-peran `agent` (`agent@mathbank.local`) dengan `permissions: { question: ["create", "read", "edit", "flag"], taxonomy: ["read"], enrichment: ["run"] }`, dan `metadata: { preset: "agent_full" }`.

#### Penyajian Daftar dan Metadata
- R5. Endpoint `GET /api/system/agent-keys` membaca seluruh kunci milik akun teknis agen maupun pendidik, dan menyertakan field `preset` pada setiap item daftar kunci.
- R6. Antarmuka `AgentKeysCard` menampilkan badge visual penanda preset (`Read-Only Tamu`, `Read-Only Pendidik`, atau `Agen MCP`) pada tabel daftar kunci.

#### Antarmuka Pengguna
- R7. Dialog pembuatan kunci pada `AgentKeysCard` menyediakan pilihan preset (Read-Only Tamu, Read-Only Pendidik, Agen MCP) disertai ringkasan izin masing-masing opsi.

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
  - Penyediaan akun teknis pendukung `reader-educator@mathbank.local` untuk preset pendidik.
  - Penyesuaian `listAgentKeys` untuk memuat semua kunci agen/reader beserta field `preset` dari metadata.
  - Penambahan pilihan preset dan badge pada komponen antarmuka `AgentKeysCard`.
  - Pengujian integrasi DB (`agent-key.db.test.ts`) dan pengujian unit otorisasi API key.
- **Out of Scope:**
  - Penambahan enum peran baru di PostgreSQL.
  - Endpoint publik anonim tanpa API Key.
  - Pembuatan API key secara mandiri oleh pengguna non-admin.
