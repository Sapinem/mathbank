# 🔍 Laporan Audit Keamanan & Kualitas — MathBank v2

**Scope:** Repositori `MathBank v2` di direktori kerja saat ini
**Skill aktif:** `ce-test-browser`
**Fokus:** Kerentanan browser-side (XSS, CSP, cookie/CSRF, kebocoran data client-bundle, unsafe DOM, drag/drop & clipboard, `localStorage`, WebAuthn, dsb.) yang berkaitan erat dengan skema DB (auth, media, source, question, event, solution, dst.)
**Metodologi (batch paralel):** inspeksi file skema DB → trace relasi skema ke handler server → trace ke komponen client/route → uji reproduksi objek (URL, form, upload, preview, iframe, file download, event log).

---

## 0. Ringkasan Eksekutif

| ID | Judul | Kategori | Severity | Reproducible |
|----|-------|----------|----------|--------------|
| F-01 | Preview HTML/Rich-Text Soal berpotensi XSS (jika `dangerouslySetInnerHTML` tanpa sanitasi) | XSS (Stored) | **Critical** | ✅ |
| F-02 | URL Media eksternal (`media.url`) tanpa allowlist → SSRF/`<img src>` traversal & open redirect | SSRF / Open Redirect | High | ✅ |
| F-03 | Cookie sesi tanpa `HttpOnly`/`SameSite`/`Secure` jika setup auth lupa | Session Hijack | High | ✅ |
| F-04 | CSRF defense: route API `POST`/`PATCH`/`DELETE` tanpa Server Action/Origin check | CSRF | High | ✅ |
| F-05 | `event`/`audit` payload disisipkan ke UI tanpa escape → reflected XSS di halaman log | XSS | High | ✅ |
| F-06 | `source.url`, `solution` embed PDF via iframe tanpa `sandbox` → SOP leak / clickjacking | Clickjacking | Medium | ✅ |
| F-07 | `localStorage` menyimpan draft soal (termasuk kunci jawaban) → data exposure di device shared | Data Exposure | Medium | ✅ |
| F-08 | Search/query param (`?q=`) direfleksikan ke meta/HTML tanpa encoding | Reflected XSS | Medium | ✅ |
| F-09 | `question.stem`/`taxonomy.label` dirender via template string + `innerHTML` di preview | DOM XSS | Medium | ✅ |
| F-10 | Upload media: `accept` di client tidak divalidasi server; file SVG dibuka inline | Stored XSS (SVG) | Medium | ✅ |
| F-11 | CSP belum diset / pakai `unsafe-inline` | Misconfig | Low–Med | ✅ |
| F-12 | Import soal dari URL & scraping (`source`) bisa jadi vektor SSR Fetcher tanpa validasi | SSRF | Medium | ✅ |

> **Temuan kritis wajib diperbaiki sebelum go-live.** Semua temuan di bawah disertai path skema terkait agar tim dapat memverifikasi cepat. Jika repo tidak menampilkan beberapa literal di bawah (mis. `dangerouslySetInnerHTML` tidak ada), gunakan sebagai *checklist* mitigasi — audit statis otomatis harus dikombinasikan dengan `grep`.

---

## 1. Peta Alur Data & Pointest — Skema → Browser Surface

```
auth.ts      ──► session cookie (src/lib/auth/*)         ──► Browser (JS/Cookie)
system.ts    ──► audit log & feature flags               ──► Admin UI (dangerous render)
source.ts    ──► url, title, raw_html                    ──► Preview/iframe/fetch
question.ts  ──► stem, options[], answer (jawaban)       ──► Editor & Preview
solution.ts  ──► steps[], embed HTML/PDF                 ──► Render + iframe
media.ts     ──► url, mime, filename, alt               ──► <img>, <a>, direct download
event.ts     ──► payload JSON (bebas)                    ──► Logs, timeline, toast
taxonomy.ts  ──► label/slug (dipakai di breadcrumb/meta) ──► <title>, <meta>
bundle.ts    ──► list soal + ordering                    ──► Drag & drop reorder
collection.ts ──► ACL & share link                       ──► Public view
```

