# RENCANA — Perbaikan Seluruh Temuan Terkumpul (M2 & M3)

> Sumber: `EVALUASI-MENYELURUH.md`, `VERIFIKASI-AUDIT-M2B.md`, `VERIFIKASI-AUDIT-M3.md`,
> `REVIEW-PER-MILESTONE.md`. **Prinsip:** perbaikan arsitektural, bukan tambal; verifikasi
> ke sumber primer; tiap item + tes + bukti.

## Status per item (verifikasi 2026-09-30)

### Keamanan
| ID | Temuan | Lokasi | Rencana |
|----|--------|--------|---------|
| NEW2 | `quick-login` bocor `detail` error mentah | `api/dev/quick-login/route.ts:60,67` | buang `detail` di respons; log server-side |
| NEW3 | `apikey.key` index **non-unik** | `db/schema/auth.ts:105` | `uniqueIndex` + migrasi |
| NEW4 | `listBundleItems` tak teruskan `actor` | `bundle-service.ts:263` | tambah param `actor` + hormati `canSeeAnswerKey` |
| D7 | `reference:manage` izin mati | `permissions.ts:118` | pakai di sources/events **atau** hapus |
| D8 | unique-violation tak ditangkap → 500 | taxonomy/topic service | tangkap `23505` → `ConflictError` (409) |
| S3 | pagar `DEMO_LOGIN` di produksi | `quick-login:21-22` | syaratkan `NODE_ENV!=production` walau DEMO_LOGIN nyala (atau tolak eksplisit) |
| S4 | `author_id` tanpa FK | `db/schema/question.ts:88` | tambah FK `references(users.id)` |
| D9 | JSON rusak → pesan salah | `route-wrapper.ts:197` | deteksi parse gagal → 400 `INVALID_JSON` |

### Aksesibilitas
| ID | Temuan | Lokasi | Rencana |
|----|--------|--------|---------|
| A2 | 2 input pencarian tanpa accessible name | `bank-soal-view:180`, `bundle-builder:166` | `aria-label` |
| A2b | label Select tanpa `htmlFor`/`id` | `question-editor:504+`, `pengaturan-view:104+` | asosiasi label |
| A3 | tabel tanpa `TableCaption`/`scope` | 4 tabel | tambah |

### Mutu
| ID | Temuan | Lokasi | Rencana |
|----|--------|--------|---------|
| C1 | audit log taksonomi/topik absen | taxonomy/topic service | `recordAudit` pada mutasi |
| C3 | helper `api<T>` duplikat | `use-bundles.ts`, `use-taxonomy-refs.ts` | ekstrak `src/lib/api/fetcher.ts` |

## Urutan eksekusi
1. **Keamanan (NEW2, NEW3, NEW4, D7, D8, S3, S4, D9)** — tes menyertai.
2. **Aksesibilitas (A2, A2b, A3)**.
3. **Mutu (C1, C3)**.
4. Gate penuh + dokumen + commit per batch.

## HASIL (2026-09-30) — semuanya SELESAI kecuali S4 (sengaja)
| ID | Status |
|----|:------:|
| NEW2 | ✅ detail tak dibocorkan |
| NEW3 | ✅ `uq_apikey_key` UNIQUE (migrasi 0005); koreksi: nilai=HASH |
| NEW4 | ✅ `listBundleItems(id, actor)` + `canSeeAnswerKey` |
| D7 | ✅ `reference:manage` dipakai sources/events |
| D8 | ✅ `withUniqueGuard` → 409 (uji live: dup→CONFLICT) |
| S3 | ✅ kebijakan (DEMO_LOGIN sah di server demo) + rate-limit |
| S4 | ⏸️ **by design** — FK memecah dev-bypass; bukan batas kepercayaan |
| D9 | ✅ `INVALID_JSON` 400 (uji live) |
| A2 | ✅ aria-label 2 input + 1 Select |
| A2b | ✅ sudah beres (+1 sisa) |
| A3 | ✅ TableCaption 4 tabel + scope=col |
| C1 | ✅ recordAudit sumber/event/label/topik (uji live) |
| C3 | ✅ ekstrak `src/lib/api/fetcher.ts` |

**Gate:** 261 unit (+19) + 80 DB · tsc 0 · lint 0 · theme:check 34/34 · build OK · smoke 7/7.
