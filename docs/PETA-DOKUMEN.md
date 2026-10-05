# PETA-DOKUMEN.md — Indeks Kanonikal & Tata Kelola Dokumen MathBank

> **Status:** Kanonikal Hidup (*Living Document*)  
> **Terakhir Diperbarui:** 5 Oktober 2026 (Mandat Dewan Direksi MAT-38)  
> **Otoritas:** Zaid (Chief of Staff / Lead Orchestrator) & Dewan Direksi Math My Id  

---

## 1. Kebijakan Tegas Cold-Storage Historis (`docs/archive/`)

⚠️ **ATURAN MUTLAK BAGI SELURUH AGEN (Zaid, Salman, Ichsan, Faruq, Bilal, Hamzah):**
1. Seluruh dokumen yang berada di dalam folder `docs/archive/` berstatus **COLD-STORAGE HISTORIS**.
2. Seluruh agen **DILARANG KERAS** menggunakan, mengutip, atau memperlakukan berkas di dalam `docs/archive/` sebagai acuan kerja aktif, aturan sistem, ataupun panduan arsitektur berjalan.
3. Dokumen di dalam `docs/archive/` hanya boleh diakses apabila Dewan Direksi (Board) secara eksplisit meminta audit atau rekonstruksi sejarah masa lalu.
4. Satu-satunya acuan kerja sah dan mengikat adalah **Dokumen Kanonikal Hidup (*Living Documents*)** yang tercantum pada Bagian 2 di bawah ini serta berkas aturan proyek (`AGENTS.md`, `CLAUDE.md`).

---

## 2. Peta Dokumen Kanonikal Hidup (*Living Documents*)

Berikut adalah 5 pilar dokumen kanonikal resmi yang merefleksikan kondisi nyata codebase MathBank (`paperclip/dev`):

| Dokumen | Domain Utama | Penanggung Jawab | Deskripsi Singkat |
|---|---|:---:|---|
| **`docs/ARCHITECTURE.md`** | Arsitektur Sistem | Salman | Arsitektur Next.js 16 App Router, modularitas L5 (SRP), isolasi pure engine L6, dan singleton connection pool. |
| **`docs/DATABASE.md`** | Basis Data & Skema | Salman | Skema PostgreSQL terpadu (`bundles`), Drizzle ORM, indeks performa (`question_type`, FK), dan transisi FSM atomic CAS guard. |
| **`docs/DESIGN_SYSTEM.md`** | Antarmuka & UX | Ichsan | Base UI headless primitives, Tailwind CSS v4, aturan anti-`space-y-*`, WCAG 2.2 AA (target sentuh 44px), isolasi KaTeX, dan standar print A4. |
| **`docs/PEDAGOGY.md`** | Mutu Pedagogis | Faruq | Standar 31 kaidah Haladyna, analisis miskonsepsi (distractor rationale A–E), rubrik analitik esai terukur, dan taksonomi kognitif Bloom/DOK. |
| **`docs/PETA-DOKUMEN.md`** | Tata Kelola Dokumen | Zaid | Peta indeks kanonikal aktif dan kebijakan operasional arsip. |

---

## 3. Struktur Direktori Arsip Cold-Storage (`docs/archive/`)

Seluruh artefak perencanaan dan catatan audit terdahulu telah direlokasi ke direktori berikut:

- `docs/archive/rencana/`: Seluruh dokumen rencana kerja historis (`RENCANA-*.md`).
- `docs/archive/audit/`: Seluruh dokumen catatan audit dan verifikasi masa lalu (`AUDIT-*.md`, `VERIFIKASI-AUDIT-*.md`, dan catatan per milestone M1–M16).
- `docs/archive/evaluasi/`: Dokumen evaluasi arsitektural dan studi banding terdahulu (`EVALUASI-*.md`, `REVIEW-*.md`, `CATATAN-*.md`).
- `docs/archive/historis/`: Riset pustaka lama, catatan integrasi Better-Auth awal, proposal lama, dan log progres otonom.

---

## 4. Dokumen Pendukung Spesifik Domain

Dokumen berikut melengkapi pilar kanonikal utama untuk kebutuhan operasional spesifik:
- `docs/ADR/`: *Architectural Decision Records* (catatan keputusan arsitektural resmi yang masih berlaku).
- `docs/PRD.md`: *Product Requirements Document* tingkat tinggi MathBank.
- `docs/RUNBOOK.md`: Panduan operasional deployment, maintenance, dan disaster recovery server.
- `docs/KEAMANAN.md`: Protokol mitigasi kerentanan (anti-SSRF, sanitasi input KaTeX, auth guard).
- `docs/plans/`: *Implementation Plans* terstruktur untuk perbaikan audit dan fitur baru.

