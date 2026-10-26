/**
 * Kontrak OpenAPI — uji **relasional**, bukan uji salinan.
 *
 * Yang dijamin di sini:
 *  1. registry ↔ filesystem: tak ada method tanpa entri, tak ada entri tanpa method;
 *  2. tiap entri punya metadata yang cukup (ringkasan, tag sah, kode galat wajar);
 *  3. penyusun spec menghasilkan OpenAPI 3.1 yang sah bentuknya untuk SELURUH
 *     operasi (tanpa impor modul route, jadi tanpa DB);
 *  4. tabel §4 KONTRAK-API memuat satu baris per operasi (tidak disunting tangan).
 *
 * Yang TIDAK diuji di sini: kesamaan byte `public/openapi.json` dengan hasil
 * generator (butuh impor route + skema Zod asli) — itu tugas `pnpm openapi:check`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { scanRoutes, type RouteMethod } from "../route-inventory";
import { MANUAL_OPERATIONS, OPERATIONS } from "./registry";
import { buildOpenApi, TAGS_FOR_SPEC, type DeclarationLike } from "./spec";

const ROOT = process.cwd();
const routes: RouteMethod[] = scanRoutes(ROOT).flatMap((file) => file.methods);
const wrapRoutes = routes.filter((route) => route.shape === "wrap");
const manualRoutes = routes.filter((route) => route.shape !== "wrap");
const keyOf = (route: { method: string; path: string }): string => `${route.method} ${route.path}`;

/** Deklarasi sintetis: bentuknya sama dengan yang ditempel `wrapRoute`. */
function syntheticDeclarations(): Map<string, DeclarationLike> {
  const map = new Map<string, DeclarationLike>();
  for (const route of wrapRoutes) {
    // Parameter path diambil dari nama segmen dinamis (`[id]` → `id`), supaya
    // uji ini tidak bergantung pada skema Zod asli tiap route.
    const names = [...route.path.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
    const params = z.object(
      Object.fromEntries(names.map((name) => [name, z.string()])),
    );
    map.set(keyOf(route), {
      authz: route.authz ?? { kind: "authenticated" },
      query: z.object({}).optional(),
      body: z.object({}).optional(),
      params,
      status: route.method === "POST" ? 201 : 200,
      idempotent: route.method === "POST",
    });
  }
  return map;
}

function collectKeys(value: unknown, key: string, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, key, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === key) out.push(k);
      collectKeys(v, key, out);
    }
  }
  return out;
}

/**
 * Status non-2xx yang sengaja memakai envelope `{ data }`: probe melaporkan
 * keadaan sistem lewat kode status (200/503), bukan lewat envelope galat.
 * Daftar ini harus tetap kecil dan beralasan — jangan tambah tanpa membaca route.
 */
const DATA_BEARING_NON_2XX = new Set(["GET /api/health", "GET /api/ready"]);

const built = buildOpenApi({ routes, declarations: syntheticDeclarations() });
const spec = built.spec as {
  openapi: string;
  paths: Record<string, Record<string, Record<string, unknown>>>;
  components: Record<string, Record<string, unknown>>;
};

const operations = Object.entries(spec.paths).flatMap(([path, verbs]) =>
  Object.entries(verbs).map(([verb, operation]) => ({ path, verb, operation })),
);

