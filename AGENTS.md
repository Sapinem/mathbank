<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# MathBank — Aturan Kerja Agent

> **Baca ini dulu setiap sesi.** Aturan di bawah lahir dari kesalahan nyata, bukan teori.

## 0. Baca dulu sebelum kerja — WAJIB

| Berkas | Isi | Kapan dibaca |
|---|---|---|
| **`CONSTRAINTS.md`** | **46 batas mutu mekanis** | **SELALU** — ini kontrak utama |
| `docs/PETA-DOKUMEN.md` | Daftar semua dokumen | Mencari dokumen |
| `docs/STRATEGI-INGEST.md` | Aturan ingest | **SEBELUM** menyentuh ingest |
| `docs/ADR/` | Keputusan arsitektur + status | Mengubah skema/arsitektur |
| `docs/DESAIN-PER-LAPISAN-MATHBANK.md` | L1–L6 (peran/auth, service, engine) | Menulis kode |
| `docs/MILESTONE.md` | Posisi proyek | Menentukan prioritas |

**Pelajaran:** pernah ada pekerjaan yang "menemukan" masalah (soal Inggris tanpa kunci, artikel teori lolos) padahal **sudah didokumentasikan** di `STRATEGI-INGEST.md` §2.1/§3.2. **Gagal baca dokumen = kerja sia-sia + keputusan salah.**

## 1. ⚠️ MathBank ≠ QBank — DUA PROYEK BERBEDA

**Ini kesalahan yang sudah berulang. Jangan terulang.**

| | **MathBank** (proyek INI) | **QBank** (proyek LAIN) |
|---|---|---|
Repo | `/home/hari/projects/mathbank` | `/home/hari/projects/qbank` |
Peran | **Proyek yang sedang dikerjakan** | Sumber data + rujukan lama |
Port dev | 3002 (atau lihat `pnpm dev`) | **1906** (systemd `qbank.service`) |
Judul halaman | "MathBank" | **"QBank — Bank Soal Matematika"** |

**Yang BOLEH dari QBank:**
- Korpus HTML mentah: `~/projects/qbank/data/corpora/{mathcyber,defantri,m4thlab,pusmendik_*}/`
- Rujukan **logika lama** (adapters, parser) — untuk **dipelajari**, bukan disalin mentah
- `~/projects/qbank/config/curriculum.yaml` — **sementara**; ini utang (CONSTRAINTS/audit F8)

**Yang DILARANG:**
- ❌ Menjalankan kode/DB QBank sebagai MathBank
- ❌ Menganggap port 1906 = MathBank (**itu QBank** — cek judul halaman)
- ❌ Menulis ke repo/DB QBank dari pekerjaan MathBank
- ❌ Menyalin `corpus://` mentah ke konten soal — **skema internal QBank, tak bisa dibuka**; gambarnya harus dipetakan ke media MathBank

**Rencana jangka panjang:** MathBank **tidak boleh bergantung** pada QBank. Utang: `curriculum.yaml` disalin ke repo ini (audit **F8**), korpus dipindah/diimpor lewat endpoint.

## 2. Data: hati-hati, ini data milik orang

- **Backup dulu** sebelum operasi merusak (hapus/migrasi). Ada `pnpm backup:db`; atau `psql \copy` ke `backups/` (ter-`.gitignore`).
- **Verifikasi FK sebelum hapus massal.** `bundle_items.question_id` & `questions.parent_id` = **RESTRICT** → urutan hapus: `bundle_items` → `bundles` → `questions`.
- **Ingest menghasilkan `draft` mentah, BUKAN data siap pakai.** Baca `docs/STRATEGI-INGEST.md` §3.2: kunci tak terdeteksi → `isFlagged`, bukan ditebak. Jangan melaporkan "berhasil ingest N soal" tanpa menyebut **kualitasnya**.
- **Ingat hasil ingest kemarin:** 177 soal masuk, **172 tanpa kunci (97%)** — karena artikel **berbahasa Inggris** tak punya penanda kunci. Cerita ini nyata; jangan ulangi tanpa pratinjau.

## 3. Skema & migrasi — prosedur yang sudah menelan korban

**Setiap kali mengubah skema, lakukan SEMUA ini:**