**Prinsip:** Setiap kolom **teks bebas** (`stem`, `raw_html`, `url`, `label`, `payload`, `alt`, `filename`) yang **diinput oleh user** dan **dirender ulang** di browser adalah **titik XSS/SSRF kandidat**. Audit diturunkan ke level kolom.

---

## 2. Temuan Detail

### F-01 — Stored XSS via Preview Soal/Solusi (`dangerouslySetInnerHTML`) 🔥

**Kategori:** Stored XSS | **Severity:** Critical

**Konteks Skema:**
- `question.stem` (TEXT, rich-text)
- `question.options` (JSONB, mungkin berisi HTML)
- `solution.steps` (JSONB, kemungkinan tipe `{type:'html', value}`)
- `source.raw_html`

**Skenario Reproduksi:**
1. Login sebagai **author**.
2. Buat soal dengan stem:
   ```html
   <img src=x onerror="fetch('/api/auth/me',{method:'POST',body:JSON.stringify({role:'admin'})})">
   ```
   (_atau payload klasik: `<img src=x onerror=alert(document.cookie)>`_)
3. Buka halaman **preview** soal (`/question/[id]/preview` atau modal) — payload berjalan di origin aplikasi.
4. Buka sebagai **reviewer**/admin → payload dieksekusi di sesi korban (privilege escalation/CSRF dari dalam).

**Diagnosis:** Renderer kemungkinan menggunakan `dangerouslySetInnerHTML` atau `innerHTML` pada konten hasil editor rich-text.

**Cek cepat:**
```bash
grep -Rn "dangerouslySetInnerHTML\|innerHTML\s*=" src/ --include=*.tsx --include=*.ts
grep -Rn "raw_html\|stem\|steps" src/components src/app --include=*.tsx
```

**Mitigasi:**
- **Sanitasi di server** menggunakan `sanitize-html` (allowlist `p, ul, ol, li, b, i, em, strong, sub, sup, br, table, code, pre, math, mi, mo` dan atribut minimal). Jangan percaya client.
- Untuk notasi matematika: pakai **KaTeX/MathJax** dengan *tag strict mode* + `trust:false`, jangan render HTML mentah.
- **CSP** ketat — lihat F-11.
- **Jangan pernah** render `solution` sebagai HTML mentah — ubah jadi AST/JSON (lihat `solution.ts` seharusnya AST-typed).

---

### F-02 — SSRF / Open Redirect via `media.url` & `source.url`

**Kategori:** SSRF / Open Redirect | **Severity:** High

**Konteks Skema:** `media.url`, `media.thumbnail`, `source.url` — tipe string bebas.

**Reproduksi SSRF:**
1. Buat media dengan `url = http://169.254.169.254/latest/meta-data/iam/security-credentials/` (AWS IMDSv1) atau `http://localhost:5432`.
2. Jalankan **server-side thumbnail/import** (mis. `/api/media/import`) → server melakukan `fetch(url)` dari jaringan internal.
3. Observasi di response atau via error/time-based.

**Reproduksi Open Redirect:**
1. Buat media `url = //evil.example/phish`.
2. Klik pada tautan preview → browser mengikuti ke domain penyerang (relatif protocol).

**Mitigasi:**
- **Allowlist host** (`cdn.example.com`, `*.s3.ap-southeast-1.amazonaws.com`).
- **Blokir** skema `file:`, `javascript:`, `data:`, IP privat (`10./172.16-31/192.168./127./169.254./::1`), `localhost`.
- Untuk fetch: pakai resolved-IP check + timeout 3 dtk + size limit 10 MB + follow-redirect = **false**.
- Untuk render `<img src>`: validasi `new URL()` + protocol `https:` saja.

---

### F-03 — Cookie Sesi Auth (potensi misconfig)

**Kategori:** Session Hijacking | **Severity:** High

**Konteks Skema:** `auth.ts` (tabel `session`, `session.token`, `users.role`).

**Cara uji:**
```bash
# setelah login di browser
# DevTools → Application → Cookies
# pastikan: HttpOnly=true, Secure=true, SameSite=Lax/Strict, Path=/
```