describe("registry ↔ filesystem", () => {
  it("setiap method wrap punya entri OPERATIONS", () => {
    const missing = wrapRoutes.map(keyOf).filter((key) => !(key in OPERATIONS));
    expect(missing).toEqual([]);
  });

  it("setiap entri OPERATIONS punya method wrap di filesystem", () => {
    const known = new Set(wrapRoutes.map(keyOf));
    const orphans = Object.keys(OPERATIONS).filter((key) => !known.has(key));
    expect(orphans).toEqual([]);
  });

  it("setiap method non-wrap punya entri MANUAL_OPERATIONS", () => {
    const missing = manualRoutes.map(keyOf).filter((key) => !(key in MANUAL_OPERATIONS));
    expect(missing).toEqual([]);
  });

  it("setiap entri MANUAL_OPERATIONS punya method non-wrap di filesystem", () => {
    const known = new Set(manualRoutes.map(keyOf));
    const orphans = Object.keys(MANUAL_OPERATIONS).filter((key) => !known.has(key));
    expect(orphans).toEqual([]);
  });

  it("jumlah operasi = jumlah method di filesystem", () => {
    expect(Object.keys(OPERATIONS).length + Object.keys(MANUAL_OPERATIONS).length).toBe(
      routes.length,
    );
    expect(operations).toHaveLength(routes.length);
  });
});

describe("metadata registry", () => {
  const entries = Object.entries(OPERATIONS);

  it("ringkasan tidak kosong dan satu baris", () => {
    for (const [key, doc] of entries) {
      expect(doc.summary.trim(), key).not.toBe("");
      expect(doc.summary, key).not.toContain("\n");
    }
  });

  it("tag selalu terdaftar di TAGS_FOR_SPEC", () => {
    const known = new Set(TAGS_FOR_SPEC.map((tag) => String(tag.name)));
    for (const [key, doc] of entries) {
      expect(doc.tags.length, key).toBeGreaterThan(0);
      for (const tag of doc.tags) expect(known.has(tag), `${key} → ${tag}`).toBe(true);
    }
    for (const [key, doc] of Object.entries(MANUAL_OPERATIONS)) {
      expect(doc.tags.length, key).toBeGreaterThan(0);
      for (const tag of doc.tags) expect(known.has(tag), `${key} → ${tag}`).toBe(true);
    }
  });

  it("kode galat tambahan berupa status HTTP yang sah", () => {
    for (const [key, doc] of entries) {
      for (const status of doc.extraErrors ?? []) {
        expect(status, key).toBeGreaterThanOrEqual(400);
        expect(status, key).toBeLessThanOrEqual(599);
      }
    }
  });

  it("respons sukses berupa skema Zod", () => {
    for (const [key, doc] of entries) {
      expect(doc.response, key).toBeInstanceOf(z.ZodType);
    }
  });
});

