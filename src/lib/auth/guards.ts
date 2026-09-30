import type { Actor } from "./actor";
import type { Role } from "./roles";
import { PERMISSIONS, type Permission, type Access } from "./permissions";

/**
 * Guard otorisasi (L1) — dipakai service & API wrapper.
 * Fungsi murni: tak sentuh DB, hanya menilai aktor vs izin.
 */

/**
 * Tingkat akses EFEKTIF aktor untuk sebuah izin.
 * Multi-role: ambil yang TERKUAT di antara semua peran (union izin).
 *   yes > own > no
 */
export function effectiveAccess(actor: Actor, permission: Permission): Access {
  const rank: Record<Access, number> = { no: 0, own: 1, yes: 2 };
  let best: Access = "no";
  for (const role of actor.roles) {
    const access = PERMISSIONS[permission][role];
    if (rank[access] > rank[best]) best = access;
  }
  return best;
}

/**
 * Apakah aktor punya izin (dengan mempertimbangkan `own`).
 *
 * Bila aktor berasal dari **API key** dengan pembatasan eksplisit
 * (`apiKeyPermissions`), pembatasan itu **menyempitkan** izin peran — tak pernah
 * memperluas. `{ question: ["create","read"] }` → hanya `question:create` &
 * `question:view` yang lolos (peta: `read`→`view`).
 */
export function can(
  actor: Actor,
  permission: Permission,
  opts?: { ownerId?: string | null },
): boolean {
  const access = effectiveAccess(actor, permission);
  let allowed: boolean;
  if (access === "yes") allowed = true;
  else if (access === "own") {
    allowed = Boolean(opts?.ownerId) && opts?.ownerId === actor.id;
  } else allowed = false;

  if (!allowed) return false;
  return apiKeyAllows(actor, permission);
}

/** Pemetaan aksi API-key plugin → nama izin MathBank. */
const API_KEY_ACTION_ALIAS: Record<string, string> = {
  read: "view",
  view: "view",
  create: "create",
  update: "edit",
  edit: "edit",
  delete: "delete",
};

/**
 * Batasan API key: bila `apiKeyPermissions` diisi, izin dibatasi padanya.
 * Bila tak diisi (undefined) → tak membatasi (perilaku lama, kompatibel).
 */
function apiKeyAllows(actor: Actor, permission: Permission): boolean {
  const perms = actor.apiKeyPermissions;
  if (!perms) return true; // tak dibatasi

  const [resource, action] = permission.split(":") as [string, string];
  const allowedActions = perms[resource];
  if (!allowedActions || allowedActions.length === 0) return false;

  const normalized = allowedActions.map(
    (a) => API_KEY_ACTION_ALIAS[a.toLowerCase()] ?? a.toLowerCase(),
  );
  return normalized.includes(action);
}

/** Aktor punya peran tertentu? */
export function hasRole(actor: Actor, role: Role): boolean {
  return actor.roles.includes(role);
}

/**
 * Tegaskan izin — lempar bila tak boleh.
 * Dipakai di service/route supaya aturan tak tersebar.
 */
export function assertCan(
  actor: Actor,
  permission: Permission,
  opts?: { ownerId?: string | null; message?: string },
): void {
  if (!can(actor, permission, opts)) {
    throw new ForbiddenError(
      opts?.message ?? `Tidak punya izin: ${permission}`,
    );
  }
}

/** Error otorisasi (dipetakan ke HTTP 403 oleh API wrapper). */
export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Error belum login (HTTP 401). */
export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED";
  constructor(message = "Harus login lebih dulu") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Error sumber daya tak ditemukan (HTTP 404). */
export class NotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor(message = "Sumber daya tidak ditemukan") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Error konflik/aturan bisnis (HTTP 409). */
export class ConflictError extends Error {
  readonly code = "CONFLICT";
  constructor(message = "Konflik data") {
    super(message);
    this.name = "ConflictError";
  }
}
