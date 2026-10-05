# ARCHITECTURE.md — Arsitektur Sistem MathBank

> **Status:** Kanonikal Hidup (*Living Document*)  
> **Terakhir Diperbarui:** 5 Oktober 2026 (Mandat Dewan Direksi MAT-38)  
> **Pemilik:** Salman (Lead System & Software Architect) & Zaid (Chief of Staff)  

---

## 1. Ikhtisar Sistem

**MathBank** adalah platform bank soal dan kurasi asesmen matematika cerdas berbasis **Next.js 16 (App Router)**, **React 19**, **Drizzle ORM**, dan **PostgreSQL 17/18**.

Tujuan operasional utama:
1. **Kurasi & Digitalisasi**: Ingest korpus soal matematika multi-sumber (HTML/LaTeX/Markdown) ke dalam format terstandarisasi.
2. **Pedagogical Enrichment**: Analisis miskonsepsi nyata siswa (distractor rationale opsi A–E), verifikasi formula KaTeX murni, rubrik esai terukur, dan pemetaan taksonomi kognitif Bloom/DOK.
3. **Penyusunan Paket Soal**: Wadah tunggal terpadu (`bundles`) untuk kurasi publik (*Bank Sumber*) maupun naskah evaluasi guru (*Naskah Ujian*).
4. **Distribusi Multi-Kanal**: Penerbitan cetak naskah A4 standar, ekspor Moodle XML, dan integrasi MCP (*Model Context Protocol*).

---

## 2. Arsitektur Berlapis Terisolasi (L1–L9)

MathBank menerapkan pemisahan tanggung jawab (*Separation of Concerns*) berbasis 9 lapisan hierarkis. Aturan mutlak: **lapisan atas boleh memanggil lapisan di bawahnya, dilarang sebaliknya.**

```
┌─────────────────────────────────────────────────────────────┐
│ L1: Antarmuka Pengguna (UI)  src/components/, src/app/(app)/│
├─────────────────────────────────────────────────────────────┤
│ L2: Shell & Layout           AppShell, Nav, Header, Toast   │
├─────────────────────────────────────────────────────────────┤
│ L3: Klien State & Cache      src/lib/hooks/ (React Query)   │
├─────────────────────────────────────────────────────────────┤
│ L4: HTTP API Route Handlers  src/app/api/**/route.ts        │
├─────────────────────────────────────────────────────────────┤
│ L5: Domain Services (SRP)    src/lib/services/              │
├─────────────────────────────────────────────────────────────┤
│ L6: Pure Engine (Tanpa DB)   src/lib/{contracts,fsm,math,   │
│                              search,export,taxonomy}        │
├─────────────────────────────────────────────────────────────┤
│ L7: Akses Data & Relasi      src/lib/db/{schema,projections}│
├─────────────────────────────────────────────────────────────┤
│ L8: Koneksi Database         src/lib/db/ (Singleton Pool)   │
├─────────────────────────────────────────────────────────────┤
│ L9: Layanan Eksternal & MCP  src/lib/{ai,mcp,ingest}        │
└─────────────────────────────────────────────────────────────┘
```

### Prinsip Utama Per Lapisan:
- **L6 Pure Engine**: Tidak boleh mengimpor database (`src/lib/db/*`), ORM Drizzle, maupun Next.js server components. Seluruh fungsi berstatus *pure functions* deterministik yang diuji 100% via unit tests.
- **L5 Services (SRP)**: Bertanggung jawab atas logika domain dan transaksi basis data. Setiap modul berfokus pada satu entitas tunggal (`question-service.ts`, `bundle-service.ts`, `taxonomy-service.ts`).
- **L8 Singleton Connection Pool**: Akses PostgreSQL dikelola melalui proxy singleton lazy-initialized dengan perlindungan kebocoran koneksi (*connection pool leak protection*).

---

## 3. Alur Data Inti (Data Flow)

### 3.1. Ingest Pipeline (Korpus ➔ Draft)
1. Ekstraktor per-sumber (`m4thlab`, `defantri`, `mathcyber`, `pusmendik`) memproses file/toko korpus.
2. Filter SSRF mengamankan pengunduhan aset gambar.
3. Konten dinormalisasi ke Markdown semantik KaTeX murni.
4. Butir soal disimpan ke tabel `questions` dengan status FSM `draft` dan dikaitkan ke `bundles` (tipe: `source`, origin: `ingest`).

### 3.2. Enrichment Pipeline (Pedagogy & AI)
1. Model AI mengevaluasi distractor: menghasilkan analisis miskonsepsi nyata untuk opsi salah A–E (`distractor_rationale`).
2. Validator sintaksis KaTeX menguji ekspresi matematika (mencegah unbalanced braces atau error rendering).
3. Penentuan taksonomi materi dan estimasi kesulitan.
4. Reviewer meninjau dan memajukan status FSM dari `draft` ➔ `review` ➔ `ready`.

### 3.3. Paket Soal & Distribusi (Bundles ➔ Output)
1. Guru atau kurator membuat bundle (`bundle_type: 'exam'` atau `'source'`).
2. Butir soal diatur urutannya (`bundle_items.display_order`).
3. Output naskah:
   - **Cetak A4 / PDF**: `/bundles/[id]/print` dengan aturan CSS print anti-potong soal.
   - **LMS Moodle**: Ekspor format Moodle XML.
