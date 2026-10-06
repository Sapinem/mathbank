# Temuan: Event & Wacana (Stimulus) pada Korpus defantri

Tanggal: 2026-10-06 · Status: event **selesai**, wacana **menunggu implementasi**

## 1. Event — SELESAI

### Masalah
Seluruh 3.201 soal & 116 bundle **tanpa** `event_id` (0). Tabel `events` hanya
berisi 5 jenis (UTBK-SNBT, OSN Matematika, SIMAK UI, UM PTN, Ujian Sekolah) —
banyak jenis ujian di korpus (TKA 26 artikel, PAS-SAS, SBMPTN, Try Out) **belum
terdaftar**.

### Yang dikerjakan
1. **Tambah 5 event** via service resmi `createEvent` (`scripts/seed-events.ts`):
   TKA (subtest Matematika Wajib/Lanjut), PAS-SAS, SBMPTN, Try Out, ANBK-AKM.
   → total **10 event**.
2. **Backfill** (`scripts/dev/backfill-event.ts`) dari judul artikel ke
   `bundles.event_id` + `questions.event_id/event_year/event_subtest`.

### Hasil
| Metrik | Sebelum | Sesudah |
|---|---:|---:|
| `bundles.event_id` | 0/116 | **49/116** |
| `questions.event_id` | 0/3.201 | **1.325** |
| `questions.event_year` | 0 | **455** |
| `questions.event_subtest` | 0 | **464** |

Sebaran: TKA 644 · UTBK-SNBT 254 · PAS-SAS 191 · Ujian Sekolah 140 ·
UM PTN 95 · SIMAK UI 1. Tahun: 2013, 2019, 2023, 2024, 2025, 2026.

### Mengapa dari JUDUL, bukan dari SOAL
Diukur langsung (`audit-event-source.ts`): hanya **6 dari 3.318** soal yang
memuat penanda event di stem — dan itu pun bukan penanda asal (kata "SBMPTN"
muncul dalam kalimat soal). **defantri menaruh nama + tahun ujian di judul
artikel**, mis. *"Soal UM UGM Matematika TKDU 2019 Kode 934"*. Jadi judul
adalah satu-satunya sinyal yang tersedia.

### Bahaya yang diperiksa & hasilnya aman
Backfill menularkan event dari judul ke **semua** soal dalam paket. Diperiksa
(`detect-mixed.ts`): dari 116 bundle, hanya **3** yang soalnya menyebut ujian —
2 kebetulan (1 kata di 1 soal dari 44/24 soal), 1 memang satu ujian.
→ **0 paket campuran**. Penularan aman di korpus ini.

Tahun `2013` (SIMAK UI) diperiksa: paket *"Contoh Soal SIMAK UI 2013"* = 1 soal,
memang SIMAK UI 2013 → **benar**, tidak diubah.

### Batasan
67 bundle tanpa event — mayoritas **artikel materi/latihan** ("Soal Latihan",
"Cara Menentukan…", "Pembahasan…") yang **memang tidak terikat event ujian**.

## 2. Wacana / Stimulus — SELESAI ✅

### Masalah
Artikel seperti *"Soal Penalaran Matematika UTBK SNBT: Sebuah Gergaji Mesin…"*
berisi **wacana + 5 sub-soal** (`$(1).$`–`$(5).$`, radio q1–q5). Sebelumnya
tersimpan sebagai **5 `single_choice` terpisah** — wacananya hilang. Kini
**1 `stimulus` + 5 anak** (`questions.parent_id` + `child_order`).

### Implementasi
- **`src/lib/ingest/parsers/adapters/defantri-wacana.ts`** (baru) — `detectWacana()`
  + `extractWacanaBefore()`; fungsi murni, terpisah agar jalur PG tak terganggu.
- **`types.ts`** — `ParsedItem` + `parentRefIndex` & `childOrder`.
- **`defantri.ts`** — deteksi wacana → dorong 1 item `stimulus`, tandai sub-soal
  sebagai anak.
