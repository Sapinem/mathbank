# ADR-0002 — Arsitektur berlapis L1–L9

- **Status:** Diterima
- **Tanggal:** 2026-09-29
- **Pengambil keputusan:** Arsitek + pemilik produk
- **Terkait:** `DESAIN-PER-LAPISAN-MATHBANK.md`, `CONSTRAINTS.md` §Arsitektur

## Konteks

QBank mencampur tanggung jawab: logika bisnis di route, akses data tersebar, engine tak murni. Untuk aplikasi enterprise, dibutuhkan pemisahan tanggung jawab yang jelas, dapat diuji, dan mudah ditelusuri.

## Keputusan

Adopsi **9 lapisan** eksplisit (L1–L9):

| Lapisan | Tanggung jawab | Aturan kunci |
|---------|----------------|--------------|
| L1 Pengguna & Peran | identitas, RBAC | multi-role, fail-closed |
| L2 Antarmuka | UI | — |
| L3 State/Klien | React Query | — |
| L4 API | route + wrapper | format respons tunggal |
| L5 Layanan | service bisnis | fungsi biasa, tanpa repo layer |
| L6 Modul/Engine | FSM, parser, matcher | **fungsi murni** (tanpa DB/network) |
| L7 Akses Data | Drizzle/contracts | — |
| L8 Database | PG 18 | reproduktif dari file |
| L9 Layanan Luar + MCP | AI, storage, MCP | AI = konfigurasi |

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| MVC klasik | Terlalu kabur untuk domain soal + banyak peran |
| Hexagonal penuh (ports/adapters) | Overhead tinggi untuk skala tim kecil saat ini |
| Tanpa lapisan eksplisit | Itu masalah QBank |

## Konsekuensi

**Positif:**
- Engine (L6) murni → mudah diuji tanpa DB.
- Service (L5) dapat diuji via integrasi DB terpisah.
- Batas jelas memudahkan onboarding & review.

**Negatif / utang:**
- Disiplin wajib: jangan "bocorkan" DB ke route, atau logika ke komponen.
- Beberapa operasi sederhana jadi melewati lebih banyak lapisan.

## Catatan

Aturan ditegakkan di `CONSTRAINTS.md` (#15–19) dan tes per-lapisan (`STRATEGI-TES.md`).
