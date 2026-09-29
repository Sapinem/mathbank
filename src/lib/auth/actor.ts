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
}