1. `pnpm db:generate` → **periksa isi `.sql`** (pernah muncul baris "hantu" dari objek yang tak tercatat)
2. Update **`src/lib/db/schema-expectations.ts`** — satu-satunya tempat angka `tables`/`triggers`, daftar trigger/CHECK wajib, dan daftar tabel terlarang. `invariants.ts`, `scripts/db-verify.ts`, dan `scripts/snapshot-metrics.ts` hanya **mengimpor** dari sana; menyunting ketiganya tidak mengubah ambang apa pun.
3. Update **`drizzle/manual/db_safety.sql`** bila ada tabel baru/dihapus — daftar trigger `updated_at` **manual**, mudah terlupa
4. `pnpm db:migrate` (**DB utama**) **DAN** `DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate` (**DB uji**)
5. `pnpm db:verify` di **KEDUA** DB
6. Uji bangun-ulang dari nol (CONSTRAINTS **#24**): DB baru → `db:migrate` → `db:verify`

> **Dua jebakan ini sudah kena 2×.** (a) `db_safety.sql` lupa diupdate → `db:migrate` gagal `42P01`. (b) **DB uji tertinggal** → 10 tes ingest gagal dengan gejala menyesatkan (`ConflictError`), padahal sebabnya DB uji belum dimigrasi.

**Jangan** memakai `db:push` (CONSTRAINTS #26).

## 4. Gerbang mutu — jalankan sebelum bilang "selesai"

```bash
pnpm typecheck && pnpm lint && pnpm lint:names
pnpm test        # unit
pnpm test:db     # integrasi DB
pnpm db:verify   # skema
pnpm build
```

**Jangan mengklaim hijau tanpa menjalankan.** Bila ada yang gagal, **laporkan apa adanya** — jangan dibulatkan jadi "berhasil".

## 5. Dokumen wajib (CONSTRAINTS #31, #32)

- Dokumen baru → **daftarkan di `docs/PETA-DOKUMEN.md`**
- Keputusan arsitektur besar → **ADR** di `docs/ADR/` (berkas baru, **jangan timpa** ADR lama; tandai "digantikan")
- Audit di `docs/audit/` → wajib **§Catatan Verifikasi** (#44)

## 6. Gaya yang diwajibkan (#28b, #6, #7, #22)

- Nama file/folder/route/fungsi: **INGGRIS**; teks untuk pengguna: **Indonesia** — dijaga `pnpm lint:names`
- **Dilarang** `useMemo`/`useCallback` (kecuali `components/ui/**` vendor) — #6
- **Dilarang** `space-y-*` → `flex flex-col gap-*` — #7
- Validasi input **Zod** di semua boundary API — #22
- `assertCan(actor, perm)` **tanpa `ownerId` selalu menolak** izin ber-`own` → tegakkan di **service**, bukan gerbang route — **#35**

## 7. Kejujuran laporan

- **Bedakan "jalan" dari "benar".** Sistem yang berjalan sesuai rancangan **bukan** berarti hasilnya siap pakai.
- **Sebutkan yang belum selesai** secara eksplisit di akhir kerja.
- **Salah → katakan salah**, jangan dibungkus. Bila keputusan lama dibatalkan, **jelaskan alasannya** dan apa yang berubah.
- Bila menemukan sesuatu **sudah didokumentasikan**, katakan begitu — jangan menyajikannya sebagai temuan baru.

## 8. Kondisi proyek saat ini (perbarui bila berubah)

**Angka metrik DIHASILKAN, bukan disimpan di sini.** Jalankan `pnpm metrics:snapshot` →
`docs/SNAPSHOT-METRIK-<tanggal>.md`. Tabel angka dulu tinggal di bagian ini dan sudah basi
(per 2026-10-24: jumlah soal, cakupan embedding, dan cakupan Zod semuanya berbeda dari DB).
Salinan tangan selalu basi, dan angka basi menghasilkan "temuan" palsu.

Yang perlu dibaca cepat dari snapshot terbaru:
- **§1 Ringkasan** — skema, volume soal/bundle/topik/media/tag/provenance/vektor.
- **§2 Kelengkapan pedagogis** — gerbang rilis: berapa soal punya `distractorRationale`/`rubric`
  dan berapa yang berstatus `ready`. Ini angka yang menentukan produk bisa dipakai.
- **§4 Objek di luar harapan** — tabel sisa migrasi yang masih hidup di DB.

Invarian skema tetap dijaga `pnpm db:verify` (angka minimum: `src/lib/db/schema-expectations.ts`).

- ADR berlaku: **0009** (bundle satu tabel), **0010** (event), **0011** (stimulus), **0014** (sumber menempel bundle), **0015** (gabung books/institutions), **0016** (`collections`), **0017** (buang enum `exercise`), **0018** (drop `collections.origin`), **0019** (isolasi vektor), **0020** (event makro vs provenance naskah), **0021** (print config), **0022** (`wrapRoute`, larangan Server Actions), **0023** (evaluator invarian skema), **0026** (deklarasi otorisasi eksplisit per method route). Total 24 ADR di `docs/ADR/`.
- **Utang terbuka:** soal belum bertopik & tanpa media (angka di snapshot §1) · **kelengkapan pedagogis** — berapa soal `ready`, berapa punya `distractorRationale`/`rubric` (angka di snapshot §2; jangan disalin ke sini) · layanan embedding `:3005` tidak selalu hidup · `main` tertinggal jauh di belakang branch kerja sehingga CI belum pernah menguji pekerjaan terbaru.

## 9. Arsitektur 6 lapisan & layanan embedding

### 9.1 Dua penomoran, satu kode

- **Dokumen desain** `docs/DESAIN-PER-LAPISAN-MATHBANK.md` memakai penomoran produk **L1–L9** (peran → antarmuka → state → API → data → engine → …). Itu acuan *ranah*.
- **Tinjauan implementasi V2** (`docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md` §3.1) memakai **6 lapisan teknis**. Saat menulis kode/audit, pakai tabel ini:

| Lapis | Isi | Modul acuan | Status 2026-10-21 |
|---|---|---|---|
| **L1 Auth/Role** | Better Auth, peran, `can`/`assertCan`/`hasRole` | `src/lib/auth/` | ✅ siap |
| **L2 API** | `wrapRoute`, rate limit, Zod di boundary | `src/lib/api/`, `src/app/api/` | ✅ 73/73 handler wrapRoute berskema Zod, 64/73 ber-rate-limit (hitung ulang HEAD ba4b10e; 9 tanpa rate-limit = stub collections mati, dihapus PR Fase 3 yang belum merge) |
| **L3 Service** | orkestrasi domain, transaksi | `src/lib/services/`, `src/lib/ingest/` | ⚠️ beberapa fungsi > 300 baris |
| **L4 Engine** | fungsi murni: KaTeX lint/repair, export, cetak | `src/lib/math/`, `src/lib/export/` | ✅ siap |
| **L5 Data Access** | Drizzle, 26 tabel, 84 index, HNSW | `src/lib/db/` | ✅ siap |
| **L6 Infra** | PG18 + pgvector, Docker Compose, Caddy, health/metrics | `docker-compose.yml`, `Caddyfile` | ✅ siap |

**Aturan:** logika murni **hanya** di L4; route **tidak** menyentuh Drizzle langsung (lewat L3/L5); jangan menambah lapisan baru tanpa ADR.

### 9.2 Layanan embedding (FastAPI BGE-M3, port `:3005`)

**Kontrak service:**

```bash
curl -s localhost:3005/health
# {"status":"ok","model":"BAAI/bge-m3","dim":1024}
curl -s -X POST localhost:3005/v1/embeddings \
  -H 'Content-Type: application/json' -d '{"input":["$x^2+1$"]}'
```

- Model `BAAI/bge-m3`, **dimensi wajib 1024** (sesuai `vector(1024)`); OpenAPI di `/openapi.json`.
- Endpoint embedding: `POST /v1/embeddings` (gaya OpenAI), health: `GET /health`.
- ⚠️ Service ini **tidak selalu hidup** (health timeout saat snapshot 2026-10-21). Nyalakan sebelum ingest/enrichment massal.

**Konvensi integrasi di aplikasi** (`src/lib/embedding/bge-m3.ts`, diselaraskan MAT-115):

- Base URL dari `BGE_M3_SERVICE_URL` (default `http://127.0.0.1:3005`), model dari `BGE_M3_MODEL` (default `bge-m3`), batas waktu `BGE_M3_TIMEOUT_MS` (default 120000 ms — cold start CPU). **Jangan hardcode port** di kode baru.
- Transport memakai kontrak **OpenAI-compatible**: `POST {base}/v1/embeddings` dengan body `{ model, input }` → `{ data: [{ embedding }] }`. Balasan gaya lama `{ embeddings: [[…]] }` (Ollama `/api/embed`) **masih diterima** agar pemanggil lama tidak putus.
- Health check: `GET /health` (fallback probe embed bila endpoint health tidak ada).
- ✅ **Backfill selesai:** 11.867 dari 11.889 soal (99,8%) punya vektor; index HNSW terisi. Sisa 22 soal.
- Aturan data: tolak vektor ≠ 1024 dim; batch + idempoten (skip berdasarkan hash konten); **backup dulu** (`pnpm backup:db`) sebelum backfill massal; jangan simpan vektor parsial.

**Referensi audit:** `docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md` (ringkasan: `docs/audit/EVALUASI-PAPERCLIP-V2-EXECUTIVE.md`, rencana aksi: `docs/audit/PAPERCLIP-V2-ACTION-PLAN.md`).
