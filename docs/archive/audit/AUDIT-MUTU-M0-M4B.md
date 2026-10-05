# AUDIT MUTU — MathBank (M0–M4b + P1–P9)

> **Tanggal:** 2026-09-29 · **Auditor:** sesi pengembangan (agen)
> **Lingkup:** seluruh yang sudah dibangun — M0–M3 ✅, M4a/M4b ✅, pekerjaan lintas-milestone P1–P9.
> **Metode:** bukti dari kode nyata + API live + browser + coverage terukur. **Bukan** klaim dokumen.
> **Sifat:** jujur — temuan buruk dicatat apa adanya, bukan laporan pemanis.

---

## Ringkasan Eksekutif

| Dimensi | Nilai | Catatan |
|---------|:-----:|---------|
| Kode (tsc/lint) | 🟢 | 0 error, 0 warning |
| Tes | 🟢 | 152 unit + 21 integrasi DB + 41 e2e |
| Coverage | 🟡 | 98,6% **tapi hanya 8 file logika murni** — bukan keseluruhan |
| Keamanan | 🔴 | **`answer_key` bocor ke klien** (S3 nyata) |
| Kepatuhan constraint | 🟡 | `useMemo` di `sidebar.tsx` (vendor shadcn) |
| UI/UX | 🟢 | bank soal render benar, responsif, a11y dasar baik |
| Dokumentasi | 🟢 | peta dokumen terpelihara; beberapa klaim perlu perbaikan |

**Kesimpulan:** fondasi **kuat** (gerbang mutu nyata, tes berlapis, dokumen rapi).
Satu **cacat keamanan nyata** (kebocoran `answer_key`) harus ditutup — sudah terverifikasi live.

---

## Temuan

### 🔴 T-1: `answer_key` + field internal bocor ke klien (S3)

**Bukti live** (`GET /api/questions?limit=2`):
```
answerKey: {"correct":["B"]}          ← KUNCI JAWABAN BOCOR
embedding: <1024 float>                ← vektor internal
embeddingContentHash, embeddingModelName
aiTagged, aiTaggedAt
```

- Penyebab: `question-service.ts` memakai `.select()` **tanpa daftar kolom** → `SELECT *`.
- Semua route (list, detail) mengembalikan **30 field**, termasuk 6 field internal.
- **Tidak ada tes** yang memverifikasi `answerKey` tidak bocor.
- Dampak: (a) kunci jawaban dapat dibaca siapa pun yang punya akses baca; (b) payload bengkak
  (embedding 1024 float × N soal); (c) info internal terekspos.

**Tindakan:** proyeksi kolom eksplisit untuk baca; `answer_key` hanya untuk peran berwenang
(guru/admin) atau endpoint khusus. S3 di `KEAMANAN.md`.

### 🟠 T-2: `rate-limit.ts` tidak masuk `coverage.include`

- Punya 10 tes, tapi tak terukur karena tak terdaftar di `vitest.config.mts`.
- Dampak: klaim coverage tak mencakup modul keamanan baru.

### 🟠 T-3: Klaim "coverage 98,6%" mudah disalahpahami

- Coverage diukur pada **8 file logika murni saja** (`include` eksplisit).
- **Tidak** mencakup `question-service.ts` (inti, 391 baris), `src/lib/db/**`, komponen, halaman.
- Ini **desain yang sah** (logika murni diuji unit; sisanya e2e) — tapi harus **dinyatakan jelas**.

### 🟡 T-4: `useMemo`/`useCallback` di `sidebar.tsx`

- `CONSTRAINTS.md` #12 melarang, tapi `sidebar.tsx` = **komponen resmi shadcn** (vendor).
- Kode kita sendiri **patuh** (0 pelanggaran).
- Perlu keputusan: kecualikan `components/ui/**` dari aturan ini (vendor) — dan catat.

### 🟡 T-5: 7 direktori kosong (scaffold `src/lib/*`)

- `ai`, `embedding`, `ingest`, `latex`, `math`, `storage`, `telemetry` — kosong, untuk M9+.
- Bukan cacat, tapi mengotori inventaris. Alternatif: hapus sampai dibutuhkan.

---

## Yang Bagus (jujur, bukan pemanis)

- **Gerbang mutu nyata**: `pnpm check` benar-benar dijalankan; tsc/lint 0.
- **Tes berlapis**: unit + integrasi DB (21) + e2e (41) — bukan cuma angka.
- **FSM diuji**: semua transisi valid + ditolak.
- **Keamanan fondasi**: rate limiting (429 terverifikasi live), security headers (CSP, KaTeX tetap render).
- **Arsitektur berlapis** diikuti; guard `assertReady` (422) betul.
- **DB reproduktif**: `db:verify` hijau; 21 trigger + 2 CHECK + 1 HNSW dari file migrasi.
- **Dokumen**: peta dokumen terpelihara; keputusan besar → ADR.

---

## Prioritas Perbaikan

| # | Temuan | Prioritas | Bisa dikerjakan sekarang? |
|---|--------|:---------:|:-------------------------:|
| 1 | T-1 kebocoran `answer_key` | 🔴 | ✅ (tutup S3) |
| 2 | T-2 rate-limit tak terukur | 🟠 | ✅ |
| 3 | T-3 klaim coverage | 🟠 | ✅ (perjelas dokumen) |
| 4 | T-4 useMemo vendor | 🟡 | ✅ (keputusan + catat) |
| 5 | T-5 direktori kosong | 🟡 | ✅ (hapus/pertahankan) |

---

*Laporan ini menjadi dasar perbaikan pada commit berikutnya.*
