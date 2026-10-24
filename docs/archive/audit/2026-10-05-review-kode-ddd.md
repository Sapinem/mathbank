# CATATAN REVIEW KODE MATHBANK (DOUBT-DRIVEN DEVELOPMENT)
**Target Repositori:** MathBank (`/home/hari/projects/mathbank`)  
**Metodologi:** Doubt-Driven Development (DDD) & Multi-Axis Audit Protocol  
**Tanggal:** 5 Oktober 2026  
**Status Evaluasi:** Tinjauan Adversarial Siklus 1 Selesai (Menunggu Pilihan Cross-Model Reviewer)

---

## 1. Ikhtisar Eksekutif & Status Empiris Sistem

Pemeriksaan menyeluruh dilakukan pada branch aktif `paperclip/dev` (commit mutakhir `ee0c732`) yang mencakup implementasi fitur terbaru:
- **MAT-41:** Penegakan kontrak pedagogi enrichment (distractor rationale A–E + validator KaTeX murni).
- **MAT-40:** Penyatuan antarmuka bundles & standardisasi tata letak cetak A4.
- **MAT-39:** Penghapusan entitas `collections` dan penambahan diskriminator `origin` pada `bundles`.
- **MAT-36:** Pemisahan dan modularisasi `bundle-service.ts` ke dalam modul-modul berorientasi SRP (<300 baris).

