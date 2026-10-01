import type { NextConfig } from "next";

/**
 * Security headers (S2) — MathBank.
 *
 * Diterapkan ke semua rute. CSP bersifat **pragmatis**: Next.js menyuntik
 * skrip inline (bootstrap RSC, anti-FOUC `next-themes`) sehingga
 * `'unsafe-inline'` diperlukan untuk skrip & gaya. Pengerasan lanjutan
 * (nonce/hash) menyusul — lihat docs/KEAMANAN.md (utang S2).
 */

/**
 * Content-Security-Policy.
 * - `default-src 'self'` → default ketat.
 * - `script-src 'self' 'unsafe-inline'` → inline bootstrap Next/next-themes.
 * - `style-src 'self' 'unsafe-inline'` → gaya inline (tema, shadcn).
 * - `img-src 'self' data: blob:` → media + data URI (KaTeX tak perlu jaringan).
 * - `font-src 'self'` → font di-self-host via next/font.
 * - `connect-src 'self'` → fetch API internal.
 * - `frame-ancestors 'none'` → anti-clickjacking (CSP modern).
 * - `base-uri 'self'` + `form-action 'self'` → cegah injeksi base/form.
 * - `object-src 'none'` → tak ada plugin.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * CSP untuk DEV: tambah `'unsafe-eval'` — React dev butuh `eval()` untuk
 * rekonstruksi callstack (fitur debug). **Tak pernah** dipakai di produksi.
 *
 * CATATAN: `upgrade-insecure-requests` **sengaja TIDAK** ada di dev. Directive itu
 * memaksa browser menaikkan semua request `http://` → `https://`. Di `localhost`
 * browser punya pengecualian (secure context), tapi saat dev diakses lewat LAN
 * (`http://192.168.x.x:3001`) tak ada HTTPS → CSS/JS/font gagal dimuat → halaman
 * tampil tanpa gaya. Directive ini hanya ditambahkan di produksi (lihat
 * `securityHeaders`), tempat TLS diterminasi reverse-proxy.
 */
const CSP_DEV = CSP.replace(
  "script-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
);

/**
 * Header keamanan.
 *
 * `isDev`: mode pengembangan (`next dev`) — jangan paksa HTTPS, tambah `'unsafe-eval'`.
 * `isHttps`: request datang lewat HTTPS (TLS diterminasi reverse-proxy) — hanya di
 *   kondisi ini `upgrade-insecure-requests` & HSTS aman dikirim.
 *
 * ⚠️ `upgrade-insecure-requests` **tidak boleh** dikirim saat halaman disajikan
 * lewat **HTTP polos** — termasuk saat uji produksi via LAN (`http://<ip>:3001`).
 * Directive itu memaksa browser menaikkan semua aset ke `https://`; tanpa TLS
 * aset gagal dimuat → halaman tampil tanpa CSS. Karena itu ia hanya
 * ditambahkan bila `isHttps` benar.
 */
function securityHeaders(isDev: boolean, isHttps: boolean) {
  let cspValue = isDev ? CSP_DEV : CSP;
  if (isHttps) {
    // Hanya saat benar-benar HTTPS: `'unsafe-eval'` tetap dev-only.
    cspValue = `${cspValue}; upgrade-insecure-requests`;
  }
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];
  // HSTS hanya saat HTTPS (jangan paksa HTTPS lewat HTTP polos).
  if (isHttps) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }
  return { headers, cspValue };
}

const nextConfig: NextConfig = {
  /**
   * Direktori output — bisa dialihkan lewat `NEXT_DIST_DIR`.
   *
   * Dipakai `scripts/deploy.sh` untuk membangun ke `.next.new` lebih dulu,
   * lalu menukarnya secara atomik. Tanpa ini, `next build` menulis langsung ke
   * `.next` yang sedang disajikan `mathbank.service` → seluruh situs balas 500
   * selama build berjalan (`Cannot find module .next/server/middleware-manifest.json`).
   * Default tetap `.next` agar perilaku lama tidak berubah.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  /**
   * Output standalone (M16/Docker) — dipakai HANYA saat membangun image Docker
   * (`NEXT_OUTPUT_STANDALONE=true`). Di produksi systemd tetap memakai
   * `pnpm build && pnpm start` (tanpa standalone) agar perilaku tak berubah.
   * Standalone menghasilkan `.next/standalone/server.js` + node_modules minimal.
   */
  ...(process.env.NEXT_OUTPUT_STANDALONE === "true" ? { output: "standalone" } : {}),
  /**
   * Origin dev yang diizinkan (Next 16). Sejak Next 16, resource dev
   * (`/_next/*`, HMR) **diblokir default** untuk origin non-lokal → saat dev
   * diakses lewat LAN (`http://192.168.x.x:3001`), JS tak termuat → halaman
   * "loading terus". Daftarkan host LAN di sini agar dev via LAN bekerja.
   *
   * ⚠️ Ini HANYA berdampak pada `next dev`, bukan produksi. Ubah/tambah lewat
   * `ALLOWED_DEV_ORIGINS` (pisah koma) bila IP LAN Anda berbeda.
   */
  allowedDevOrigins: (
    process.env.ALLOWED_DEV_ORIGINS ??
    "192.168.18.100,localhost,127.0.0.1,b.iyo.my.id"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    // `upgrade-insecure-requests` + HSTS hanya dikirim bila operator menyatakan
    // app disajikan via HTTPS (di balik reverse-proxy TLS). Set `APP_HTTPS=true`
    // di lingkungan produksi. Default: HTTP polos → directive tidak dikirim,
    // agar uji produksi via LAN (`http://<ip>:3001`) tetap memuat CSS/aset.
    const isHttps = process.env.APP_HTTPS === "true";
    const { headers, cspValue } = securityHeaders(isDev, isHttps);
    return [
      {
        // CSP statis + header keamanan untuk SEMUA rute.
        // (Nonce per-request TIDAK dipakai — bug Turbopack #93094; lihat src/proxy.ts
        //  yang kini hanya membuang header CSP kiriman klien.)
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: cspValue }, ...headers],
      },
    ];
  },
};

export default nextConfig;
