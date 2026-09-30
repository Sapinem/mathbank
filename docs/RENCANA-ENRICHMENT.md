# RENCANA ENRICHMENT — AI Enrichment & Embedding (M10)

> **Dokumen ini menjawab:** *Bagaimana AI dipakai di MathBank — untuk apa, lewat jalur mana, dan bagaimana ia tidak pernah menjadi jalur yang tak terkendali?*
> **Status:** 🟡 rencana — **menunggu persetujuan pemilik produk** (keputusan ditandai ⚠️)
> **Dibuat:** 2026-09-30
> **Milestone:** M10 (AI Enrichment & Embedding)
> **Dependensi:** M9 (ingest) ✅ · L9 terkunci (`DESAIN-PER-LAPISAN-MATHBANK.md`)
> **Rujukan:** `DESAIN-PER-LAPISAN-MATHBANK.md` L9 · `SKEMA-DB-DETAIL.md` · `KONTRAK-API.md` · `KEAMANAN.md` · `CONSTRAINTS.md`

---

## 1. Prinsip (terkunci di L9 — tidak dibuka lagi)

| # | Prinsip |
|---|---------|
| 1 | **AI = konfigurasi, bukan kode.** Provider TIDAK di-hard-code; dibaca dari `app_settings` (`ai.base_url`, `ai.api_key`, `ai.model`, `ai.enabled`). 9router = salah satu nilai. |
| 2 | **Satu gerbang** — semua panggilan LLM lewat `ai/client.ts`. Tak ada `fetch("https://api.openai.com…")` tersebar. |
| 3 | **Embedding BGE-M3, dim 1024**, via `BGE_M3_SERVICE_URL` (infrastruktur, bukan preferensi). Validasi ketat `.length === 1024`. |
| 4 | **Enrichment = 3 jalur** (worker internal · agen MCP · manual). Worker **bukan aktor**. |
| 5 | **AI tak pernah membuat `answer_key` final** — hasil enrichment = usulan → status `review`, bukan `ready`. |
| 6 | **Tak ada kode mati** — dibuat = dipakai & diuji (L6). |
| 7 | **Draft tetap draft** — konsisten dengan keputusan M9 (semua hasil ingest = draft). |

---

## 2. Apa yang SUDAH ada (fakta repo, bukan asumsi)

| Ada | Di mana | Catatan |
|-----|---------|---------|
| Skema embedding | `questions.embedding` (`vector(1024)`), `embedding_content_hash`, `embedding_model_name` | inline 1 tempat ✅ |
| Skema AI tagging | `questions.ai_tagged`, `ai_tagged_at` | boolean + timestamp |
| Index HNSW | invarian `[invarian] OK — … 1 HNSW` | sudah dibuat M1 |
| Tabel setting | `app_settings` (key/value/is_secret) | `settings-service.ts` sudah mask secret |
| API key agen | tabel `apikey` (plugin Better-Auth) | untuk M11 |
| ENV embedding | `.env.example: BGE_M3_SERVICE_URL=http://localhost:8080` | TEI port |
| Ollama | terpasang `/usr/local/bin/ollama` v0.32.11, unit systemd ada (disabled) | bisa jadi host embedding |
| Kebijakan AI | `app_settings` (`ai.*`) — desain L9 | belum ada kode |

**Yang BELUM ada:** `src/lib/ai/`, `src/lib/embedding/`, halaman Pengaturan bagian AI (masih "Menyusul M10"), endpoint `/api/ai/*`, alur enrichment.

---

## 3. Lingkungan nyata (ini menentukan bentuk implementasi)

Diverifikasi di mesin ini:

| Fakta | Nilai | Implikasi |
|-------|-------|-----------|
| GPU NVIDIA | **tidak ada** (driver gagal) | embedding **CPU-only** |
| RAM | 7,7 GB total · **2,2 GB bebas** | BGE-M3 (1,2 GB fp16) **ketat**; harus hemat |
| CPU | 8 core | cukup untuk batch kecil |
| Ollama | v0.32.11 terpasang, **tak jalan** | opsi host embedding |

