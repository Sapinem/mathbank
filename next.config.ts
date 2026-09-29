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
 * Header keamanan. Dalam mode dev, header yang memaksa HTTPS dilewati agar
 * pengembangan lokal (`http://localhost`) tetap berjalan.
 */
function securityHeaders(isDev: boolean) {
  // `upgrade-insecure-requests` HANYA produksi: di dev ia mematahkan akses via
  // LAN (http://<ip>:3001 tanpa TLS → aset gagal → halaman tanpa CSS).
  const cspValue = isDev
    ? CSP_DEV
    : `${CSP}; upgrade-insecure-requests`;
  const headers = [
    { key: "Content-Security-Policy", value: cspValue },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];
  // HSTS hanya di produksi (jangan paksa HTTPS di localhost).
  if (!isDev) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }
  return headers;
}

const nextConfig: NextConfig = {
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    return [
      {
        source: "/:path*",
        headers: securityHeaders(isDev),
      },
    ];
  },
};

export default nextConfig;
