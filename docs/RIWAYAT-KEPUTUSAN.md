# RIWAYAT KEPUTUSAN — MathBank

> Jejak keputusan arsitektur & desain MathBank. Kronologis, dengan **alasan** di balik tiap keputusan.
> Sumber: sesi interview arsitektur (QBank) → desain per-lapisan → pembuatan kanvas MathBank.

---

## 1. LATAR: Kenapa MathBank Dibuat Baru

### Diagnosis QBank
Saat review arsitektur QBank, ditemukan masalah mendasar:

- **Dua sistem sumber tak tersinkron:** `question_sources` (16.913 baris, punya `event_name` teks bebas) **vs** `sources`/`schools`/`exam_events` (kosong). Dua-duanya ada; hanya satu dipakai.
- **Tabel "istana kosong":** `sources` (7, semua NULL), `exam_events` (0), `schools` (0), `categories` (0), `tags` (0) — dirancang tapi **tak pernah diisi penuh** (migrasi belum kelar).
- **Duplikasi embedding:** `questions.embedding` (inline) **dan** `question_embeddings` (tabel).
- **FSM kode mati:** `question-fsm.ts` (263 baris, rapi) **tak dipakai sama sekali**, 0 tes. Transisi status dilakukan manual.
- **Aturan izin tersebar:** di 42 file; tak ada satu tabel "siapa boleh apa".
- **Boilerplate API:** `getActor`+401+try/catch+ZodError tertulis ulang di **39 dari 52 route**.
- **Service God Object:** `question-service.ts` 1010 baris, 14 method.
- **Pelanggaran CONSTRAINT sendiri:** larangan `useMemo`/`useCallback` dilanggar (7×, 8×, 2×).

### Keputusan: Bikin Baru (bukan refactor)
User berargumen:
> "Bukannya malah jadi utang arsitektur dan kadang jadi kurang leluasa dalam mengembangkan kalau ada yang harus disesuaikan. Kalau bikin baru kan bener2 bebas gak ada beban. Kalau ada yang sudah bagus dari sana tinggal kita copy saja."

Asisten awalnya menyarankan refactor (lebih hemat), lalu **setuju** setelah argumen user: kanvas bersih = bebas dari kompatibilitas data lama, bisa pilih bentuk target optimal.

**Keputusan:**
- Nama: **MathBank** (menggantikan QBank; QBank pensiun)
- Lokasi: `~/projects/mathbank`
- **Migrasi data QBank DIBATALKAN** ("abaikan saja, kita dari kanvas putih bersih")
- Yang bagus dari QBank: **disalin selektif** (lihat CETAK-BIRU-MATHBANK.md)
- Moodle: **fase berikutnya**
- MCP: **disesuaikan**

---

## 2. ARSITEKTUR DATA v2 (lihat ARSITEKTUR-DATA-FINAL.md + L7-TINJAUAN-KRITIS-DATA.md)

Puluhan keputusan. Yang paling penting:

- **Provenance ≠ Event.** Satu soal punya **dua asal**: `source_id` (wadah fisik, mis. buku) + `event_id`+tahun+subtest (peristiwa nyata, mis. UTBK 2025).
- **Sumber pola B:** induk `sources` + tabel anak hanya yang kaya (`books`, `institutions`); web cukup kolom `url`.
- **Sekolah = sumber** (atribut via `institutions`), bukan penyelenggara event.
- **Event:** hanya UTBK/OSN/SBMPTN. **UTS/PAS = Bundle** (bukan event).
- **Stimulus** `parent_id`, **kedalaman maks 1** (tak bersarang). Hapus induk → RESTRICT (bukan cascade) kalau masih ada anak.
- **Topik 3-level** (Kategori›Topik›SubTopik) via `parent_id`; M:N (`question_topics`) dengan **1 primer**.
- **Tags** tetap (label sekunder opsional).
- **Rename:** `categories`→`topics`, `schools`→`institutions`, `exam_events`→`events`.
- **Embedding satu tempat** (inline `questions.embedding`).
- **Soal diedit langsung** walau sudah dipakai naskah (naskah = bukan snapshot; user menerima konsekuensi).
- **`is_flagged`+`flag_notes`** dipertahankan (kurasi kualitas inti).
- **`answer_key`** & **`data_payload`**: skema per-tipe soal (11 tipe) — lihat L7.
- **Audit:** SATU tabel `audit_logs` generik (bukan dua terpisah).
- **Matematika saja** → tak ada tabel `subjects`. **Kurikulum** (Merdeka/K13) tidak perlu.
- **Pencarian:** trigram `pg_trgm` GIN + vektor HNSW + hybrid **RRF** (dari cetak biru). Dedup 0.98 master-dup / 0.85 near-dup.

