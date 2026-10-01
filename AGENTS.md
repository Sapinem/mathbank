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
2. Update `src/lib/db/invariants.ts` **dan** `scripts/db-verify.ts` (angka `tables`/`triggers`)
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

- **28 tabel** · skema sehat · `db:verify` hijau (DB utama & DB uji)
- Referensi: **174 topik**, **5 events**, **6 sumber**
- **0 soal** — kanvas kosong (177 soal mentah lama sudah dibuang atas keputusan pemilik produk)
- ADR berlaku: **0009** (bundle satu tabel), **0010** (event), **0011** (stimulus), **0014** (sumber menempel bundle), **0015** (gabung books/institutions), **0016** (`collections`)
- **Utang terbuka:** UI koleksi · parser kunci dua bahasa · `warnings`→`isFlagged` tak tersambung · `curriculum.yaml` di luar repo · pengaman `scripts/ingest-corpus.ts`