describe("buildOpenApi", () => {
  it("lengkap — tanpa masalah", () => {
    expect(built.problems).toEqual([]);
  });

  it("memakai OpenAPI 3.1 dan tidak membocorkan $schema", () => {
    expect(spec.openapi).toBe("3.1.0");
    expect(collectKeys(spec, "$schema")).toEqual([]);
  });

  it("mendeklarasikan skema keamanan yang dipakai", () => {
    const schemes = Object.keys(spec.components.securitySchemes ?? {});
    expect(schemes.sort()).toEqual(["apiKey", "sessionCookie"]);
  });

  it("setiap operasi punya operationId unik, ringkasan, tag, dan x-mathbank.authz", () => {
    const ids = operations.map(({ operation }) => String(operation.operationId));
    expect(new Set(ids).size).toBe(ids.length);
    for (const { path, verb, operation } of operations) {
      const label = `${verb.toUpperCase()} ${path}`;
      expect(String(operation.summary).trim(), label).not.toBe("");
      expect((operation.tags as string[]).length, label).toBeGreaterThan(0);
      expect((operation["x-mathbank"] as Record<string, unknown>).authz, label).toBeTruthy();
    }
  });

  it("route publik tidak menuntut kredensial, sisanya menuntut sesi atau API key", () => {
    for (const { path, verb, operation } of operations) {
      const label = `${verb.toUpperCase()} ${path}`;
      const meta = operation["x-mathbank"] as Record<string, unknown>;
      const security = operation.security as unknown[] | undefined;
      if (meta.authz === "public") {
        expect(security, label).toEqual([]);
      } else if (meta.authz === "manual") {
        // `none` (probe/dev) dan `delegated` (Better Auth) tidak memakai
        // skema keamanan MathBank — pustaka menangani kredensialnya sendiri.
        expect(security, label).toEqual(meta.security === "bearer" ? [{ apiKey: [] }] : []);
      } else {
        expect(security, label).toEqual([{ sessionCookie: [] }, { apiKey: [] }]);
      }
    }
  });

  it("setiap parameter path punya deklarasi", () => {
    for (const { path, verb, operation } of operations) {
      const expected = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
      const declared = ((operation.parameters as { name: string; in: string }[] | undefined) ?? [])
        .filter((parameter) => parameter.in === "path")
        .map((parameter) => parameter.name);
      expect(declared.sort(), `${verb.toUpperCase()} ${path}`).toEqual(expected.sort());
    }
  });

  it("envelope galat tidak pernah memuat data (CONSTRAINT #17)", () => {
    for (const { path, verb, operation } of operations) {
      const responses = operation.responses as Record<
        string,
        { content?: Record<string, { schema?: unknown }> }
      >;
      for (const [status, response] of Object.entries(responses)) {
        if (!status.startsWith("4") && !status.startsWith("5")) continue;
        const schema = response.content?.["application/json"]?.schema as
          | { properties?: Record<string, unknown>; required?: string[] }
          | undefined;
        if (!schema?.properties) continue;
        const label = `${verb.toUpperCase()} ${path} → ${status}`;
        if (schema.properties.data) {
          // Probe melaporkan keadaan lewat kode status, bukan galat: 503 dari
          // /api/health memang membawa `{ data: { status } }` (lihat route-nya).
          expect(DATA_BEARING_NON_2XX.has(`${verb.toUpperCase()} ${path}`), label).toBe(true);
          continue;
        }
        // Envelope MathBank: hanya `error` (tanpa `data`). Respons protokol lain
        // (mis. JSON-RPC dari /api/mcp) boleh punya bentuk sendiri asal tanpa `data`.
        if (schema.properties.error && Object.keys(schema.properties).length === 1) {
          expect(schema.required, label).toEqual(["error"]);
        }
      }
    }
  });
});

describe("artefak & dokumen", () => {
  it("public/openapi.json ada dan bentuknya cocok dengan kode", () => {
    const artifact = JSON.parse(readFileSync(join(ROOT, "public", "openapi.json"), "utf8")) as {
      openapi: string;
      paths: Record<string, Record<string, unknown>>;
    };
    expect(artifact.openapi).toBe("3.1.0");
    const artifactKeys = Object.keys(artifact.paths)
      .flatMap((path) => Object.keys(artifact.paths[path]).map((verb) => `${verb} ${path}`))
      .sort();
    const codeKeys = operations
      .map(({ path, verb }) => `${verb} ${path}`)
      .sort();
    expect(artifactKeys).toEqual(codeKeys);
  });

  it("tabel §4 KONTRAK-API memuat satu baris per operasi", () => {
    const doc = readFileSync(join(ROOT, "docs", "KONTRAK-API.md"), "utf8");
    const begin = doc.indexOf("<!-- BEGIN:GENERATED:endpoints -->");
    const end = doc.indexOf("<!-- END:GENERATED:endpoints -->");
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(begin);
    const block = doc.slice(begin, end);
    const rows = block.split("\n").filter((line) => line.startsWith("| `"));
    expect(rows).toHaveLength(operations.length);
    expect(new Set(rows).size).toBe(rows.length);
  });

  it("header KONTRAK-API menyebut jumlah route & method yang benar", () => {
    const doc = readFileSync(join(ROOT, "docs", "KONTRAK-API.md"), "utf8");
    const routeFiles = scanRoutes(ROOT).length;
    expect(doc).toContain(`${routeFiles} route handler`);
    expect(doc).toContain(`${routes.length} method`);
  });
});
