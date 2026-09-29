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

/** Apakah aktor punya izin (dengan mempertimbangkan `own`). */
export function can(
  actor: Actor,
  permission: Permission,
  opts?: { ownerId?: string | null },
): boolean {
  const access = effectiveAccess(actor, permission);
  if (access === "yes") return true;
  if (access === "own") {
    return Boolean(opts?.ownerId) && opts?.ownerId === actor.id;
  }
  return false;
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
