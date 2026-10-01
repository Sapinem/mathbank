# RENCANA G3 — Kurasi Massal (Bulk Action, Rapid Review, Merge Label)

- **Tanggal:** 2026-10-01
- **Gelombang:** G3 (dari `REVIEW-MASUKAN-AUDIT-QBANK.md`)
- **Masukan:** #2/#22 (bulk action + batch progress) · #11 (rapid review flashcard) · #17 (merge label sinonim)

## Kondisi nyata (terverifikasi — audit KEMBALI keliru)

| Butir | Klaim audit | Kenyataan di kode |
|---|---|---|
| #2/#22 | "backend `batchUpdateQuestions` **siap**" | **PALSU** — `grep` seluruh `src/` **tak ada** `batchUpdate*`. Harus dibangun dari nol. |
| #11 | `telaah-view.tsx` kartu tumpuk | Ada `questions/review-view.tsx` (261 baris) — antrean vertikal; **tanpa** mode flashcard. |
| #17 | `tags-view.tsx` CRUD saja | UI-nya `reference/labels-view.tsx` (bukan `tags-view`); service `taxonomy-service.ts` **tak punya** `mergeTags`. |

> Dua klaim audit salah nama/keberadaan lagi (pola M13). Verifikasi ke kode menyelamatkan dari mengerjakan hal yang tak ada / tak perlu.

## Rincian pekerjaan

### G3.1 — Bulk Action Bar + runner batch (#2, #22)
- **Service baru** `bulkQuestionAction(ids, action, actor)` di `question-service.ts`:
  **memanggil ulang** `changeQuestionStatus` / `setQuestionFlag` **per item** — jadi
  izin per-tujuan (L1), FSM (L6), & penjagaan balapan (#36) **tetap ditegakkan**,
  tak ada jalur pintas. Mengembalikan `{ ok: string[], failed: {id, error}[] }`.
- **Endpoint** `POST /api/questions/batch` — body `{ ids: string[], action, value? }`;
  `rateLimit` ketat (#33); **tanpa** `permission` di gerbang (izin per-aksi di service,
  mengikuti pola `[id]/status` & #35).
- **UI** di `question-bank-view.tsx`: checkbox per kartu + **bar seleksi mengambang**
  (menampilkan jumlah terpilih; aksi: Setujui/Arsipkan/Tandai/Lepas tanda) + dialog
  konfirmasi + **progress** hasil per-item (sukses/gagal).

### G3.2 — Mode Rapid Review (flashcard) (#11)
- Di `review-view.tsx`: tombol ganti mode **Daftar ↔ Kilat**.
- Mode kilat: **satu kartu besar** (stimulus + soal + opsi + kunci) + navigasi
  **`←`/`→`** (keyboard) & tombol; aksi Setujui/Tolak/Flag tetap ada.
- Fokus kartu + `tabIndex` agar panah bekerja; patuhi a11y (WCAG 2.2 AA).

### G3.3 — Merge Label sinonim (#17)
- **Service** `mergeTags(sourceId, targetId, actor)` **atomik** dlm transaksi:
  (1) pindahkan `question_tags` dari source → target (hindari duplikat UNIQUE),
  (2) hapus source, (3) `recordAudit` (`action:"update"` disertai ringkasan).
- **Endpoint** `POST /api/tags/merge` — `{ sourceId, targetId }`, `taxonomy:manage`.
- **UI** di `labels-view.tsx`: aksi "Gabungkan…" per baris → dialog pilih target →
  konfirmasi (menyebut berapa soal dipindah).

## Prinsip (arahan pemilik)
- **Tak tambal-sulam**: bulk **memakai ulang** jalur izin/FSM nyata, bukan logika paralel.
- **Detail utuh**: tiap butir tetap barisnya sendiri + bukti.
- **YAGNI**: tanpa kolom baru; tanpa entitas baru.

## Butuh keputusan
1. **Endpoint `POST /api/questions/batch`** (aditif) + `POST /api/tags/merge` (aditif). ✅
2. Aksi bulk: **5 aksi** (Setujui · Tolak→draf · Arsipkan · Tandai · Lepas tanda) — **disetujui pemilik**. ✅

## Status — ✅ SELESAI (2026-10-01)
- G3.1 ✅ bulk action (service `bulkQuestionAction` reuse jalur izin/FSM + endpoint + UI bar) ·
  G3.2 ✅ Rapid Review (mode Kilat, ←/→) · G3.3 ✅ merge label (transaksi atomik).
- Tes: **577 unit** (+5) & **176 db** (+10); `pnpm check` EXIT 0.
- **Catatan FSM:** `draft→ready` & `ready→draft` **tak sah**; jalur = `draft→review→ready`,
  dan tolak = `review→draft`. Bulk **menghormati** ini per-butir (item gagal dicatat).

## Yang TIDAK dikerjakan
- Batch edit metadata (kesulitan/topik massal) — belum diminta; bisa menyusul.
- Kolom `points` bundle — ditunda (YAGNI).
