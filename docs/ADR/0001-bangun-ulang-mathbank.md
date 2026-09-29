# ADR-0001 — Bangun ulang MathBank (bukan refactor QBank)

- **Status:** Diterima
- **Tanggal:** 2026-09-29
- **Pengambil keputusan:** Pemilik produk
- **Terkait:** `RIWAYAT-KEPUTUSAN.md` §1, `PRD.md`

## Konteks

QBank (v1.0.0) sudah berjalan tetapi menumpuk masalah: skema data tidak konsisten, dead code (mis. `question-fsm.ts` tak dipakai), file akar kotor, dan desain UI yang tak terpadu. Di sisi lain ada keinginan menaikkan kualitas ke standar "enterprise" (arsitektur berlapis, tata kelola, tes). Pertanyaan: **refactor bertahap** atau **bangun baru dari nol**?

## Keputusan

Bangun **MathBank** sebagai proyek baru dari nol ("kanvas putih bersih"), memakai kerangka & pelajaran dari QBank tetapi **tanpa** membawa utang teknisnya. **Migrasi data QBank DIBATALKAN** — tidak ada data produksi yang perlu diselamatkan.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| Refactor QBank bertahap | Utang tersebar; risiko "menambal" berkelanjutan; sulit menerapkan arsitektur berlapis bersih |
| Fork lalu bersihkan | Sisa kode mati & konvensi lama tetap menggoda untuk dipakai |

## Konsekuensi

**Positif:**
- Arsitektur berlapis L1–L9 bersih; zero dead code.
- Tata kelola mutu (CONSTRAINTS, gerbang tes) diterapkan sejak awal.
- Bebas memilih skema data v2 tanpa kompromi.

**Negatif / utang:**
- Harus membangun ulang UI & fitur (tak ada warisan gratis).
- QBank tetap ada sebagai referensi; perlu disiplin agar tak diam-diam tersalin.

## Catatan

Dokumen QBank-era (VISION/ROADMAP lama) perlu ditandai atau diarsipkan — lihat `PETA-DOKUMEN.md`.
