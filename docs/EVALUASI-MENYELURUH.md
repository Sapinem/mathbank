# EVALUASI MENYELURUH — MathBank (2026-09-30)

> **Perintah:** "evaluasi menyeluruh capaian kita dengan best practice."
> **Metode:** audit berbasis bukti (kode/DB/tes nyata), 3 penyidik paralel
> (audit otomatis + 2 subagent: a11y & keamanan). Bukan klaim dokumen.

## 0. Ringkasan Eksekutif

| Dimensi | Nilai | Verdict |
|---------|-------|---------|
| Arsitektur & lapisan (L1–L9) | konsisten, batas bersih | ✅ **Baik** |
| Kualitas tipe | **0** `any` · **0** `@ts-ignore` | ✅ **Sangat baik** |
| Kebersihan kode | **0** `console.log` · **0** TODO/FIXME | ✅ **Sangat baik** |
| Coverage (logika murni) | **95,2% stmt / 95,7% lines** | ✅ **Sangat baik** (≥85%) |
| Tes | 232 unit + 80 DB = **312 hijau** | ✅ **Baik** |
| Keamanan API | 3 route tanpa rateLimit · api_key plaintext | 🟠 **Perlu perbaikan** |
| Aksesibilitas | kontras token mentah · label form | 🟠 **Perlu perbaikan** |
| Dokumentasi | 7 dokumen belum terdaftar | 🟡 **Ringan** |
| Konsistensi | audit log tak merata · duplikasi select | 🟡 **Ringan** |

**Kesimpulan:** fondasi **kokoh & disiplin** (tipe, kebersihan, coverage luar biasa
untuk proyek sebesar ini). Utang utama terkonsentrasi di **keamanan** & **a11y** —
keduanya **sudah direncanakan** (M13 Keamanan lanjutan, M15 UI polish), jadi bukan
kejutan, tapi **layak dibayar lebih awal** untuk beberapa item murah.

## 1. Yang SUDAH BAIK (pertahankan)

1. **Zero-any / zero-ignore** — disiplin tipe luar biasa (jarang di proyek cepat).
2. **Coverage 95%** pada logika murni (auth, FSM, contracts, rate-limit, warna).
3. **Pemisahan lapisan tegas** — komponen klien TIDAK impor service ber-DB (pernah
   jadi cacat, kini dijaga; konvensi `import type`).
4. **`wrapRoute` terpusat** — resolve aktor → izin → Zod → rate-limit → error
   mapping. Pola konsisten di 24 route.
5. **Guard RESTRICT** (soal dipakai paket tak bisa dihapus) — invarian bisnis
   ditegakkan di service + DB.
6. **XSS aman** — `MathContent` meng-escape `&<>` sebelum markdown; KaTeX
   `output:"html"` meng-escape input sendiri.
7. **ADR** — 8 keputusan arsitektur terdokumentasi.
8. **theme:check nyata** — 16 pasang kontras diuji mesin di CI.

## 2. Temuan (prioritas)

