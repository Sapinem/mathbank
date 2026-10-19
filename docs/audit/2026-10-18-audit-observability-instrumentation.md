# Audit Observability & Instrumentation — MathBank v2

> **Tanggal audit:** 18 Oktober 2026
> **Commit acuan:** `7c4df34` (`feat(math): render tabel markdown GFM di MathContent`)
> **Sifat:** *read-only audit* — **tidak ada kode aplikasi yang diubah**. Satu-satunya berkas baru = dokumen ini + satu baris registrasi di `docs/PETA-DOKUMEN.md` (#31).
> **Status dokumen:** ⚠️ — *instrumentasi* yang **ada** bekerja untuk jalur yang dilalui; **cakupan API baik** (40/51 route via `wrapRoute`; 5 dari 11 sisanya adalah stub 410 & endpoint health/metrics sendiri), tetapi **keandalan sebagian**: redaksi, metrik, dan galat pra-catat (lihat §1). Dokumentasi `OBSERVABILITAS.md` **over-claim** pada 3 poin (§3, tabel drift).
>
> **Catatan metodologis (penting):** tugas meminta audit dengan skill `observability-and-instrumentation`. **Skill itu tidak terdaftar** di lingkungan agen (`Unknown skill`; daftar tersedia: `memory-leak-debugging`, `debug-optimize-lcp`, `chrome-devtools`, dll. — **tidak ada** skill observability). Audit karena itu **tidak** memakai rubrik skill tersebut. Sebagai baseline kepatuhan dipakai **kontrak proyek sendiri**: `docs/OBSERVABILITAS.md`, `docs/SLA-SLO.md`, `docs/KONTRAK-API.md`, `docs/KEAMANAN.md`, dan `CONSTRAINTS.md`. Bila pemilik punya rubrik resmi skill tersebut, hasil di bawah dapat dipetakan ulang — strukturnya (Logs/Metrics/Traces/Audit/Alerting) sengaja mengikuti tiga pilar yang sudah dipakai proyek.

---

## 1. Ringkasan

| # | Pilar | Hasil |
|---|-------|-------|
| 1 | **Logging** | 🟠 Berfungsi untuk jalur `wrapRoute` & `/img`. 🔴 Redaksi berbasis **nama kunci saja** → rahasia di dalam **pesan error** & **stack (non-produksi)** lolos (O-01). 🟠 **Tidak ada access log** permintaan sukses & `durationMs` tak pernah di-log, padahal didokumentasikan (O-03). 🟡 `console.*` liar di 4 berkas (O-04). |
| 2 | **Metrik** | 🔴 Label metrik = **path mentah** → kardinalitas tak terbatas & bocor ID entitas (O-06, terbukti: 100 ID → 101 label). 🔴 Persentil **salah secara algoritmis** setelah buffer penuh (`slice(0, filled)` = seluruh array 512 termasuk slot nol) (O-07). 🟡 `uptimeSec` = "umur metrik", bukan umur proses (O-08). 🟡 Prod bisa **tanpa metrik sama sekali** bila `METRICS_TOKEN` kosong (O-09). |
| 3 | **Traces / Korelasi** | 🟠 `X-Request-ID` baik di wrapper; **tidak** dikirim ke klien pada 500 (memutus alur dukungan) (O-02). Tidak ada `requestId` di log route non-wrapper. |
| 4 | **Health / SLO** | 🔴 `/api/health` & `/api/ready` **publik, tanpa rate-limit**, dan mengembalikan `err.message` mentah dari Postgres (O-10). Tiap probe = 4 round-trip DB. Endpoint health sendiri tak tercatat di metrik (O-11). SLO `SLA-SLO.md` **tidak terpetakan** ke metrik mana pun (O-12). |
| 5 | **Audit trail** | ✅ `audit_logs` (immutable via trigger) + `recordViewAudit` untuk akses sensitif. 🟡 Isi `audit_logs` **tidak** bisa dikorelasikan ke `requestId` (O-14); `X-Request-ID` klien dibuang Caddy (O-13). |
| 6 | **Rate limit sebagai sinyal** | 🟠 Key app-level memakai `X-Forwarded-For` **kiri** (spoofable) — **sudah terdokumentasi** sebagai `SEC-02` / `S1` 🟠 (bukan temuan baru, O-16); ditambah **memory leak** karena `prune()` tak pernah dipanggil (O-17) & rate-limit opt-in (O-18). |
| 7 | **Alerting** | 🔴 **Tidak ada** — diakui di `OBSERVABILITAS.md` §6/§7. Semua sinyal di atas harus ditarik manual. |
| 8 | **Instrumentasi startup** | 🟡 `instrumentation.ts` memakai `console` (bukan `log`), dan kegagalan `checkDbInvariants` di-swallow kecuali `STRICT_INVARIANTS=true` (O-20). |

**Verdict:** instrumentasi MathBank **memadai sebagai "rekaman"** untuk aplikasi single-node dengan tim kecil, **tetapi belum memadai sebagai "sistem kepercayaan"**: belum ada alert, label metrik tidak stabil, persentil bisa menyesatkan, dan ada jalur galat yang tak pernah ter-log. Severity tertinggi adalah **O-01** (kebocoran rahasia ke log), **O-07** (persentil menyesatkan), dan **O-10** (probe kesehatan membocorkan detail internal).

---

## 2. Tabel Temuan

Format: **ID · Severity · Lokasi · Bukti · Dampak · Rekomendasi**.

> Severity: 🔴 HIGH · 🟠 MEDIUM · 🟡 LOW · ✅ Sah (kontrol berjalan).

### 2.1 Logging

| ID | Sev | Lokasi | Bukti | Dampak | Rekomendasi |
|----|-----|--------|-------|--------|-------------|
| **O-01** | 🔴 | `src/lib/telemetry/logger.ts:37-56,62-70,77-81` | `redact()` hanya meredaksi bila **nama kunci** cocok (`SENSITIVE_KEYS`). Objek `Error` → `{name, message, stack}` **tanpa** penyaringan `message`. Probe: `{err: Error("connect failed: koneksi-db-URI(REDACTED)")}` → `message` utuh. Stack di-log penuh saat `NODE_ENV!=="production"`. `details` Zod ([{path:["password"],input:"<REDACTED>"}]) **lolos** karena kuncinya `path`/`input`. | Kredensial DB, token, atau isi input pengguna bisa masuk journald/Loki. Di staging (`NODE_ENV=production`? **tidak** — staging sering non-prod) → bocor. | (a) Tambah **pola nilai** (regex `postgres(ql)?://…@`, `Bearer …`, `sk-…`) pada string; (b) untuk `Error.message`, jalankan scrub pola yang sama; (c) **jangan** log `stack` lewat logger aplikasi di lingkungan apa pun yang terhubung ke log kolektor — atau kirim stack ke sentry/stderr terpisah; (d) di `route-wrapper.ts:143-150`, kirim `{errName, errMessage: scrub(err.message)}` alih-alih `err` utuh; (e) tambah tes di `logger.test.ts` untuk pesan berisi secret. |
| **O-02** | 🟠 | `src/lib/api/route-wrapper.ts:266-273` | Respons 500 = `{error:{code,message}}` **tanpa** `X-Request-ID` di *body*. Header `X-Request-ID` memang di-set, tetapi `KONTRAK-API.md:26` menjanjikan "Log error 500 memuat `rid=<id>`" — padahal log memakai field `requestId` JSON, bukan `rid=`. | Pengguna melihat "Kesalahan server" tanpa ID untuk diberikan ke ops. Operator harus mengorelasikan manual berdasarkan waktu+IP. Kontrak API **tidak benar** apa adanya. | Tambah `requestId` ke body error 500 (`{error:{code,message,requestId}}`); perbarui `KONTRAK-API.md:26` agar menyebut `"requestId"` (JSON) bukan `rid=`. |
| **O-03** | 🟠 | `src/lib/api/route-wrapper.ts:282-300, 331-368` | Galat **semua** tercatat (401/403/4xx/5xx) di `errorResponse` — termasuk galat `resolveActor` (catch menyelubungi `try` sejak awal). Yang **tidak ada**: (a) log permintaan **sukses** (tak ada access log); (b) field `durationMs` tak pernah di-log — `grep durationMs` di `src/**` hanya menemukan **deklarasi tipe** di `LogContext` (`logger.ts:86`) & parameter `recordRequest`; (c) route tanpa wrapper (6 fungsional) tidak punya korelasi `requestId` sama sekali. | `OBSERVABILITAS.md:65` mengklaim "Log request API (route, requestId, actorId, status, durasi) via `route-wrapper.ts`" — **hanya sebagian benar**: galat tercatat, sukses & durasi tidak. Diagnosa "permintaan lambat" mustahil dari log; harus dari `/api/metrics` yang p95-nya sendiri cacat (O-07). | Tambah `log.info({msg:"request", route, method, status, durationMs, requestId, actorId})` di `finish()` (opsional sampling), **atau** koreksi `OBSERVABILITAS.md:65` agar jujur: "log galat + metrik sukses". |
| **O-04** | 🟡 | `src/app/api/mcp/route.ts:92`, `src/app/api/bundles/[id]/export/moodle/route.ts:94`, `src/app/api/dev/quick-login/route.ts:67`, `src/instrumentation.ts:25,40,43` | `console.error/log` bebas — bukan JSON terstruktur, tanpa `requestId`, tak ikut `LOG_LEVEL`. | Sinyal galat pada 3 jalur (ekspor massal ber-`answer_key`, MCP, dev-login) tak ter-query seragam. Export Moodle menulis ke disk + git; kegagalannya hanya string bebas. | Ganti dengan `log.error({msg, route, code, ...})`. Untuk `instrumentation.ts`, gunakan `log` (import dinamis teraman karena modul dijalankan di edge guard? — `NEXT_RUNTIME==="nodejs"` menjamin aman). |
| **O-05** | ✅ | `logger.ts:44-54` | `answerKey`, `answer_key`, `password`, `token`, `cookie`, `authorization` → `[REDACTED]` (probe terverifikasi: `correctOption` pun teredaksi karena substring `correct`). | — | Pertahankan; tambah kasus uji `accessToken`, `x-api-key` (kunci header diberi tanda hubung → normalisasi sudah benar). |

### 2.2 Metrik

| ID | Sev | Lokasi | Bukti | Dampak | Rekomendasi |
|----|-----|--------|-------|--------|-------------|
| **O-06** | 🔴 | `src/lib/telemetry/metrics.ts:128-133` + `route-wrapper.ts:301` | `recordRequest(method, routePath, …)` dengan `routePath = new URL(req.url).pathname` (**mentah**). Probe: 100 request ke `/api/questions/<uuid>` → **101 entri** di `snapshot().routes`; label contoh `GET /api/questions/6a31bd02-c3b5-434e-a254-a9887032ed96`. `Map` tak pernah dibatasi. | (a) **Unbounded memory** — tiap ID soal/bundle/media = satu entri + `Float64Array(512)` (~4 KB) → 100 k ID = ~400 MB. (b) **Bocor ID entitas** via `/api/metrics` (siapa pun dengan token). (c) p50/p95 per soal, bukan per endpoint — metrik tak berguna untuk SLO. | Normalisasi path: ganti segmen yang cocok UUID/angka dengan `:id` **sebelum** `recordRequest` (mis. `path.replace(/\/[0-9a-f-]{8,}/g,"/:id")`), atau lebih baik gunakan **route pattern** — Next menyediakan pathname parameterisasi bila dipanggil dari middleware, atau lewat opsi `routePattern` per route. Tambah **cap jumlah label** (mis. 500) + satukan overflow ke `__other__`. |
| **O-07** | 🔴 | `metrics.ts:73` | `percentile()`: `Array.from(s.samples.slice(0, s.filled)).sort(...)`. Setelah `filled === MAX_SAMPLES` (512), `slice(0, 512)` = **seluruh array**, termasuk slot yang **belum pernah terisi** di siklus ring — nilai `0`. Setelah 1000 request, ~488 slot berisi `0`. | p50/p95 **turun palsu** ke 0 setelah buffer berputar. Probe sinkron dengan `filled<512` (1..100) → `p50=50, p95=95, max=100` **benar**; kebocoran hanya muncul **setelah 512 request**. Ini membuat metrik latensi **secara sistematis menyesatkan** persis pada beban tertinggi — saat SLO paling perlu diukur. | Hitung atas `Array.from(this.samples)` lalu `.filter(v => v > 0)` **hanya bila** `filled < MAX_SAMPLES`, atau simpan sebagai array JS biasa + `.splice`; paling sederhana: `const arr = Array.from(s.samples.slice(0, s.filled))` → ganti `slice(0, s.filled)` dengan `slice(0, MAX_SAMPLES)` **hanya jika** `filled === MAX_SAMPLES`. Tambah tes regresi > MAX_SAMPLES di `metrics.test.ts`. |
| **O-08** | 🟡 | `metrics.ts:113` | `uptimeSec: Math.round((Date.now() - s.startedAt)/1000)` — `startedAt` diset saat import pertama, bukan `process.uptime()`. Di dev dengan hot-reload `globalThis` dipertahankan → benar; bila modul dimuat ulang setelah proses hidup lama → **under-report**. Nama field menyesatkan (`/api/health` memakai `process.uptime()` — **sumber berbeda**). | Dua endpoint melaporkan dua "uptime" berbeda → pembanding SLO keliru. | Pakai `Math.round(process.uptime())` agar sama dengan `/api/health`. |
| **O-09** | 🟠 | `src/app/api/metrics/route.ts:60-64` | Komparasi token waktu-konstan, **simpanan**: `token.length === required.length && token.split("").reduce(...) === 0` — aman untuk panjang sama (tak ada early-exit per byte di JS? **ada** — panjang bocor, tapi token panjang diketahui operator). Bila `METRICS_TOKEN=""` (bawaan `docker-compose.yml:48` dan `.env.docker.example:35`) → **404 di produksi** = **tidak ada metrik sama sekali** di produksi, padahal semua SLO ingin diukur. | Produksi tidak mengukur apa pun; insiden hanya bisa diketahui dari keluhan pengguna. | Dokumentasikan sebagai **wajib** di checklist deploy (`METRICS_TOKEN` **harus** diisi di prod), atau ubah default: bila kosong & prod → izinkan **hanya** `127.0.0.1`/jaringan internal (Caddy: `@internal remote_ip private_ranges`). |

### 2.3 Health / Readiness / SLO

| ID | Sev | Lokasi | Bukti | Dampak | Rekomendasi |
|----|-----|--------|-------|--------|-------------|
| **O-10** | 🔴 | `src/app/api/health/route.ts:47-57`, `src/app/api/ready/route.ts:38-49` | `catch` mengembalikan `error: err instanceof Error ? err.message : "unknown"` ke **publik**. Probe ke Postgres: `ECONNREFUSED` → `"connect ECONNREFUSED 127.0.0.1:1"`; salah password → `"password authentication failed for user \"mathbank\""`. Selain itu **tanpa auth & tanpa rate-limit** → bisa dipakai sebagai **amplifier** (tiap panggilan = 4 query DB: 1 count + 3 lookup + 1 pk → lihat `invariants.ts:75-126`). | Kebocoran topologi internal (host/port, nama user DB) & info versi Postgres ke internet; beban DB tak terukur dari probe nyasar/bot. | Kembalikan `{status:"down"}` **tanpa** `error`; log detail lewat `log.error` dengan `requestId`. Tambah rate-limit IP (pakai `x-forwarded-for` **kanan** sesuai topologi Caddy — lihat O-11). Pertimbangkan probe **liveness** di path publik dan readiness di port/internal saja. |
| **O-11** | 🟡 | `src/app/api/health/route.ts:29-44` | Endpoint `?probe=liveness` memakai `NextResponse.json` dengan `dynamic="force-dynamic"` — tidak memakai `recordRequest`; `/api/health`, `/api/ready`, `/api/metrics` **semua** tak tercatat di metrik (bukan `wrapRoute`). | Monitoring tidak bisa mengukur **ketersediaan layanan probe itu sendiri**; RTO/RPO SLO tidak dapat diturunkan. | Catat `recordRequest` di ketiga endpoint health/metrics (cukup satu baris di `finish`). |
| **O-12** | 🟠 | `docs/SLA-SLO.md:17-24` vs `metrics.ts:100-131` | SLO p95 ≤ 300 ms "cara ukur: log terstruktur", tetapi (a) log **tidak** memuat `durationMs` (O-03), (b) metrik p95 **salah** setelah 512 req (O-07), (c) tidak ada label endpoint ter-normalisasi (O-06). Tiga jalur pengukuran itu **tidak kompatibel**. | SLO tidak terukur → "99,5%" hanya klaim. | Tetapkan **satu** sumber kebenaran: metrik dengan label ternormalisasi + p95 benar, di-*scrape* tiap 15 dtk (lihat O-13). Ganti "log terstruktur" di `SLA-SLO.md` menjadi "`/api/metrics` (p95, label endpoint)". |

### 2.4 Traceability & Audit

| ID | Sev | Lokasi | Bukti | Dampak | Rekomendasi |
|----|-----|--------|-------|--------|-------------|
| **O-13** | 🟠 | `Caddyfile:18-22` | Caddy **mengganti** `X-Request-ID` dengan `{http.request.uuid}` miliknya (`header_up` = set) → **header dari klien dibuang**, jadi klien tak bisa meneruskan trace ID-nya sendiri (kontrak `KONTRAK-API.md:26` "diteruskan dari header masuk bila ada" **tidak terjadi** di topologi nyata). Jika ada proxy di depan Caddy (Cloudflare), ID milik CF juga hilang. | Alur trace klien → server → DB terputus di hop pertama. | Ganti ke `header_up X-Request-ID {header.X-Request-ID}` **dengan fallback** `{http.request.uuid}` — sintaks Caddy tidak mendukung fallback langsung; alternatif: nama header terpisah, atau terima UUID Caddy sebagai `X-Request-ID` dan dokumentasikan bahwa ini ID *server*, bukan ID klien. |
| **O-14** | 🟡 | `src/lib/services/audit.ts:35-48`; `src/lib/db/schema/system.ts:31-46` | `audit_logs` tidak punya kolom `requestId`/`traceId`; `recordAudit` tidak menerimanya. | Audit ("siapa, apa, kapan") **tidak** bisa dihubungkan ke log sistem saat insiden — harus cocokkan berdasarkan waktu. | Tambah kolom `request_id text` (nullable) + teruskan dari `ctx` lewat `wrapRoute` (`AsyncLocalStorage`); memerlukan migrasi + `db_safety` (prosedur AGENTS.md §3). |
| **O-15** | ✅ | `drizzle/manual/db_safety.sql` (`trg_audit_logs_immutable`) + `invariants.ts:23-30` | `audit_logs` **immutable**, dan trigger-nya **diperiksa** health check. | — | — |

### 2.5 Rate-limit, Idempotensi (as observability/robustness)

| ID | Sev | Lokasi | Bukti | Dampak | Rekomendasi |
|----|-----|--------|-------|--------|-------------|
| **O-16** | 🟠 *(sudah terdokumentasi)* | `route-wrapper.ts:86-90`, `img/[shortId]/route.ts:32-36`, `mcp/route.ts:43-47` | `clientIp` = `split(",")[0]` (kiri) dari `X-Forwarded-For`. Menurut perilaku Caddy (dikonfirmasi caddy#6783 + docs `trusted_proxies`), nilai klien **dipertahankan di kiri**, IP koneksi nyata ditambahkan di **kanan** — jadi ini **stub yang dikendalikan klien**. | Bypass limiter: kirim XFF acak → bucket baru tiap request → `429` tak pernah muncul. Untuk `/api/metrics` (token yang sama) ini mempercepat brute-force token. | Ambil elemen **paling kanan** (yang ditambahkan proxy) — atau fix arsitektural: Caddy `header_up X-Client-IP {client_ip}` (dengan `trusted_proxies` benar) dan app membaca `X-Client-IP` **saja**. **Catat sebagai `SEC-02` yang masih terbuka** — bukan temuan baru. |
| **O-17** | 🟠 | `src/lib/api/rate-limit.ts:83-88`; `src/lib/api/idempotency.ts:73-78` | `prune()` **tidak pernah dipanggil** di `src/**` (grep: 0 pemanggil non-test; branch negative: tak ada `setInterval` di `src/lib`). Setiap `rateLimitKey` unik (terutama dengan O-16) → `Map` tumbuh selamanya. Idempotensi menyimpan **seluruh body respons** (untuk `POST /api/questions`, bisa berisi objek soal penuh) dengan TTL 60 dtk yang hanya dicek **saat `get()`** — entri yang tak pernah dibaca lagi **tak pernah dihapus**. | Memory leak bertahap, tak terlihat di metrik (metrik tak mencatat ukuran store). Risiko tertinggi di `/api/mcp` (stateless, tiap agen) & `/api/questions` (dengan `Idempotency-Key` berbeda tiap retry). | Panggil `prune(Date.now())` di `instrumentation.ts` (`setInterval(..., 60_000).unref()`) **atau** di `recordRequest`. Tambahkan metrik `storeSize` untuk `rateLimit` & `idempotency` agar kebocoran **terlihat** sebelum OOM. |
| **O-18** | 🟡 | `route-wrapper.ts:315-320`; `metrics.ts` | `checkRateLimit` dipanggil **jika** `opts.rateLimit`; 21 route mutasi **tanpa** `rateLimit` opt-in (lihat daftar di bawah §4). Rate-limit **opt-in** berarti route baru mudah lupa. | 429 & bucket tidak ada untuk mis. `POST /api/v1/ingest/upload`, `POST /api/questions/batch`, `POST /api/tags/merge` — operasi berat. Tidak ada sinyal metrik `rate_limited_total`, jadi tidak bisa alert "ada brute-force". | (a) Ubah default: **semua POST/PATCH/PUT/DELETE** ber-rate-limit kecuali opt-out eksplisit. (b) Rilis metrik `rate_limited_total` per scope. |

### 2.6 Alerting & Startup

| ID | Sev | Lokasi | Bukti | Dampak | Rekomendasi |
|----|-----|--------|-------|--------|-------------|
| **O-19** | 🔴 | `docs/OBSERVABILITAS.md:69-79` | Alerting = **belum ada** (diakui). Tidak ada uptime monitor, tidak ada aturan 5xx. | Semua temuan di atas hanya berdampak **setelah** seseorang membuka `/api/metrics` — padahal `/api/metrics` bisa **nonaktif** di prod (O-09). | Minimal: cron eksternal (mis. Uptime Kuma) → `/api/health?probe=liveness` + `/api/ready`; skrip kecil `scripts/check-alerts.ts` membaca `/api/metrics` (token) dan gagal non-zero bila `totalErrors/totalRequests > 1%` atau `p95 > 300ms` cukup lama → dipicu systemd timer / GitHub Actions schedule. |
| **O-20** | 🟡 | `src/instrumentation.ts:20-36` | Memakai `console.log`/`console.error`, bukan `log`. Bila `checkDbInvariants` tak bisa terhubung (DB belum siap), `catch` hanya `console.error` dan **tidak** mencoba ulang; `STRICT_INVARIANTS` tak di-set di `docker-compose.yml` → default longgar. | Sinyal "skema tak utuh" tak berformat & tak bisa di-query/alert. `startup` gagal DB tidak pernah berubah menjadi peringatan yang bisa di-monitor. | Gunakan `log.error({msg:"startup.invariants_failed", problems})`. Tambahkan `invariants_ok` sebagai gauge opsional di `/api/metrics`. |

### 2.7 Kontrol yang berjalan (✅) — agar laporan tidak berat sebelah

| Kontrol | Bukti |
|--------|-------|
| Log JSON satu baris, `warn/error`→stderr | `logger.ts:94-102` |
| Level dari `LOG_LEVEL`, default `info` | `logger.ts:24-29`; `docker-compose.yml:47` |
| Dogfooding: log dibungkam di tes | `logger.ts:97` |
| Metrik nol-dependensi, tahan hot-reload (`globalThis`) | `metrics.ts:56-60` |
| `/api/metrics` diblokir 404 di prod jika token kosong | `metrics/route.ts:18-20` |
| Liveness murni (tanpa DB) untuk cegah restart-loop | `health/route.ts:29-34` |
| Invariant check sebagai **kontrak** (26 tabel, 24 trigger, 2 CHECK, 1 HNSW, uuidv7) | `invariants.ts:15-35` |
| Error boundary global & `(app)` tanpa membocorkan stack | `global-error.tsx`, `(app)/error.tsx` |
| `requestId` diterima & dipotong 64 char → header `X-Request-ID` pada respons | `route-wrapper.ts:285-287, 362` |
| Idempotensi menghapus penanda in-flight saat galat | `route-wrapper.ts:376-384` |
| Rate-limit login Better Auth **persisten DB** + `cf-connecting-ip` | `auth/server.ts:73-85` |
| `audit_logs` immutable + audit akses baca sensitif (M13 S7) | `db_safety.sql`, `audit.ts:50-80` |

---

## 3. Temuan yang **sudah terdokumentasi** (bukan temuan baru)

Sesuai AGENTS.md §7 — ini disajikan sebagai **status**, bukan penemuan:

| Temuan audit ini | Sudah dicatat di | Status dokumen |
|---|---|---|
| XFF spoofable di limiter aplikasi (O-16) | `docs/KEAMANAN.md:153,176` (`S1`→🟠, `SEC-02` 🟠 HIGH) | 🔴 **terbuka** — rekomendasi di REKOM-01 |
| Alerting belum ada (O-19) | `OBSERVABILITAS.md:69,88` | diakui |
| Tracing belum ada | `OBSERVABILITAS.md:17,89` | diakui (wajar single-node) |
| Probe uptime nyata belum ada | `SLA-SLO.md:51` | diakui |
| Rate-limit in-memory tak multi-instance | `rate-limit.ts:9-13`, `KEAMANAN.md` S1 | diakui |
| `wrapRoute` belum 100% cakupan | ADR-0022 + `docs/audit/2026-10-18-…` D-06 | sebagian diakui; **dampak telemetri-nya belum** |

**Klaim dokumen yang tidak akurat (drift dokumen yang baru):**

| Doc | Baris | Klaim | Realita |
|---|---|---|---|
| `OBSERVABILITAS.md` | 65 | "Log request API (route, requestId, actorId, status, durasi)" | Tidak ada log sukses; tidak ada `durationMs` di log mana pun |
| `KONTRAK-API.md` | 26 | "Setiap respons menyertakan `X-Request-ID`" | Hanya respons **via `wrapRoute`**; `/api/health`, `/api/ready`, `/api/metrics`, `/img/*` **tidak** menyertakan |
| `OBSERVABILITAS.md` | 33-38 | "28 tabel, 26 trigger" | Kode: `invariants.ts:17-26` = **26 tabel, 24 trigger** (drift lama, disentuh oleh audit sebelumnya D-10) |
| `OBSERVABILITAS.md` (via `PETA-DOKUMEN.md`) | rujukan | Menunjuk `RENCANA-OBSERVABILITAS-M16.md` | Berkas ada di `docs/archive/rencana/`, bukan `docs/` |

---

## 4. Bukti mentah (probe yang dijalankan)

```
# metrics.ts — kardinalitas label
routeKeys: 101                       ← 100 ID unik + 1 endpoint statis
sample label: GET /api/questions/6a31bd02-c3b5-434e-a254-a9887032ed96

# metrics.ts — persentil (filled < MAX_SAMPLES → benar)
latensi 1..100 ms → p50=50, p95=95, max=100   ✅ (bug O-07 hanya ≥512 sampel)
# metrics.ts — uptime
snapshot().uptimeSec=0 vs process.uptime()=0 (skrip baru) — sumber berbeda (O-08)

# logger.ts — redaksi (replika logika, file identik)
{err: Error("connect failed: koneksi-db-URI(REDACTED)")}
  → {"err":{"name":"Error","message":"connect failed: koneksi-db-URI(REDACTED)"}}   🔴
{details:[{path:["password"],input:"<REDACTED>"}]} → input utuh                       🔴
{answerKey:"A"} / {answer_key:...} / {correctOption:"B"} → [REDACTED]              ✅

# Postgres error message (postgres.js)
ECONNREFUSED → "connect ECONNREFUSED 127.0.0.1:1"                                  (O-10)
28P01        → 'password authentication failed for user "mathbank"'                 (O-10)
```

**Cakupan `wrapRoute`** (`grep -l`/`grep -L` atas 51 `route.ts` di `src/app/api`): **40 via wrapper**, **11 tanpa wrapper**:
`auth/[...all]`, `bundles/[id]/export/moodle`, `collections` (stub 410), `collections/[id]` (410), `collections/[id]/items` (410), `dev/demo-status`, `dev/quick-login`, `health`, `mcp`, `metrics`, `ready`.
→ Dikurangi 3 stub 410 & 2 endpoint health/metrics, **hanya 6 route fungsional** yang berada di luar wrapper — **cakupan telemetri API sebenarnya baik** (ini mengoreksi dugaan awal audit; lihat §7). Yang hilang dari metrik: 3 stub, `health`/`ready`/`metrics` sendiri (O-11), `mcp`, `dev/*`, dan `export/moodle`.

**Route mutasi tanpa `rateLimit: true`** (21 total; sebagian memakai limiter khusus di dalam handler — mis. `mcp` — perlu dicek per-route saat remediasi): `ai/embed`, `ai/enrich`, `bundles/[id]/duplicate`, `bundles/[id]/export/moodle`, `bundles/[id]/items/[itemId]`, `dev/quick-login`, `events/[id]`, `mcp`, `media/upload`, `questions/batch`, `questions/[id]/{flag,permanent,status}`, `sources/[id]`, `system/agent-keys/[id]`, `tags/{clean-unused,merge,[id]}`, `v1/ingest/{upload,commit}`.

**Tes telemetri saat audit:**
`pnpm exec vitest run src/lib/telemetry src/app/api/health src/lib/api/route-wrapper.test.ts` → **51 lulus, 1 gagal**. Kegagalan = `src/lib/telemetry/check-names.test.ts` (CONSTRAINTS #28b) karena **berkas dev berbahasa Indonesia** di `scripts/dev/*` (`lihat-soal.ts`, `hapus-yang-error.ts`, …) — **bukan** terkait telemetri, tetapi **repository saat ini tidak hijau** untuk tes yang berada di folder telemetri. (Tidak diperbaiki: di luar cakupan read-only audit; dicatat agar tak diklaim "hijau".)

---

## 5. Rekomendasi berurutan (nilai / risiko)

| # | Aksi | Menutup | Nilai | Risiko | Perkiraan |
|---|------|---------|-------|--------|-----------|
| **REKOM-01** | XFF → `X-Client-IP` dari Caddy (`trusted_proxies`) **atau** ambil elemen **kanan**; sebutkan di `KEAMANAN.md` bahwa SEC-02 ditutup | O-16 | 🔴 tinggi | rendah | 0,5 hari |
| **REKOM-02** | Normalisasi label metrik (`:id`) + cap label; perbaiki `percentile()`; pakai `process.uptime()`; tes >512 sampel | O-06, O-07, O-08 | 🔴 tinggi | rendah | 1 hari |
| **REKOM-03** | Scrub nilai rahasia di `redact()` (pola URL/Bearer) + jangan log `stack` ke kolektor; `err` → `{name,message scrubbed}` | O-01 | 🔴 tinggi | rendah | 0,5 hari |
| **REKOM-04** | `/api/health` & `/api/ready`: hapus `error` mentah dari respons publik + rate-limit probe | O-10 | 🔴 tinggi | rendah | 0,5 hari |
| **REKOM-05** | Access log info di `finish()` (dengan `durationMs`, `requestId`) **atau** hapus klaim `OBSERVABILITAS.md:65`; `requestId` di body 500; perbarui `KONTRAK-API.md:26` | O-02, O-03, drift | 🟠 sedang | rendah | 0,5 hari |
| **REKOM-06** | Prune berkala untuk rate-limit & idempotensi + gauge ukuran store | O-17 | 🟠 sedang | rendah | 0,5 hari |
| **REKOM-07** | Alert minimum (uptime monitor + skrip error-budget terhadap `/api/metrics`) | O-19, O-12 | 🟠 sedang | rendah | 1 hari |
| **REKOM-08** | `METRICS_TOKEN` wajib di prod (checklist deploy) atau allow-list jaringan internal | O-09 | 🟠 sedang | rendah | 0,5 hari |
| **REKOM-09** | Rate-limit default untuk semua route mutasi + `rate_limited_total` | O-18 | 🟡 rendah | sedang | 1 hari |
| **REKOM-10** | `requestId` di `audit_logs` (migrasi + `db_safety` + `db:verify`) | O-14 | 🟡 rendah | sedang | 1 hari |
| **REKOM-11** | Ganti `console.*` di 3 route + `instrumentation.ts` → `log` | O-04, O-20 | 🟡 rendah | rendah | 2 jam |
| **REKOM-12** | Caddy: teruskan `X-Request-ID` klien bila ada (atau dokumentasikan ID server) | O-13 | 🟡 rendah | rendah | 2 jam |

**Urutan disarankan:** REKOM-03 dan REKOM-04 lebih dulu (kebocoran, perubahan kecil), lalu REKOM-02 (metrik kepercayaan), REKOM-01, lalu sisanya.

---

## 6. Yang belum selesai / batasan audit

- **Skill `observability-and-instrumentation` tidak tersedia** → baseline memakai dokumen proyek (lihat kepala dokumen). Rubrik skill (jika ada) belum diterapkan.
- **Tidak** menjalankan aplikasi terhadap DB produksi; probe redaksi metrik/logger memakai replika logika & fungsi asli di proses terpisah.
- **O-07** dibuktikan secara **analitis** dari kode (bukan probe runtime >512 request). `slice(0, s.filled)` saat `filled === 512` mengembalikan seluruh array (termasuk slot `0` yang belum ditimpa), dan jalur `filled < 512` terbukti benar lewat probe. **Disarankan tes regresi >512 sampel** sebagai bukti utama saat remediasi.
- `docs/VERIFIKASI-*.md` yang dirujuk `CONSTRAINTS.md` #44 **tidak ditemukan**; §Catatan Verifikasi di bawah disertakan langsung di dokumen ini.
- Cakupan rate-limit (O-18) & cakupan wrapper (§4) dihitung via `grep`/skrip per-route; route yang dibuat setelah audit ini perlu diperiksa ulang.

---

## 7. Catatan Verifikasi

> Wajib menurut `CONSTRAINTS.md` #44.

| Aspek | Isi |
|---|---|
| **Verifikator** | Agen audit (sesi 2026-10-18, `@7c4df34`) |
| **Metode** | Baca statik `src/lib/telemetry/*`, `src/lib/api/{route-wrapper,rate-limit,idempotency}.ts`, `src/app/api/{health,ready,metrics}/route.ts`, `src/instrumentation.ts`, error boundary; enumerasi 51 route (`grep -l`/`grep -L` atas `route.ts`); grep pemanggilan `prune`/`setInterval`/`console.*`; **probe runtime** (replika `redact()`, `recordRequest/snapshot()` asli via `tsx`, error Postgres nyata); `vitest` selektif telemetri (51/52 lulus); verifikasi perilaku XFF Caddy via docs & caddy#6783. |
| **Terverifikasi BENAR (control berjalan)** | Log JSON + redaksi nama-kunci, level & sink (O-05); liveness tanpa DB; `/api/metrics` 404 prod tanpa token; invariant sebagai kontrak; `audit_logs` immutable; idempotensi membuang state gagal; rate-limit login persisten DB + `cf-connecting-ip`. |
| **Koreksi terhadap klaim lama** | (1) `OBSERVABILITAS.md:65` — **tidak ada** access log per request & `durationMs` tak pernah di-log → dokumen over-claim. (2) `KONTRAK-API.md:26` — `X-Request-ID` **tidak** pada semua respons, dan log memakai `requestId` JSON, bukan `rid=`. (3) `OBSERVABILITAS.md:33` — angka invarian 28/26 sudah usang (kode: 26/24). (4) `rate-limit`/`idempotency` `prune()` **ada tapi mati** — komentar "dipanggil berkala" (`rate-limit.ts:36-40`) tidak benar. |
| **Yang TIDAK terbukti / dibatasi** | O-07 (analitis, lihat §6); klaim "513 entri metrik → OOM" tidak diukur (angka berbasis ukuran `Float64Array(512)`); tidak ada uji terhadap topologi Cloudflare nyata. |
| **Status baris** | Laporan ⚠️: **5 HIGH** — kebocoran rahasia (O-01), metrik (O-06, O-07), kebocoran detail health (O-10), alerting (O-19, diakui); **7 MEDIUM**, **6 LOW**, **2 kontrol ✅**. |
| **Dokumen terkait** | `docs/OBSERVABILITAS.md`, `docs/SLA-SLO.md`, `docs/KEAMANAN.md` (S1/SEC-02), `docs/KONTRAK-API.md`, `docs/audit/2026-10-18-konsistensi-dokumen-adr-vs-kode.md` |
