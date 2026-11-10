import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { demoUserByKey, DEMO_PASSWORD } from "@/lib/auth/demo-users";
import { demoLoginAllowed } from "@/lib/auth/demo-login";
import { checkRateLimit, rateLimitKey } from "@/lib/api/rate-limit";
import { getClientIp } from "@/lib/api/client-ip";

/**
 * POST /api/dev/quick-login — login cepat untuk DEMO.
 *
 * Menandatangani session better-auth untuk akun demo terpilih, lalu meneruskan
 * cookie sesi ke klien.
 *
 * **Pagar ganda (Fase 2, lihat `src/lib/auth/demo-login.ts` untuk matriks
 * lengkap):** di lingkungan production-like (`NODE_ENV=production` atau
 * `APP_ENV=production/staging`) route ini MATI (404) KECUALI BOTH
 * `DEMO_LOGIN=enabled` DAN `DEMO_LOGIN_PUBLIC=true` diset — yaitu deployment
 * yang memang server demo publik, bukan produksi sungguhan.
 * ⚠️ **Keputusan pemilik (2026-09-30):** server demo publik **sengaja**
 * menjalankan demo — deployment itu harus menyetel KEDUA flag di atas.
 * Untuk produksi sungguhan, **JANGAN** set `DEMO_LOGIN_PUBLIC`.
 *
 * **Rate-limit (Fase 2):** route ini tidak lewat `wrapRoute` agar kontrak
 * responsnya (404/400/500/`{ data: { ok, key, name } }` + set-cookie)
 * tidak berubah, tetapi pemeriksaan rate-limit yang sama dipakai manual di
 * sini: 10 burst, isi ulang 0,2/detik (≈12/menit), di-key per IP (route ini
 * belum terautentikasi). Melebihi batas → 429 `RATE_LIMITED` + `Retry-After`.
 * Rate-limit diperiksa SETELAH pagar lingkungan, supaya permintaan ke
 * lingkungan yang mati tidak menghabiskan bucket.
 *
 * Body: { key: "admin" | "guru" | "penelaah" }
 */
const bodySchema = z.object({ key: z.string().min(1) });

/** Kebijakan rate-limit khusus quick-login (lebih ketat dari default). */
const QUICK_LOGIN_RATE_POLICY = { capacity: 10, refillPerSec: 0.2 };

/** Respons set-cookie tak boleh masuk cache bersama. */
function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: Request) {
  if (!demoLoginAllowed()) {
    return noStore(
      NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Tidak ditemukan." } },
        { status: 404 },
      ),
    );
  }

  const rateKey = rateLimitKey(null, getClientIp(req), "dev:quick-login");
  const rate = await checkRateLimit(rateKey, QUICK_LOGIN_RATE_POLICY);
  if (!rate.allowed) {
    return noStore(
      NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Terlalu banyak permintaan. Coba lagi nanti.",
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
        },
      ),
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return noStore(
      NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Body tak valid." } },
        { status: 400 },
      ),
    );
  }

  const demo = demoUserByKey(parsed.data.key);
  if (!demo) {
    return noStore(
      NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Akun demo tak dikenal." } },
        { status: 404 },
      ),
    );
  }

  // Panggil handler better-auth melalui request internal, ambil set-cookie.
  const url = new URL("/api/auth/sign-in/email", req.url);
  const res = await auth.handler(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: demo.email, password: DEMO_PASSWORD }),
    }),
  );

  if (!res.ok) {
    // NEW2: JANGAN bocorkan detail respons Better Auth (bisa memuat pesan DB).
    // Catat server-side saja; klien dapat pesan generik.
    const detail = await res.text().catch(() => "");
    console.error("[dev/quick-login] sign-in gagal:", detail.slice(0, 500));
    return noStore(
      NextResponse.json(
        {
          error: {
            code: "DEMO_SIGNIN_FAILED",
            message:
              "Gagal masuk sebagai akun demo. Jalankan `pnpm seed:users` lebih dulu.",
          },
        },
        { status: 500 },
      ),
    );
  }

  const out = noStore(
    NextResponse.json({ data: { ok: true, key: demo.key, name: demo.name } }),
  );
  // Teruskan semua cookie sesi (bisa >1).
  for (const cookie of res.headers.getSetCookie()) {
    out.headers.append("set-cookie", cookie);
  }
  return out;
}
