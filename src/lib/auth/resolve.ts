import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userRoles } from "@/lib/db/schema/auth";
import { auth } from "./server";
import { isRole, type Role } from "./roles";
import type { Actor } from "./actor";

/**
 * Identifikasi aktor dari request (L1 + L4).
 * Prioritas: session cookie (manusia) → API key (agen/mesin).
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

/** Resolusi aktor lengkap (session → apikey). */
export async function resolveActor(headers: Headers): Promise<Actor | null> {
  return (await actorFromSession(headers)) ?? (await actorFromApiKey(headers));
}
