import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { authUser, userRoles, apiKey } from "@/lib/db/schema/auth";
import { eq, and, desc, inArray } from "drizzle-orm";
import { assertCan } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import type { Role } from "@/lib/auth/roles";
import { throwVersionedWriteMiss } from "./versioned";

/**
 * Manajemen API key untuk Agen MCP dan Integrasi Read-Only (M11-e).
 *
 * Mendukung 3 preset akses:
 * 1. `read_only_guest`: Pembaca tamu tanpa kunci jawaban (service account: guest-reader@mathbank.local, peran `agent`).
 * 2. `read_only_full`: Pembaca pendidik/LMS dengan kunci jawaban (service account: reader-educator@mathbank.local, peran `teacher`).
 * 3. `agent_full`: Agen AI MCP penuh (service account: agent@mathbank.local, peran `agent`).
 *
 * Kunci penuh hanya ditampilkan SEKALI saat dibuat; setelah itu DB hanya menyimpan hash/awalan.
 * Izin: `user:manage` (admin) — hanya admin yang mengelola kredensial agen dan API key.
 */

export type ApiKeyPreset = "read_only_guest" | "read_only_full" | "agent_full";

export const TECHNICAL_USERS: Record<
  ApiKeyPreset,
  { email: string; name: string; role: Role }
> = {
  read_only_guest: {
    email: "guest-reader@mathbank.local",
    name: "Tamu Read-Only",
    role: "agent",
  },
  read_only_full: {
    email: "reader-educator@mathbank.local",
    name: "Pendidik Read-Only",
    role: "teacher",
  },
  agent_full: {
    email: "agent@mathbank.local",
    name: "Agen MCP",
    role: "agent",
  },
};

/** Info ringkas key untuk UI (TANPA nilai rahasia). */
export interface AgentKeyInfo {
  id: string;
  version: number;
  name: string | null;
  prefix: string | null;
  enabled: boolean;
  createdAt: string | null;
  expiresAt: string | null;
  lastRequest: string | null;
  requestCount: number | null;
  preset: ApiKeyPreset;
}

/** Pastikan akun teknis ada dan memiliki peran yang tepat; kembalikan id-nya. */
export async function ensureTechnicalUser(
  email: string,
  name: string,
  role: Role,
): Promise<string> {
  const existing = await db
    .select({ id: authUser.id })
    .from(authUser)
    .where(eq(authUser.email, email))
    .limit(1);

  if (existing[0]) {
    const userId = existing[0].id;
    const hasRole = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)))
      .limit(1);
    if (hasRole.length === 0) {
      await db.insert(userRoles).values({ userId, role }).onConflictDoNothing();
    }
    return userId;
  }

  // Belum ada → buat tanpa password login (akun teknis; tak dipakai untuk login).
  const [created] = await db
    .insert(authUser)
    .values({
      id: crypto.randomUUID(),
      email,
      name,
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
      .where(eq(authUser.email, email))
      .limit(1);
    userId = fallback!.id;
  }

  const hasRole = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)))
    .limit(1);
  if (hasRole.length === 0) {
    await db.insert(userRoles).values({ userId, role }).onConflictDoNothing();
  }
  return userId;
}

function parsePresetFromMetadata(metadata: unknown): ApiKeyPreset {
  if (!metadata) return "agent_full";
  try {
    const parsed =
      typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    if (
      parsed?.preset === "read_only_guest" ||
      parsed?.preset === "read_only_full" ||
      parsed?.preset === "agent_full"
    ) {
      return parsed.preset;
    }
  } catch {
    // fallback bila parse gagal
  }
  return "agent_full";
}

