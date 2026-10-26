/**
 * Penyusun OpenAPI — perilaku saat input TIDAK lengkap.
 *
 * `registry.test.ts` memastikan kontrak nyata utuh; berkas ini memastikan
 * penyusun **melaporkan** kekurangan alih-alih diam-diam menghasilkan spec
 * bolong. Tanpa ini, route baru tanpa entri registry akan lolos.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildOpenApi, openApiPathOf, operationIdOf, type DeclarationLike, type RouteLike } from "./spec";

const decl = (extra: Partial<DeclarationLike> = {}): DeclarationLike => ({
  authz: { kind: "authenticated" },
  query: z.object({ page: z.coerce.number().int().min(1).optional() }),
  params: z.object({ id: z.string().uuid() }),
  status: 200,
  idempotent: false,
  ...extra,
});

const route = (extra: Partial<RouteLike> = {}): RouteLike => ({
  method: "GET",
  path: "/api/questions/[id]",
  shape: "wrap",
  authz: { kind: "route", permission: "question:view" },
  ...extra,
});

describe("buildOpenApi — input tak lengkap", () => {
  it("melaporkan method wrap tanpa deklarasi", () => {
    const { problems, spec } = buildOpenApi({
      routes: [route()],
      declarations: new Map(),
    });
    expect(problems).toContainEqual(expect.stringContaining("deklarasi tidak terbaca"));
    expect(spec.paths).toEqual({});
  });

  it("melaporkan method wrap yang belum punya entri registry", () => {
    const key = "GET /api/tidak-ada";
    const { problems } = buildOpenApi({
      routes: [route({ path: "/api/tidak-ada" })],
      declarations: new Map([[key, decl()]]),
    });
    expect(problems).toContainEqual(expect.stringContaining("belum ada di OPERATIONS"));
  });

  it("melaporkan route non-wrap yang belum punya entri manual", () => {
    const { problems } = buildOpenApi({
      routes: [route({ path: "/api/tidak-ada", shape: "manual" })],
      declarations: new Map(),
    });
    expect(problems).toContainEqual(
      expect.stringContaining("route non-wrap tanpa entri MANUAL_OPERATIONS"),
    );
  });

  it("melaporkan entri registry yatim saat daftar route tidak memuatnya", () => {
    const { problems } = buildOpenApi({ routes: [], declarations: new Map() });
    expect(problems).toContainEqual(expect.stringContaining("ada di OPERATIONS tapi route-nya tidak ada"));
    expect(problems).toContainEqual(
      expect.stringContaining("ada di MANUAL_OPERATIONS tapi route-nya tidak ada"),
    );
  });
});

describe("buildOpenApi — bentuk operasi", () => {
  it("menurunkan parameter query & path dari skema Zod", () => {
    const key = "GET /api/questions/[id]";
    const { spec, problems } = buildOpenApi({
      routes: [route()],
      declarations: new Map([[key, decl()]]),
    });
    // Selain route uji, semua entri registry lain dilaporkan yatim — bukan urusan tes ini.
    expect(problems.length).toBeGreaterThan(0);
    const operation = (spec.paths as Record<string, Record<string, Record<string, unknown>>>)[
      "/api/questions/{id}"
    ].get;
    const parameters = operation.parameters as { name: string; in: string; required: boolean }[];
    expect(parameters.map((p) => `${p.in}:${p.name}`).sort()).toEqual([
      "path:id",
      "query:page",
    ]);
    expect(parameters.find((p) => p.in === "path")?.required).toBe(true);
    expect(parameters.find((p) => p.in === "query")?.required).toBe(false);
  });

  it("menandai operasi idempoten hanya bila deklarasinya begitu", () => {
    const key = "GET /api/questions/[id]";
    const once = buildOpenApi({ routes: [route()], declarations: new Map([[key, decl()]]) });
    const twice = buildOpenApi({
      routes: [route()],
      declarations: new Map([[key, decl({ idempotent: true })]]),
    });
    const metaOf = (result: ReturnType<typeof buildOpenApi>) =>
      ((result.spec.paths as Record<string, Record<string, Record<string, unknown>>>)[
        "/api/questions/{id}"
      ].get["x-mathbank"] as Record<string, unknown>).idempotent;
    // `idempotent` hanya dipancarkan saat true — ketiadaannya berarti "tidak idempoten".
    expect(metaOf(once)).toBeUndefined();
    expect(metaOf(twice)).toBe(true);
  });
});

describe("pembantu jalur & operationId", () => {
  it("mengubah segmen dinamis Next menjadi templating OpenAPI", () => {
    expect(openApiPathOf("/api/questions/[id]")).toBe("/api/questions/{id}");
    expect(openApiPathOf("/api/auth/[...all]")).toBe("/api/auth/{all}");
    expect(openApiPathOf("/api/bundles/[id]/items/[itemId]")).toBe(
      "/api/bundles/{id}/items/{itemId}",
    );
    expect(openApiPathOf("/api/questions")).toBe("/api/questions");
  });

  it("operationId unik untuk method+path yang berbeda", () => {
    const ids = [
      operationIdOf("GET", "/api/questions"),
      operationIdOf("POST", "/api/questions"),
      operationIdOf("GET", "/api/questions/[id]"),
      operationIdOf("DELETE", "/api/bundles/[id]/items/[itemId]"),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
