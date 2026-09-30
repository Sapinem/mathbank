import { request } from "@playwright/test";

/**
 * Warm-up e2e: kunjungi semua rute sekali SEBELUM tes jalan, agar Next dev
 * meng-compile semuanya lebih dulu. Tanpa ini, compile on-demand saat tes
 * berjalan menyebabkan `net::ERR_ABORTED` / "element not found" acak.
 */
const ROUTES = [
  "/",
  "/login",
  "/questions",
  "/questions/new",
  "/review",
  "/references/topics",
  "/references/sources",
  "/references/events",
  "/references/labels",
  "/system/settings",
  "/api/auth/me",
  "/api/questions?limit=1",
  "/api/topics",
  "/api/sources",
  "/api/events",
  "/api/tags",
  "/api/settings",
  "/api/dev/demo-status",
];

export default async function globalSetup() {
  const ctx = await request.newContext({ baseURL: "http://localhost:3100" });
  // Dua putaran: pertama memicu compile, kedua memastikan hangat.
  for (let i = 0; i < 2; i++) {
    await Promise.all(
      ROUTES.map((r) => ctx.get(r, { timeout: 60_000 }).catch(() => {})),
    );
  }
  await ctx.dispose();
}
