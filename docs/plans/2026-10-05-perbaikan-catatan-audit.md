# Implementation Plan — Perbaikan Catatan Audit MathBank (5 Oktober 2026)

> **Tujuan:** Memperbaiki temuan kritis fungsional, keamanan jaringan anti-SSRF, sanitasi parser KaTeX, dan batasan skema database hasil evaluasi audit independen 5 Oktober 2026 menggunakan metodologi Test-Driven Development (TDD Red-Green-Refactor).

---

## 1. Pemetaan Berkas Terdampak

| Berkas Target | Peran & Rincian Perubahan |
|---|---|
| [`src/lib/ingest/media/fetch.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts) | Pengerasan Anti-SSRF: resolusi DNS pra-koneksi (`dns.promises.lookup`) + penanganan manual HTTP redirect loop (`redirect: "manual"`). |
| [`src/lib/ingest/media/media-io.test.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/media-io.test.ts) | Tes unit verifikasi proteksi SSRF terhadap DNS rebinding dan redirect ke IP privat/metadata AWS `169.254.169.254`. |
| [`src/lib/ai/enrich.ts`](file:///home/hari/projects/mathbank/src/lib/ai/enrich.ts) | Perbaikan parsing KaTeX: deteksi delimiter tak berpasangan (`hasUnmatchedDelimiters`), kurung terbalik (`braceDepth`), dan penyebut kosong pada kurung bersarang (`hasEmptyFrac`). |
| [`src/lib/ai/enrich.test.ts`](file:///home/hari/projects/mathbank/src/lib/ai/enrich.test.ts) | Tes unit regresi untuk delimiter tak tertutup (`\(x^2+1`), kurung terbalik `}{`, dan `\frac{\sqrt{2}}{}`. |
| [`src/lib/services/enrichment-service.ts`](file:///home/hari/projects/mathbank/src/lib/services/enrichment-service.ts) | Hapus fungsi lokal `slugify` 200 karakter; ganti dengan kanonikal `slugify(name, 100)` dari `tree.ts`. Perbaiki penanganan tabrakan slug unik pada `findOrCreateTagTx`. |
| [`src/lib/services/enrichment.db.test.ts`](file:///home/hari/projects/mathbank/src/lib/services/enrichment.db.test.ts) | Tes integrasi DB untuk tabrakan slug tag unik (dua nama berbeda menghasilkan slug sama) dan panjang slug >100 karakter. |
| [`src/app/api/mcp/route.ts`](file:///home/hari/projects/mathbank/src/app/api/mcp/route.ts) | Terapkan proteksi rate limit HTTP `checkRateLimit` pada handler `POST /api/mcp` (CONSTRAINT #33). |
| [`src/lib/export/gitsync-writer.ts`](file:///home/hari/projects/mathbank/src/lib/export/gitsync-writer.ts) | Tambahkan komentar inline `/*turbopackIgnore: true*/` untuk membungkam peringatan dynamic filesystem tracing Turbopack. |

---

## 2. Tahapan Eksekusi (Bite-Sized TDD Tasks)

### Task 1: [SEC-01] Pengerasan Jaringan Anti-SSRF pada `fetchImage`
- [ ] **Langkah 1.1 (TDD Red):** Di [`src/lib/ingest/media/media-io.test.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/media-io.test.ts), tambahkan pengujian:
  - Penolakan domain yang me-resolve ke IP privat/loopback melalui mock DNS lookup.
  - Penolakan respons redirect HTTP 301/302 yang mengarah ke `http://169.254.169.254/latest/meta-data/` atau IP lokal.
- [ ] **Langkah 1.2 (Verifikasi Red):** Jalankan `pnpm test src/lib/ingest/media/media-io.test.ts` dan amati kegagalan tes.
- [ ] **Langkah 1.3 (TDD Green):** Di [`src/lib/ingest/media/fetch.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts):
  - Gunakan `dns.promises.lookup` untuk memvalidasi seluruh alamat IP hasil resolusi hostname sebelum melakukan fetch.
  - Ubah opsi `redirect` menjadi `"manual"`, dan buat loop penanganan redirect (maksimal 3 lompatan) yang memeriksa ulang IP tujuan pada setiap hop.
- [ ] **Langkah 1.4 (Verifikasi Green):** Jalankan ulang tes unit dan pastikan semua tes SSRF lulus.

---

### Task 2: [CORR-01, CORR-04, CORR-05] Pembenahan Parser & Kontrak KaTeX di `enrich.ts`
- [ ] **Langkah 2.1 (TDD Red):** Di [`src/lib/ai/enrich.test.ts`](file:///home/hari/projects/mathbank/src/lib/ai/enrich.test.ts), buat kasus uji kegagalan:
  - Rumus dengan delimiter tak tertutup: `"Diketahui \\(x^2 + 5x = 0"` (harus menghasilkan isu `syntax`).
  - Kurung terbalik: `"Nilai dari \\(x^{2}{y\\)"` (harus menghasilkan isu kurung tidak valid).
  - Pembilang bersarang dengan penyebut kosong: `"\\frac{\\sqrt{2}}{}"` (harus menghasilkan isu pecahan kosong).
- [ ] **Langkah 2.2 (Verifikasi Red):** Jalankan `pnpm test src/lib/ai/enrich.test.ts` dan pastikan kasus-kasus tersebut gagal tertangkap.
- [ ] **Langkah 2.3 (TDD Green):** Di [`src/lib/ai/enrich.ts`](file:///home/hari/projects/mathbank/src/lib/ai/enrich.ts):
  - Tambahkan fungsi pembantu `hasUnmatchedDelimiters(text: string): boolean` yang membandingkan count `\(` vs `\)`, `\[` vs `\]`, dan parity `$`.
  - Pada `braceDepth`, tambahkan guard `if (depth < 0) return -1` di dalam loop iterasi karakter.
  - Sempurnakan regex `hasEmptyFrac` agar mengenali kurung bersarang pada pembilang.
- [ ] **Langkah 2.4 (Verifikasi Green):** Jalankan `pnpm test src/lib/ai/enrich.test.ts` dan pastikan 100% kasus uji lulus.

---

### Task 3: [CORR-02 & CORR-03] Standarisasi Slug Tag & Penanganan Tabrakan Unik
- [ ] **Langkah 3.1 (TDD Red):** Di [`src/lib/services/enrichment.db.test.ts`](file:///home/hari/projects/mathbank/src/lib/services/enrichment.db.test.ts):
  - Buat tes enrichment dengan tag bernama sangat panjang (>150 karakter) — pastikan tidak melempar galat PostgreSQL 22001 (`value too long`).
  - Buat tes dengan dua tag yang menghasilkan slug identik (misal `"Aljabar Linear"` dan `"Aljabar-Linear"`) — pastikan tidak memicu `TypeError`.
- [ ] **Langkah 3.2 (Verifikasi Red):** Jalankan tes dan amati galat crash.
- [ ] **Langkah 3.3 (TDD Green):** Di [`src/lib/services/enrichment-service.ts`](file:///home/hari/projects/mathbank/src/lib/services/enrichment-service.ts):
  - Hapus fungsi lokal `slugify` dan gunakan kanonikal `slugify(name, 100)` dari `src/lib/taxonomy/tree.ts` (CONSTRAINT #40).
  - Pada `findOrCreateTagTx`, perbarui kueri fallback pemulihan:
    ```typescript
    const [again] = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(sql`lower(${tags.name}) = lower(${trimmed}) OR ${tags.slug} = ${slug}`)
      .limit(1);
    if (!again) throw new Error(`Gagal memproses tag "${trimmed}" (slug: ${slug})`);
    return again.id;
    ```
- [ ] **Langkah 3.4 (Verifikasi Green):** Jalankan `pnpm test:db src/lib/services/enrichment.db.test.ts` dan pastikan lulus rapi.

---

### Task 4: [SEC-02] Rate Limiting Route HTTP MCP
- [ ] **Langkah 4.1:** Di [`src/app/api/mcp/route.ts`](file:///home/hari/projects/mathbank/src/app/api/mcp/route.ts):
  - Impor `checkRateLimit` dari `@/lib/api/rate-limit`.
  - Periksa IP klien di awal fungsi `POST`: jika batas terlampaui, kembalikan HTTP 429 JSON-RPC error.
- [ ] **Langkah 4.2:** Jalankan `pnpm test:db src/lib/mcp/mcp.db.test.ts` untuk memastikan tidak ada efek samping pada alur normal MCP.

---

### Task 5: [PERF-01] Optimasi Dynamic Filesystem Access Turbopack
- [ ] **Langkah 5.1:** Di [`src/lib/export/gitsync-writer.ts`](file:///home/hari/projects/mathbank/src/lib/export/gitsync-writer.ts) dan [`src/lib/ingest/config.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/config.ts), tambahkan komentar `/*turbopackIgnore: true*/` pada pemanggilan `join()`.
- [ ] **Langkah 5.2:** Jalankan `pnpm build` dan pastikan 4 peringatan tracing Turbopack hilang atau berkurang.

---

## 3. Matriks Verifikasi Akhir (Exit Gate)
- [ ] `pnpm theme:check` (34/34 WCAG 2.2 AA)
- [ ] `pnpm lint:names` (100% English naming)
- [ ] `pnpm typecheck` (0 errors)
- [ ] `pnpm lint` (0 errors, 0 warnings)
- [ ] `pnpm test:coverage` (Statements ≥85%, Branches ≥80%, Functions ≥85%, Lines ≥85%)
- [ ] `pnpm test:db` (23 berkas tes integrasi lulus)
- [ ] `pnpm db:verify` (26 tabel, 24 triggers, zero drift)
- [ ] `pnpm build` (Next.js 16 App Router build exit 0)
