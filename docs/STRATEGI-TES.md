# STRATEGI-TES.md — Kontrak Pengujian MathBank

> **Status:** 📝 mengikat sejak 2026-09-29 (audit pasca-Fase 1).
> **Tujuan:** memastikan **setiap lapisan** punya jaring pengaman yang sesuai — bukan hanya logika murni.
> **Batas mutu:** lihat `CONSTRAINTS.md`. Gerbang: `pnpm check` (+ `pnpm db:verify`, `pnpm e2e`).

---

## 0. Prinsip

1. **Tes mengikuti LAPISAN, bukan selera.** Setiap lapisan (L1–L9) punya *jenis* tes yang wajib.
2. **Milestone tak boleh "selesai"** tanpa tes sesuai lapisannya (lihat §4).
3. **Ambang coverage jujur & per-lapisan** — bukan satu angka global yang menyembunyikan lubang.
4. **Tes gagal = kode salah ATAU tes salah.** Jangan melumpuhkan tes untuk "hijau".
5. **Tak ada tes palsu** — dilarang `it.todo`, `expect(true)`, atau placeholder (`1+1=2`).

---

## 1. Piramida Tes (MathBank)

```
         ╱╲      Smoke produksi (read-only)     — 7 pemeriksaan deploy
        ╱  ╲     `pnpm smoke:prod` (SETIAP rilis)
       ╱────╲
      ╱      ╲   Alur API (Vitest, handler)     — alur lintas-lapisan
     ╱        ╲  `src/lib/api/*.db.test.ts` (resolve→izin→validasi→DB)
    ╱──────────╲ Integrasi (Vitest + PG)       — service ↔ DB nyata
   ╱            ╲ Unit (Vitest)                — logika murni, cepat, banyak
  ╱______________╲
```

> **PENTING (2026-09-30):** E2E *browser* (Playwright) **dipensiunkan dari
> gerbang** karena rapuh di dev server (compile on-demand → `net::ERR_ABORTED`).
> Penggantinya: **tes alur API** (memanggil route handler langsung) +
> **smoke produksi**. Skrip lama tetap ada di `e2e-manual/` untuk dijalankan
> manual bila perlu. Lihat `docs/EVALUASI-STRATEGI-E2E.md`.

| Tingkat | Alat | DB? | Kecepatan | Jumlah |
|---------|------|-----|-----------|--------|
| **Unit** | Vitest | tidak | milidetik | banyak |
| **Integrasi** | Vitest + PG uji | ya | detik | sedang |
| **Alur API** | Vitest + handler | ya | detik | sedang |
| **Smoke produksi** | tsx + fetch | tidak | detik | 7 cek |

---

## 2. Matriks: Lapisan → Jenis Tes WAJIB

| Lapisan | Isi | Jenis tes | Lokasi | Status |
|---------|-----|-----------|--------|:------:|
| **L9 AI** | klien AI (baca `app_settings`) | Unit (mock `fetch`) | `src/lib/ai/*.test.ts` | ⬜ M10 |
| **L8 Data** | schema, migrasi | **Integrasi DB** + `db:verify` | `scripts/db-verify.ts` | 🟡 partial |
| **L7 Contracts** | Zod schema | **Unit** | `src/lib/contracts/*.test.ts` | ✅ |
| **L6 Engine/FSM** | FSM, parser, matcher | **Unit (pure)** | `src/lib/fsm/*.test.ts` | ✅ |
| **L5 Service** | question-service, audit | **Integrasi DB** | `src/lib/services/*.test.ts` | 🔴 |
| **L4 API** | route-wrapper, route | **Unit** (mock actor) | `src/lib/api/*.test.ts` | 🔴 |
| **L3 Hooks** | use-* (React Query) | **Unit** (mock fetch) | `src/lib/hooks/*.test.ts(x)` | 🔴 |
| **L2 Komponen** | kartu, panel, form | **Komponen** (Testing Library) | `src/components/**/*.test.tsx` | 🟡 |
| **L1 A11y/Display** | labels, MathContent | **Unit** | ada | ✅ |

**Aturan:** lapisan bertanda 🔴 = **utang tes** yang harus dibayar sebelum milestone terkait dinyatakan selesai.

---

## 3. Konvensi Penulisan

### 3.1 Penamaan
- File tes **bersebelahan** dengan kode: `question-service.ts` → `question-service.test.ts`.
- Deskripsi pakai **Bahasa Indonesia**, format: `describe("<unit>")` → `it("<perilaku yang diharapkan>")`.
- Satu `it` = satu perilaku. Nama menjelaskan **harapan**, bukan implementasi.
  - ✅ `it("soal tanpa answer_key tak bisa jadi ready")`
  - ❌ `it("test canBeReady")`

### 3.2 Struktur (Arrange–Act–Assert)
```ts
it("menolak transisi draft → ready", () => {
  // arrange
  const from = "draft" as const;
  // act + assert
  expect(() => transition(from, "ready")).toThrow(InvalidTransitionError);
});
```

### 3.3 Integrasi DB (service ↔ PG)
- Pakai **PG uji terpisah**, bukan DB dev. Lihat §5.
- Tiap suite: **seed minimal** di `beforeEach`, **bersihkan** di `afterEach` (transaksi rollback bila bisa).
- Uji **perilaku**, termasuk **penolakan invarian** (mis. stimulus depth, siklus topik).

### 3.4 Komponen (Testing Library)
- Uji lewat **peran & teks** (`getByRole`, `getByText`), bukan class/CSS.
- Query mutasi memakai **`user-event`**, bukan `fireEvent`.
- Jangan snapshot besar — rapuh & tak bermakna.

### 3.5 E2E (dipensiunkan — lihat §1)

Skrip lama ada di `e2e-manual/` (Playwright): `pnpm e2e:manual`. **Tidak** masuk
gerbang. Pengganti utama: tes alur API (§3.6) & smoke produksi (§3.7).

### 3.6 Alur API (Vitest + handler) — pengganti e2e alur

- File: `src/lib/api/*.db.test.ts`. Panggil **route handler langsung**:
  `import { POST } from "@/app/api/.../route"`, lalu `await POST(req, { params })`.
- Mock aktor: `vi.mock("@/lib/auth/resolve", () => ({ resolveActor: async () => aktor }))`.
- Uji **alur lintas-lapisan**: autentikasi (401) → izin (403) → validasi (400) →
  logika service → DB → format respons (`{ data }` / `{ error }`).
- Termasuk **rate-limit** (429) dan invarian bisnis (siklus 409).

### 3.7 Smoke produksi (read-only)

- `pnpm smoke:prod` (produksi sungguhan) atau `pnpm smoke:prod:demo`
  (bila login demo sengaja aktif).
- Menghantam domain hidup: halaman 200, guard 307→/login, CSP, pagar quick-login.
- **Read-only** — tak pernah menyentuh data. Jalankan setiap rilis.

---

## 4. "Definition of Done" per Milestone

Sebuah milestone **selesai** hanya bila:

- [ ] Semua **jenis tes wajib** untuk lapisan yang disentuh ada & hijau (§2).
- [ ] `pnpm check` exit 0 (typecheck · lint · coverage · build).
- [ ] `pnpm db:verify` hijau (bila menyentuh skema).
- [ ] `pnpm test:db` hijau (tes integrasi + alur API, bila menyentuh service/API).
- [ ] `pnpm smoke:prod` hijau (bila merilis ke produksi).
- [ ] Tak ada tes palsu / placeholder.

**Milestone menyentuh service (L5) atau API (L4) → WAJIB punya tes integrasi/unit masing-masing.**

---

## 5. Infrastruktur Tes DB (Integrasi)

Prinsip: **tes DB memakai database terpisah**, dijalankan sekali per suite.

```bash
# 1) DB uji (sekali setup; jangan pakai DB dev 'mathbank')
sudo -u postgres psql -p 5433 -c "CREATE DATABASE mathbank_test OWNER mathbank;"
sudo -u postgres psql -p 5433 -d mathbank_test -c \
  "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS pgcrypto;"
DATABASE_URL="postgresql://mathbank:$MB_PASSWORD@localhost:5433/mathbank_test" pnpm db:migrate
```

- Skrip tes membaca `TEST_DATABASE_URL` (fallback `DATABASE_URL`).
- **Jangan** jalankan tes destruktif terhadap DB dev.
- Untuk skema, andalkan `pnpm db:verify` (bukan tes Vitest) — sudah menutup jumlah objek & objek kritis.

### 5.1 Kredensial basi → `password authentication failed for user "mathbank"`

Gejala: `psql "$TEST_DATABASE_URL" -c 'select 1'` gagal dengan `FATAL: password
authentication failed for user "mathbank"`, padahal server hidup (role proyek
lain di klaster yang sama bisa connect). Artinya **password role di klaster
sudah bergeser** dari nilai di `.env` — bukan server mati, bukan DB hilang.

Perbaikan (pilih satu jalur; keduanya idempoten):

```bash
# Jalur A — punya akses superuser OS (postgres)
sudo -u postgres psql -p 5433 -c "ALTER ROLE mathbank WITH PASSWORD 'PASSWORD_BARU';"

# Jalur B — tanpa sudo: pakai role superuser lain yang kredensialnya masih valid
# (mis. proyek tetangga di klaster yang sama). JANGAN cetak password ke log.
psql "postgresql://SUPERUSER:RAHASIA@localhost:5433/postgres" \
  -c "ALTER ROLE mathbank WITH PASSWORD 'PASSWORD_BARU';"
```

Lalu **samakan** `.env` (`DATABASE_URL` + `TEST_DATABASE_URL`) dengan
`PASSWORD_BARU`. `.env.example` hanya berisi placeholder `GANTI_PASSWORD` —
jangan pernah menuliskan password asli (atau `***`, yang bukan placeholder
valid) di berkas yang di-commit.

Verifikasi (harus hijau sebelum lanjut):

```bash
psql "$TEST_DATABASE_URL" -c "select current_user, current_database()"
psql "$TEST_DATABASE_URL" -c "select extname from pg_extension where extname in ('vector','pg_trgm')"
psql "$TEST_DATABASE_URL" -c "select pg_get_userbyid(datdba) from pg_database where datname='mathbank_test'"
pnpm test:db
```

Catatan operasional: bila `pnpm test:db` sekarang berjalan tetapi ada tes
gagal, itu **bug kontrak/tes**, bukan kredensial. Kredensial yang benar
membuka jalan verifikasi; ia tidak menjamin suite hijau dengan sendirinya.

---

## 6. Ambang Coverage (jujur, per-lapisan)

Coverage **tidak** diukur sebagai satu angka global. Dua scope:

| Scope | Include | Ambang | Alat |
|-------|---------|--------|------|
| **logika murni** | `auth/*`, `fsm/*`, `contracts/*`, `display/*`, `api/route-wrapper` | ≥ 90% stmt | `vitest --coverage` |
| **service & integrasi** | `services/*` | ≥ 70% stmt (naik bertahap) | `vitest --coverage` (proyek DB) |

**Aturan:** **jangan turunkan ambang**. Menaikkan bertahap saat cakupan bertambah. Lapisan tanpa tes = **0%** dan tercatat sebagai utang (§2).

**Ambang gerbang global** (`vitest.config.mts`, diukur atas berkas `include`):
kini **statements 90 · branches 80 · functions 88 · lines 92** (dinaikkan di M14
dari 85/75/85/85). Cakupan nyata M14: **93.25 / 84.95 / 91.91 / 95.28**.

---

## 7. Yang TIDAK perlu dites

- Kode framework (Next.js routing, React rendering) — sudah diuji hulu.
- Tipe TypeScript (dijaga `tsc`, bukan tes runtime).
- Skema Drizzle murni (dijaga `db:verify` + Migrasi).
- CSS presentasional murni (dijaga tinjauan visual / e2e tema).

---

## 8. Utang Tes Saat Ini (audit 2026-09-29)

| # | Lapisan | Utang | Prioritas | Status |
|---|---------|-------|-----------|:------:|
| T1 | L4 API | `route-wrapper.ts` tanpa tes (pemetaan error 401/403/404/409/422/400/500) | 🔴 tinggi | ✅ **selesai** (22 tes) |
| T2 | L5 Service | `question-service.ts` (385 baris) tanpa tes integrasi | 🔴 tinggi | ✅ **selesai** (21 tes DB) |
| T3 | L3 Hooks | 5 hook tanpa tes | 🟡 sedang | ⬜ |
| T4 | L2 Komponen | 37 komponen, 0 tes (hanya e2e) | 🟡 sedang | ⬜ |
| T5 | L8 Data | schema tanpa tes integrasi (ditutup `db:verify`) | 🟢 rendah | ✅ (db:verify) |
| T6 | L1 Auth | `resolve.ts` 0% (pintu identitas + pagar dev-bypass) | 🔴 tinggi | ✅ **selesai** (16 tes) |
| T7 | L1 Auth | Matriks izin tak dikunci exhaustive | 🟠 menengah | ✅ **selesai** (20 tes kunci) |

> **Diperbarui 2026-09-29:** T1 & T2 dibayar. `route-wrapper` masuk scope coverage;
> tes integrasi DB dapat perintah sendiri `pnpm test:db` (lihat §5).
> **T6 & T7 dibayar** (audit RBAC): `resolve.ts` 0%→**94%**; matriks izin dikunci exhaustive
> (setiap sel) sehingga perubahan tak sengaja tertangkap. Modul `auth` kini **43 tes**.

---

*Dokumen ini hidup — perbarui saat lapisan/ambang berubah. Lihat `AUDIT-KODE.md` & `CONSTRAINTS.md`.*
