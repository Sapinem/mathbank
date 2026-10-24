# Observability & Instrumentation Audit Report: MathBank v2.0
**Target File Path:** `MathBankAuditor/reports/17.10.2026/audit-observability-and-instrumentation.md`  
**Audit Date:** 17 Oktober 2026  
**Auditor Persona:** Observability & Reliability Engineer (`observability-and-instrumentation`)  
**Scope:** Core Architecture, Telemetry Infrastructure (`src/lib/telemetry/`), API Route Wrapper (L4), In-Memory Metrics & Cardinality, Structured Logging & Redaction, External Dependency Instrumentation (AI/Ollama/PostgreSQL), Health & Readiness Probes, Batch/Bulk Services (L5), and Protocol Isolation (MCP STDIO).

---

### Executive Summary

Codebase MathBank v2 telah memiliki fondasi telemetri in-house yang dirancang ramping tanpa dependensi eksternal berat (M16), mencakup modul structured logging (`logger.ts`), in-memory metrics ring buffer (`metrics.ts`), serta endpoint probe `/api/health`, `/api/ready`, dan `/api/metrics`.

Meskipun fondasi dasar ini telah aktif, audit mendalam berbasis skill **observability-and-instrumentation** menemukan **dua isu berisiko tinggi (High)** dan beberapa **celah visibilitas signifikan (Medium/Low)**. Celah paling kritis adalah **ledakan kardinalitas metrik (*cardinality explosion*)** akibat pencatatan *raw URL pathname* (termasuk UUID dinamis) ke dalam `Map` in-memory tanpa batas, yang berpotensi memicu *memory leak* dan kegagalan proses Node.js di bawah beban produksi. Selain itu, terdapat risiko **korupsi stream protokol JSON-RPC pada transport MCP STDIO** ketika log non-error dipancarkan ke `stdout`.

| Severity | Count | Status / Action |
|---|:---:|---|
| **Critical** | 0 | Tidak ada kegagalan fatal seketika |
| **High** | 2 | Wajib diperbaiki sebelum rilis v2.0 / integrasi skala besar |
| **Medium** | 4 | Perlu ditangani pada sprint berjalan untuk menjamin keandalan on-call |
| **Low** | 3 | Peningkatan *defense-in-depth*, reduksi *false positive*, dan kelengkapan probe |

---

### Key Findings

