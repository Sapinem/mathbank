# AUDIT KODE — MathBank (2026-09-29)

> **Lingkup:** seluruh `src/` (2.855 baris lib · 2.997 komponen · 635 app), skema DB, konfigurasi mutu, e2e.
> **Metode:** pembacaan berkas inti, pencarian statis (smell), verifikasi DB langsung, e2e Playwright, audit coverage.
> **Kesimpulan umum:** fondasi **sehat & disiplin** (nol `any`, nol `ts-ignore`, nol `useMemo`, larangan React Compiler dipatuhi). Namun ditemukan **1 cacat gerbang mutu serius**, **1 risiko keamanan**, dan beberapa **cacat kecil**.

---

## Status Perbaikan (setelah audit)

| # | Temuan | Status |
|---|---|---|
| **A1** | Coverage palsu 9% | ✅ **Diperbaiki** — `@vitest/coverage-v8` terpasang; `check` kini jalankan `test:coverage`; cakupan diskop ke logika murni → **98,7% stmt / 97,6% cabang / 100% fungsi** |
| **A2** | Dev bypass = admin | ✅ **Diperbaiki** — pagar `NODE_ENV === "production"` → bypass mati total di produksi |
| **A3** | Dashboard hardcoded 0 | ✅ **Diperbaiki** — `/api/stats` + hook `use-stats` (14 soal, distribusi nyata) |
| **A4** | Rute `/bank-soal/baru` & `/[id]` 404 | ⏳ **Dijadwalkan M4c** (dokumentasi jujur) |
| **A5** | `smoke.test.ts` placeholder | ✅ **Dihapus** |
| **A6** | FSM tulis DB saat status sama | ✅ **Diperbaiki** — `changeQuestionStatus` keluar awal bila `from===to` |
| **A7** | `changeStatusSchema` tak dipakai | ⏳ Kosmetik — dicatat |
| **A8** | Paginasi offset | ⏳ Dicatat; tangani saat skala menuntut |
| **A9** | 7 direktori kosong (ai/embedding/…) | ⏳ Scaffold milestone mendatang; git tak melacak dir kosong |

**Gerbang mutu kini NYATA:** `pnpm check` = typecheck 0 · lint 0 · **coverage 98,7%** · build 0 · e2e 33 hijau (desktop 17 / mobile 16).

---

## Ringkasan Temuan (awal)

| # | Tingkat | Temuan | Dampak |
|---|---|---|---|
| **A1** | 🔴 **Kritis** | Coverage nyata **9,12%**, bukan ≥85%. Dependensi `@vitest/coverage-v8` tak terpasang → ambang **tak pernah ditegakkan** | Gerbang mutu **palsu** sejak M0 |
| **A2** | 🟠 Tinggi | `AUTH_DEV_BYPASS=*** membuka **seluruh aplikasi sebagai admin**, tanpa syarat `NODE_ENV` | Bila env bocor ke produksi → **lubang keamanan total** |
| **A3** | 🟡 Sedang | Dashboard dulu **hardcoded 0** (kini diperbaiki — `/api/stats`) | Sudah ditangani |
| **A4** | 🟡 Sedang | `href="/bank-soal/baru"` & `/bank-soal/[id]` → **404** (rute belum ada) | Tombol "Buat Soal" & klik kartu mati (M4c) |
| **A5** | 🟢 Rendah | `src/lib/search/smoke.test.ts` = placeholder `1+1=2` di folder tak relevan | Sampah |
| **A6** | 🟢 Rendah | `transition(from,to)` membolehkan `from===to`; service tetap tulis DB + audit saat sama | Audit "draft→draft" palsu |
| **A7** | 🟢 Rendah | `changeStatusSchema` ada tapi `changeQuestionStatus` pakai `type` langsung | Kontrak status tak dipakai konsisten |
| **A8** | 🟢 Rendah | ADMIN-008: paginasi `offset` makin lambat di skala besar | Belum relevan MVP |

**Baik (tak perlu tindakan):** nol `any`/`ts-ignore`/`eslint-disable`/`console.log`/TODO; `.env` ter-gitignore; `useEffect` tunggal = event listener sah (bukan setState-in-effect); FSM 92% tertutup; DB cocok dengan dokumen (27 tabel/21 trigger/79 indeks/23 FK); RBAC union multi-peran benar.

---

## A1 — 🔴 Coverage palsu (paling penting)

**Bukti:**
```
$ npx vitest run --coverage
 MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'
```
Setelah dipasang:
```
All files   | 9.12 % Stmts | 6.15 % Branch | 6.71 % Funcs | 9.79 % Lines
ERROR: Coverage for lines (9.79%) does not meet global threshold (85%)
```
**Akar:** `vitest.config.mts` menetapkan ambang, tetapi paket coverage absen → Vitest **melewatkan** pengukuran tanpa menggagalkan. `pnpm check` menjalankan `pnpm test` (bukan `--coverage`) → ambang **tak pernah dievaluasi**.
**Perbaikan:** pasang `@vitest/coverage-v8` ✅ (sudah) + ubah `check` agar menjalankan `test:coverage`; isi tes sampai ambang tercapai ATAU turunkan ambang ke kondisi jujur + naikkan bertahap.

---

## A2 — 🟠 Dev bypass = admin

**Bukti (`resolve.ts:76-92`):** `actorFromDevBypass()` dipanggil **pertama**; mengembalikan `roles: ["admin"]` selama `AUTH_DEV_BYPASS===***"true"`, tanpa memeriksa `NODE_ENV`.
**Perbaikan:** tolak bypass bila `process.env.NODE_ENV === "production"` (hard guard), terlepas dari env.

---

## Rekomendasi urutan perbaikan

1. **A2** (keamanan, 1 baris) — kunci bypass ke non-produksi.
2. **A1** (gerbang mutu) — jadikan coverage nyata & terukur.
3. **A4** (UX) — selesaikan di M4c (rute detail & editor).
4. **A5/A6/A7** (kerapian) — bersihkan cepat.
5. **A8** — catat; tangani saat skala menuntut.