### 🔴 Tinggi (keamanan)
| # | Temuan | Lokasi | Bukti |
|---|--------|--------|-------|
| S1 | **Route tanpa rateLimit** (langgar CONSTRAINTS #33) — ✅ **DIPERBAIKI** | `api/auth/me`, `api/questions/[id]` GET, `api/settings` GET | grep route |
| S2 | `api_key` tersimpan **plaintext** di `app_settings` (jsonb) | `db/schema/system.ts` | subagent |
| S3 | `DEMO_PASSWORD` **hardcoded** & bisa login di produksi bila `DEMO_LOGIN=enabled` — ⚠️ diperjelas (M13) | `auth/demo-users.ts:13` | grep |
| S4 | `questions.author_id` = `text` **tanpa FK** ke `user(id)` — tak ada integritas referensial | `db/schema/question.ts:88` | subagent |
| S5 | Error API internal: diperiksa — **aman** (route-wrapper tak bocorkan stack; hanya 500 generik) | `api/route-wrapper.ts` | subagent ✅ |
| S6 | SQL injection: diperiksa — **aman** (semua `sql\`\`` adalah DDL/index/default statis, bukan input) | schema + filters | subagent ✅ |
| S7 | Proyeksi `answer_key`/`embedding` lewat API: diperiksa — **aman** (jalur baca pakai `questionColumns`); `listBundleItems` pakai `withAnswerKey:false` | `bundle-service.ts` | subagent ✅ |
| S8 | Index unik email & slug: **ada** (`user_email_unique`, `uq_sources_slug`, `uq_bundles_slug_active`) | migrasi | subagent ✅ |

### 🟠 Menengah (a11y + konsistensi)
| # | Temuan | Lokasi | Bukti |
|---|--------|--------|-------|
| A1 | **Kontras**: `text-gold`/`text-success`/`text-warning` dipakai sbg teks di latar putih | beberapa komponen | subagent a11y |
| A2 | Form input tanpa label terhubung (htmlFor/id) | editor, pengaturan | subagent a11y |
| A3 | Tabel tanpa `caption`/`scope` | 4 tabel | subagent a11y |
| C1 | **Audit log tak merata** — taxonomy/topic-service tak mencatat | `taxonomy-service.ts`, `topic-service.ts` | grep |
| C2 | Blok `select` paket **duplikat** (listBundles & getBundle) | `bundle-service.ts` | grep |
| C3 | Helper `api<T>` **duplikat** di 2 hook | `use-bundles.ts`, `use-taxonomy-refs.ts` | grep |

### 🟡 Ringan (dokumentasi + kualitas kode)
| # | Temuan | Bukti |
|---|--------|-------|
| D1 | **7 dokumen belum terdaftar** di PETA-DOKUMEN (langgar #31) — ✅ **DIPERBAIKI** | file compare |
| D2 | Komentar `demo-users.ts` basi ("mati di produksi" — kini `DEMO_LOGIN`) — ✅ **DIPERBAIKI** | read file |
| D3 | `bundle-service.ts` 516 baris (kandidat pecah); blok select duplikat — ✅ **duplikasi DIPERBAIKI** | wc |
| D4 | `taxonomy-service.ts:139,235,304` pakai `sql\`questions\`` / `sql\`question_tags\`` (nama tabel mentah) — bukan injeksi, tapi hilang type-safety Drizzle | subagent keamanan |
| D5 | `validateBundle` membaca `answerKey` mentah tanpa `canSeeAnswerKey` — **aman kini**, tapi rapuh bila diperluas | subagent keamanan |
| D6 | **`theme:check` hanya uji token berpasangan**, bukan pemakaian nyata (mis. `text-gold` di latar putih lolos) — celah validasi kontras | subagent a11y |

## 3. Rencana Perbaikan

### Langkah 1 — Perbaikan murah & penting (SEKARANG, sebelum M8)
- **S1**: tambah `rateLimit` ke 3 route (5 menit, tes ada).
- **C2**: ekstrak `bundleColumns()` — hilangkan duplikasi.
- **D1**: daftarkan 7 dokumen di PETA-DOKUMEN.
- **D2**: perbarui komentar `demo-users.ts` + beri **peringatan tegas** `DEMO_LOGIN`.

### Langkah 2 — M13 (Keamanan lanjutan)
- **S2**: enkripsi `is_secret` at-rest / secret manager.
- **S3**: pagar `DEMO_LOGIN` agar **tidak boleh** di produksi sungguhan (env terpisah).
- Audit izin menyeluruh + FK `author_id`.

### Langkah 3 — M15 (UI/UX polish)
- **A1–A3**: token teks kontras, label form, caption tabel.
- **Responsif**: ganti `DesktopOnly` editor soal → Sheet (pola sudah ada di paket).

## 4. Catatan metodologis
- Angka coverage **hanya untuk scope logika murni** (bukan seluruh proyek) — sesuai
  CONSTRAINTS #3. Jangan klaim "coverage proyek 95%".
- Temuan a11y & keamanan sebagian dari subagent — **diverifikasi ulang** lewat grep
  sendiri sebelum masuk tabel ini.
- Dependensi `outdated`: react 19.2.8→19.3.0 (minor), typescript 5.9→7.0 (mayor,
  tunggu stabil), eslint 9→10 (mayor). **Tidak mendesak.**

---
*Evaluasi ini hidup — perbarui saat item dibayar. Lihat juga
docs/EVALUASI-STRATEGI-E2E.md & docs/EVALUASI-DESKTOPONLY.md.*
