import type { Role } from "./roles";

/**
 * Aktor — identitas yang melakukan aksi.
 * Bisa manusia (session), agen/mesin (apikey), atau sistem (internal).
 */
export interface Actor {
  id: string;
  name: string;
  /** Multi-role (L1) — satu akun boleh punya beberapa peran. */
  roles: Role[];
  via: "session" | "apikey" | "system";
  mustChangePassword?: boolean;
  /** Izin dari API key (untuk agen/mesin), bila via apikey. */
  apiKeyPermissions?: Partial<Record<string, string[]>>;
  /** ID spesifik API key (untuk isolasi rate limit antar-kunci). */
  apiKeyId?: string;
}

/** Tipe penulis audit (sinkron enum `author_type` DB). */
export type AuthorType = "teacher" | "agent" | "machine" | "system";

/**
 * Petakan aktor → `author_type` untuk audit/solusi.
 * Manusia (session) = teacher; sistem = system; apikey = machine
 * (agent dianggap machine kecuali punya peran `agent` eksplisit → agent).
 */
export function authorTypeOf(actor: Actor): AuthorType {
  if (actor.via === "system") return "system";
  if (actor.via === "apikey") {
    return actor.roles.includes("agent") ? "agent" : "machine";
  }
  return "teacher";
}