> ⚠️ **Konsekuensi penting:** embedding BGE-M3 CPU di mesin 8 core / 2,2 GB bebas akan **lambat** (puluhan–ratusan ms per teks) dan **berisiko OOM** bila batch besar. Perlu keputusan lajur (lihat §7 ⚠️D1).

---

## 4. Arsitektur yang diusulkan

```
src/lib/
  ai/
    client.ts       — satu gerbang LLM (BACA app_settings). OpenAI-compatible.
                     chat() · chatJson() · health()
    enrich.ts       — prompt + parse hasil (usulan tag/level/kesulitan) → ParsedEnrichment
  embedding/
    bge-m3.ts       — embedTexts(texts) → number[1024][]. Validasi ketat. Health.
    hash.ts         — contentHash untuk deteksi basi (pakai hash.ts ingest)
  services/
    enrichment-service.ts  — orkestrasi: ambil soal → AI tag → usulan; embedding → simpan
    ai-settings-service.ts — validasi + simpan ai.* (key TERENKRIPSI)
  api/  (muka manusia, /api/*)
    ai/health · ai/enrich · ai/embed · ai/settings
```

**Alur enrichment (worker / manual / agen — satu implementasi):**

```
soal (draft|review)
  → ai/client.chatJson(prompt)          [L9: satu gerbang]
  → usulan {topics[], difficulty, cognitiveLevel, tags[], notes}
  → TIDAK ditulis langsung ke soal
  → status → review  (bukan ready)      [prinsip #5]
  → audit_logs(action=update)           [+ usulan disimpan utk ditinjau manusia]
```

**Alur embedding:**

```
soal (embedding null ATAU hash konten ≠ embedding_content_hash)
  → embedding/bge-m3.embedTexts([contentMarkdown])
  → simpan embedding + embedding_content_hash + embedding_model_name
  → aktifkan mode "semantik" di pencarian M6 (fallback trigram bila kosong)
```

---

## 5. Kontrak baru (usulan)

**`app_settings` (baru, is_secret sesuai):**

| Kunci | Tipe | Secret | Default |
|-------|------|:------:|---------|
| `ai.enabled` | boolean | — | `false` |
| `ai.base_url` | string | — | `""` (contoh: `https://9router.local/v1`) |
| `ai.api_key` | string | ✅ | — |
| `ai.model` | string | — | `""` |
| `ai.max_tokens` | number | — | `1024` |
| `ai.timeout_ms` | number | — | `60000` |

**Embedding (ENV, bukan setting):** `BGE_M3_SERVICE_URL` · opsional `BGE_M3_MODEL` (default `bge-m3`).

**Endpoint (muka manusia, `/api/*`):**

| Method | Path | Izin | Fungsi |
|--------|------|------|--------|
| GET | `/api/ai/health` | `settings:manage` | cek LLM + embedding hidup |
| POST | `/api/ai/settings` | `settings:manage` | simpan `ai.*` (key terenkripsi) |
| POST | `/api/ai/enrich` | `question:update` | enrich 1 soal → usulan + `review` |
| POST | `/api/ai/embed` | `question:update` | embed 1 soal (atau batch kecil) |

