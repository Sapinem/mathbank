# VERIFIKASI — Audit M5 (Taksonomi & Referensi)

> **Pemicu:** pemilik meminta lanjut ke dokumen audit berikutnya. **Metode:** verifikasi
> tiap klaim `docs/audit/M5-TAKSONOMI-DAN-REFERENSI.md` ke kode + **uji alur HTTP nyata**.
> **Hasil:** klaim struktural umumnya akurat, tapi ditemukan **1 bug integritas data
> nyata** (propagasi `level`) + **2 cacat lain** yang lolos dari dokumen audit.

## 1. Klaim yang TERVERIFIKASI ✅

| Klaim | Bukti | Verdict |
|-------|-------|:-------:|
| Service `topic-service.ts` (3-level, anti-siklus) | ada; `resolveLevelFrom`, `isSelfOrDescendantFrom`, `subtreeMaxDepthFrom` | ✅ |
| Batas kedalaman 3 → `ConflictError` | `resolveLevelFrom` baris 69-73 | ✅ |
| Service `taxonomy-service.ts` (sources/events/tags) | ada | ✅ |
| 8 endpoint CRUD referensi | `topics`(GET/POST) + `[id]`(GET/PATCH/DELETE), idem sources/events/tags = **14 endpoint** | ✅ |
| UI pohon/sumber/event/label | `topics-view`, `sources-view`, `events-view`, `labels-view` ada | ✅ |
| Tes DB topik & taksonomi | `topic-service.db.test.ts`, `taxonomy-service.db.test.ts` ada; 84 lulus | ✅ |
| Trigger `usage_count` | `invariants.ts` menyebut 2 trigger usage_count | ✅ |
| Tanpa `.select()` telanjang | `grep` di kedua service = 0 | ✅ |

## 2. 🔴 T-M5-1: Audit log `updateTopic` salah label ("create") — ✅ **SELESAI**

`topic-service.ts:211-217` — `updateTopic` mencatat audit dengan
**`action: "create"`** dan `changeSummary: "Topik dibuat: ..."` (copy-paste dari
`createTopic`). **Bukti live:** DB `audit_logs` untuk 3 create + 1 update menampilkan
**4 entri "create"** — update **tak terbedakan** dari create → **audit trail menyesatkan**.

**Perbaikan:** `action: "update"`, `changeSummary: "Topik diperbarui: ..."`.
**Bukti live:** kini `update | Topik diperbarui: UJI3-T-RENAMED` ✅.

## 3. 🔴 T-M5-2: Re-parent TIDAK mempropagasi `level` ke keturunan (integritas data) — ✅ **SELESAI**

`updateTopic` (baris 202-208) meng-update `level` **hanya untuk node yang dipindah**
(`WHERE id = ?`). Keturunannya **tetap level lama** → pohon rusak.

**Bukti live Awal** (`b.iyo.my.id`): Kategori **A**(L1)→anak **A1**(L2). `PATCH A {parentId:B}`
→ A jadi L2, tapi **A1 tetap L2** (seharusnya 3) ❌.

**Dampak:** dua node satu rantai berlevel sama; `listTopicsByLevel(2)` & pemilih topik
per-level **salah**; pelanggaran semantik 3-level. (CHECK DB hanya menjaga 1..3.)

**Perbaikan:** saat re-parent, hitung `delta = newLevel - oldLevel`, kumpulkan id
keturunan (`descendantIdsFrom`), lalu **UPDATE seluruh subtree `level = level + delta`
dalam SATU transaksi** (`db.transaction`). **Bukti live:** A→L2, **A1→L3** ✅.
Tes DB baru `T-M5-2` (propagasi + tolak bila melebihi kedalaman).

## 4. 🟡 T-M5-3: Endpoint `/api/tags/clean-unused` diklaim tapi TIDAK ADA — ✅ **SELESAI**

**Bukti live awal:** `POST /api/tags/clean-unused` → **405** (rute tak ada).
**Perbaikan:** implementasi `cleanUnusedTags()` + route
`POST /api/tags/clean-unused` (izin `taxonomy:manage`) — hapus tag `usage_count=0`
+ entri audit ringkas. **Bukti live:** `200 {removed: 1}` ✅. Tes DB `T-M5-3`.

## 5. Kesimpulan M5 — ✅ **SELESAI (2026-09-30)**

Struktur M5 **kokoh** (3-level, anti-siklus, RESTRICT). **T-M5-2 (propagasi level)
— cacat integritas data nyata — sudah DIPERBAIKI & terbukti live** (transaksi atomik).
T-M5-1 (audit) & T-M5-3 (endpoint) tuntas. **M5 lulus.**

### Pelajaran
Dokumen audit menilai **struktur**, bukan **perilaku kasus tepi (re-parent/rename)**.
Operasi yang mengubah `parentId` pada hierarki **wajib mempropagasi kolom turunan**
(`level`) ke seluruh subtree + transaksi. Audit log operasi update **wajib** beda dari
create (jangan copy-paste).

---
*Lihat juga: `docs/audit/M5-TAKSONOMI-DAN-REFERENSI.md`, `SKEMA-DB-DETAIL.md` §topics,
`CONSTRAINTS.md` #35-37.*
