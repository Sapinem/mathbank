import { can, effectiveAccess, apiKeyAllows, ForbiddenError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";

/**
 * Kebijakan tulis MCP — SATU TEMPAT (L9, keputusan #1).
 *
 * Semua tool MCP menilai izin lewat sini, BUKAN menaruh cek sendiri-sendiri.
 * Tujuannya: permukaan MCP tak pernah lebih luas dari matriks izin L1, dan
 * perubahan kebijakan cukup diubah di satu berkas.
 *
 * Aturan pokok untuk `agent` (L1):
 *  - Boleh: buat soal, cari, enrichment; `question:edit` & `taxonomy:manage` = **own**.
 *  - TIDAK boleh: bundle, hapus, ubah status (setReady/archive).
 *  - `answer_key` **tidak pernah** masuk keluaran tool (proyeksi aman).
 */

/** Kapabilitas MCP (nama ramah) → izin L1 sebenarnya. */
export const MCP_CAPABILITIES = {
  "question.read": "question:view",
  "question.create": "question:create",
  "question.edit": "question:edit", // `own` → wajib `ownerId`
  "question.flag": "question:flag",
  "taxonomy.read": "question:view", // baca topik/sumber = izin baca soal
  "taxonomy.manage": "taxonomy:manage", // `own` untuk agent
  "enrichment.run": "enrichment:run",
  "media.manage": "media:manage",
} as const;

export type McpCapability = keyof typeof MCP_CAPABILITIES;

/**
 * Apakah aktor boleh melakukan kapabilitas MCP?
 * `ownerId` wajib untuk kapabilitas ber-`own` saat memeriksa objek konkret.
 * Untuk registrasi tool (opts undefined), izin bernilai true jika peran tidak 'no'
 * dan API key mengizinkan aksi terkait.
 */
export function canMcp(
  actor: Actor,
  capability: McpCapability,
  opts?: { ownerId?: string | null },
): boolean {
  const perm = MCP_CAPABILITIES[capability];
  if (opts === undefined) {
    if (effectiveAccess(actor, perm) === "no") return false;
    return apiKeyAllows(actor, perm);
  }
  return can(actor, perm, opts);
}

/** Tegaskan kapabilitas — lempar `ForbiddenError` bila tak boleh. */
export function assertMcp(
  actor: Actor,
  capability: McpCapability,
  opts?: { ownerId?: string | null; message?: string },
): void {
  if (!canMcp(actor, capability, opts)) {
    throw new ForbiddenError(
      opts?.message ?? `Agen tidak punya kapabilitas: ${capability}`,
    );
  }
}

/**
 * Kapabilitas yang **sengaja TIDAK dibuka** untuk MCP (dokumentasi eksplisit).
 * Bila ada tool yang mencoba memakainya → itu bug kebijakan, bukan fitur.
 */
export const MCP_FORBIDDEN = [
  "question:delete",
  "question:hardDelete",
  "question:setReady", // ubah status disetujui
  "question:archive",
  "bundle:manage",
  "reference:manage", // buat sumber/event massal — di luar cakupan agent
  "settings:manage",
  "user:manage",
] as const;

export { ForbiddenError };
