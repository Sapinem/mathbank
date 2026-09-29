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
         ╱╲         E2E (Playwright)          — 33 skenario, alur lintas-lapisan
        ╱  ╲        sedikit, lambat, berharga
       ╱────╲
      ╱      ╲      Integrasi (Vitest + PG)   — service ↔ DB nyata
     ╱        ╲     sedang, sedang
    ╱──────────╲
   ╱            ╲   Unit (Vitest)             — logika murni, cepat, banyak
  ╱______________╲
```

| Tingkat | Alat | DB? | Kecepatan | Jumlah |
|---------|------|-----|-----------|--------|
| **Unit** | Vitest | tidak | milidetik | banyak |
| **Integrasi** | Vitest + PG uji | ya | detik | sedang |
| **E2E** | Playwright | ya (dev) | detik–menit | sedikit |

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

### 3.5 E2E (Playwright)
- Satu `spec` = satu area fitur (`theme`, `responsive`, `bank-soal`, `api`).
- Uji **alur pengguna**, bukan tiap tombol.
- Proyek ganda: `desktop` (1280) + `mobile` (Pixel 5).

---

## 4. "Definition of Done" per Milestone

Sebuah milestone **selesai** hanya bila:

- [ ] Semua **jenis tes wajib** untuk lapisan yang disentuh ada & hijau (§2).
- [ ] `pnpm check` exit 0 (typecheck · lint · coverage · build).
- [ ] `pnpm db:verify` hijau (bila menyentuh skema).
- [ ] `pnpm e2e` hijau (bila menyentuh UI/alur).
- [ ] Tak ada tes palsu / placeholder.

**Milestone menyentuh service (L5) atau API (L4) → WAJIB punya tes integrasi/unit masing-masing.**

---

## 5. Infrastruktur Tes DB (Integrasi)

Prinsip: **tes DB memakai database terpisah**, dijalankan sekali per suite.

```bash
# DB uji (sekali setup; jangan pakai DB dev 'mathbank')
sudo -u postgres psql -p 5433 -c "CREATE DATABASE mathbank_test OWNER mathbank;"
sudo -u postgres psql -p 5433 -d mathbank_test -c \
  "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS pgcrypto;"
DATABASE_URL="postgresql://mathbank:...@localhost:5433/mathbank_test" pnpm db:migrate
```

- Skrip tes membaca `TEST_DATABASE_URL` (fallback `DATABASE_URL`).
- **Jangan** jalankan tes destruktif terhadap DB dev.
- Untuk skema, andalkan `pnpm db:verify` (bukan tes Vitest) — sudah menutup jumlah objek & objek kritis.

---

## 6. Ambang Coverage (jujur, per-lapisan)

Coverage **tidak** diukur sebagai satu angka global. Dua scope:

| Scope | Include | Ambang | Alat |
|-------|---------|--------|------|
| **logika murni** | `auth/*`, `fsm/*`, `contracts/*`, `display/*`, `api/route-wrapper` | ≥ 90% stmt | `vitest --coverage` |
| **service & integrasi** | `services/*` | ≥ 70% stmt (naik bertahap) | `vitest --coverage` (proyek DB) |

**Aturan:** **jangan turunkan ambang**. Menaikkan bertahap saat cakupan bertambah. Lapisan tanpa tes = **0%** dan tercatat sebagai utang (§2).

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

> **Diperbarui 2026-09-29:** T1 & T2 dibayar. `route-wrapper` masuk scope coverage;
> tes integrasi DB dapat perintah sendiri `pnpm test:db` (lihat §5).

---

*Dokumen ini hidup — perbarui saat lapisan/ambang berubah. Lihat `AUDIT-KODE.md` & `CONSTRAINTS.md`.*