> Semua mutasi **wajib `rateLimit`** (CONSTRAINTS #33) + **`audit_logs`**.

---

## 6. Aturan mutu & keselamatan (WAJIB)

1. **Jangan tulis langsung ke `questions`** dari usulan AI — simpan usulan, status → `review`.
2. **Jangan sentuh `answer_key`** dengan AI (jawaban = tanggung jawab manusia).
3. **Flag × status**: soal `is_flagged` **tidak boleh** jadi `ready` (invarian sudah ada) — AI pun tunduk.
4. **Embedding basi**: simpan `embedding_content_hash`; hitung ulang hanya bila konten berubah.
5. **Secret**: `ai.api_key` **tidak pernah** dikembalikan mentah — ikuti `settings-service` (mask `***`).
6. **Gagal AI ≠ gagal soal**: error LLM hanya membatalkan enrichment, soal tetap utuh.
7. **Batas biaya**: `ai.max_tokens` + timeout + `rateLimit`; log tiap panggilan ke `audit_logs`.
8. **Wajib teruji**: client (mock HTTP), embedding (mock/validasi dim), enrichment (mock), alur API (DB uji).

---

## 7. ✅ Keputusan (ditetapkan 2026-09-30)

### ✅ D1 — Hosting BGE-M3: **Ollama lokal** · LLM: **9router (OpenAI-compatible)**
**Terukur nyata di mesin ini** (bukan estimasi):

| Metrik | Nilai |
|--------|-------|
| Dimensi | **1024** ✅ persis sesuai skema |
| Kecepatan warm | **296 ms/teks** (CPU, 8 core) |
| Muat pertama | 13,9 s (sekali) |
| RAM | **1.276 MB** (~1,2 GB); sisa 2,4 GB |
| Model | `bge-m3` (sudah di-pull) |

Endpoint Ollama: `POST /api/embed` → `{model, input}` → `{embeddings[]}`.
**LLM (9router)** via `ai/client.ts` baca `app_settings`; endpoint OpenAI-compatible.
**Model dapat dipilih dari Setting** — endpoint `GET ai.base_url/models` menampilkan daftar model yang tersedia.

### ✅ D2 — `ai.api_key` **terenkripsi at-rest** (AES-256-GCM), kunci di ENV
Kunci: `SETTINGS_ENC_KEY` (32 byte, hex/base64). Secret lain mengikuti pola sama.

### ✅ D3 — Cakupan enrichment: **topik + kesulitan + cognitive level + tags**
Semua = **usulan** → disimpan, status soal → `review` (bukan `ready`). `answer_key` tak disentuh.

### ✅ D4 — Pemicu: **manual + batch**
- **Manual**: 1 soal / beberapa terpilih di UI.
- **Batch**: antrean (pola mirip ingest) — proses bertahap, bisa dilanjutkan.

---

## 7b. (Riwayat) Keputusan yang diajukan

### ⚠️ D1 — Bagaimana BGE-M3 dihosting?
Mesin **CPU-only, RAM ketat** (§3).

| Opsi | Cara | Untung | Rugi |
|------|------|--------|------|
| **A. Ollama lokal** | `ollama serve` + `ollama pull bge-m3`; endpoint `/api/embed` | sudah terpasang; 1 perintah | CPU lambat; ~1,2 GB RAM |
| **B. TEI (HuggingFace)** | container `text-embeddings-inference` port 8080 | cepat (Rust), sesuai `.env.example` | butuh Docker/GPU; CPU tetap lambat |
| **C. Jasa embedding eksternal** | API OpenAI-compatible | tak bebani mesin | data keluar; biaya |
| **D. Tunda embedding, AI tagging dulu** | enrichment teks dulu; embedding menyusul | ringan; buktikan nilai dulu | pencarian semantik M6 tertunda |

**Rekomendasi:** **D lalu A** — mulai dari **AI tagging (teks)** yang ringan, buktikan nilainya; embedding (BGE-M3 via Ollama) menyusul saat jelas dibutuhkan. *Alasan: RAM hanya 2,2 GB bebas, embedding CPU berat, dan nilai enrichment teks bisa dirasakan lebih dulu.*

### ⚠️ D2 — Enkripsi `ai.api_key` di DB
Desain L9 bilang "terenkripsi", tetapi `settings-service` sekarang **menyimpan plaintext** (hanya dimask saat dibaca).

| Opsi | Cara |
|------|------|
| **A. Enkripsi at-rest** | AES-256-GCM, kunci dari ENV baru `SETTINGS_ENC_KEY` (atau turunan `BETTER_AUTH_SECRET`) |
| **B. Plaintext + kontrol akses ketat** | hanya `settings:manage` bisa baca; DB dianggap tepercaya |
| **C. Simpan di ENV saja** | `AI_API_KEY` di `.env`, bukan DB |

**Rekomendasi:** **A** — sesuai desain terkunci ("terenkripsi"); kunci enkripsi di ENV (bukan DB).

### ⚠️ D3 — Model & prompt enrichment
Apa yang AI **boleh** usulkan? (semua = usulan, bukan tulisan final)

- [ ] `topics[]` (dari daftar topik yang ADA)
- [ ] `difficulty` (easy/medium/hard)
- [ ] `cognitiveLevel` (C1–C6)
- [ ] `tags[]`
- [ ] **ragam bahasa / normalisasi LaTeX**
- [ ] usulan pembahasan (untuk soal tanpa pembahasan)
- [ ] deteksi duplikat semantik

**Rekomendasi:** mulai **3 pertama** (topik · kesulitan · kognitif) — paling bernilai, paling aman, mudah diverifikasi.

### ⚠️ D4 — Pemicu enrichment
- [ ] Otomatis saat soal masuk (worker)
- [ ] Manual di UI (1 soal / terpilih)
- [ ] Batch (antrean seperti ingest)

**Rekomendasi:** **manual dulu** (bisa segera dilihat hasilnya), batch menyusul.

---

## 8. Rencana kerja (setelah keputusan)

| Langkah | Isi | Gate |
|---------|-----|------|
| M10-a | `ai/client.ts` (baca setting, `chat`/`chatJson`/`health`/**`listModels`**) + tes mock | tsc/lint/tes |
| M10-b | `ai-settings-service` + **enkripsi AES-256-GCM** + endpoint `/api/ai/settings` + `/api/ai/models` + UI Pengaturan bagian AI | tes DB |
| M10-c | `embedding/bge-m3.ts` (**Ollama `/api/embed`**) + hash + tes | tes |
| M10-d | `enrichment-service` + `/api/ai/enrich` + status→`review` (manual) | tes DB |
| M10-e | Aktifkan mode **semantik** di pencarian M6 (fallback trigram) | tes DB |
| M10-f | **Batch** enrichment (antrean) + Halaman UI enrichment | tes DB/manual |
| 📄 | Dokumen ini (`RENCANA-ENRICHMENT.md`) | ✅ |

---

## 9. Catatan Verifikasi

**Status: ✅ TERIMPLEMENTASI (2026-09-30)** — M10-a s/d M10-f inti selesai.

| Langkah | Status | Bukti |
|---------|:------:|-------|
| M10-a `ai/client.ts` | ✅ | `chat`/`chatJson`/`listModels`/`health`; 20 tes unit |
| M10-b settings + UI | ✅ | enkripsi AES-256-GCM; kartu **AI/Enrichment** di Pengaturan (live) |
| M10-c `embedding/bge-m3.ts` | ✅ | Ollama; **dim 1024 terverifikasi** |
| M10-d `enrichment-service` | ✅ | usulan → terapkan + draft→review; jawaban utuh |
| M10-e pencarian semantik | ✅ | query natural-language → soal relevan #1 (nyata) |
| M10-f batch + UI | ✅ (batch) / ⏭️ UI enrich | endpoint batch jalan |

**Verifikasi nyata (produksi ini):**
- Embedding BGE-M3 (Ollama): **1024-dim**, ~296 ms/teks, RAM ~1,2 GB.
- Enkripsi key: tersimpan `v1:…` di DB; UI baca `***` + `isSet` (tak bocor).
- E2E: mock LLM → usulan (topik/kesulitan/kognitif/tags) diterapkan, status → `review`, `answer_key` utuh.
- Pencarian semantik: `"bagaimana cara menurunkan fungsi berpangkat"` → soal turunan **peringkat 1**.
- Gate: unit **405** · DB **128** · coverage **91,99%** · tsc 0 · lint 0.

**Belum (menyusul):**
- UI enrichment di halaman soal (tombol "Enrich dengan AI" + pratinjau usulan).
- M11 MCP (tool `enrich`) memakai service yang sama.

### Keputusan status enrichment (dikonfirmasi 2026-09-30)

Saat AI meng-enrich soal, status berubah: **hanya `draft` → `review`**. Status lain
(`review`/`ready`/`archived`) **tetap apa adanya** walau metadatanya diperbarui AI.

Alasan: enrichment pada soal yang sudah diverifikasi tidak boleh diam-diam
menurunkan status (memaksa telaah ulang). Guru dapat mengirim ke telaah secara
eksplisit ("Kirim Telaah") bila ingin re-verifikasi.