- **`commit.ts`** — peta `ref.index` → id soal → `parentId`/`childOrder`.
  Service `createQuestion` sudah memvalidasi (stimulus tak boleh punya parent;
  anak harus menunjuk stimulus).
- 11 tes baru (`defantri-wacana.test.ts` 8 · `defantri-bs-label.test.ts` 3).

### Kriteria deteksi (kunci)
- Penanda **`$\left( n \right).$`**, berurutan mulai 1.
- **Tiap nomor menunjuk grup radio BERBEDA** (q1,q2,q3,…) — ini pembeda dari
  penomoran persamaan `\cdots \left( 1 \right)` yang menunjuk radio **sama**.

### Bukti
- Pindai **414 artikel** → **tepat 1** terdeteksi (`2024-09-soal-penalaran-matematika`).
  Presisi 100%, 0 false positive.
- Ingest via API → `created: 6`; DB: **1 stimulus + 5 anak** (child_order 1–5),
  **0 anak dengan induk bukan stimulus**.

### Bug gerbang yang ditemukan & diperbaiki
Gerbang jalur PG (`audit-defantri-pg-verify.ts`) **salah menghitung BS berlabel**
(`$(B)\ \text{Benar}$`, bentuk PAS/SAS) sebagai soal PG → 4 artikel PAS/SAS
memunculkan selisih. Diperbaiki: `isBs` kini mengenali bentuk berlabel.
Hasil: **210/210, selisih 0** (dari 214 artikel; 4 artikel BS tak lagi salah hitung).


### Deteksi
Penanda `$\left( 1 \right).$` … (perhatikan: pakai `\left(`, bukan `(1)`).

**Kriteria kunci** — membedakan sub-soal asli dari penomoran persamaan:
- **Wacana asli**: tiap `(n)` menunjuk grup radio **BERBEDA** (q1,q2,q3,q4,q5)
- **False positive**: beberapa `(n)` menunjuk radio **SAMA** — ini penomoran
  persamaan `\cdots \left( 1 \right)` di dalam penyelesaian, bukan sub-soal

### Verifikasi SELURUH korpus (274 artikel ber-radio)
Setelah memindai seluruh korpus (`inv-wacana-all.ts` + `check-leftright.ts`),
hanya **5 artikel** memakai pola `\left( n \right)`, dan **hanya 1 yang wacana asli**:

| Artikel | Sub-soal | Radio unik | Verdict |
|---|---:|---:|---|
| **2024-09-soal-penalaran-matematika** | **5** | **5** | ✅ **WACANA ASLI** |
| 2019-05-soal-dan-pembahasan-unbk-matematika-smp | 2 | 1 | ✗ penomoran persamaan |
| 2022-01-pembahasan-relasi-dan-fungsi-matematika-smp | 2 | 0 | ✗ tanpa radio |
| 2022-01-pembahasan-spldv-matematika-smp | 2 | 1 | ✗ penomoran persamaan |
| 2025-09-model-soal-tka-matematika-smp-mts | 2 | 1 | ✗ penomoran persamaan |

→ kandidat **5 → 1**. Pola penomoran soal biasa (`1.`, `2.`, …) mendominasi
korpus dan **bukan** sub-soal wacana; jangan dipakai sebagai penanda.


### Rencana
Modul terpisah (seperti `defantri-tf.ts`) agar jalur PG tidak terganggu:
deteksi rangkaian sub-soal ber-radiobeda → buat 1 `stimulus` (wacana = teks
sebelum sub-soal pertama) + anak dengan `parent_id` + `childOrder`.

## Berkas
- `scripts/seed-events.ts` — +5 event
- `scripts/dev/{inv-event,inv-event-full,backfill-event,audit-event-source,detect-mixed,inspect-mixed,inspect-2013}.ts`
- `scripts/dev/{inv-stimulus,eval-stimulus,inspect-stimulus}.ts`
- `scripts/dev/reingest.ts` — re-ingest artikel (hapus → ingest ulang)
