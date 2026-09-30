import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userRoles } from "@/lib/db/schema/auth";
import { auth } from "./server";
import { isRole, type Role } from "./roles";
import type { Actor } from "./actor";

/**
 * Identifikasi aktor dari request (L1 + L4).
 * Prioritas: session cookie (manusia) → dev bypass (dev saja) → API key (agen/mesin).
 */

/** Ambil peran dari DB (multi-role). */
async function rolesOf(userId: string): Promise<Role[]> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role).filter(isRole);
}

/** Aktor dari session cookie. */
export async function actorFromSession(
  headers: Headers,
): Promise<Actor | null> {
  try {
    const session = await auth.api.getSession({ headers });
    if (!session?.user) return null;
    const u = session.user as unknown as {
      id: string;
      name: string;
      mustChangePassword?: boolean;
    };
    return {
      id: u.id,
      name: u.name,
      roles: await rolesOf(u.id),
      via: "session",
      mustChangePassword: u.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}

/** Aktor dari API key (agen/mesin). */
export async function actorFromApiKey(headers: Headers): Promise<Actor | null> {
  const raw = (
    headers.get("x-api-key") ??
    headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  ).trim();
  if (!raw) return null;
  try {
    const result = await auth.api.verifyApiKey({ body: { key: raw } as never });
    if (!result?.valid || !result.key) return null;
    const key = result.key as unknown as {
      id: string;
      name?: string;
      referenceId: string;
      permissions?: Record<string, string[]>;
    };
    return {
      id: key.referenceId,
      name: key.name ?? "API Client",
      roles: await rolesOf(key.referenceId),
      via: "apikey",
      apiKeyPermissions: key.permissions,
    };
  } catch {
    return null;
  }
}

/**
 * Aktor dev (hanya bila AUTH_DEV_BYPASS=true DAN lingkungan benar-benar dev).
 *
 * Pagar BERLAPIS (enterprise guardrail — cegah kebocoran hak admin di UAT/staging):
 *  1. `NODE_ENV` TIDAK boleh `production`.
 *  2. `APP_ENV` (bila diset) TIDAK boleh `production`/`staging` — pagar keras
 *     kedua, karena di UAT/staging `NODE_ENV` sering dibiarkan non-production.
 *  3. `AUTH_DEV_BYPASS` harus literal `"true"`.
 */
function actorFromDevBypass(): Actor | null {
  // Pagar 1: JANGAN pernah aktif di produksi, terlepas dari nilai env.
  if (process.env.NODE_ENV === "production") return null;
  // Pagar 2: tolak lingkungan staging/UAT (di sana bypass HARUS mati agar
  // pengujian matriks peran murni tak bocor hak admin).
  const appEnv = process.env.APP_ENV?.toLowerCase();
  if (appEnv === "production" || appEnv === "staging") return null;
  // Pagar 3: opt-in eksplisit.
  if (process.env.AUTH_DEV_BYPASS !== "true") return null;
  return {
    id: "dev-user",
    name: "Dev User",
    roles: ["admin"],
    via: "session",
  };
}

/**
 * Resolusi aktor lengkap.
 *
 * Urutan: **session cookie → dev bypass → API key**.
 *
 * Kenapa session DIDAHULUKAN atas dev bypass: halaman *quick-login* demo perlu
 * benar-benar mengubah peran (admin/guru/penelaah). Bila bypass selalu menang,
 * semua orang jadi admin dan demo peran tak bermakna. Bypass tetap berlaku saat
 * TAK ada session (akses cepat tanpa login).
 */
export async function resolveActor(headers: Headers): Promise<Actor | null> {
  return (
    (await actorFromSession(headers)) ??
    actorFromDevBypass() ??
    (await actorFromApiKey(headers))
  );
}
