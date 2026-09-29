# CATATAN PLANNING — Dokumen yang Perlu Dilengkapi

> Status: 📝 **AWAL** — untuk dibahas bersama. Ini kerangka, bukan keputusan final.
> Tujuan: memetakan dokumen planning apa saja yang perlu ada **sebelum** pembangunan MathBank berlanjut.

---

## 1. Yang SUDAH Ada (docs/ MathBank)

| Dokumen | Isi | Status |
|---------|-----|--------|
| `VISION.md` | Visi produk | ✅ (dari QBank, perlu ditinjau ulang untuk MathBank) |
| `ROADMAP.md` | Peta jalan | ✅ (dari QBank, perlu ditinjau) |
| `ARSITEKTUR-DATA-FINAL.md` | Skema data v2 | ✅ |
| `ARSITEKTUR-SISTEM-FULL.md` | Peta 9 lapisan sistem | ✅ |
| `DESAIN-PER-LAPISAN-MATHBANK.md` | **Desain L1–L9 terkunci** ⭐ | ✅ |
| `L7-TINJAUAN-KRITIS-DATA.md` | 17 temuan skema | ✅ |
| `CETAK-BIRU-MATHBANK.md` | Inventaris hal implisit + rencana bangun | ✅ |
| `RENCANA-MIGRASI-DATA.md` | Migrasi 7 fase | ⚠️ mungkin tak relevan (migrasi dibatalkan) |
| `DESIGN-THEME-FRAMEWORK.md` | Kerangka tema | ✅ |
| `THEME-FRAMEWORK-GUIDE.md` | Panduan tema | ✅ |
| `CATATAN-INTERVIEW-ARSITEKTUR.md` | Jejak interview | ✅ |
| `RIWAYAT-KEPUTUSAN.md` | **Riwayat keputusan** | ✅ (baru) |
| `STATUS-UI-MENGGANTUNG.md` | **Status UI** | ✅ (baru) |

---

## 2. Yang BELUM Ada — Perlu Dilengkapi

### 🔴 KRUSIAL (harus ada sebelum bangun)

| # | Dokumen | Kenapa perlu |
|---|---------|--------------|
| 1 | **PRD.md** (Product Requirements) | Definisi produk MathBank: fitur, pengguna, alur utama, batasan. Acuan semua kerja. |
| 2 | **MILESTONE / PETA BANGUN** | Urutan miliseone (M1..Mn) — apa dulu, apa kemudian. Tanpa ini, kerja tak terarah. |
| 3 | **DESIGN.md** (desain visual final) | Aturan atmosfer, palet, tipografi, komponen. (Fase A/B UI belum dibawa!) |
| 4 | **RENCANA-TEST.md** | Strategi testing: unit/service, integrasi DB, e2e, visual, target coverage. |

### 🟡 PENTING (perlu sebelum fase tertentu)

| # | Dokumen | Kenapa perlu |
|---|---------|--------------|
| 5 | **SKEMA-DB-DETAIL.md** | Bentuk final tiap tabel (DDL + relasi + enum) — jembatan dari L7 ke kode Drizzle. |
| 6 | **RENCANA-UI.md** | Fase C/D UI: sidebar, header, halaman, command palette. (Menggantikan `RENCANA-REDESIGN-UI.md` QBank.) |
| 7 | **STRATEGI-INGEST.md** | Alur ingest: PDF → parse → soal; `ingest_queue`, retry, idempotensi, target_type. |
| 8 | **RENCANA-ENRICHMENT.md** | Alur AI enrichment: embedding, AI tagging, dedup; izin agent/MCP. |
| 9 | **RENCANA-MCP.md** | Kontrak MCP: tool, skema, kebijakan tulis (`policy.ts`), izin. |
| 10 | **KONTRAK-API.md** | Daftar endpoint + format respons tunggal + Zod schema. |
| 11 | **RENCANA-EKSPOR.md** | Ekspor: paket soal (1× stimulus), Moodle (per-item), PDF. |
| 12 | **RENCANA-DEPLOY.md** | Lingkungan: dev/prod, PG 18, backup, ENV, observability. |

### 🟢 NANTI (bagus ada, tak blokir)

| # | Dokumen | Kenapa |
|---|---------|--------|
| 13 | **PANDUAN-OPERASIONAL.md** | Cara pakai untuk guru/admin. |
| 14 | **RENCANA-MOODLE.md** | Integrasi Moodle (fase berikutnya). |
| 15 | **ADR/** (Architecture Decision Records) | Catatan keputusan formal per-ADR (untuk keputusan kompleks ke depan). |
| 16 | **RENCANA-TAKSONOMI.md** | Seed & kelola topik/grade/difficulty/cognitive dari yaml → DB. |

---

## 3. Kategori Dokumen (Standar)

Agar terstruktur, dokumen bisa dikelompokkan:

```
docs/
  00-visi/           VISION.md, ROADMAP.md, PRD.md
  01-arsitektur/     ARSITEKTUR-*.md, DESAIN-PER-LAPISAN, L7-TINJAUAN
  02-data/           SKEMA-DB-DETAIL.md
  03-desain/         DESIGN.md, DESIGN-THEME-FRAMEWORK, RENCANA-UI
  04-proses/         RIWAYAT-KEPUTUSAN, CATATAN-INTERVIEW, STATUS-UI
  05-rencana/        MILESTONE, RENCANA-*.md
  06-acre/           ADR/*.md
```

*(Belum diputuskan — ini usulan tata kelola.)*

---

## 4. Pertanyaan Planning yang Perlu Dijawab

1. **Urutan milestone:** apa M1, M2, ...? (mis. skema → auth → tema → soal CRUD → ...)
2. **Scope MVP:** fitur minimum apa yang harus ada dulu?
3. **Dokumen mana yang wajib** sebelum mulai (krusial) vs bisa menyusul?
4. **Bawa dari QBank:** dokumen mana yang disalin (Fase A/B UI, PRD lama sebagai dasar)?
5. **Tata kelola docs:** folder bernomor (usulan §3) atau flat?
6. **Format planning:** pakai PRD + MILESTONE + PLAN per-milestone?

---

## 5. Usulan Urutan Pengerjaan Planning

1. **PRD.md** — definisi produk (dasar segalanya)
2. **MILESTONE.md** — urutan pembangunan
3. **SKEMA-DB-DETAIL.md** — bentuk final tabel (jembatan ke kode)
4. **RENCANA-TEST.md** — strategi tes
5. **DESIGN.md** + **RENCANA-UI.md** — desain visual & UI
6. Sisanya (ingest, enrichment, MCP, API, ekspor, deploy) menyusul per-milestone

---

## 6. Catatan

- `RENCANA-MIGRASI-DATA.md` — migrasi QBank **dibatalkan**; dokumen ini mungkin tak relevan. **Perlu ditinjau** (hapus/arsipkan/ubah jadi "arsip referensi").
- `VISION.md` & `ROADMAP.md` masih **berorientasi QBank** — perlu disesuaikan untuk MathBank.
- Dokumen QBank `PRD-SYSTEM-ARCHITECTURE.md` **belum disalin** — mungkin berguna sebagai dasar PRD MathBank (perlu ditinjau).
