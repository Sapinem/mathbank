# AUDIT DEPENDENSI & PUSTAKA (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & OPTIMIZED** — ⚠️ **DIVERIFIKASI ULANG 2026-09-30: kedua temuan "redundan" (`cn`, `tw-animate-css`) SALAH — lihat `docs/VERIFIKASI-AUDIT-PUSTAKA.md`. TIDAK ada perubahan kode yang diperlukan.**  
**Target:** Evaluasi Efisiensi Paket, Pustaka Unused/Redundan, dan Rekomendasi Upgrades (`package.json`).

---

## 1. Pustaka Redundan & Tidak Efisien (Unused / Redundant)

| Pustaka | Versi | Status Penggunaan | Analisis & Rekomendasi |
| :--- | :--- | :--- | :--- |
| **`cn`** | `^0.4.0` | ⚠️ **Redundan** | Digunakan pada `src/lib/utils.ts` (`export { cn } from "cn"`). Rekomendasi: Ganti dengan pustaka standar `clsx` + `tailwind-merge` agar penanganan *class conflict* pada Tailwind CSS v4 lebih transparan dan andal. |
| **`tw-animate-css`** | `^1.4.0` | ⚠️ **Potensi Redundan** | MathBank menggunakan **Tailwind CSS v4** (`@tailwindcss/postcss`) dan `@base-ui/react` yang mengelola animasi via `data-open:animate-in`. Paket ini dapat di-prune jika animasi sudah sepenuhnya menggunakan CSS v4. |

---

## 2. Matriks Evaluasi Stack Pustaka Utama (Active Tech Stack)

| Pustaka | Versi | Peran di MathBank | Status & Evaluasi |
| :--- | :--- | :--- | :---: |
| **`next`** | `16.3.6` | Framework App Router (Turbopack) | 🟢 **Sangat Baik** (Next.js 16 mutakhir) |
| **`react` / `react-dom`** | `19.2.8` | UI Library | 🟢 **Sangat Baik** (React 19 Compiler Active) |
| **`@base-ui/react`** | `^1.8.0` | Headless UI Primitives (`base-nova`) | 🟢 **Sangat Baik** (ADR-0008, Menggantikan Radix 100%) |
| **`drizzle-orm` / `drizzle-kit`** | `^0.45.3` / `^0.31.11` | Type-safe ORM & DB Migration | 🟢 **Sangat Baik** (Performa kueri SQL presisi & cepat) |
| **`better-auth`** | `^1.7.6` | Autentikasi Session & API Key | 🟢 **Sangat Baik** (Multi-role & DB rate-limiting aktif) |
| **`katex`** | `^0.18.9` | Fast Math Expressions Renderer | 🟢 **Sangat Baik** (Standar emas rendering matematika) |
| **`@dnd-kit/react`** | `^0.5.0` | Drag-and-Drop Builder Paket Soal (M7) | 🟢 **Sangat Baik** (Aksesibel & mendukung Mobile Sheet) |
| **`@tanstack/react-query`** | `^5.104.0` | Client Data Fetching & Caching | 🟢 **Sangat Baik** (State async & Optimistic UI) |
| **`zod`** | `^4.6.5` | Schema Validation | 🟢 **Sangat Baik** (Validasi terpusat di kontrak API) |
| **`lucide-react`** | `^1.48.0` | Icon Set Resmi | 🟢 **Sangat Baik** (Ikon UI konsisten) |

---

## 3. Rekomendasi Optimasi Pustaka Enterprise

### 💡 A. Refactoring Helper `cn()` (`clsx` + `tailwind-merge`)
Ganti dependensi paket `cn` dengan memasang `clsx` dan `tailwind-merge` secara standar pada `src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 💡 B. Penambahan Sanitizer `isomorphic-dompurify`
Pasang `isomorphic-dompurify` untuk menyanitasi String SVG TikZ (Studio M3) atau pratinjau wacana HTML sebelum di-render ke DOM guna memproteksi aplikasi dari potensi Cross-Site Scripting (XSS).

---

## 📄 KESIMPULAN AUDIT PUSTAKA

MathBank memiliki daftar dependensi yang **sangat bersih, modern, dan bebas dari bloatware**. Keputusan menghapus `radix-ui` dan menggantinya dengan `@base-ui/react` membuat jejak memori antarmuka menjadi jauh lebih efisien.
