# ADR-0006 — Invarian "lunak" di service, bukan CHECK keras

- **Status:** Diterima
- **Pengambil keputusan:** Pemilik produk + lead engineer
- **Tanggal:** 2026-09-29
- **Terkait:** `SKEMA-DB-DETAIL.md` §Invarian, `question-fsm.ts`, `CONSTRAINTS.md` #27

## Konteks

Aturan produk: **soal boleh dibuat tanpa `answer_key`** (fokus: bikin soal dulu) dan tetap berstatus `draft`/`review`. Namun soal **tak boleh ditandai `ready`** dan **tak boleh diekspor ke Moodle** sebelum jawabannya diisi.

Awalnya invarian ini ditegakkan sebagai **CHECK constraint keras** (`status='ready' → answer_key≠'{}'`). Masalahnya: constraint keras juga memblokir mutasi lain dan mengganggu alur kerja yang sah.

## Keputusan

Pisahkan dua jenis invarian:

| Jenis | Contoh | Ditegakkan di |
|-------|--------|---------------|
| **Keras (struktural)** | difficulty 1–5, level topik 1–3 | **CHECK constraint** (DB) |
| **Lunak (transisional)** | `ready` wajib `answer_key` | **guard service** (`assertReady`) → HTTP 422 |

Implementasi: `question-fsm.ts` `assertReady()` (fungsi **murni**, teruji), dipanggil dari `changeQuestionStatus` saat `to === "ready"`. Pengecualian: tipe `stimulus` (wacana tak punya jawaban sendiri).

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| CHECK keras di DB | Memblokir alur sah (soal tanpa kunci); pesan error DB kasar; tak bisa beri pesan domain |
| Hanya validasi di UI | Bisa dilewati API/MCP; tak aman |
| Trigger DB | Logika domain tersembunyi di DB; sulit diuji & dirawat |

## Konsekuensi

**Positif:**
- Alur kerja fleksibel: soal boleh ada tanpa kunci; kunci diminta saat naik ke `ready`.
- Pesan error jelas & spesifik domain (422 `NOT_READY`, Bahasa Indonesia).
- Fungsi murni → mudah diuji; ada di 15 tes FSM + tes integrasi.

**Negatif / utang:**
- Aturan **tak terlihat di skema DB** — perlu didokumentasikan (dilakukan: SKEMA-DB-DETAIL + ADR ini).
- **Wajib** diterapkan di semua jalur yang bisa menetapkan `ready` (kini service + wrapper). Ekspor Moodle (M12) harus menambah guard serupa.

## Catatan

Keputusan pemilik produk (koreksi arah). Konsekuensi hilir: soal tanpa `answer_key` juga tak bisa diekspor ke Moodle — "batasan" yang dimaksud pemilik.
