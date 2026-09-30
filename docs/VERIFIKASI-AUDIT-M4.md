# VERIFIKASI — Audit M4 (Bank Soal / CRUD)

> **Pemicu:** pemilik meminta audit M4. **Metode:** verifikasi setiap klaim
> `REVIEW-PER-MILESTONE.md` §M4 ke kode + **uji alur HTTP nyata** dengan 3 peran
> (admin, guru, penelaah). **Hasil:** klaim M4a/M4b **akurat**, tapi **alur telaah
> inti RUSAK** — ditemukan **1 bug kritis** yang lolos dari dokumen audit M4.

## 1. Verifikasi klaim M4a/M4b — semua ✅

| Klaim | Bukti | Verdict |
|-------|-------|:-------:|
| 7 endpoint questions | `route.ts`(GET,POST), `[id]`(GET,PATCH,DELETE), `[id]/status`(PATCH), `[id]/flag`(PATCH) = **7** | ✅ |
| FSM `draft→review→ready→archived` | `question-fsm.ts`; transisi eksplisit + `InvalidTransitionError` | ✅ |
| Guard `assertReady` (stimulus dikecualikan) | `canBeReady`/`assertReady` benar | ✅ |
| Proyeksi aman S3 | `getQuestion({viewer})` + `canSeeAnswerKey`; `getQuestionInternal` hanya internal | ✅ |
| Tes DB | 80 lulus (6 file); questions 25 tes | ✅ |
| T-M4-1 (dead links `/…/baru`) | **SELESAI** — M4c/M4d dibangun; tautan kini `/questions/new` & `/questions/[id]` yang **ada** | ✅ |

## 2. 🔴 T-M4-3: Alur telaah (reviewer) RUSAK — ✅ **SELESAI**

**Bukti uji HTTP nyata** (`b.iyo.my.id`, 2026-09-30):

| Aksi | Peran | Hasil | Seharusnya |
|------|-------|:-----:|-----------|
| `draft → review` | admin | ✅ 200 | ✅ |
| **`review → ready`** | **penelaah** | ❌ **403 `Tidak punya izin: question:edit`** | **✅ 200** (matrix: reviewer `setReady=yes`) |
| **`review → archived`** | **penelaah** | ❌ **403** | ✅ 200 (matrix: reviewer `archive=yes`) |
| `flag` soal orang lain | penelaah | ✅ 200 | ✅ |

**Perbaikan (2026-09-30):** hapus gerbang `permission: "question:edit"` di
`api/questions/[id]/status/route.ts` — izin ditegakkan **per-tujuan di service**
(`changeQuestionStatus`). **Bukti pasca-perbaikan:** penelaah `review→ready` →
**HTTP 200, status `ready`** ✅. Tes DB baru: penelaah bisa, guru non-pemilik ditolak.

## 3. 🟡 T-M4-4: `question:hardDelete` izin MATI — ✅ **SELESAI**

**Perbaikan:** tambah `hardDeleteQuestion()` di `question-service.ts` +
endpoint **`DELETE /api/questions/[id]/permanent`**. Aturan: hanya soal yang sudah
**soft-deleted**; RESTRICT bila dipakai paket; anak (opsi/solusi/topik/label/media)
di-CASCADE. **Bukti live:** hard-delete tanpa soft-delete → **409**; setelah
soft-delete → **200** ✅.

## 4. 🟡 T-M4-5: `changeQuestionStatus` tanpa penjagaan balapan — ✅ **SELESAI**

**Perbaikan:** UPDATE kini `WHERE id = ? AND status = from` + `.returning()`; bila 0
baris → `ConflictError` **409** (bukan lost-update). FSM idempoten (`from===to`
sengaja diizinkan) — sabuk kedua ini menutup balapan baca↔tulis nyata.

## 5. Kesimpulan M4 — ✅ **SELESAI (per 2026-09-30)**

Fondasi M4 (service, FSM, S3) **kokoh**. **Bug kritis alur telaah (T-M4-3) yang
lolos dari dokumen audit M4 sudah DIPERBAIKI & terbukti live** (penelaah bisa
approve). T-M4-4 & T-M4-5 tuntas. **M4 lulus.**

### Pelajaran
Dokumen audit M4 menilai **kode service**, bukan **jalur pemakaian nyata (route)**.
Bug bersembunyi di gerbang route (`assertCan` tanpa `ownerId`). **Gate izin
ber-`own` di route-level WAJIB tidak dipakai** — serahkan ke service yang punya
`ownerId`. **Tambahkan tes lewat-route** untuk alur peran (bukan hanya service).

---
*Lihat juga: `REVIEW-PER-MILESTONE.md` §M4, `KEAMANAN.md`, `KONTRAK-API.md`.*
