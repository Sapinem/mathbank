# EVALUASI MENYELURUH — MathBank (2026-09-30)

> **Perintah:** "evaluasi menyeluruh capaian kita dengan best practice."
> **Metode:** audit berbasis bukti (kode/DB/tes nyata), 3 penyidik paralel
> (audit otomatis + 2 subagent: a11y & keamanan). Bukan klaim dokumen.
>
> **Catatan kejujuran dokumen:** laporan subagent menemukan `docs/KEAMANAN.md`
> mengklaim S1 (rate limit) & S3 "SELESAI" — padahal 4 route terlewat dari S1
> (3 ditemukan awal + `/api/auth/*`), dan S3 tak diterapkan di jalur baca paket.
> Klaim dokumen **diperlunak** agar utang tercatat jujur.

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
| **NEW1** | ~~**`/api/auth/*` (login Better Auth) TANPA rate-limit per-IP**~~ → **✅ TERBUKTI SALAH sebagian besar & SUDAH DIPERKUAT.** Rate-limit login **aktif otomatis** (rule bawaan `/sign-in` 3/10 s); yang benar-benar diperbaiki: **storage** (memory→database, persisten) + **IP asli** (`cf-connecting-ip`, tahan spoof). Lihat `docs/RENCANA-RATE-LIMIT.md`. | `api/auth/[...all]/route.ts`, `auth/server.ts` | docs better-auth 1.7.6 + uji 429 |
| **NEW2** | **`dev/quick-login` membocorkan `detail`** error mentah (`auth.handler` respons, bisa memuat pesan DB) — pagarnya `DEMO_LOGIN` yang bisa dinyalakan di produksi | `api/dev/quick-login/route.ts:60-68` | subagent |
| S1 | **Route tanpa rateLimit** (langgar CONSTRAINTS #33) — ✅ **DIPERBAIKI** | `api/auth/me`, `api/questions/[id]` GET, `api/settings` GET | grep route |
| S2 | `api_key` tersimpan **plaintext** di `app_settings` (jsonb) | `db/schema/system.ts` | subagent |
| S3 | `DEMO_PASSWORD` **hardcoded** & bisa login di produksi bila `DEMO_LOGIN=enabled` — ⚠️ diperjelas (M13) | `auth/demo-users.ts:13` | grep |
| S4 | `questions.author_id` = `text` **tanpa FK** ke `user(id)` — tak ada integritas referensial | `db/schema/question.ts:88` | subagent |
| **NEW3** | `apikey.key` (rahasia) di-index **NON-unik** → potensi collision/duplikasi kunci; + tersimpan **plaintext** | `db/schema/auth.ts:102-105` | subagent |
| S5 | Error API internal: diperiksa — **aman** (route-wrapper tak bocorkan stack; hanya 500 generik) | `api/route-wrapper.ts` | subagent ✅ |
| S6 | SQL injection: diperiksa — **aman** (semua template `sql` = bind-param/DDL statis, bukan input) | schema + filters | subagent ✅ |
| S7 | Proyeksi `answer_key`/`embedding` lewat API: diperiksa — **aman**; ⚠️ **NEW4**: `listBundleItems` **tak** teruskan `actor` → kunci selalu dibuang (under-exposure, tak konsisten dgn aturan S3) | `bundle-service.ts:282` | subagent |
| S8 | Index unik email & slug: **ada** (`user_email_unique`, `uq_sources_slug`, `uq_bundles_slug_active`) | migrasi | subagent ✅ |

### 🟠 Menengah (a11y + konsistensi)
| # | Temuan | Lokasi | Bukti |
|---|--------|--------|-------|
| A1 | **Kontras gagal**: `text-gold` (**2.16:1**), `text-warning` (**2.25:1**), `text-success` (**3.70:1**) dipakai sbg teks/ikon di latar putih — token status dirancang sbg *latar*, bukan teks | `question-card.tsx:65,79`, `telaah-view.tsx:231`, `display/labels.ts:69-72` | subagent a11y |
| A2 | Form input tanpa label terhubung (htmlFor/id) — 2 **input pencarian** tanpa accessible name (KRITIS: `bank-soal-view:177`, `bundle-builder:163`); label Select tak terasosiasi (`question-editor:504`, `pengaturan-view:104,137`) | editor, pengaturan, bank-soal | subagent a11y |
| A3 | Tabel tanpa `<caption>` + `<th>` tanpa `scope` | `bundle-list-view:105`, `labels-view:94`, `sources-view:123`, `events-view:122` | subagent a11y |
| C1 | **Audit log tak merata** — taxonomy/topic-service tak mencatat | `taxonomy-service.ts`, `topic-service.ts` | grep |
| C2 | Blok `select` paket **duplikat** (listBundles & getBundle) — ✅ **DIPERBAIKI** | `bundle-service.ts` | grep |
| C3 | Helper `api<T>` **duplikat** di 2 hook | `use-bundles.ts`, `use-taxonomy-refs.ts` | grep |

**A11y — konfirmasi negatif (bersih ✅):** tak ada `div`/`span` onClick tanpa role · tak ada tombol ikon tanpa nama · tak ada `<img>` tanpa alt · tak ada `outline-none` tanpa pengganti · tak ada tautan "klik di sini" · heading tak melompat. Sisanya hanya ikon dekoratif inline tanpa `aria-hidden` (ringan).

### 🟡 Ringan (dokumentasi + kualitas kode)
| # | Temuan | Bukti |
|---|--------|-------|
| D1 | **7 dokumen belum terdaftar** di PETA-DOKUMEN (langgar #31) — ✅ **DIPERBAIKI** | file compare |
| D2 | Komentar `demo-users.ts` basi ("mati di produksi" — kini `DEMO_LOGIN`) — ✅ **DIPERBAIKI** | read file |
| D3 | `bundle-service.ts` 516 baris (kandidat pecah); blok select duplikat — ✅ **duplikasi DIPERBAIKI** | wc |
| D4 | `taxonomy-service.ts:139,235,304` pakai `sql\`questions\`` / `sql\`question_tags\`` (nama tabel mentah) — bukan injeksi, tapi hilang type-safety Drizzle | subagent keamanan |
| D5 | `validateBundle` membaca `answerKey` mentah tanpa `canSeeAnswerKey` — **aman kini**, tapi rapuh bila diperluas | subagent keamanan |
| D6 | **`theme:check` hanya uji token berpasangan**, bukan pemakaian nyata (mis. `text-gold` di latar putih lolos) — celah validasi kontras. **Saran:** tambah pasangan cek `accent`/`success`/`warning` sbg teks di `bg` | subagent a11y |
| D7 | `reference:manage` izin **mati** (didefinisikan, tak dipakai — sources/events pakai `taxonomy:manage`) | subagent keamanan |
| D8 | `tags.name`/`topics.slug`/`sources.slug`/`events.code` unique-violation **tak** ditangkap → 500 generik (bukan 409 ramah) | subagent keamanan |
| D9 | `route-wrapper.ts:184` `req.json().catch(()=>({}))` **menelan** error parse JSON (tak bisa bedakan body kosong vs JSON rusak) | subagent keamanan |
| D10 | `resolve.ts:76-86` dev-bypass → admin penuh bila `AUTH_DEV_BYPASS=true` (pagar `NODE_ENV` kuat, tapi perlu pagar kedua utk staging) | subagent keamanan |

## 3. Rencana Perbaikan

### Langkah 1 — Perbaikan murah & penting (SEKARANG, sebelum M8)
- **S1**: tambah `rateLimit` ke 3 route (5 menit, tes ada).
- **C2**: ekstrak `bundleColumns()` — hilangkan duplikasi.
- **D1**: daftarkan 7 dokumen di PETA-DOKUMEN.
- **D2**: perbarui komentar `demo-users.ts` + beri **peringatan tegas** `DEMO_LOGIN`.

### Langkah 2 — M13 (Keamanan lanjutan)
- **NEW1** (🔴 prioritas #1): rate-limit `/api/auth/*` (credential stuffing).
- **NEW2**: buang field `detail` di `dev/quick-login` (log server-side saja).
- **NEW3**: `apikey.key` → `uniqueIndex` (+ pertimbangkan hashing).
- **NEW4**: teruskan `actor` ke `listBundleItems` (aturan S3 konsisten).
- **D8**: tangkap unique-violation → `ConflictError` (409 ramah).
- **S2**: enkripsi `is_secret` at-rest / secret manager.
- **S3**: pagar `DEMO_LOGIN` agar **tidak boleh** di produksi sungguhan (env terpisah).
- **S4**: FK `author_id`; **D7**: hapus/selaraskan `reference:manage`; **D10**: pagar kedua dev-bypass.

### Langkah 3 — M15 (UI/UX polish)
- **A1**: token teks kontras (`--mb-*-text` gelap) atau badge ber-latar; **D6**: perluas `theme:check`.
- **A2**: `aria-label` 2 input pencarian + `htmlFor`/`id` label Select.
- **A3**: `<TableCaption>` + `scope="col"` (4 tabel).
- **C1**: audit log taksonomi/topik; **C3**: ekstrak helper `api<T>`; **D9**: 400 eksplisit JSON rusak.

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

---

## 5. PEMBARUAN — Seluruh temuan dibayar (2026-09-30)

Atas permintaan pemilik ("perbaiki seluruh temuan yang terkumpul"), semua item di
Langkah 1–3 **selesai**. Rencana & bukti: `docs/RENCANA-PERBAIKAN-TEMUAN.md`.

| ID | Temuan | Status | Bukti |
|----|--------|:------:|-------|
| NEW2 | `quick-login` bocor `detail` | ✅ | detail dibuang dari respons; log server-side |
| NEW3 | `apikey.key` non-unik | ✅ | `uq_apikey_key` UNIQUE (migrasi `0005`); **koreksi: nilai key = HASH** (Better Auth default), bukan plaintext |
| NEW4 | `listBundleItems` tak teruskan `actor` | ✅ | param `actor` + `canSeeAnswerKey` |
| D7 | `reference:manage` izin mati | ✅ | kini dipakai sources/events (taxonomy:manage utk topik/tag) |
| D8 | unique-violation → 500 | ✅ | `withUniqueGuard` → 409; uji live: dup sumber → `CONFLICT` |
| S3 | pagar `DEMO_LOGIN` | ✅ kebijakan | keputusan pemilik: server ini demo → `DEMO_LOGIN` sah; diperkuat rate-limit + NEW2 |
| S4 | FK `author_id` | ⏸️ **tak dikerjakan (by design)** | `author_id` sah menyimpan identitas non-user (`dev-user`, agen). FK akan memecah dev-bypass. Bukan batas kepercayaan (izin dari roles). |
| D9 | JSON rusak → pesan salah | ✅ | `INVALID_JSON` 400; uji live terbukti |
| A2 | 2 input pencarian tanpa nama | ✅ | `aria-label` (bank-soal & bundle-builder) |
| A2b | label Select | ✅ | **sudah** `aria-label`/`htmlFor` (temuan subagent basi) + 1 sisa diperbaiki |
| A3 | tabel tanpa caption/scope | ✅ | `TableCaption` 4 tabel + `scope="col"` default |
| C1 | audit taksonomi/topik absen | ✅ | `recordAudit` di semua mutasi sumber/event/label/topik (uji live) |
| C3 | helper `api<T>` duplikat | ✅ | diekstrak ke `src/lib/api/fetcher.ts` |

**Hasil:** 261 unit (+19) + 80 DB hijau; tsc 0; lint 0; `theme:check` 34/34; build OK;
produksi sehat (smoke 7/7). Diverifikasi live: D9, D8, C1, NEW3 (index).