#### [HIGH] OBS-01: Ledakan Kardinalitas Metrik & Memory Leak pada In-Memory Route Stats
- **Lokasi:** [`src/lib/api/route-wrapper.ts:290-297`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L290-L297) dan [`src/lib/telemetry/metrics.ts:27-73`](file:///home/hari/projects/mathbank/src/lib/telemetry/metrics.ts#L27-L73)
- **Tipe Celah:** CWE-770: Allocation of Resources Without Limits or Throttling / Unbounded Label Cardinality
- **Deskripsi:**  
  Pada [`route-wrapper.ts:290`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L290), label metrik diambil langsung dari URL riil yang masuk:
  ```typescript
  const routePath = new URL(req.url).pathname;
  // ...
  recordRequest(method, routePath, res.status, Date.now() - startedAt);
  ```
  Pada [`metrics.ts:62-73`](file:///home/hari/projects/mathbank/src/lib/telemetry/metrics.ts#L62-L73), fungsi `recordRequest` menyimpan statistik ke dalam `state().routes` (tipe `Map<string, RouteStat>`). Kunci yang digunakan adalah kombinasi `${method} ${route}`.  
  Ketika endpoint dengan parameter rute dinamis diakses (misalnya `/api/questions/01927c34-9123-7a1b-90cb-22920f78abcd`, `/api/bundles/uuid`, `/api/topics/uuid`), setiap ID unik menciptakan *entry* baru dalam `Map`. Setiap entri mengalokasikan objek `RouteStat` lengkap dengan `new Float64Array(512)` (~4 KB buffer per entri).  
  `state().routes` tidak memiliki batas kapasitas (*max entries*), tidak memiliki mekanisme *eviction* (LRU), dan tidak melakukan normalisasi rute.
- **Dampak:**  
  1. **Memory Leak / OOM:** Penyerang atau lalu lintas reguler yang melakukan *crawling* terhadap ribuan soal akan menggelembungkan `Map` hingga ratusan megabyte, berujung pada crash OOM (*Out Of Memory*) pada server Next.js.
  2. **Event Loop Starvation:** Pemanggilan `snapshot()` pada [`metrics.ts:104-119`](file:///home/hari/projects/mathbank/src/lib/telemetry/metrics.ts#L104-L119) (diakses via `/api/metrics`) melakukan iterasi dan *in-memory sort* terhadap seluruh entri `s.routes`. Jika terdapat 100.000 rute unik, pemanggilan ini akan memblokir *single-threaded event loop* Node.js selama ratusan milidetik.
  3. **Pelanggaran Prinsip Metrik:** Melanggar aturan mendasar observabilitas: *“Never use user IDs, raw URLs, error messages, or other unbounded values as labels.”*
- **Skenario Bukti:**  
  Klien mengeksekusi *loop* membaca 20.000 soal:
  ```bash
  for i in {1..20000}; do
    curl -s "http://localhost:1234/api/questions/00000000-0000-0000-0000-$(printf '%012d' $i)" > /dev/null
  done
  ```
  Hasil: `snapshot().routes` membengkak menjadi 20.000 entri, memakan memori >80 MB, dan `/api/metrics` mengalami *latency spike* signifikan saat men-serialize JSON.
- **Rekomendasi Perbaikan:**  
  Normalisasikan rute dinamis ke *route pattern* (mis. `/api/questions/[id]`) atau gunakan opsi eksplisit `metricRoute` pada `wrapRoute`, serta pasang batas maksimum kapasitas pada `state().routes`.

  ```typescript
  // src/lib/api/route-wrapper.ts
  export interface RouteOptions<TQuery, TBody, TResult> {
    // ...
    /** Template rute statis untuk metrik (mencegah ledakan kardinalitas). */
    metricRoute?: string;
  }

  // Normalisasi fallback bila metricRoute tidak disediakan:
  function sanitizeRouteForMetrics(pathname: string): string {
    return pathname
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
      .replace(/\/img\/[A-Za-z0-9_-]+/g, "/img/:shortId");
  }

  // src/lib/telemetry/metrics.ts
  const MAX_METRIC_ROUTES = 200;
  export function recordRequest(method: string, rawRoute: string, status: number, durationMs: number): void {
    const route = sanitizeRouteForMetrics(rawRoute);
    const k = key(method, route);
    const s = state();
    if (!s.routes.has(k) && s.routes.size >= MAX_METRIC_ROUTES) {
      // Tolak alokasi rute baru jika melampaui batas; masukkan ke kategori generic
      const overflowKey = `${method.toUpperCase()} [other]`;
      const fallback = s.routes.get(overflowKey) ?? newStat();
      fallback.count += 1;
      s.routes.set(overflowKey, fallback);
      return;
    }
    // ... update stat normal
  }
  ```

---

#### [HIGH] OBS-02: Korupsi Stream Transport Protokol MCP STDIO Akibat Logging ke `stdout`
- **Lokasi:** [`src/lib/telemetry/logger.ts:105-113`](file:///home/hari/projects/mathbank/src/lib/telemetry/logger.ts#L105-L113) dan [`src/mcp-stdio.ts:13-27`](file:///home/hari/projects/mathbank/src/mcp-stdio.ts#L13-L27)
- **Tipe Celah:** Protocol Violation / IPC Stream Corruption
- **Deskripsi:**  
  Transport MCP STDIO ([`src/mcp-stdio.ts`](file:///home/hari/projects/mathbank/src/mcp-stdio.ts)) berkomunikasi dengan host MCP (seperti Claude Desktop, Claude Code, Cursor) melalui saluran standar masukan/keluaran (`stdin`/`stdout`). Spesifikasi Model Context Protocol mensyaratkan bahwa data yang dikirim ke `stdout` **harus murni frame pesan JSON-RPC 2.0**.  
  Pada [`src/lib/telemetry/logger.ts:111-113`](file:///home/hari/projects/mathbank/src/lib/telemetry/logger.ts#L111-L113):
  ```typescript
  function emit(level: LogLevel, ctx: LogContext): void {
    // ...
    const line = JSON.stringify(buildEntry(level, ctx));
    if (level === "error" || level === "warn") process.stderr.write(line + "\n");
    else process.stdout.write(line + "\n");
  }
  ```
  Tingkat log `info` dan `debug` dipancarkan langsung ke `process.stdout.write`.  
  Meskipun komentar di `src/mcp-stdio.ts:13` memperingatkan: *“stdout DIPAKAI protokol MCP — jangan `console.log` ke stdout”*, jika ada *service* atau dependensi yang memanggil `log.info(...)` (misalnya saat mencatat lifecycle event, inisialisasi AI, atau audit event), baris log JSON mentah akan terinjeksi ke `stdout`.
- **Dampak:**  
  Klien MCP yang membaca stream `stdout` akan mengalami *parse error* karena menerima baris non-JSON-RPC, memutus sesi agen (*fatal connection drop*), dan menggagalkan seluruh integrasi alat AI.
- **Rekomendasi Perbaikan:**  
  Sediakan konfigurasi *sink* atau deteksi mode MCP runtime (`MCP_STDIO=1`) pada logger untuk mengarahkan seluruh level log (`debug`, `info`, `warn`, `error`) secara eksklusif ke `process.stderr`.

  ```typescript
  // src/lib/telemetry/logger.ts
  const IS_MCP_MODE = process.env.MCP_STDIO === "true" || process.argv.includes("src/mcp-stdio.ts");

  function emit(level: LogLevel, ctx: LogContext): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;
    if (process.env.NODE_ENV === "test" && !process.env.LOG_LEVEL) return;
    const line = JSON.stringify(buildEntry(level, ctx));
    
    // Dalam mode MCP atau level error/warn, selalu gunakan stderr agar stdout steril untuk JSON-RPC
    if (IS_MCP_MODE || level === "error" || level === "warn") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  }
  ```

---

#### [MEDIUM] OBS-03: Ketiadaan Log Permintaan Sukses & Dokumentasi Drift pada `route-wrapper.ts`
- **Lokasi:** [`src/lib/api/route-wrapper.ts:362-374`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L362-L374) dan [`docs/OBSERVABILITAS.md:65`](file:///home/hari/projects/mathbank/docs/OBSERVABILITAS.md#L65)
- **Tipe Celah:** Observability Blindspot / Documentation Drift
- **Deskripsi:**  
  Dokumen arsitektur [`docs/OBSERVABILITAS.md:65`](file:///home/hari/projects/mathbank/docs/OBSERVABILITAS.md#L65) menyatakan:  
  *“- Log request API (route, requestId, actorId, status, durasi) via route-wrapper.ts.”*  
  Namun pada implementasi nyata [`src/lib/api/route-wrapper.ts:362-374`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L362-L374):
  ```typescript
  const data = await opts.handler({ actor, query, body, req, params });
  const res = NextResponse.json({ data }, { status: opts.status ?? 200 });
  res.headers.set("X-Request-ID", requestId);
  // ...
  return finish(res);
  ```
  Fungsi `log.info` **sama sekali tidak pernah dipanggil** saat permintaan menghasilkan status sukses (HTTP 200/201). Pemanggilan logger hanya terjadi di dalam `errorResponse()` ketika ada *exception* atau error HTTP (status ≥ 400).  
  Selain itu, tidak ada mekanisme pencatatan *slow query / slow request warning* jika sebuah permintaan sukses membutuhkan waktu eksekusi yang abnormal (mis. >2 detik).
- **Dampak:**  
  Tim on-call tidak memiliki jejak akses (*access log*) untuk audit operasional. Jika terjadi insiden di mana permintaan lambat berhasil diselesaikan (tidak melempar error), tidak ada log yang dapat mengidentifikasi aktor, durasi, atau pola query yang membebani server.
- **Rekomendasi Perbaikan:**  
  Tambahkan pemanggilan `log.info` pada akhir permintaan yang sukses atau setidaknya catat peringatan terstruktur jika durasi melebihi ambang batas (*slow threshold* ≥ 1000 ms).

  ```typescript
  // src/lib/api/route-wrapper.ts
  const durationMs = Date.now() - startedAt;
  if (durationMs > 1000) {
    log.warn({
      msg: "permintaan lambat (slow request)",
      requestId,
      route: routePath,
      method,
      actorId: actor.id,
      durationMs,
      status: opts.status ?? 200,
    });
  } else if (process.env.LOG_ACCESS === "true") {
    log.info({
      msg: "permintaan selesai",
      requestId,
      route: routePath,
      method,
      actorId: actor.id,
      durationMs,
      status: opts.status ?? 200,
    });
  }
  ```

---

#### [MEDIUM] OBS-04: Bypassing Telemetri & Log Inkonsisten pada Route Non-`wrapRoute`
- **Lokasi:** [`src/app/api/bundles/[id]/export/moodle/route.ts:89-96`](file:///home/hari/projects/mathbank/src/app/api/bundles/%5Bid%5D/export/moodle/route.ts#L89-L96) dan [`src/app/img/[shortId]/route.ts:48-98`](file:///home/hari/projects/mathbank/src/app/img/%5BshortId%5D/route.ts#L48-L98)
- **Tipe Celah:** Inconsistent Telemetry Pipeline / Unstructured Logging
- **Deskripsi:**  
  1. **Route Moodle Export:** Endpoint `POST /api/bundles/[id]/export/moodle` mengeksekusi operasi berat (menulis file ke disk, memanggil *subprocess* `git init/add/commit`). Pada baris 94, error ditangani menggunakan:
     ```typescript
     console.error("[moodle-export] error:", (err as Error).message);
     ```
     Route ini tidak membangkitkan `requestId`, tidak mengembalikan header `X-Request-ID`, tidak mencatat durasi proses, dan tidak memanggil `recordRequest()` ke sistem metrik.
  2. **Route Image Serving (`/img/[shortId]`):** Melayani trafik biner media. Endpoint ini tidak menyertakan `X-Request-ID` pada response header dan tidak memanggil `recordRequest()`. Akibatnya, volume throughput, latensi transfer gambar, dan kegagalan pengambilan media sama sekali tidak tercermin pada dasbor `/api/metrics`.
- **Dampak:**  
  Operasi paling intensif secara I/O (ekspor GitSync dan penyajian media) menjadi titik buta (*blind spot*) dalam observabilitas sistem. Jika terjadi lonjakan kegagalan ekspor atau kegagalan pembacaan media, monitoring metrik tidak memberikan sinyal apa pun.
- **Rekomendasi Perbaikan:**  
  Ganti `console.error` dengan `log.error`, sertakan `X-Request-ID`, dan rekam metrik latensi pada seluruh *exit path*.

---

#### [MEDIUM] OBS-05: Penelanan Error Senyap (*Silent Error Swallowing*) pada Resolusi Autentikasi
- **Lokasi:** [`src/lib/auth/resolve.ts:23-44`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts#L23-L44) dan [`src/lib/auth/resolve.ts:47-73`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts#L47-L73)
- **Tipe Celah:** Blind Error Suppression / Silent Infrastructure Failure
- **Deskripsi:**  
  Pada fungsi `actorFromSession` dan `actorFromApiKey`, blok `try/catch` menangkap setiap kegagalan dengan blok kosong:
  ```typescript
  export async function actorFromSession(headers: Headers): Promise<Actor | null> {
    try {
      const session = await auth.api.getSession({ headers });
      // ...
    } catch {
      return null;
    }
  }
  ```
  Jika database PostgreSQL mengalami putus koneksi, kehabisan *pool connection*, atau terjadi kerusakan tabel autentikasi Better Auth, exception tersebut ditelan mentah-mentah dan sistem mengembalikan `null`.  
  Pemanggil (`wrapRoute`) kemudian menafsirkan `null` sebagai ketiadaan kredensial pengguna dan melempar `UnauthorizedError` (HTTP 401).
- **Dampak:**  
  Ketika infrastruktur database atau modul auth rusak, sistem melaporkan seolah-olah pengguna salah memasukkan kredensial (HTTP 401), bukan kesalahan server (HTTP 500). On-call engineer melihat lonjakan 401 tanpa ada log error database di journald, sehingga salah mendiagnosis insiden.
- **Rekomendasi Perbaikan:**  
  Catat exception ke `log.warn` atau bedakan antara ketiadaan token valid versus kegagalan jaringan/infrastruktur basis data:

  ```typescript
  // src/lib/auth/resolve.ts
  import { log } from "@/lib/telemetry/logger";

  export async function actorFromSession(headers: Headers): Promise<Actor | null> {
    try {
      const session = await auth.api.getSession({ headers });
      if (!session?.user) return null;
      // ...
    } catch (err) {
      log.warn({
        msg: "gagal menyelesaikan sesi pengguna (auth error)",
        err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
      });
      return null;
    }
  }
  ```

---

#### [MEDIUM] OBS-06: Ketiadaan Telemetri RED pada Dependensi Eksternal (AI Chat & Ollama Embeddings)
- **Lokasi:** [`src/lib/ai/client.ts:67-98`](file:///home/hari/projects/mathbank/src/lib/ai/client.ts#L67-L98) dan [`src/lib/embedding/bge-m3.ts:58-85`](file:///home/hari/projects/mathbank/src/lib/embedding/bge-m3.ts#L58-L85)
- **Tipe Celah:** Missing External Dependency Instrumentation
- **Deskripsi:**  
  Skill `observability-and-instrumentation` menetapkan bahwa setiap dependensi eksternal wajib diinstrumentasi dengan metrik **RED**: **R**ate (panggilan/detik), **E**rrors (tingkat kegagalan), dan **D**uration (histogram latensi), serta log metadata terstruktur.  
  1. Pada [`src/lib/ai/client.ts`](file:///home/hari/projects/mathbank/src/lib/ai/client.ts): Panggilan HTTP `fetch` ke endpoint LLM (`/chat/completions`) tidak merekam durasi, tidak mencatat kode status provider, dan tidak mempropagasi `x-request-id` ke header upstream.
  2. Pada [`src/lib/embedding/bge-m3.ts`](file:///home/hari/projects/mathbank/src/lib/embedding/bge-m3.ts): Panggilan ke service Ollama lokal (`/api/embed`) tidak memiliki pencatatan latensi agregat, padahal inferensi CPU embedding BGE-M3 memakan waktu ~296 ms per teks.
- **Dampak:**  
  On-call tidak dapat mendeteksi apakah degradasi performa MathBank bersumber dari perlambatan provider AI eksternal atau masalah internal, serta tidak dapat melacak pola konsumsi token secara otomatis.
- **Rekomendasi Perbaikan:**  
  Bungkus panggilan klien AI dengan pengukuran latensi dan log metadata:

  ```typescript
  // src/lib/ai/client.ts
  const t0 = Date.now();
  try {
    const res = await fetch(`${apiBase(cfg.baseUrl)}/chat/completions`, { ... });
    const durationMs = Date.now() - t0;
    if (!res.ok) {
      log.warn({
        msg: "ai_provider_call_failed",
        providerUrl: apiBase(cfg.baseUrl),
        model: cfg.model,
        status: res.status,
        durationMs,
      });
    }
    // ...
  }
  ```

---

#### [LOW] OBS-07: Titik Buta Kegagalan Parsial pada Aksi Massal (*Bulk Batch Operations*)
- **Lokasi:** [`src/lib/services/question-bulk.ts:57-75`](file:///home/hari/projects/mathbank/src/lib/services/question-bulk.ts#L57-L75) dan [`src/lib/services/enrichment/enrich.ts:202-211`](file:///home/hari/projects/mathbank/src/lib/services/enrichment/enrich.ts#L202-L211)
- **Tipe Celah:** Silent Partial Failure Blindspot
- **Deskripsi:**  
  Fungsi `bulkQuestionAction` memproses hingga 200 soal dalam *loop*. Ketika terjadi kesalahan pada butir tertentu (misalnya transisi status ditolak FSM atau konflik balapan), kesalahan ditangkap oleh `catch (err)` dan dimasukkan ke dalam array `result.failed`.  
  Fungsi mengembalikan respons HTTP 200 OK dengan format `{ data: { ok: [...], failed: [...] } }`.  
  Karena route handler berhasil mengembalikan HTTP 200, `wrapRoute` menganggap seluruh permintaan sukses: tidak ada pemanggilan `log.error` atau `log.warn`, dan metrik mencatatnya sebagai 2xx.
- **Dampak:**  
  Jika seorang guru melakukan bulk ready terhadap 100 soal dan 95 di antaranya gagal karena belum memiliki kunci jawaban (`NOT_READY`), sistem tidak mencatat satu pun baris log warning/error ke server sink, menyulitkan pendeteksian kegagalan kurasi massal dari sisi operasi.
- **Rekomendasi Perbaikan:**  
  Tambahkan pencatatan log terstruktur jika `result.failed.length > 0`:
  ```typescript
  if (result.failed.length > 0) {
    log.warn({
      msg: "bulk_action_partial_failure",
      action,
      actorId: actor.id,
      successCount: result.ok.length,
      failedCount: result.failed.length,
      sampleErrors: result.failed.slice(0, 5),
    });
  }
  ```

---

#### [LOW] OBS-08: Redaksi Berlebih Substring `"pass"` & Risiko Kebocoran URL Berisi Token
- **Lokasi:** [`src/lib/telemetry/logger.ts:47-50`](file:///home/hari/projects/mathbank/src/lib/telemetry/logger.ts#L47-L50) dan [`src/lib/telemetry/logger.ts:56-77`](file:///home/hari/projects/mathbank/src/lib/telemetry/logger.ts#L56-L77)
- **Tipe Celah:** Overzealous Redaction / Key-Based Only Sanitization
- **Deskripsi:**  
  1. **Over-redaction:** Pada `logger.ts:49`, fungsi `isSensitiveKey` menggunakan `k.includes("pass")`. Setiap key objek yang memuat kata "pass" (seperti `passRate`, `isPassed`, `bypassValidation`, `passwordChangePending`) otomatis disamarkan menjadi `"[REDACTED]"`. Hal ini mengaburkan variabel non-kredensial yang dibutuhkan saat debugging logika penilaian atau bypass status.
  2. **URL Secret Leak Risk:** Fungsi `redact()` hanya memeriksa nama kunci objek (*dictionary keys*), bukan nilai string. Jika sebuah pesan error mencakup URL eksternal yang membawa token pada query string (mis. `url: "https://api.openai.com/v1?key=sk-secret"`), URL tersebut tetap dicetak apa adanya karena kuncinya bernama `url`.
- **Rekomendasi Perbaikan:**  
  Ganti pencocokan substring `"pass"` dengan regex yang lebih presisi (mis. `/^pass(word|_hash)?$/i`), dan bersihkan query string sensitif dari nilai URL sebelum di-log.

---

#### [LOW] OBS-09: Probe Readiness Belum Mencakup Dependensi AI & Ollama
- **Lokasi:** [`src/app/api/ready/route.ts:16-51`](file:///home/hari/projects/mathbank/src/app/api/ready/route.ts#L16-L51) dan [`src/lib/embedding/bge-m3.ts:95-99`](file:///home/hari/projects/mathbank/src/lib/embedding/bge-m3.ts#L95-L99)
- **Tipe Celah:** Incomplete Readiness Probe
- **Deskripsi:**  
  Fungsi `embeddingHealth()` sudah diimplementasikan dengan sangat baik pada [`src/lib/embedding/bge-m3.ts:95-99`](file:///home/hari/projects/mathbank/src/lib/embedding/bge-m3.ts#L95-L99) (melakukan embedding cepat 1 kata "ping" untuk memverifikasi kesiapan Ollama). Namun, endpoint `GET /api/ready` dan `GET /api/health` hanya memverifikasi koneksi PostgreSQL dan invarian skema tabel/trigger.
- **Dampak:**  
  Load balancer atau orkestrator kontainer akan menganggap instans MathBank "Ready" (200 OK) meskipun daemon Ollama lokal atau konfigurasi AI belum hidup, sehingga fitur pencarian semantik dan enrichment langsung gagal begitu menerima lalu lintas awal.
- **Rekomendasi Perbaikan:**  
  Sertakan pemeriksaan status embedding opsional pada `/api/ready` (tanpa memblokir total jika mode AI opsional):
  ```typescript
  const embedStatus = await embeddingHealth().catch(() => ({ ok: false, error: "unreachable" }));
  // sertakan ke dalam laporan status: { db: "up", embedding: embedStatus.ok ? "up" : "degraded" }
  ```

---

### What's Done Well (Positive Observations)

1. **Desain In-Memory Metrik Zero-Dependency (M16):**  
   Implementasi [`src/lib/telemetry/metrics.ts`](file:///home/hari/projects/mathbank/src/lib/telemetry/metrics.ts) menggunakan *circular ring buffer* `Float64Array(512)` untuk menghitung kuantil latensi (p50, p95, max) secara deterministik tanpa menambah beban pustaka eksternal.
2. **Propagasi & Penegakan Request ID:**  
   [`src/lib/api/route-wrapper.ts:287-288`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L287-L288) secara konsisten menerima header masuk `x-request-id` dari reverse proxy atau membangkitkan `crypto.randomUUID()`, lalu melekatkannya ke response header `X-Request-ID` dan konteks log error.
3. **Pemisahan Tegas Probe Liveness vs Readiness:**  
   [`src/app/api/health/route.ts:25-30`](file:///home/hari/projects/mathbank/src/app/api/health/route.ts#L25-L30) mengimplementasikan probe `?probe=liveness` yang murni menjawab status proses tanpa menyentuh database, mencegah *restart-loop cascade* saat basis data sedang pulih.
4. **Verifikasi Invarian Skema Mendalam pada Startup:**  
   [`src/instrumentation.ts`](file:///home/hari/projects/mathbank/src/instrumentation.ts) dan [`src/lib/db/invariants.ts`](file:///home/hari/projects/mathbank/src/lib/db/invariants.ts) memverifikasi 26 tabel, 2 constraint CHECK, indeks HNSW, 24 trigger, dan fungsi `uuidv7()` langsung saat server Next.js menyala, mendeteksi drift skema lebih dini.
5. **Redaksi Rekursif Terhadap Kredensial Sensitif:**  
   [`src/lib/telemetry/logger.ts:56-77`](file:///home/hari/projects/mathbank/src/lib/telemetry/logger.ts#L56-L77) secara rekursif menelusuri objek dan array hingga kedalaman 6 level untuk menyamarkan token, password, cookie, API key, dan `answer_key` sebelum baris log JSON dipancarkan.

---

### Observability Skill & Checklist Compliance Matrix

| Area Evaluasi | Kriteria Evaluasi | Status | Catatan / Rekomendasi |
|---|---|:---:|---|
| **On-Call Questions** | Pertanyaan operasional terdokumentasi & dipetakan ke telemetri | **FAIL** | Belum ada pemetaan pertanyaan on-call eksplisit di `OBSERVABILITAS.md` |
| **Structured Logging** | Format JSON satu baris dengan field stabil | **PASS** | Diimplementasikan rapi di `logger.ts` |
| **Log Levels** | Penggunaan level konsisten (`error`, `warn`, `info`, `debug`) | **PARTIAL** | Log akses/sukses belum dipancarkan; route non-wrapper pakai `console.error` |
| **Request Correlation** | `X-Request-ID` dibangkitkan, diterima, dan dipropagasikan | **PASS** | Aktif di seluruh route yang menggunakan `wrapRoute` |
| **Secret Sanitization** | Redaksi kredensial, token, dan data kunci jawaban | **PASS** | Dilindungi fungsi `redact()` di `logger.ts` |
| **Metric Cardinality** | Label metrik terbatas pada set kecil & terikat (bounded) | **FAIL** | **Celah OBS-01:** raw URL dengan UUID dicatat langsung ke `state().routes` |
| **Percentile Latency** | Pengukuran histogram / persentil (bukan rata-rata saja) | **PASS** | Ring buffer menghitung p50, p95, dan max di `metrics.ts` |
| **External Dependencies** | RED terukur untuk PostgreSQL, AI Gateway, dan Ollama | **FAIL** | **Celah OBS-06:** Belum ada metrik durasi/error untuk client LLM & BGE-M3 |
| **Resource Saturation** | Metrik USE untuk connection pool dan queue depth | **FAIL** | Tidak ada visibilitas terhadap saturasi DB pool (10 koneksi) & pending queue |
| **Health Probes** | Pemisahan liveness dan readiness endpoint | **PASS** | `/api/health?probe=liveness` dan `/api/ready` berfungsi sesuai standar |
| **Distributed Tracing** | Trace context propagation / OpenTelemetry | **N/A** | Ditangguhkan dengan sengaja untuk arsitektur single-node (ADR/OBS) |
| **Alerting & Runbooks** | Alert berbasis gejala terhubung ke runbook 3-baris | **PARTIAL** | Playbook insiden ada di `RUNBOOK.md` §7, namun belum ada direktori `docs/runbooks/` |

---

### Remediation Roadmap

1. **Prioritas 1 (Sprint Blocker / Stabilitas Produksi):**
   - **Remediasi OBS-01:** Terapkan sanitasi rute pada `recordRequest()` (`sanitizeRouteForMetrics`) dan beri batas maksimum 200 entri pada `state().routes` di [`src/lib/telemetry/metrics.ts`](file:///home/hari/projects/mathbank/src/lib/telemetry/metrics.ts).
   - **Remediasi OBS-02:** Pastikan seluruh emisi log pada proses MCP STDIO dialihkan secara mutlak ke `process.stderr` di [`src/lib/telemetry/logger.ts`](file:///home/hari/projects/mathbank/src/lib/telemetry/logger.ts).
2. **Prioritas 2 (Sprint Berjalan):**
   - **Remediasi OBS-03:** Tambahkan pencatatan *slow request warning* (>1000 ms) pada blok sukses `wrapRoute` di [`src/lib/api/route-wrapper.ts`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts).
   - **Remediasi OBS-04:** Migrasikan `console.error` pada [`export/moodle/route.ts`](file:///home/hari/projects/mathbank/src/app/api/bundles/%5Bid%5D/export/moodle/route.ts) ke `log.error` terstruktur dan hubungkan metrik `/img/[shortId]`.
   - **Remediasi OBS-05:** Tambahkan `log.warn` pada blok `catch` di [`src/lib/auth/resolve.ts`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts) saat resolusi sesi gagal karena kendala internal.
3. **Prioritas 3 (Operasional & Reliability Hardening):**
   - **Remediasi OBS-06:** Instrumentasi durasi dan error rate panggilan upstream di [`src/lib/ai/client.ts`](file:///home/hari/projects/mathbank/src/lib/ai/client.ts).
   - **Remediasi OBS-07:** Rekam ringkasan kegagalan parsial pada aksi massal `bulkQuestionAction`.
   - **Remediasi OBS-08 & OBS-09:** Sempurnakan regex redaksi pada `logger.ts` dan integrasikan `embeddingHealth()` ke dalam respons probe kesiapan `/api/ready`.

---
*Laporan audit komprehensif ini selesai dan siap diarsipkan ke `MathBankAuditor/reports/17.10.2026/audit-observability-and-instrumentation.md`.*