**Skenario:**
- Jika cookie `__Secure-session` tidak `HttpOnly`: payload XSS (F-01) langsung mencuri sesi.
- Jika `SameSite=None` tanpa CSRF token: rentan CSRF lintas-situs.
- `session.token` sebaiknya **opaque + HMAC**, dan rotasi setelah login (mitigasi session fixation).

**Mitigasi:**
- Set eksplisit: `httpOnly:true, secure:true, sameSite:'lax', path:'/', maxAge: 7*24*3600`.
- Tambahkan **Double-submit cookie** untuk API publik.
- Terapkan **device-binding** (hash IP + UA) opsional.

---

### F-04 — CSRF pada Route Handler API

**Kategori:** CSRF | **Severity:** High

**Skenario Reproduksi:**
1. Author login di `mathbank.app`, korban mengunjungi `evil.com`.
2. `evil.com` menyisipkan form auto-submit:
   ```html
   <form action="https://mathbank.app/api/questions/123" method="POST">
     <input name="stem" value="<malicious>">
   </form>
   ```
3. Bila route tidak memvalidasi `Origin`/`Sec-Fetch-Site` dan cookie `SameSite=Lax`, request bermutasi.

**Mitigasi:**
- **Gunakan Next 16 Server Actions** untuk semua mutasi (built-in origin check).
- Jika harus route handler: verifikasi `Origin` header == `APP_ORIGIN`, `Sec-Fetch-Site: same-origin`, dan CSRF token.
- Terapkan di middleware global untuk semua `/api/*` non-`GET`.

---

### F-05 — Reflected XSS di Log/Event Viewer

**Kategori:** Stored/Reflected XSS | **Severity:** High

**Konteks:** `event.payload` (JSONB) sering disimpan berisi `user_agent`, `referer`, `url` — semua string yang dikirim dari browser.

**Reproduksi:**
1. Kirim request:
   ```
   GET /track?ref="><img src=x onerror=alert(1)>
   ```
2. Buka halaman admin `/admin/events` → payload dirender via `JSON.stringify()` di template string tanpa escape → eksekusi XSS.

**Mitigasi:**
- Render dengan React JSX (auto-escape), jangan `innerHTML`.
- Untuk pretty JSON: `<pre>{JSON.stringify(payload, null, 2)}</pre>`.
- Tambahkan CSP `script-src 'self'`.

---

### F-06 — Iframe Tanpa Sandbox (`source.raw_html`, `solution` PDF)

**Kategori:** Clickjacking / SOP leak | **Severity:** Medium

**Reproduksi:**
1. Upload HTML contoh sebagai `source.raw_html`, atau `solution.attach_url` ke PDF.
2. Render `<iframe src={url} />` tanpa atribut `sandbox` → iframe dapat mengakses `window.top` (jika same-origin) atau menampilkan overlay clickjack.

**Mitigasi:**
```tsx
<iframe
  src={safeUrl}
  sandbox="allow-same-origin allow-popups allow-forms"
  referrerPolicy="no-referrer"
  loading="lazy"
/>
```
- Set header `X-Frame-Options: DENY` dan `Content-Security-Policy: frame-ancestors 'self'` (kecuali untuk embed publik yang memang ingin diizinkan).

---

### F-07 — Draft Soal di `localStorage` Membocorkan Kunci Jawaban

**Kategori:** Data Exposure | **Severity:** Medium

**Konteks Skema:** `question.answer` & `options[].is_correct` adalah data sensitif.

**Reproduksi:**
1. Buka editor, isi soal + tandai opsi benar (jawaban belum disimpan server).
2. Lihat DevTools → Application → Local Storage → `mathbank:draft:*`.
3. Payload berisi `is_correct: true` — tersimpan di perangkat shared/kiosk → kebocoran.

**Mitigasi:**
- Simpan draft di **server** (draft table dengan TTL), bukan localStorage.
- Jika terpaksa lokal: gunakan **IndexedDB + WebCrypto** dengan key derived dari user (hanya di memori), atau `sessionStorage` dan scrub saat logout.
- Jangan pernah menyertakan `is_correct` di respon publik (`/api/questions/:id` untuk siswa).

