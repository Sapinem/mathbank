# Ingest Sumber m4thlab

Tanggal: 2026-10-06 · Status: **SELESAI** ✅

## Hasil akhir

| Metrik | Nilai |
|---|---:|
| Artikel di-ingest | **221** (dari 248 berkas; 27 tanpa soal = artikel non-soal) |
| Bundle m4thlab di DB | **221** |
| Soal | **2.938** |
| Verifikasi parse-vs-DB | **221/221 cocok, 0 tak cocok** ✓ |
| Stem kosong | **0** ✓ |
| LaTeX tak seimbang | **0** ✓ |
| URL gambar mentah | **0** ✓ |
| Punya pembahasan | **2.908/2.938 (99%)** |

## Survei awal (semua sumber)

| Sumber | Berkas | Berhasil parse | Soal | Gagal |
|---|---:|---:|---:|---:|
| defantri (selesai) | 414 | 274 | 9.548 | 0 |
| **m4thlab** | 249 | **221** | **2.938** | 0 |
| mathcyber | 406 | 342 | 7.643 | 0 |
| pusmendik_tka | 8 | 8 | 189 | 0 |
| pusmendik_dayaserap | 4 | 0 | 0 | 4 (adapter null — JSON, belum ada) |

Perintah survei: `npx tsx scripts/dev/survey-sources.ts`

## Kualitas parse m4thlab (`audit-m4thlab.ts`)

| Metrik | Nilai |
|---|---:|
| `single_choice` | 2.219 |
| `essay` | 719 |
| Panjang pembahasan (median) | 163 char (maks 3.531) |

**719 `essay` itu SAH** — soal uraian asli ("Tentukan akar-akar…", "Tentukan FPB…")
yang jawabannya ada di pembahasan, bukan pilihan ganda.

## Hambatan yang ditemukan & diperbaiki

### 1. Rate limit `/ingest/commit`
Aturan awal `capacity 10, refill 0.2/dtk` = **1 commit / 5 detik** → HTTP 429 saat
ingest massal. **Dinaikkan** (keputusan pemilik) ke **`capacity 30, refillPerSec 1`**
(1 commit/detik) di `src/app/api/v1/ingest/commit/route.ts`.

### 2. Rate limit SIGN-IN (Better Auth)
Gejala `401 Unauthorized` pada `upload` — **bukan** cookie kedaluwarsa biasa,
melainkan **Better Auth membatasi sign-in**:
`[dev/quick-login] sign-in gagal: "Too many requests."`
→ Runner hanya login **saat 401**, maks **1× per batch**, + jeda 3 dtk
(`ensureLogin()` dengan `loginInFlight`).
Catatan: `scripts/dev/demo-login.ts` melaporkan "✓ ok" walau gagal — menyesatkan.

### 3. Keandalan runner
- Yang **gagal TIDAK ditandai** selesai → otomatis diulang (tidak ada data hilang).
- Retry saat 429 (commit) & 401 (upload).
- Daftar selesai: `/tmp/m4thlab-done.json`.

## Alur ingest
Runner: `scripts/dev/ingest-m4thlab.ts` — lewat API resmi upload → commit.
- Dry-run `--dry [n]`, ingest `[n]`, jeda `INGEST_GAP_MS` (default 1200).
Verifikator: `scripts/dev/verify-m4thlab-all.ts` (semua berkas, parse vs DB).

## Gate
Unit **838/838** · DB **248/248** · gerbang PG **210/210 selisih 0**.
