# ADR-0031 — Kanonisasi Jalur Ingest dan Depresiasi Antrean HTML Mentah

- **Status:** Diterima
- **Tanggal:** 2026-11-09
- **Pengambil keputusan:** pemilik produk + tim arsitektur
- **Terkait:** ADR-0012 (`contentHash`), ADR-0014 (sumber menempel bundle), ADR-0022 (`wrapRoute`), ADR-0028 (cabut prefix v1 ingest), `docs/STRATEGI-INGEST.md`

## Konteks

Sebelumnya, modul ingest MathBank (`src/lib/ingest/parsers/adapters/*`) menyatukan logika parsing dan pembedahan HTML blog (MathCyber1997, Defantri, M4thlab, Pusmendik) langsung di dalam core runtime aplikasi web. Akibatnya:

1. Setiap perubahan markup/layout blog pihak ketiga atau anomali baru memaksa perubahan dan pengujian ulang pada core engine MathBank.
2. Database menyimpan konten HTML mentah raksasa di tabel `ingest_queue`, yang membebani ukuran database dan backup padahal MathBank berfokus sebagai bank soal kanonik berkualitas tinggi.
3. Kualitas ingest menjadi rapuh dan tercampur antara tanggung jawab ekstraksi dokumen mentah dan tanggung jawab penjaminan mutu domain (quality gate).

## Keputusan

1. **Pemisahan Peran Arsitektur:**
   - **Core API MathBank murni bertindak sebagai Quality Gate & Persistence Gateway.** Dibangun endpoint baru `POST /api/ingest/questions` yang hanya menerima batch array JSON berformat kanonik MathBank (`canonicalIngestBatchSchema`), memvalidasi sintaks KaTeX secara ketat (`validateKatexContract`), memvalidasi skema data/kunci (`questionDataPayloadSchema`, `answerKeySchema`), serta melakukan deduplikasi `contentHash` dan pencatatan provenance `bundle_items`.
   - **Adapter Sumber & Ekstraksi Dokumen Dipindahkan ke Skrip CLI Terpisah.** Seluruh parser HTML, regex DOM blog, dan penanganan media dipindahkan ke modul mandiri di `scripts/ingest/sources/*`. Skrip ini bertanggung jawab mengekstrak data mentah menjadi payload kanonik sebelum menembak endpoint gateway.
   - **Tolak Cacat di Gateway Tanpa Penampung Sampah Core:** Butir yang tidak memenuhi standar mutu langsung ditolak dan dikembalikan dalam respons terstruktur (`failures: [{ index, stemPreview, reason }]`). Penanganan log kegagalan (dead-letter log) dikelola secara lokal oleh skrip pengirim (`logs/ingest/`), bukan di database core.

2. **Depresiasi Endpoint Raw HTML Lama:**
   - Jalur raw ingest lama (`POST /api/ingest/upload` dan `POST /api/ingest/commit`) diberi header deprecation (RFC 9745 & RFC 8594): `Deprecation: @1794182400`, `Sunset: Mon, 08 Feb 2027 00:00:00 GMT` (masa transisi 90 hari), dan link successor `</api/ingest/questions>`.
   - Tabel `ingest_queue` ditandai deprecated untuk pembersihan pada rilis pasca masa transisi.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| Mempertahankan adapter di core API | Core codebase terus membengkak dengan regex spesifik blog dan regresi layout pihak ketiga. |
| Menyimpan butir cacat ke tabel dead-letter di core DB | Mengotori database core dengan string KaTeX rusak dan opsi tidak valid yang bertentangan dengan invarian integritas data MathBank. |
| Memindahkan scraping ke repositori terpisah seketika | Menambah beban koordinasi repo baru di tahap sekarang; menempatkan di `scripts/ingest/` dalam repo ini memberikan isolasi runtime tanpa kehilangan kemudahan kolaborasi. |

## Konsekuensi

**Positif:**
- Core engine dan API MathBank terisolasi penuh dari kekacauan anomali scraping HTML blog eksternal.
- Endpoint kanonik batch baru teruji kuat dengan Zod dan KaTeX validator, dapat dimanfaatkan oleh berbagai sumber data (skrip, crawler, webhook masa depan).
- Skrip sumber dapat beriterasi cepat tanpa risiko merusak stabilitas API core.

**Negatif / utang:**
- Selama 90 hari masa transisi, endpoint raw HTML lama masih aktif di codebase sebelum tabel `ingest_queue` dapat di-drop permanen dari Drizzle schema.

## Catatan Verifikasi

- `POST /api/ingest/questions` diverifikasi dengan unit test dan integrasi database (AE1 & AE2).
- Header `Deprecation`, `Sunset`, dan `Link` terverifikasi aktif pada `/api/ingest/upload` dan `/api/ingest/commit`.
