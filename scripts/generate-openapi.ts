#!/usr/bin/env tsx
/**
 * Generator kontrak OpenAPI 3.1 + tabel endpoint KONTRAK-API (Fase B).
 *
 * Sumber kebenaran (tidak ada yang disalin tangan):
 *  - daftar method + `authz` → `route-inventory.ts` (pemindaian `src/app/api`);
 *  - skema query/body/params + status → `ROUTE_DECLARATION` yang ditempel
 *    `wrapRoute` (skema yang PERSIS dipakai runtime);
 *  - ringkasan/tag/skema respons → `src/lib/api/openapi/registry.ts`.
 *
 * Pemakaian:
 *   pnpm openapi:generate            tulis public/openapi.json + blok KONTRAK-API
 *   pnpm openapi:check               gagal bila artefak/dokumen menyimpang
 *   tsx scripts/generate-openapi.ts --list   cetak inventaris operasi
 */
// Wajib paling awal: modul route (lewat route-wrapper) membaca DATABASE_URL saat
// dievaluasi, dan ESM mengevaluasi seluruh import sebelum badan modul ini jalan.
import "./openapi-env";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { scanRoutes, type RouteMethod } from "../src/lib/api/route-inventory";
import { routeDeclarationOf } from "../src/lib/api/route-wrapper";
import { buildOpenApi, type DeclarationLike } from "../src/lib/api/openapi/spec";
import { TAGS_FOR_SPEC } from "../src/lib/api/openapi/spec";

const SPEC_PATH = join("public", "openapi.json");
const DOCS_PATH = join("docs", "KONTRAK-API.md");
const BEGIN = "<!-- BEGIN:GENERATED:endpoints -->";
const END = "<!-- END:GENERATED:endpoints -->";

type Json = Record<string, unknown>;

/** Impor modul route (tsx menangani .ts) lalu ambil deklarasinya. */
async function declarationOf(
  file: string,
  method: RouteMethod,
): Promise<DeclarationLike | null> {
  const mod = (await import(pathToFileURL(join(process.cwd(), file)).href)) as Json;
  return routeDeclarationOf(mod[method.method]);
}

async function collectDeclarations(
  routes: ReturnType<typeof scanRoutes>,
): Promise<Map<string, DeclarationLike>> {
  const out = new Map<string, DeclarationLike>();
  for (const route of routes) {
    for (const method of route.methods) {
      if (method.shape !== "wrap") continue;
      const declared = await declarationOf(route.file, method);
      if (declared) out.set(`${method.method} ${method.path}`, declared);
    }
  }
  return out;
}

/** Satu baris "izin" untuk tabel dokumen. */
function authzLabel(op: Json): string {
  const meta = (op["x-mathbank"] ?? {}) as Json;
  switch (meta.authz) {
    case "public":
      return "publik";
    case "authenticated":
      return "(login)";
    case "route":
      return `\`${String(meta.permission)}\``;
    case "service":
      return meta.routeGate ? `service (gerbang \`${String(meta.routeGate)}\`)` : "service";
    case "manual":
      return "manual";
    default:
      return "—";
  }
}

const MANUAL_SECURITY_LABEL: Record<string, string> = {
  none: "publik",
  bearer: "API key",
  delegated: "Better Auth",
};

/** Tabel markdown per tag, dihasilkan dari spec. */
interface DocRow {
  path: string;
  verb: string;
  label: string;
  summary: string;
  /** Penanda konkurensi optimistik (ADR-0030): If-Match / ETag / —. */
  version: string;
}

function labelOf(operation: Json): string {
  const meta = (operation["x-mathbank"] ?? {}) as Json;
  if (meta.authz === "manual") {
    if (typeof meta.accessLabel === "string") return meta.accessLabel;
    return MANUAL_SECURITY_LABEL[String(meta.security)] ?? "manual";
  }
  return authzLabel(operation);
}