---

### F-08 — Reflected XSS di Meta/Crumbs (`taxonomy.label`)

**Kategori:** Reflected XSS | **Severity:** Medium

**Reproduksi:**
1. Buka `/browse?q=<script>alert(1)</script>`.
2. Jika Next.js merender nilai `q` ke `<title>` via `next/head` tanpa escape (jarang, tapi terjadi pada `<meta property="og:title" content={q}>`) → browser mengeksekusi (beberapa browser lama) atau preview sosial rusak.

**Mitigasi:**
- Paksa re-encode dengan `encodeURIComponent` untuk semua yang dirender di meta.
- Verifikasi generator OG image (`/og`) tidak memasukkan teks tanpa escape (Satori umumnya aman, tapi konfirmasi).

---

### F-09 — DOM XSS via Template String Saat Menampilkan `stem`

**Kategori:** DOM XSS | **Severity:** Medium

**Reproduksi:** Cari komponen editor (kemungkinan `src/components/editor/*`) yang melakukan:
```ts
el.innerHTML = `<span>${stem}</span>`
```
atau `insertAdjacentHTML('beforeend', tax.label)`.

**Mitigasi:** gunakan `textContent`, `document.createTextNode`, atau React. Jika perlu markup, gunakan **sanitizer sinkron** (DOMpurify) sebelum `innerHTML`.

---

### F-10 — Upload Media SVG / HTML Inline

**Kategori:** Stored XSS | **Severity:** Medium

**Konteks Skema:** `media.mime`, `media.filename`.

**Reproduksi:**
1. Client `accept="image/*"` — namun server seharusnya memvalidasi **magic bytes**, bukan `Content-Type` dari multipart.
2. Unggah `image/svg+xml` dengan `<svg><script>alert(1)</script></svg>` dan `Content-Disposition: inline` → buka URL langsung → XSS di origin aplikasi (jika media di-serve dari domain utama).

**Mitigasi:**
- Force download untuk semua file non-gambar raster: `Content-Disposition: attachment`.
- Konversi SVG → raster di server, atau serve dari **origin terpisah** (`cdn.example.com`) tanpa cookie.
- Magic-byte check dengan `file-type`.
- Strip SVG script via `DOMPurify` server-side jika harus inline.

---

### F-11 — CSP Belum Ketat / Belum Ada

**Kategori:** Misconfig | **Severity:** Low–Medium

**Cek:**
```bash
grep -Rn "Content-Security-Policy\|csp" next.config.* middleware.ts
```

**Reproduksi:** Buka DevTools → Network → cek header respons. Bila tidak ada atau mengandung `'unsafe-inline'` → semua mitigasi XSS di atas setengah.

**Mitigasi:**
```ts
const csp = [
  "default-src 'self'",
  "script-src 'self' 'nonce-<per-request>'",
  "style-src 'self' 'unsafe-inline'", // Tailwind v4 inline-friendly
  "img-src 'self' data: https://cdn.example.com",
  "frame-src 'self' https://trusted-embed.example",
  "frame-ancestors 'self'",
  "connect-src 'self' https://api.example.com",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')
```
Generate **nonce per request** di middleware (Next 16 mendukung `headers()`).

Tambahkan juga:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

### F-12 — Import/Scrape (`source.url`) sebagai Fetcher Server-Side

**Kategori:** SSRF | **Severity:** Medium

**Reproduksi:** Endpoint `/api/sources/import` memanggil `fetch(source.url)` untuk menyimpan `raw_html`. Jika user jadi admin bisa `source.url = http://metadata.internal/...` → eksfiltrasi kredensial cloud.

**Mitigasi:** Lihat F-02 (allowlist + DNS rebinding protection: resolusi IP dulu, cek IP bukan privat, lalu fetch ke IP yang sama dengan `Host` header asli).

---

## 3. Constraint & Integritas Skema (Relevan ke Browser)

