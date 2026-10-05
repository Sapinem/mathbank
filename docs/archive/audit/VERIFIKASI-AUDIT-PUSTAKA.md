# VERIFIKASI — Audit Pustaka & Dependensi

> **Pemicu:** pemilik meminta membahas `docs/audit/AUDIT-PUSTAKA-DAN-DEPENDENSI.md`.
> **Metode:** verifikasi tiap klaim (versi, "redundan", rekomendasi) ke `package.json`
> + isi nyata `node_modules` + pemakaian di kode. **Hasil:** klaim versi **akurat**,
> kesimpulan "bersih" **benar**, TETAPI **kedua temuan "redundan" SALAH**.

## 1. Klaim versi — SEMUA ✅
`next@16.3.6`, `react@19.2.8`, `@base-ui/react@^1.8.0`, `drizzle-orm@^0.45.3`,
`better-auth@^1.7.6`, `katex@^0.18.9`, `lucide-react@^1.48.0`, `zod@^4.6.5`,
`@tanstack/react-query@^5.104.0` — **semua cocok** dengan `package.json`.

## 2. ❌ #A "`cn` REDUNDAN" — SALAH (rekomendasi justru MUNDUR)

Dokumen menyarankan **ganti `cn` → `clsx` + `tailwind-merge`**. Faktanya paket `cn`
adalah **`shadcn-ui/cn`** — karya tim shadcn sendiri, deskripsi resminya:
> *"Fast, small, **compiled** class-name merging for Tailwind CSS. **Drop-in
> replacement for clsx + tailwind-merge**."*

Jadi rekomendasi itu = menukar **paket resmi shadcn yang lebih baru & cepat**
dengan **yang lama & lebih lambat** → **mundur**, melanggar prinsip "ikuti praktik
terbaik". Selain itu `cn` **dipakai di ~22 file** (hampir semua `components/ui/**`
+ `app/(app)/page.tsx` + `question-card.tsx`) — **jelas tidak redundan**.

**Kesimpulan:** **JANGAN diubah.** Pertahankan `cn` (ADR/aturan shadcn).

## 3. ❌ #B "`tw-animate-css` POTENSI REDUNDAN" — SALAH

Dokumen menduga bisa di-prune karena Base UI mengelola animasi via
`data-open:animate-in`. Faktanya `tw-animate-css` **dipakai**: `src/app/globals.css:2`
`@import "tw-animate-css"` — **wajib** untuk utility animasi shadcn (`animate-in`,
`fade-in`, `slide-in-*`, dsb.) yang dipakai komponen UI. Menghapusnya → animasi
dialog/sheet/dropdown **hilang**.

**Kesimpulan:** **JANGAN di-prune.**

## 4. ✅ Kesimpulan "bersih & bebas bloatware" — BENAR
Pemindaian pemakaian tiap dependency (kode + css + config) → **tak ada** dependensi
menganggur (hanya `react-dom` "tak terimpor langsung" = false-positive; dipakai
Next/React).

## 5. 💡 #B-baru: `isomorphic-dompurify` (sanitizer) — BELUM RELEVAN
Tetap seperti catatan enterprise #5: **TikZ belum dibangun** (stub) → belum ada
SVG pengguna untuk disanitasi. **Tunda** sampai Studio TikZ diimplementasikan.

## 6. Anti-rekomendasi (jangan lakukan)
- ❌ Jangan ganti `cn` → `clsx`+`tailwind-merge` (mundur).
- ❌ Jangan prune `tw-animate-css` (animasi shadcn rusak).
- ❌ Jangan pasang `isomorphic-dompurify` sekarang (belum ada target).

## Kesimpulan
Audit pustaka **akurat pada inventaris & versi**, tapi **dua "temuan"-nya salah arah**
(mengusulkan downgrade & penghapusan paket yang justru dipakai). Pola sama M1–M5 +
enterprise: klaim tak diverifikasi ke pemakaian nyata. **Tidak ada aksi perbaikan
kode yang diperlukan** dari audit ini.

---
*Lihat juga: `docs/audit/AUDIT-PUSTAKA-DAN-DEPENDENSI.md`, `docs/TUMPUKAN-TEKNOLOGI.md`,
`CONSTRAINTS.md`.*
