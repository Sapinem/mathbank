import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { authUser, userRoles, apiKey } from "@/lib/db/schema/auth";
import { eq, and, desc } from "drizzle-orm";
import { assertCan, NotFoundError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";

/**
 * Manajemen API key untuk AGEN MCP (M11-e).
 *
 * Sebuah API key dimiliki oleh seorang **pengguna ber-peran `agent`** (kolom
 * `reference_id`). Kunci penuh hanya ditampilkan SEKALI saat dibuat; setelah itu
 * DB hanya menyimpan hash/awalan.
 *
 * Izin: `user:manage` (admin) — hanya admin yang mengelola kredensial agen.
 */

/** Email pengguna agen bawaan (dibuat otomatis bila belum ada). */
const AGENT_EMAIL = "agent@mathbank.local";
const AGENT_NAME = "Agen MCP";

/** Info ringkas key untuk UI (TANPA nilai rahasia). */
export interface AgentKeyInfo {
  id: string;
  name: string | null;
  prefix: string | null;
  enabled: boolean;
  createdAt: string | null;
  expiresAt: string | null;
  lastRequest: string | null;
  requestCount: number | null;
}

/** Pastikan pengguna `agent` ada; kembalikan id-nya. */
async function ensureAgentUser(): Promise<string> {
  const existing = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.email, AGENT_EMAIL))
    .limit(1);
  if (existing[0]) return existing[0].id;

  // Belum ada → buat tanpa password login (akun teknis; tak dipakai untuk login).
  const [created] = await db
    .insert(authUser)
    .values({
      id: crypto.randomUUID(),
      email: AGENT_EMAIL,
      name: AGENT_NAME,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: authUser.email })
    .returning({ id: authUser.id });

  let userId = created?.id;
  if (!userId) {
    const [fallback] = await db
      .select({ id: authUser.id })
      .from(authUser)
      .where(eq(authUser.email, AGENT_EMAIL))
      .limit(1);
    userId = fallback!.id;
  }

  const hasRole = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "agent")))
    .limit(1);
  if (hasRole.length === 0) {
    await db.insert(userRoles).values({ userId, role: "agent" }).onConflictDoNothing();
  }
  return userId;
}

/** Daftar API key agen (aman untuk UI). */
export async function listAgentKeys(actor: Actor): Promise<AgentKeyInfo[]> {
  assertCan(actor, "user:manage");
  const agentId = await ensureAgentUser();
  const rows = await db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      enabled: apiKey.enabled,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      lastRequest: apiKey.lastRequest,
      requestCount: apiKey.requestCount,
    })
    .from(apiKey)
    .where(eq(apiKey.referenceId, agentId))
    .orderBy(desc(apiKey.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    enabled: r.enabled,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
    lastRequest: r.lastRequest ? new Date(r.lastRequest).toISOString() : null,
    requestCount: r.requestCount,
  }));
}

/**
 * Buat API key agen baru. Mengembalikan **kunci penuh SEKALI** (`key`) — setelah
 * ini tak bisa dilihat lagi.
 */
export async function createAgentKey(
  actor: Actor,
  input: { name?: string; expiresInDays?: number },
): Promise<{ id: string; key: string; prefix: string | null; name: string | null }> {
  assertCan(actor, "user:manage");
  const agentId = await ensureAgentUser();

  const result = (await auth.api.createApiKey({
    body: {
      name: input.name?.trim() || "Agen MCP",
      userId: agentId,
      ...(input.expiresInDays && input.expiresInDays > 0
        ? { expiresIn: input.expiresInDays * 24 * 60 * 60 }
        : {}),
      // Batasi aksi kunci pada yang dibutuhkan agen (least privilege).
      permissions: {
        question: ["create", "read", "edit", "flag"],
        taxonomy: ["read"],
        enrichment: ["run"],
      },
    },
  })) as unknown as {
    id: string;
    key: string;
    prefix?: string | null;
    name?: string | null;
  };

  return {
    id: result.id,
    key: result.key,
    prefix: result.prefix ?? null,
    name: result.name ?? input.name ?? null,
  };
}

/** Cabut (hapus) API key agen. */
export async function revokeAgentKey(actor: Actor, keyId: string): Promise<void> {
  assertCan(actor, "user:manage");
  const agentId = await ensureAgentUser();

  // Pastikan key ini memang milik pengguna agen (cegah cabut key milik user lain),
  // lalu hapus langsung dari DB. Kita tak memakai `auth.api.deleteApiKey` karena
  // endpoint itu mensyaratkan sesi login (di sini aktornya admin yang sudah lolos
  // `assertCan`) — menghapus via DB lebih andal & tetap satu jalur izin.
  const deleted = await db
    .delete(apiKey)
    .where(and(eq(apiKey.id, keyId), eq(apiKey.referenceId, agentId)))
    .returning({ id: apiKey.id });
  if (deleted.length === 0) throw new NotFoundError("API key tidak ditemukan.");
}
