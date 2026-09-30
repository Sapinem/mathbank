import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { demoUserByKey, DEMO_PASSWORD } from "@/lib/auth/demo-users";

/**
 * POST /api/dev/quick-login — login cepat untuk DEMO.
 *
 * Menandatangani session better-auth untuk akun demo terpilih, lalu meneruskan
 * cookie sesi ke klien.
 *
 * **Pagar:** aktif di dev. Di produksi MATI (404) kecuali `DEMO_LOGIN=enabled`
 * diset eksplisit — jadi tak pernah jadi pintu belakang tanpa sengaja.
 * ⚠️ **Keputusan pemilik (2026-09-30):** server ini (b.iyo.my.id) **sengaja**
 * menjalankan `DEMO_LOGIN=enabled` sebagai demo publik. Untuk produksi sungguhan,
 * **JANGAN** set `DEMO_LOGIN`. Lindung lain: rate-limit Better Auth + `detail`
 * tak dibocorkan (NEW2).
 *
 * Body: { key: "admin" | "guru" | "penelaah" }
 */
const bodySchema = z.object({ key: z.string().min(1) });

/** Apakah login demo diizinkan di lingkungan ini? */
function demoLoginAllowed(): boolean {
  if (process.env.DEMO_LOGIN === "enabled") return true;
  return process.env.NODE_ENV !== "production";
}

export async function POST(req: Request) {
  if (!demoLoginAllowed()) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Tidak ditemukan." } },
      { status: 404 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Body tak valid." } },
      { status: 400 },
    );
  }

  const demo = demoUserByKey(parsed.data.key);
  if (!demo) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Akun demo tak dikenal." } },
      { status: 404 },
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
    return NextResponse.json(
      {
        error: {
          code: "DEMO_SIGNIN_FAILED",
          message:
            "Gagal masuk sebagai akun demo. Jalankan `pnpm seed:users` lebih dulu.",
        },
      },
      { status: 500 },
    );
  }

  const out = NextResponse.json({ data: { ok: true, key: demo.key, name: demo.name } });
  // Teruskan semua cookie sesi (bisa >1).
  for (const cookie of res.headers.getSetCookie()) {
    out.headers.append("set-cookie", cookie);
  }
  return out;
}