### Hasil Pengujian Empiris Langsung (Baseline):
- **Typecheck (`pnpm typecheck`):** **0 galat** (`tsc --noEmit` exit 0).
- **Linter & Secret Scanner (`pnpm lint`):** **0 galat, 0 peringatan**; 625 berkas bersih dari rahasia/kredensial.
- **Konvensi Bahasa & Naming (CONSTRAINT #28b):** **100% patuh bahasa Inggris** (`pnpm lint:names` exit 0).
- **Pengujian Unit & Cakupan (Coverage):** **64 berkas tes lulus (741 tes lulus)** via `vitest run --coverage`.
  - Statements: **91.84%** (ambang batas: ≥ 85%)
  - Branches: **83.81%** (ambang batas: ≥ 80%)
  - Functions: **91.31%** (ambang batas: ≥ 85%)
  - Lines: **94.02%** (ambang batas: ≥ 85%)
- **Pengujian Integrasi Database (`pnpm test:db`):** **23 berkas tes lulus (240 tes integrasi lulus)**.
- **Verifikasi Skema Database (`pnpm db:verify`):** **26 tabel, 24 triggers, 3 checks, 1 HNSW index** (Zero Drift).
- **Kompilasi Produksi Next.js 16 (Turbopack):** **48 rute statis & 51 endpoint API berhasil dikompilasi**.

---

## 2. Siklus Doubt-Driven Development (DDD)

Sesuai protokol Doubt-Driven Development, setiap keputusan atau klaim non-trivial diuji secara adversarial dengan memposisikan penelaah dalam konteks terisolasi dan bias untuk **membantah** (*disprove*), bukan menyetujui (*validate*).

```markdown
Doubt cycle status:
- [x] Step 1: CLAIM — Merumuskan klaim non-trivial & dampaknya
- [x] Step 2: EXTRACT — Mengisolasi unit kode terkecil (artifact) & kontrak (contract)
- [x] Step 3: DOUBT — Menjalankan adversarial review fresh-context
- [x] Step 4: RECONCILE — Mengklasifikasikan temuan (contract misread / actionable / trade-off / noise)
- [ ] Step 5: STOP — Memenuhi kondisi henti (trivial / 3 siklus / user override)
```

### 2.2. Klasifikasi & Rekonsiliasi Temuan (Step 4: RECONCILE)

Sesuai aturan preseden (*precedence order*) Doubt-Driven Development:

#### 1. Contract / Snippet Misread (Artefak Potongan vs Basis Kode Penuh)
- **`cleanMessage` dilaporkan undefined:** Pada berkas riil [`src/lib/ai/enrich.ts:230-235`](file:///home/hari/projects/mathbank/src/lib/ai/enrich.ts#L230), fungsi `cleanMessage` sudah didefinisikan secara lokal. Penelaah menandainya karena isolasi potongan artefak.
- **Validasi KaTeX pada Distractor Rationale:** Pada tingkat agregat [`evaluatePedagogyContract`](file:///home/hari/projects/mathbank/src/lib/ai/enrich.ts#L508), `validateKatexContract(o.distractorRationale)` sudah dipanggil untuk setiap opsi salah. Namun pada fungsi unit `validateDistractorRationales` hal ini memang belum dilakukan.

#### 2. Valid + Actionable (Cacat Riil yang Wajib Diperbaiki)
- **[DOUBT-CRIT-01] Delimiter Terbuka KaTeX Lolos Diam-Diam:** Regex `MATH_RE` hanya mencocokkan delimiter berpasangan. Rumus dengan delimiter tak tertutup (misal `\(x^2+1`) menyebabkan `extractMathSegments` kosong, sehingga lolos validasi (melanggar CONSTRAINT #29).
- **[DOUBT-CRIT-02] Kolom Slug Tag Overflow (CONSTRAINT #40):** Fungsi lokal `slugify` di `enrichment-service.ts` memotong 200 karakter, melanggar batas kolom `tags.slug` (`varchar(100)`).
- **[DOUBT-CRIT-03] Unhandled `TypeError` pada Tabrakan Slug di `findOrCreateTagTx`:** Ketika terjadi tabrakan slug unik pada `tags`, `again` bernilai `undefined`, memicu `TypeError: Cannot read properties of undefined (reading 'id')`.
- **[DOUBT-CRIT-04] Cacat `braceDepth` pada Kurung Terbalik (`}{`):** Pengecekan hanya di akhir (`depth === 0`) memungkinkan kurung terbalik lolos.
- **[DOUBT-CRIT-05] `hasEmptyFrac` Gagal pada Kurung Bersarang Pembilang:** Regex `[^{}]*` gagal mengenali pembilang ber-subscript/akar seperti `\frac{\sqrt{2}}{}`.
- **[SEC-01] Kerentanan SSRF DNS Rebinding & Follow Redirects:** `isPrivateOrBlockedHost` di `fetch.ts` rentan bypass DNS rebinding dan auto-redirect ke IP internal/metadata.
- **[SEC-02] Ketiadaan Rate Limiting pada MCP HTTP Route:** `/api/mcp` belum diproteksi rate limiter (CONSTRAINT #33).

#### 3. Valid Trade-off (Kompromi Sadar)
- **Macro Terlarang pada Raw Markdown:** Pemeriksaan macro global mendeteksi `\input` di seluruh teks naskah. Trade-off ini diterima demi keamanan ketat bank soal matematika sekolah agar tidak ada macro I/O LaTeX yang tersimpan.

#### 4. Noise / Context-Dependent
- **Dukungan Delimiter Warisan (`$` dan `$$`):** Proyek MathBank sengaja mempertahankan parser `$`/`$$` untuk kompatibilitas impor ribuan soal lama dari korpus Mathcyber/Defantri/Pusmendik, meskipun soal baru diwajibkan memakai `\(...\)` / `\[...\]`.


### 2.1. Klaim yang Diuji (Claims Under Scrutiny)

#### CLAIM 1 (KaTeX Engine & Pedagogi MAT-41)
> **KLAIM:** *"Mesin validasi KaTeX murni (`validateKatexContract`) dan validator rationale di `src/lib/ai/enrich.ts` menjamin bahwa rumus matematika rusak dan opsi tanpa analisis miskonsepsi tidak akan lolos ke database/pipeline review."*  
> **URGENSI (Why it matters):** Rumus matematika yang lolos dengan delimiter terbuka atau kurung tak seimbang akan memecah layout UI mobile/desktop, menyebabkan crash pada KaTeX auto-render di browser klien, dan merusak ekspor Moodle XML serta PDF cetak.

#### CLAIM 2 (Slugifikasi Tag & Skema DB di `enrichment-service.ts`)
> **KLAIM:** *"Pembuatan tag otomatis dari usulan AI di `findOrCreateTagTx` aman dari pelanggaran batasan skema dan tabrakan konkurensi."*  
> **URGENSI (Why it matters):** Error 500 pada transaksi enrichment akibat overflow kolom atau `TypeError` akan menggagalkan pipeline kurasi massal.

#### CLAIM 3 (Keamanan Anti-SSRF Media Ingest di `fetch.ts`)
> **KLAIM:** *"Fungsi `fetchImage` kebal terhadap serangan Server-Side Request Forgery (SSRF) dan eksfiltrasi endpoint metadata cloud."*  
> **URGENSI (Why it matters):** Sumber soal eksternal dapat mengeksploitasi DNS rebinding atau redirection untuk mengakses metadata AWS/GCP (`169.254.169.254`) atau port internal localhost.

---

## 3. Temuan Adversarial Review (Single-Model Reviewer)

Evaluasi independen terhadap unit artefak menghasilkan temuan-temuan kritis berikut:

### 🔴 Temuan Kritis (Critical & Required)

1. **[DOUBT-CRIT-01] Kebocoran Rumus Delimiter Terbuka / Unclosed Delimiters (CONSTRAINT #29)**
   - **Lokasi:** [`src/lib/ai/enrich.ts:185, 268-306`](file:///home/hari/projects/mathbank/src/lib/ai/enrich.ts#L185)
   - **Mekanisme Cacat:** Regex `MATH_RE = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g` mensyaratkan pasangan buka dan tutup delimiter. Jika naskah masukan memuat rumus dengan delimiter terbuka tanpa tutup (misal: `Diketahui \(x^2 + 5x = 0` tanpa `\)`), `MATH_RE` gagal mencocokkan. Akibatnya `extractMathSegments` mengembalikan array kosong `[]`. Fungsi `validateKatexContract` mengembalikan `{ ok: true, issues: [] }`. Naskah dengan rumus rusak lolos tanpa terdeteksi!
   - **Rekomendasi Tindakan:** Tambahkan pre-check pemindaian pasangan delimiter (`\(...\)`, `\[...\]`, `$...$`, `$$...$$`). Jika jumlah delimiter pembuka tidak sama dengan penutup, hasilkan issue `syntax: "Delimiter rumus tidak berpasangan / tidak tertutup"`.

2. **[DOUBT-CRIT-02] Database Column Overflow pada Tag Slug (CONSTRAINT #40)**
   - **Lokasi:** [`src/lib/services/enrichment-service.ts:73-81, 114-115`](file:///home/hari/projects/mathbank/src/lib/services/enrichment-service.ts#L73)
   - **Mekanisme Cacat:** `enrichment-service.ts` mendefinisikan fungsi lokal `slugify` yang memotong hingga 200 karakter (`.slice(0, 200)`). Padahal kolom `tags.slug` pada database didefinisikan sebagai `varchar(100)`. Jika nama tag menghasilkan slug lebih dari 100 karakter, query insert akan melempar database error 500 fatal: `value too long for type character varying(100)`.
   - **Rekomendasi Tindakan:** Hapus fungsi `slugify` lokal di `enrichment-service.ts` dan gunakan helper kanonikal `slugify(name, 100)` dari `src/lib/taxonomy/tree.ts` yang mematuhi CONSTRAINT #40.

3. **[DOUBT-CRIT-03] Potensi `TypeError` (Crash Transaksi) pada `findOrCreateTagTx`**
   - **Lokasi:** [`src/lib/services/enrichment-service.ts:106-125`](file:///home/hari/projects/mathbank/src/lib/services/enrichment-service.ts#L106)
   - **Mekanisme Cacat:** Pada `findOrCreateTagTx`:
     ```typescript
     const [row] = await tx.insert(tags).values({ name, slug: slugify(name) }).onConflictDoNothing().returning({ id: tags.id });
     if (row) return row.id;
     const [again] = await tx.select({ id: tags.id }).from(tags).where(sql`lower(${tags.name}) = lower(${name})`).limit(1);
     return again!.id; // <-- CRASH bila konflik terjadi pada SLUG, bukan NAME
     ```
     Jika dua nama berbeda menghasilkan slug yang sama (misal `"Aljabar Linear"` dan `"Aljabar-Linear"`), `onConflictDoNothing()` membatalkan insert karena unique index `uq_tags_slug`. Namun query pemulihan berikutnya mencari `lower(name) = lower(${name})` yang tidak ditemukan. Akibatnya `again` bernilai `undefined`, dan non-null assertion `again!.id` melempar `TypeError: Cannot read properties of undefined (reading 'id')`!
   - **Rekomendasi Tindakan:** Tangani fallback dengan query kondisi OR (`lower(name) = ... OR slug = ...`) atau buat slug deterministik dengan sufiks unik, serta jangan gunakan `!.` tanpa validasi.

4. **[DOUBT-CRIT-04] Bypass `braceDepth` pada Kurung Terbalik (`}{`)**
   - **Lokasi:** [`src/lib/ai/enrich.ts:207-219`](file:///home/hari/projects/mathbank/src/lib/ai/enrich.ts#L207)
   - **Mekanisme Cacat:** `braceDepth` hanya memeriksa `depth === 0` di akhir string. String dengan kurung terbalik seperti `}{` atau `\frac}{x{` akan berkurang ke `-1` lalu kembali ke `0`.
   - **Rekomendasi Tindakan:** Jika pada saat iterasi `depth < 0`, segera kembalikan nilai tidak valid (misal `-1`).

5. **[DOUBT-CRIT-05] `hasEmptyFrac` Gagal Mendeteksi Kurung Bersarang pada Pembilang**
   - **Lokasi:** [`src/lib/ai/enrich.ts:222-227`](file:///home/hari/projects/mathbank/src/lib/ai/enrich.ts#L222)
   - **Mekanisme Cacat:** Regex `/\\(?:d|t)?frac\s*\{[^{}]*\}\s*\{\s*\}/` menggunakan `[^{}]*` untuk pembilang. Jika pembilang memuat kurung kurawal bersarang (seperti `\frac{\mathbf{x}}{}` atau `\frac{\sqrt{2}}{}`), regex gagal mencocokkan sehingga penyebut kosong lolos.
   - **Rekomendasi Tindakan:** Gunakan parser kedalaman kurung kurawal atau regex yang mendukung satu level kurung bersarang.

6. **[DOUBT-CRIT-06] SSRF via DNS Rebinding & Unvalidated Redirects pada `fetchImage` (SEC-01)**
   - **Lokasi:** [`src/lib/ingest/media/fetch.ts:183, 204-208`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L183)
   - **Mekanisme Cacat:** `isPrivateOrBlockedHost` hanya memvalidasi string nama host mentah dengan regex IP IPv4. Domain pihak ketiga yang mengarah ke `127.0.0.1` atau `169.254.169.254` (seperti `127.0.0.1.nip.io`) lolos filter. Selain itu `redirect: "follow"` pada fetch native secara otomatis mengikuti respon redirect HTTP 301/302 ke IP privat/metadata tanpa filter ulang.
   - **Rekomendasi Tindakan:** Lakukan resolusi DNS (`dns.promises.lookup`) sebelum koneksi, dan tangani redirect secara manual (`redirect: "manual"`) dengan validasi ulang URL redirect.

7. **[DOUBT-CRIT-07] Ketiadaan Rate Limiting pada HTTP MCP Route (`/api/mcp`) (SEC-03)**
   - **Lokasi:** [`src/app/api/mcp/route.ts:30-57`](file:///home/hari/projects/mathbank/src/app/api/mcp/route.ts#L30)
   - **Mekanisme Cacat:** Endpoint `/api/mcp` dipanggil langsung tanpa pembungkus `wrapRoute` dan tanpa pengecekan `checkRateLimit`. Penyerang dapat melakukan brute-force API key atau DoS serangan beban tinggi.
   - **Rekomendasi Tindakan:** Pasang `checkRateLimit(req, { limit: 120, windowMs: 60000, keyPrefix: "rl:mcp:" })` di awal handler `POST`.

---

## 4. Matriks Multi-Axis Review (5 Sumbu Kualitas)

| Kode Temuan | Tingkat Keparahan | Sumbu | Deskripsi Singkat | Status / Tindakan |
|---|---|---|---|---|
| **SEC-01** | 🔴 Critical | Security | SSRF DNS Rebinding & Follow Redirects di `fetch.ts` | Wajib perbaikan (Resolve DNS + Manual Redirect) |
| **CORR-01** | 🔴 Critical | Correctness | Silent pass pada KaTeX unclosed delimiters | Wajib perbaikan (Pre-check balanced delimiters) |
| **CORR-02** | 🟠 Required | Correctness | Tag slug slice(0,200) melanggar `varchar(100)` (CONSTRAINT #40) | Wajib perbaikan (Gunakan `slugify(name, 100)`) |
| **CORR-03** | 🟠 Required | Correctness | `TypeError` pada slug conflict di `findOrCreateTagTx` | Wajib perbaikan (Tangani fallback slug conflict) |
| **SEC-02** | 🟠 Required | Security | Ketiadaan Rate Limiting pada `/api/mcp` (CONSTRAINT #33) | Wajib perbaikan (Terapkan `checkRateLimit`) |
| **CORR-04** | 🟡 Medium | Correctness | `braceDepth` lolos kurung terbalik `}{` | Perbaiki logika depth < 0 |
| **CORR-05** | 🟡 Medium | Correctness | `hasEmptyFrac` gagal pada pembilang kurung bersarang | Perbaiki regex frac |
| **HYG-01** | 🟡 Medium | Simplicity | Dead code file tombstone `collection-service.ts` pasca MAT-39 | Hapus berkas dead code yang tidak terpakai |
| **ARC-01** | 🟡 Consider | Architecture | Berkas service membengkak >300 baris (`taxonomy-service.ts`: 567 baris) | Modularisasi berkas sesuai CONSTRAINT #16 |
| **PERF-01** | 🔵 Nit | Performance | Turbopack Dynamic Filesystem Access Tracing (`gitsync-writer.ts`) | Tambahkan `/*turbopackIgnore: true*/` |

---

## 5. Rekomendasi Solusi Teknis Konkret (Engineering Patches)

### Patch 1: Perbaikan Delimiter KaTeX (`src/lib/ai/enrich.ts`)
```typescript
function hasUnmatchedDelimiters(text: string): boolean {
  const inlineOpen = (text.match(/\\\(/g) || []).length;
  const inlineClose = (text.match(/\\\)/g) || []).length;
  const displayOpen = (text.match(/\\\[/g) || []).length;
  const displayClose = (text.match(/\\\]/g) || []).length;
  const dollarCount = (text.match(/(?<!\\)\$/g) || []).length;

  return (
    inlineOpen !== inlineClose ||
    displayOpen !== displayClose ||
    dollarCount % 2 !== 0
  );
}
```

### Patch 2: Perbaikan Slug & Konflik Tag (`src/lib/services/enrichment-service.ts`)
```typescript
import { slugify } from "@/lib/taxonomy/tree";

async function findOrCreateTagTx(tx: Tx, name: string): Promise<string> {
  const trimmed = name.trim();
  const slug = slugify(trimmed, 100);
  
  const [existing] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${trimmed}) OR ${tags.slug} = ${slug}`)
    .limit(1);
  if (existing) return existing.id;

  const [row] = await tx
    .insert(tags)
    .values({ name: trimmed, slug })
    .onConflictDoNothing()
    .returning({ id: tags.id });
  if (row) return row.id;

  const [again] = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${trimmed}) OR ${tags.slug} = ${slug}`)
    .limit(1);
  if (!again) {
    throw new Error(`Gagal membuat atau menemukan tag "${trimmed}" (slug: ${slug})`);
  }
  return again.id;
}
```

### Patch 3: Perbaikan Rate Limiter MCP (`src/app/api/mcp/route.ts`)
```typescript
import { checkRateLimit } from "@/lib/api/rate-limit";

export async function POST(req: NextRequest): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip, { limit: 120, windowMs: 60000, keyPrefix: "rl:mcp:" });
  if (!rl.allowed) {
    return jsonRpcError(429, -32000, "Too Many Requests: Rate limit exceeded");
  }
  return handleMcp(req);
}
```

---

## 6. Status Verifikasi Sesuai Protokol MathBankAuditor

> **§ Catatan Verifikasi:**
> - **Verifikator:** Auditor Independen Antigravity (Protokol Doubt-Driven Development).
> - **Metode:** Uji statis multi-axis, pelacakan batasan `CONSTRAINTS.md`, adversarial review subagent terisolasi, dan pengujian empiris build/test (`pnpm check` exit 0).
> - **Temuan Utama:** Ditemukan 2 celah kritis fungsional (unclosed delimiters KaTeX lolos diam-diam, dan potensi TypeError pada collision tag slug), 1 celah batasan DB (slugify 200 karakter vs `varchar(100)`), 1 celah keamanan SSRF (DNS rebinding pada fetch media), dan 1 celah DoS (ketiadaan rate limiting pada MCP HTTP).
> - **Peran Auditor:** Laporan ini adalah catatan audit & rekomendasi solusi teknis (*audit & report only*). Dilarang mengubah kode secara sepihak; eksekusi perbaikan diserahkan kepada tim software engineer.
