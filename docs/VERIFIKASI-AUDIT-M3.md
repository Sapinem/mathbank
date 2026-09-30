# VERIFIKASI — Audit M3 (Tema & Shell)

> **Pemicu:** pemilik meminta cek audit M3. **Metode:** verifikasi setiap klaim
> `REVIEW-PER-MILESTONE.md` §M3 ke kode + hitung ulang kontras dengan mesin warna
> MathBank. **Hasil:** klaim M3 **akurat**, TETAPI menemukan **celah kelas cacat
> yang sama** seperti M1/M2: klaim "verifikasi WCAG" **benar kodenya, salah
> cakupannya**.

## 1. Verifikasi klaim M3 — semua ✅

| Klaim | Bukti | Verdict |
|-------|-------|:-------:|
| Mesin tema (`scripts/theme/build.ts`) 3 warna → OKLCH | ada | ✅ |
| `theme:check` nyata | `scripts/theme/{build,check,tokens}.ts` + `src/lib/theme/color.ts` (+tes) | ✅ |
| Font Roboto Flex + Mono | `next/font/google`; var `--font-roboto-mono` (T-M3-2 fixed) | ✅ |
| Base UI (0 radix) | 0 `@radix-ui`; **15** file `@base-ui/react` | ✅ |
| Gelap+terang default OS | `defaultTheme="system"`, `enableSystem` | ✅ |
| Warna status universal (hardcoded) | `build.ts:35-38` literal oklch | ✅ |

## 2. 🟠 Temuan BARU — T-M3-3: `theme:check` luput warna status (celah arsitektural)

**Fakta:**
- `scripts/theme/check.ts` memeriksa **8 pasangan × 2 mode = 16** (persis "16/16").
- **Nol** pasangan menyentuh warna **status** (`success`/`warning`/`error`/`info`/`gold`).
- Sebab arsitektural: warna status didefinisikan **hardcoded di `build.ts:35-38`**,
  **bukan** di `tokens.ts` (sumber kebenaran yang diperiksa `check.ts`). `TokenSet`
  bahkan tak punya field status → **mustahil** diperiksa tanpa memperbaiki arsitektur.

**Kontras NYATA (dihitung ulang, mode terang, vs latar & kartu):**

| Token | Rasio | AA ≥4.5 | Dipakai di |
|-------|:-----:|:-------:|-----------|
| `text-success` | **3.70:1** | ⚠️ gagal | **jawaban benar** (`question-card.tsx:79`), stok (`labels.ts:69`) |
| `text-warning` | **2.25:1** | ❌ gagal berat | stok rendah (`labels.ts:71`) |
| `text-gold` | **2.47:1** | ❌ gagal berat | ikon bendera (`question-card.tsx:65`, `telaah-view.tsx:231`) |
| `text-info` | **3.94:1** | ⚠️ gagal | (cadangan) |
| `text-error` | 4.76:1 | ✅ lulus | `labels.ts:72`, `math-content.tsx:69` |
| status mode gelap | 6.19–10.49 | ✅ lulus | — |

**7 titik pemakaian `text-<status>` tanpa `-fg`** (mode terang gagal):
`question-card.tsx:79`, `question-card.tsx:65`, `telaah-view.tsx:231`,
`labels.ts:69,71,72`, `math-content.tsx:69`, `states.tsx:52`.

**Dampak:** indikator **jawaban benar** (`text-success`) & **peringatan stok**
(`text-warning`) sulit dibaca di mode terang — tepat pada makna paling penting.
**Kelas cacat:** sama dengan M1/M2 — klaim "terverifikasi" tanpa cakupan nyata.

## 3. Perbaikan yang benar (arsitektural, bukan tambal)

1. **Pindahkan** definisi warna status ke `tokens.ts` (sumber kebenaran tunggal) →
   `build.ts` & `check.ts` membacanya (hilangkan hardcode duplikat).
2. **Tambah** pasangan status ke `PAIRS` (`text-<status>` di `bg`/`card`, 2 mode) →
   `theme:check` menangkap regresi.
3. **Gelapkan** nilai status terang agar ≥4.5:1 (mis. `success` L 0.6→0.52,
   `warning` L 0.75→0.58, `gold`/`accent` L→turun) — dengan tes rujukan.
4. Opsional: jadikan `theme:check` **sadar-pemakaian** (pindai kelas `text-*` nyata
   di komponen) agar token yang dipakai tapi belum terdaftar ikut ketahuan.

**Status:** ✅ **SELESAI** (2026-09-30). Perbaikan arsitektural:
1. Warna status dipindah ke `tokens.ts` (`STATUS_TOKENS`) — sumber kebenaran tunggal;
   `build.ts` tak lagi hardcode.
2. `theme:check` diperluas: **16 → 34 pasangan** (kini mencakup status & aksen).
3. Nilai digelapkan agar ≥4.5:1 (terang): success 3.70→**4.91**, warning 2.25→**4.92**,
   gold 2.47→**4.88**, info 3.94→**4.90**. Pasangan teoretis `accent-fg`-di-`accent`
   dihapus (tak dipakai UI) → diganti verifikasi nyata.
4. **Temuan tambahan (mode gelap):** `text-gold-fg` di atas `bg-gold/15` gelap =
   **1.27:1 (GAGAL total)** — bug badge "perlu perhatian" di mode gelap. Diperbaiki:
   `accent-fg` mode gelap L0.13→**0.985** (terang) → kini lolos.
5. Tes regresi baru `src/lib/theme/tokens-contrast.test.ts` (11 tes) — menjaga status
   & badge emas tetap AA di kedua mode, menutup celah "sadar-pemakaian".

**Bukti:** `theme:check` **34/34**; 253 unit (+11); terverifikasi live (computed
`--mb-accent-fg` = lab 7.78% terang / 98.26% gelap).

---
*Lihat juga: `EVALUASI-MENYELURUH.md` (celah theme:check), `A11Y.md`, `REVIEW-PER-MILESTONE.md` §M3.*