---

## 3. DESAIN PER-LAPISAN (lihat DESAIN-PER-LAPISAN-MATHBANK.md) — 9 lapisan ✅

Ini **inti kanvas bersih**. Dibahas L1→L9, tiap lapisan dikunci.

### L1 — Pengguna & Peran ✅
- **Multi-role** (1 akun bisa punya beberapa peran; izin = gabungan).
- 5 peran formal: **admin, teacher, reviewer, agent, machine**.
- **worker** (enrichment/embedding) = proses internal, **bukan aktor**.
- **Taxonomy kelola:** bukan admin-only (teacher/reviewer/agent bisa kelola miliknya).
- **Hard-delete:** admin boleh semua; **teacher boleh hapus soal sendiri**.
- **MCP bisa enrichment** dengan izin khusus (agent bertindak sebagai enrichment).

### L2 — Antarmuka ✅
- 4 grup sidebar: **Kerja / Referensi / Studio / Sistem**.
- **Referensi = submenu lipat** (Topik · Sumber & Asal · Event · Label), bukan tab terpisah, bukan 3 menu terpisah.
- Event punya halaman (dulu QBank: ada API, tak ada halaman).
- Ingest pindah ke grup **Sistem**.
- Menu **sama** untuk semua peran (bedanya hanya aksi), belum dibedakan.
- "Eksplorer Soal" → **"Bank Soal"**. Tombol "Buat Soal" di header **dihapus**.

### L3 — State/Klien ✅
- Patuh larangan `useMemo`/`useCallback` (React Compiler) sejak hari 1.
- Hook **kecil & fokus** (~100 baris), bukan `useQuestionExplorer` 381 baris.
- `staleTime` **per-jenis**: taxonomy 30m · questions 30s · reviewQueue 10s · user 5m.
- Identity endpoint benar: **`/api/auth/me`** (QBank salah panggil `/change-password`).
- Context = **tema saja**.

### L4 — API ✅
- **Pembungkus route** (`auth`, `query`/`body` schema, `handler`) — hapus boilerplate 39 route.
- **Format respons tunggal:** `{data:T}` / `{error:{code,message}}`.
- **Zod di mana-mana** (bukan validasi manual).
- Auth dari **matriks izin L1**.
- Dua muka API (UI `/api/*`, mesin `/api/v1/ingest/*`) pakai wrapper sama.

### L5 — Layanan ✅
- **Fungsi biasa** (bukan class + static).
- **Pecah** service besar, **maks ~300 baris** (`question/` → create·query·lifecycle·media·filters·index).
- Filter builder = **modul terpisah** (`question/filters.ts`, teruji).
- **TANPA repository layer** (service panggil Drizzle langsung — <100 user).
- Ganti `reference-data-service` generik → **service per-domain** (grade/difficulty/cognitive/topic).

### L6 — Modul/Engine ✅
- **FSM DIPAKAI betulan** (bukan kode mati seperti QBank) — semua transisi status via FSM.
- **Tak ada kode mati** — dibuat = dipakai & diuji.
- Parser **dipecah** jadi fungsi kecil teruji.
- Engine = **fungsi murni** (tanpa DB, tanpa network).
- `document-processor` dinamai jujur (`ingest/extract.ts`).

### L7 — Akses Data ✅
- Tinjauan kritis v2: **17 temuan** diperbaiki (lihat L7-TINJAUAN-KRITIS-DATA.md).
- Schema Drizzle: **1 file per-domain** (~14 file).
- Konsistensi: semua `role` jadi **enum**; timestamp seragam; `author_type` sinkron L1.
- **Audit tunggal generik** `audit_logs`.

