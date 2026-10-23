# Ingest Sumber mathcyber

Tanggal: 2026-10-06 · Status: **SELESAI** ✅

## Hasil akhir

| Metrik | Nilai |
|---|---:|
| Berkas di-ingest | **405** (semua ditandai selesai) |
| Artikel dgn soal | **342** |
| Bundle mathcyber di DB | **342** |
| Soal | **7.623** |
| Verifikasi parse-vs-DB | **336/342 cocok** |
| "Tak cocok" (6) | **semuanya DEDUP**, 0 data hilang |

### 6 "tak cocok" = dedup `content_hash` (bukan kehilangan)
Soal kembar di dalam SATU artikel hanya disimpan sekali (`content_hash`),
lalu di-link ke paket. Terbukti: jumlah **stem unik** = persis jumlah di DB.

| Artikel | parse | unik (=DB) | selisih |
|---|---:|---:|---:|
| osnp-ipa-sd | 40 | **27** | 13 |
| conditional-probability | 24 | **22** | 2 |
| peluang-bersyarat | 26 | **24** | 2 |
| lingkaran-tingkat-sd | 47 | **46** | 1 |
| pengukuran-fisika | 16 | **15** | 1 |
| tka-ppkn-sma | 30 | **29** | 1 |

## Kualitas parse (`audit-mathcyber.ts`)
| Metrik | Nilai |
|---|---:|
| `single_choice` | 4.596 |
| `essay` | 3.047 |
| Stem kosong | **0** |
| Punya pembahasan | 7.037 (92%) |
| **PG tanpa kunci** | **413 (5,4%)** |

## Temuan besar: KUNCI sebenarnya ADA, tapi presisi belum cukup
413 soal PG tanpa kunci diselidiki menyeluruh (2 putaran, seluruh 405 berkas):
- Penanda kunci nyata: **`(Jawaban X)`** — konsisten 273×.
- **TAPI presisinya hanya 90,2%** saat diuji vs kunci yang sudah ada
  (3.413 cocok, **369 tidak cocok**) — urutan penanda tidak selalu selaras
  dengan urutan soal hasil parse.
- **Keputusan: kunci TIDAK diisi otomatis** (prinsip "kunci kosong > kunci salah").
  Soal tetap masuk + ditandai **"perlu telaah"**.
- Rencana lanjutan: pemetaan **per-blok soal** (bukan per-urutan) agar presisi >99%.

Rincian: `docs/plans/2026-10-06-temuan-kunci-mathcyber.md`

## Hambatan & perbaikan (pelajaran operasional)

### 1. `401` = sesi/sign-in, BUKAN cookie rusak
- **Better Auth punya rate limit SIGN-IN** (`Too many requests`).
- Sesi bertahan hanya **~12–16 artikel / ~25 detik** → sering kedaluwarsa di
  tengah batch.
- **Solusi yang terbukti:** login (+ jeda 5 dtk) **sebelum tiap batch** →
  20/20 bersih. Login berulang saat 401 justru memicu rate limit sign-in.

### 2. `409` = commit idempoten
`Sebagian id bukan 'pending'` — commit sebelumnya **berhasil**; perlakukan
sebagai selesai (jangan diulang).

### 3. Rate limit `/ingest/commit`
Dinaikkan `10/0.2` → **`30/1`** per detik (keputusan pemilik).

### 4. Runner aman
Yang gagal **tidak ditandai** selesai → otomatis diulang. Terbukti tidak ada
data hilang meski gejolak 401 berulang.

## Alur
- Runner: `scripts/dev/ingest-mathcyber.ts` (dry-run `--dry`, jeda `INGEST_GAP_MS`).
- Verifikator: `scripts/dev/verify-mathcyber-all.ts`.
- Daftar selesai: `/tmp/mathcyber-done.json`.
- **Praktik terbaik:** `demo-login.ts` → `sleep 5` → `ingest-mathcyber.ts 20`
  per batch.

## Gate
Unit **838/838** · DB **248/248** · gerbang PG **210/210 selisih 0**.

## Korpus MathBank setelah mathcyber
| Sumber | Soal | Paket |
|---|---:|---:|
| mathcyber | 7.623 | 342 |
| defantri | 3.319 | 116 |
| m4thlab | 2.938 | 221 |
| **TOTAL** | **13.599** | 679 |
