# TUMPUKAN TEKNOLOGI (Tech Stack) — MathBank

> **Dokumen ini menjawab:** *Library & teknologi apa yang dipakai MathBank, dan mengapa?*
> **Status:** 📝 Draft v1 — rekomendasi, menunggu ratifikasi.
> **Prinsip:** **pasang saat dibutuhkan**, bukan menumpuk di awal. Tiap paket = beban (update, keamanan, learning).

---

## Filosofi Pemilihan

1. **Kanvas bersih** — pilih yang terbaik, bukan warisan QBank.
2. **Pasang saat perlu** — per-milestone, bukan semua di awal.
3. **Kode milik kita** — utamakan yang bisa di-copy (shadcn) daripada dependency hitam.
4. **Standar industri** — pakai yang matang & luas (React Query, Zod, Drizzle).
5. **Sesuai gaya** — Linear/Vercel (padat, presisi).

---

## ✅ SUDAH TERPASANG (M0–M2)

### Fondasi
| Paket | Versi | Untuk |
|-------|-------|-------|
| `next` | 16.3.6 | Framework (App Router, Turbopack) |
| `react` / `react-dom` | 19.2.8 | UI (React Compiler) |
| `typescript` | 5.9.3 | Bahasa |
| `tailwindcss` | 4.3.3 | Styling (v4, CSS-first) |

### Data & Auth
| Paket | Versi | Untuk |
|-------|-------|-------|
| `drizzle-orm` + `drizzle-kit` | 0.45 / 0.31 | ORM + migrasi |
| `postgres` | 3.4.9 | Driver (postgres.js) |
| `better-auth` (+ `drizzle-adapter`, `api-key`) | 1.7.6 | Auth + API key |
| `zod` | 4.6.5 | Validasi |
| `yaml` | 2.9.1 | Baca curriculum.yaml (seeder) |

### Kualitas
| Paket | Versi | Untuk |
|-------|-------|-------|
| `vitest` | 5.0.2 | Unit/integrasi test |
| `@testing-library/react` | 16.3 | Test komponen |
| `eslint` + `eslint-config-next` | 9 / 16.3 | Lint |
| `dotenv`, `tsx` | — | Utilitas skrip |

---

## 🎯 USULAN — per Milestone

### M3 — Tema & Shell (🔴 SEKARANG)

| Paket | Untuk | Alasan |
|-------|-------|--------|
| **`shadcn/ui`** (+ `class-variance-authority`, `clsx`, `tailwind-merge`) | Komponen dasar | Kode milik kita (copy), Tailwind, cocok Linear/Vercel. **Sudah dipilih.** |
| **`@tanstack/react-query`** | Server state | Desain **L3** (staleTime per-jenis, cache, optimistic). Standar. |
| **`katex`** | Render rumus | **INTI** — bank soal **matematika**. Wajib. |
| **`lucide-react`** | Ikon | Bersih, ringan, dipakai shadcn. |
| **`cmdk`** | Command palette ⌘K | Dari shadcn; ringan. |
| **`sonner`** | Toast | Notifikasi; dipakai shadcn. |
| **`next-themes`** | Mode gelap/terang | Default OS; matang. |

> **Catatan tema:** mesin 3-warna → OKLCH kita tulis **sendiri** (tak sulit). Tambah `culori` **hanya bila** butuh konversi warna rumit.

### M4 — Bank Soal

| Paket | Untuk | Alasan |
|-------|-------|--------|
| **`react-hook-form`** + `@hookform/resolvers` | Form | Editor soal = form kompleks; ringan, Zod resolver |
| **`@tanstack/react-table`** | Tabel daftar soal | Sorting/filter/paging, headless |
| **`react-katex`** atau wrapper sendiri | KaTeX React | Render rumus di komponen |
| *(opsional)* `dompurify` | Sanitasi HTML | Bila render markdown/HTML user |

> **Editor:** pertimbangkan **`@tiptap/react`** (rich editor) **HANYA bila** butuh WYSIWYG. Untuk markdown+KaTeX, **textarea + preview** cukup dulu (lebih simpel).

### M5–M6 — Taksonomi & Pencarian

