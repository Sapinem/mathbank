#!/usr/bin/env tsx
/**
 * Penjaga deklarasi otorisasi route (CONSTRAINT #35) — Fase A.
 *
 * Setiap method route WAJIB menyatakan otoritasnya secara eksplisit lewat
 * `authz` pada `wrapRoute` (atau terdaftar di allowlist beralasan untuk route
 * yang sengaja tidak memakai pembungkus). Pemeriksa ini memastikan deklarasi
 * itu **benar**, bukan sekadar ada:
 *
 *  1. Tepat satu `authz` per method; `kind` dikenal; tanpa kunci warisan
 *     (`permission`/`auth`).
 *  2. `public` wajib `reason` dan path-nya disetujui di `PUBLIC_ROUTES`.
 *  3. `route`/`routeGate`: izin ada di matriks PERMISSIONS **dan** tidak
 *     ber-`own` untuk peran mana pun — `assertCan` di route tanpa `ownerId`
 *     selalu menolak (kambuh T-M4-3).
 *  4. `service`: `enforcedIn` = `path.ts:namaFungsi`, berkas & fungsi ada, dan
 *     badan fungsi benar-benar memuat pemeriksaan otorisasi — supaya komentar
 *     tak bisa basi (pernah terjadi di `bundles/route.ts`).
 *  5. Method non-wrap hanya dari allowlist; setiap method wrap punya skema
 *     `query`/`body`/`params` (CONSTRAINT #22).
 *
 * Pemakaian: `pnpm lint:authz` (dipanggil juga dari `pnpm check`).
 * `--list` mencetak inventaris lengkap.
 */
import {
  HTTP_METHODS,
  scanRoutes,
  verifyAuthz,
  type RouteMethod,
} from "../src/lib/api/route-inventory";

function label(m: RouteMethod): string {
  const kind = m.authz ? m.authz.kind : "(manual)";
  const detail =
    m.authz?.kind === "route"
      ? ` ${m.authz.permission}`
      : m.authz?.kind === "service"
        ? ` ${m.authz.enforcedIn}`
        : "";
  return `${m.method.padEnd(7)} ${m.path.padEnd(44)} ${kind}${detail}`;
}

const routes = scanRoutes();
const methods = routes.flatMap((r) => r.methods);
const problems = verifyAuthz(routes);

if (process.argv.includes("--list")) {
  for (const route of routes) {
    for (const m of route.methods) console.log(label(m));
  }
  console.log("");
}

const byKind = new Map<string, number>();
for (const m of methods) {
  const kind = m.authz?.kind ?? `manual:${m.shape}`;
  byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
}
const summary = [...byKind.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, n]) => `${k}=${n}`)
  .join(" · ");

if (problems.length === 0) {
  console.log(
    `✅ Otorisasi: ${methods.length} method di ${routes.length} route punya deklarasi sah (${summary}).`,
  );
  console.log(
    `   Method HTTP yang dikenal: ${HTTP_METHODS.join(", ")}.`,
  );
  process.exit(0);
}

console.error("⛔ Pelanggaran deklarasi otorisasi (CONSTRAINT #35):\n");
for (const p of problems) {
  const where = p.method ? `${p.method} ` : "";
  console.error(`  ${p.file}\n    ${where}← ${p.message}`);
}
console.error(
  "\n" +
    problems.length +
    " pelanggaran. Perbaiki deklarasi \`authz\`; jangan menambah pengecualian " +
    "tanpa alasan tertulis di src/lib/api/route-inventory.ts.",
);
process.exit(1);
