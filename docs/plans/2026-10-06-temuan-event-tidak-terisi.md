# Temuan: Event tidak pernah terisi otomatis (dan UNBK tak ada di katalog)

Tanggal: 2026-10-06 · Status: **SELESAI diperbaiki**

## Masalah yang dilaporkan pemilik
> "Event udah dimasukin?"

Jawaban jujur saat itu: **BELUM** — 0 dari 162 soal punya `event_id`, padahal
katalog `events` sudah berisi 10 baris.

## Akar masalah (3 lapis)

### 1. Pipeline ingest TIDAK mengisi event sama sekali
`commit.ts` & `service.ts` tidak pernah menyentuh `event_id`. Event hanya bisa
masuk lewat skrip manual `backfill-event.ts`.

### 2. `backfill-event.ts` membaca FILE CETAK yang mudah usang
```ts
const inv = JSON.parse(readFileSync("/tmp/event-inventory.json", "utf8"));
```
File itu dibuat sekali oleh `inv-event-full.ts`. Setelah DB dibersihkan & diisi
ulang, isi file **tidak lagi cocok** dengan DB → 0 bundle ter-update.

### 3. Katalog `events` TIDAK punya "Ujian Nasional"
Katalog punya: UTBK-SNBT, OSN Matematika, SIMAK UI, Ujian Mandiri PTN,
Ujian Sekolah, TKA, PAS-SAS, SBMPTN, Try Out, ANBK-AKM.

Padahal **UNBK/UN = 16 artikel** di defantri (mis. "Simulasi UNBK Matematika IPA
2018", "Soal UN Matematika Kategori Soal Sulit 2015"). Detektor mengenali
"Ujian Nasional" tetapi katalog tak punya barisnya → bundle dilewati.

## Perbaikan

### A. Detektor jadi modul bersama — `src/lib/ingest/event-detect.ts`
- `detectEvent(title)` → `{ events, subtests, year, code }`.
- Satu sumber kebenaran, dipakai resolver & skrip.
- Tambah pola `unbk|unas|un` dan `anbk|akm`.
- 10 tes (`event-detect.test.ts`) — termasuk contoh pemilik (UNBK IPS 2019).

### B. Resolver DB — `src/lib/ingest/event-resolve.ts`
- `resolveEventsForBundles(db, ids)` — isi `bundles.event_id` + tiap
  `questions.event_id/event_year/event_subtest` dari JUDUL paket.
- `resolveEventsAll(db)` — backfill seluruh bundle.
- `findUnknownEvents(db, ids)` — laporkan event terdeteksi yang **belum** ada
  di katalog (pemilik memutuskan dulu; tidak pernah dibuat otomatis).

### C. Ingest mengisi event OTOMATIS
- `CommitResult.bundleId` + `ProcessResult.bundleId` ditambahkan.
- Route `POST /api/v1/ingest/commit` memanggil `resolveEventsForBundles()`
  setelah commit, dan mengembalikan `eventsTagged` + `unknownEvents`.
- Runner `ingest-defantri.ts` menampilkan `| event=N` dan `⚠️BARU:…`.

### D. `backfill-event.ts` dibaca ulang dari DB
Buang ketergantungan `/tmp/event-inventory.json`; sekarang memakai
`resolveEventsAll()` langsung dari isi DB → selalu sinkron.

### E. Katalog: tambah `Ujian Nasional`
`scripts/seed-events.ts`, lewat service resmi (`createEvent`):
```
name: "Ujian Nasional", shortname: "UN", category: "ujian_sekolah"
aliases: [UNBK, UNKP, UNAS, UN, Ujian Nasional Berbasis Komputer, Simulasi UNBK]
```
Katalog: 10 → **11 event**.

## Bukti

| Uji | Hasil |
|---|---|
| `event-detect.test.ts` | 10/10 lulus |
| `event-resolve.test.ts` | 10/10 lulus |
| Backfill pada bundle UNBK | `✓ [2019] UNBK Matematika SMA IPS 2019 → event=Ujian Nasional` |
| | 1 bundle + **40 soal** ter-update |
| Ingest artikel UNBK baru (dev) | `punya event_id: 2 bundle / 80 soal` — **otomatis** |
| Artikel "cara cepat" (non-ujian) | tetap tanpa event ✓ (sesuai: "kalau gak ada event gak papa") |

## Pelajaran
- **Hot-reload dev TIDAK memuat file BARU** — menambah modul (`event-resolve.ts`)
  butuh `systemctl --user restart mathbank-dev.service`, bukan sekadar sunting.
  Gejala: `Module not found: Can't resolve ...` di log.
- Skrip yang membaca file cetak (`/tmp/*.json`) rapuh; lebih baik query DB
  langsung agar tak pernah usang.
- Untuk sumber data baru, **laporkan** event yang belum dikenal sebelum
  menambahkannya ke katalog.