| Paket | Untuk | Alasan |
|-------|-------|--------|
| **`nuqs`** | URL state type-safe | Filter di URL (bisa di-bookmark) |
| *(sudah ada)* | — | Trigram & vektor: **di DB**, bukan library |

### M7–M8 — Paket & Ekspor

| Paket | Untuk | Alasan |
|-------|-------|--------|
| **`@react-pdf/renderer`** **atau** cetak browser | PDF | Cetak browser dulu (M8); PDF terprogram bila perlu |
| *(opsional)* `puppeteer` | PDF server-side | Bila butuh layout presisi (berat — hindari bila bisa) |

### M9 — Ingest PDF (fase lanjut)

| Paket | Untuk | Alasan |
|-------|-------|--------|
| **`pdf-parse`** atau **`unpdf`** | Ekstraksi teks PDF | Ringan |
| **`mammoth`** | Ekstraksi DOCX | Bila perlu |
| *(sudah ada)* `yaml`, dll | — | — |

### M10 — AI Enrichment (fase lanjut)

| Paket | Untuk | Alasan |
|-------|-------|--------|
| *(tak ada SDK khusus)* | Panggil LLM | Cukup `fetch` ke endpoint (OpenAI-compatible setting). **Tak perlu SDK** — endpoint = konfigurasi (L9). |

> **Catatan:** jangan pasang `openai` SDK — kita panggil endpoint generik (9router dll) via `fetch`. Lebih fleksibel.

### M11 — MCP (fase lanjut)

| Paket | Untuk | Alasan |
|-------|-------|--------|
| **`@modelcontextprotocol/sdk`** | Server MCP | SDK resmi |

### Opsional / Kapan saja

| Paket | Untuk | Kapan |
|-------|-------|-------|
| `@t3-oss/env-nextjs` | Validasi env type-safe | Saat env bertambah |
| `date-fns` | Tanggal | Bila butuh manipulasi tanggal |
| `culori` | Konversi OKLCH | Bila mesin tema kompleks |
| `zod` (sudah ada) | — | — |

---

## 🚫 Yang SENGAJA TIDAK Dipakai

| Paket | Kenapa tidak |
|-------|--------------|
| **Prisma** | Drizzle lebih ringan, SQL-first, sesuai QBank |
| **NextAuth/Auth.js** | Better Auth sudah dipilih (lebih modern) |
| **Redux / Zustand** | React Query + Context cukup (L3); skala <100 user |
| **Axios** | `fetch` bawaan cukup |
| **`openai` SDK** | Endpoint = konfigurasi; `fetch` lebih fleksibel (L9) |
| **Jest** | Vitest lebih cepat, Vite-native |
| **styled-components / Emotion** | Tailwind v4 cukup |
| **Moment.js** | Usang; `date-fns` bila perlu |
| **MUI / Ant Design** | Terlalu berat & tak sesuai gaya Linear/Vercel |
| **Manual `useMemo`/`useCallback`** | React Compiler (CONSTRAINTS) |

---

## 📊 Ringkasan per Milestone

| Milestone | Paket yang ditambah |
|-----------|---------------------|
| M0–M2 | *(fondasi, data, auth, test)* ✅ |
| **M3** | shadcn/ui · react-query · katex · lucide · cmdk · sonner · next-themes |
| **M4** | react-hook-form · react-table · react-katex |
| M5–M6 | nuqs |
| M7–M8 | (PDF: cetak browser dulu) |
| M9 | pdf-parse/unpdf · mammoth |
| M10 | *(tak ada — pakai fetch)* |
| M11 | @modelcontextprotocol/sdk |

---

## ❓ Keputusan yang Perlu Dikonfirmasi

1. **shadcn/ui** sebagai basis komponen — setuju? (sudah dipilih di awal)
2. **React Query** (bukan Zustand/Redux) — setuju?
3. **KaTeX** — tentu ya (inti).
4. **Editor soal:** markdown+preview dulu, atau langsung Tiptap (WYSIWYG)?
5. **PDF:** cetak browser dulu (M8), atau siapkan @react-pdf sejak awal?
6. Pasang **M3 sekarang** (7 paket), sisanya menyusul?

---

*Stack ini hidup — bisa berkembang. Prinsipnya: pasang saat perlu, kode milik kita bila bisa.*