/** Daftar API key agen dan integrasi (aman untuk UI). */
export async function listAgentKeys(actor: Actor): Promise<AgentKeyInfo[]> {
  assertCan(actor, "user:manage");
  const userIds = await Promise.all([
    ensureTechnicalUser(
      TECHNICAL_USERS.read_only_guest.email,
      TECHNICAL_USERS.read_only_guest.name,
      TECHNICAL_USERS.read_only_guest.role,
    ),
    ensureTechnicalUser(
      TECHNICAL_USERS.read_only_full.email,
      TECHNICAL_USERS.read_only_full.name,
      TECHNICAL_USERS.read_only_full.role,
    ),
    ensureTechnicalUser(
      TECHNICAL_USERS.agent_full.email,
      TECHNICAL_USERS.agent_full.name,
      TECHNICAL_USERS.agent_full.role,
    ),
  ]);

  const rows = await db
    .select({
      id: apiKey.id,
      version: apiKey.version,
      name: apiKey.name,
      prefix: apiKey.prefix,
      enabled: apiKey.enabled,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      lastRequest: apiKey.lastRequest,
      requestCount: apiKey.requestCount,
      metadata: apiKey.metadata,
    })
    .from(apiKey)
    .where(inArray(apiKey.referenceId, userIds))
    .orderBy(desc(apiKey.createdAt));

  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    name: r.name,
    prefix: r.prefix,
    enabled: r.enabled,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
    lastRequest: r.lastRequest ? new Date(r.lastRequest).toISOString() : null,
    requestCount: r.requestCount,
    preset: parsePresetFromMetadata(r.metadata),
  }));
}

/**
 * Buat API key baru dengan preset terpilih. Mengembalikan **kunci penuh SEKALI** (`key`) — setelah
 * ini tak bisa dilihat lagi.
 */
export async function createAgentKey(
  actor: Actor,
  input: {
    name?: string;
    expiresInDays?: number;
    preset?: ApiKeyPreset;
  },
): Promise<{
  id: string;
  key: string;
  prefix: string | null;
  name: string | null;
  preset: ApiKeyPreset;
}> {
  assertCan(actor, "user:manage");
  const preset: ApiKeyPreset = input.preset ?? "read_only_guest";
  const techUser = TECHNICAL_USERS[preset];
  const targetUserId = await ensureTechnicalUser(
    techUser.email,
    techUser.name,
    techUser.role,
  );

  // Scoped permissions per preset
  const permissions: Record<string, string[]> =
    preset === "agent_full"
      ? {
          question: ["create", "read", "edit", "flag"],
          taxonomy: ["read"],
          enrichment: ["run"],
        }
      : {
          question: ["read"],
          taxonomy: ["read"],
        };

  const defaultName = techUser.name;

  const result = (await auth.api.createApiKey({
    body: {
      name: input.name?.trim() || defaultName,
      userId: targetUserId,
      ...(input.expiresInDays && input.expiresInDays > 0
        ? { expiresIn: input.expiresInDays * 24 * 60 * 60 }
        : {}),
      permissions,
      metadata: { preset },
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
    preset,
  };
}

/** Cabut (hapus) API key agen atau integrasi. */
export async function revokeAgentKey(
  actor: Actor,
  keyId: string,
  /** Versi yang diharapkan (ADR-0030); `undefined` = tanpa prakondisi. */
  expectedVersion?: number | "*",
): Promise<void> {
  assertCan(actor, "user:manage");
  const userIds = await Promise.all([
    ensureTechnicalUser(
      TECHNICAL_USERS.read_only_guest.email,
      TECHNICAL_USERS.read_only_guest.name,
      TECHNICAL_USERS.read_only_guest.role,
    ),
    ensureTechnicalUser(
      TECHNICAL_USERS.read_only_full.email,
      TECHNICAL_USERS.read_only_full.name,
      TECHNICAL_USERS.read_only_full.role,
    ),
    ensureTechnicalUser(
      TECHNICAL_USERS.agent_full.email,
      TECHNICAL_USERS.agent_full.name,
      TECHNICAL_USERS.agent_full.role,
    ),
  ]);

  // Pastikan key ini memang milik salah satu akun teknis (cegah cabut key milik user lain),
  // lalu hapus langsung dari DB.
  const owned = and(eq(apiKey.id, keyId), inArray(apiKey.referenceId, userIds));
  const where =
    expectedVersion === undefined || expectedVersion === "*"
      ? owned
      : and(owned, eq(apiKey.version, expectedVersion));
  const deleted = await db.delete(apiKey).where(where).returning({ id: apiKey.id });
  if (deleted.length === 0) {
    return throwVersionedWriteMiss(apiKey, keyId, expectedVersion, "API key tidak ditemukan.", {
      scope: inArray(apiKey.referenceId, userIds),
    });
  }
}