function renderDocsTable(spec: Json): string {
  const paths = spec.paths as Record<string, Record<string, Json>>;
  const byTag = new Map<string, DocRow[]>();

  for (const [path, operations] of Object.entries(paths)) {
    for (const [verb, operation] of Object.entries(operations)) {
      const tag = String((operation.tags as string[] | undefined)?.[0] ?? "system");
      const meta = (operation["x-mathbank"] ?? {}) as Json;
      const row: DocRow = {
        path,
        verb: verb.toUpperCase(),
        label: labelOf(operation),
        summary: String(operation.summary ?? ""),
        version: meta.ifMatch ? "If-Match" : meta.etag ? "ETag" : "—",
      };
      const list = byTag.get(tag) ?? [];
      list.push(row);
      byTag.set(tag, list);
    }
  }

  const order = (TAGS_FOR_SPEC as Json[]).map((t) => String(t.name));
  const blocks: string[] = [];
  for (const tag of order) {
    const rows = byTag.get(tag);
    if (!rows || rows.length === 0) continue;
    const description = String(
      (TAGS_FOR_SPEC as Json[]).find((t) => t.name === tag)?.description ?? "",
    );
    rows.sort((a, b) => a.path.localeCompare(b.path) || a.verb.localeCompare(b.verb));
    blocks.push(
      [
        `### ${tag} — ${description}`.trimEnd(),
        "",
        "| Method | Path | Izin | Versi | Ringkasan |",
        "|--------|------|:----:|:-----:|-----------|",
        ...rows.map(
          (row) =>
            `| \`${row.verb}\` | \`${row.path}\` | ${row.label} | ${row.version} | ${row.summary} |`,
        ),
      ].join("\n"),
    );
  }
  return blocks.join("\n\n");
}

function replaceBlock(text: string, body: string): string {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start < 0 || end < 0) {
    throw new Error(`Penanda ${BEGIN} / ${END} tidak ditemukan di ${DOCS_PATH}.`);
  }
  return text.slice(0, start + BEGIN.length) + "\n" + body + "\n" + text.slice(end);
}

async function main(): Promise<void> {
  const files = scanRoutes();
  const routes = files.flatMap((file) => file.methods);
  const declarations = await collectDeclarations(files);
  const { spec, problems } = buildOpenApi({ routes, declarations });

  if (process.argv.includes("--list")) {
    const paths = spec.paths as Record<string, Record<string, Json>>;
    for (const [path, operations] of Object.entries(paths)) {
      for (const [verb, operation] of Object.entries(operations)) {
        console.log(
          `${verb.toUpperCase().padEnd(6)} ${path.padEnd(44)} ${authzLabel(operation)}`.trimEnd(),
        );
      }
    }
  }

  if (problems.length > 0) {
    console.error("⛔ Kontrak OpenAPI belum lengkap:\n");
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      "\nTambahkan entri di src/lib/api/openapi/registry.ts " +
        "(OPERATIONS untuk wrapRoute, MANUAL_OPERATIONS untuk route non-wrap).",
    );
    process.exit(1);
  }

  const json = JSON.stringify(spec, null, 2) + "\n";
  const docs = replaceBlock(readFileSync(DOCS_PATH, "utf8"), renderDocsTable(spec));

  const check = process.argv.includes("--check");
  if (check) {
    const drift: string[] = [];
    let current = "";
    try {
      current = readFileSync(SPEC_PATH, "utf8");
    } catch {
      drift.push(`${SPEC_PATH} belum ada`);
    }
    if (current && current !== json) drift.push(`${SPEC_PATH} menyimpang dari registry`);
    if (readFileSync(DOCS_PATH, "utf8") !== docs) {
      drift.push(`${DOCS_PATH} §4 menyimpang dari registry`);
    }
    if (drift.length > 0) {
      console.error("⛔ Kontrak OpenAPI menyimpang:\n");
      for (const item of drift) console.error(`  ${item}`);
      console.error("\nJalankan `pnpm openapi:generate` lalu commit hasilnya.");
      process.exit(1);
    }
    console.log(`✅ OpenAPI sinkron: ${SPEC_PATH} + ${DOCS_PATH} §4.`);
    return;
  }

  writeFileSync(SPEC_PATH, json);
  writeFileSync(DOCS_PATH, docs);
  const paths = spec.paths as Record<string, Record<string, Json>>;
  const pathCount = Object.keys(paths).length;
  const operationCount = Object.values(paths).reduce(
    (total, operations) => total + Object.keys(operations).length,
    0,
  );
  console.log(
    `✅ ${SPEC_PATH} ditulis (${operationCount} operasi / ${pathCount} path) + ${DOCS_PATH} §4 diperbarui.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
