import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (Next 16; dulunya `middleware.ts`) — keamanan CSP (M13 S9).
 *
 * ── KENAPA BUKAN NONCE (temuan vercel/next.js#93094) ────────────────────────
 * Pola resmi Next 16 (`nonce` + `'strict-dynamic'` di proxy) **TIDAK BEKERJA**
 * di produksi dengan **Turbopack** (bundler default Next 16): Next hanya
 * menempelkan nonce ke `<meta name="csp-nonce">`, **TIDAK** ke tag
 * `<script src="/_next/static/chunks/*.js">` yang disuntik framework. Akibatnya
 * `'strict-dynamic'` **memblokir SEMUA skrip** → React tak menghidrasi, halaman
 * mati. Diverifikasi langsung di stack ini (16.3.7): nonce muncul di header &
 * `<meta>`, 0 tag `<script>` ber-nonce, tombol form tak merespons.
 * → Karena itu CSP **statis** dipegang `next.config.ts`
 *   (`script-src 'self' 'unsafe-inline'`). Nonce ditunda sampai bug di atas
 *   diperbaiki; kode nonce disimpan di riwayat git untuk diaktifkan kembali.
 *
 * ── YANG DIKERJAKAN PROXY DI SINI ───────────────────────────────────────────
 * **Buang header `Content-Security-Policy` dari request masuk** —
 * CVE-2026-44581 / GHSA-ffhc-5mcf-pf4q: App Router membaca nonce dari header CSP
 * *request* lalu menyuntikkannya ke HTML; pada versi rentan hal itu bisa dipakai
 * menyuntik atribut (XSS). Kita sendiri yang menetapkan CSP, jadi header CSP
 * kiriman klien **tidak boleh dipercaya** dan harus dibuang.
 * (Versi kita 16.3.7 > 16.2.5 = sudah terpatch; strip ini = defense in depth.)
 */

/** Header CSP yang dibuang dari request masuk (anti CVE-2026-44581). */
const INBOUND_CSP_HEADERS = [
  "content-security-policy",
  "content-security-policy-report-only",
];

export function proxy(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  // Buang CSP kiriman klien — kita tak mempercayai header ini dari luar.
  for (const h of INBOUND_CSP_HEADERS) requestHeaders.delete(h);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Jalankan pada semua rute kecuali aset statis. CSP tetap dari `next.config.ts`
 * (lihat catatan atas) — proxy di sini hanya membersihkan header masuk.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