### L8 — Database ✅
- **PostgreSQL 18** (target) — **berdampingan** dengan PG 17 (QBank di :5432, MathBank di :5433).
- ⏸️ **Pemasangan DITUNDA** (diputuskan kemudian).
- **UUID PK `uuidv7()`** (berurutan waktu, index lebih rapi).
- Ekstensi: **`pg_trgm` + `vector`** (pgvector **0.8.6** untuk PG 18 — sudah diverifikasi ada di PGDG).
- Backup: **manual + terjadwal**.
- Embedding **inline**, index **HNSW**.

### L9 — Layanan Luar + MCP ✅
- **MCP dibakukan:** `policy.ts` (kebijakan tulis **1 tempat**) + tool **enrichment**.
  - agent BOLEH: buat soal · buat aset · cari · enrichment (izin khusus)
  - agent TIDAK: bundle · hapus · ubah status · kelola taksonomi
- **LLM = satu gerbang `ai/client.ts`** yang **BACA SETTING** — provider = **konfigurasi** (`app_settings`), **bukan hard-code**.
  - **9router**: JANGAN hard-code → masuk **Pengaturan** (UI). 9router = salah satu nilai.
  - Setting: `ai.base_url`, `ai.api_key` (terenkripsi), `ai.model`, `ai.enabled`.
- **LaTeX keamanan dibawa:** `openin_any='p'` (mitigasi LFI) + temp `/tmp`. ⚠️ WAJIB.
- **Embedding:** BGE-M3, **dim 1024** (validasi ketat).
- **Storage:** abstraksi tipis (`storage/media.ts`) — filesystem → bisa pindah S3.
- **Moodle:** SKIP (fase berikutnya).

---

## 4. STACK & KONFIGURASI TEKNIS

- **Stack:** Next.js **16.3.6** · React **19.2.8** · Tailwind **v4.3.3** · TypeScript 5.9.3
- **DB:** PostgreSQL 18 + Drizzle ORM (`drizzle-orm` + `drizzle-kit`)
- **Auth:** Better Auth
- **Validasi:** Zod v4
- **Test:** Vitest + Testing Library
- **Font:** **Roboto Flex** + Roboto Mono
- **Tema:** kerangka generatif — **3 warna sumber** (primer `#0158CA`, sekunder netral, aksen `#D5AC1E`) → seluruh UI. **Hanya MathBank/QBank**.
- **Mode:** Gelap + Terang, **default ikut OS** (`prefers-color-scheme`).
- **Visual:** Linear/Vercel (gelap, padat, presisi, border tipis, satu aksen).
- **Warna status** (sukses/error/warning/info): **UNIVERSAL — tak ikut brand**.
- **"Siap"** = biru brand (bukan hijau); emas = "perlu perhatian".

---

## 5. STATUS UI — MENGGANTUNG ⏸️

Lihat `STATUS-UI-MENGGANTUNG.md` untuk detail lengkap. Ringkasnya:
- UI redesign **dijeda** di QBank, **belum dilanjutkan** di MathBank.
- Yang sudah diputuskan (carry-over): "Bank Soal", tombol Cari (⌘K), hapus "Buat Soal".
- Yang **BELUM final**: struktur menu final, apakah Referensi 1 halaman bertab (kini: submenu lipat), dll.
- **Fase tersisa:** C (Sidebar+Header+Command Palette), D (halaman).

---

## 6. BELUM DIPUTUSKAN / UTANG KEPUTUSAN

- **Skema ingest** (retry, target_type) — ditunda.
- **Fork naskah** (`forked_from_bundle_id`) — pending (konsep belum jelas).
- **Pemasangan PG 18** — ditunda.
- **Cold storage / arsip lama** — belum.
- **Moodle** — fase berikutnya.
- **UI Fase C & D** — menunggu planning final.

---

## 7. URUTAN KEPUTUSAN (kronologis ringkas)

1. Review DB → temukan dua sistem tak sinkron
2. Rancang arsitektur data v2 (12+ putaran interview)
3. Peta arsitektur sistem (9 lapisan)
4. Arsipkan dokumen lama
5. Putuskan bikin MathBank dari nol
6. Desain per-lapisan L1→L9 (tiap lapisan dikunci)
7. Buat repo MathBank (kanvas bersih)
8. Simpan riwayat keputusan (dokumen ini)
9. ⏭️ **LANJUT: Planning** (dokumen apa yang perlu dilengkapi)
