/**
 * Peran formal MathBank (L1) — enum tertutup.
 * Multi-role: satu akun boleh punya beberapa peran; izin = gabungan.
 */
export const ROLES = ["admin", "teacher", "reviewer", "agent", "machine"] as const;

export type Role = (typeof ROLES)[number];

/** Label Indonesia untuk tampilan. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  teacher: "Guru",
  reviewer: "Penelaah",
  agent: "Agen AI",
  machine: "Mesin",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
