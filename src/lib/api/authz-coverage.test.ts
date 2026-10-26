import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  MANUAL_ROUTES,
  PUBLIC_ROUTES,
  scanRoutes,
  verifyAuthz,
  type AuthzProblem,
  type RouteFile,
  type RouteMethod,
} from "./route-inventory";

/**
 * Penjaga deklarasi otorisasi (CONSTRAINT #35) — sisi TES.
 *
 * Angka TIDAK ditulis di sini: seluruh hitungan diturunkan dari filesystem
 * lewat `scanRoutes()`, sehingga menambah route tidak menuntut menyunting tes.
 * Pemeriksa yang sama dipakai `pnpm lint:authz` (scripts/check-authz.ts).
 */

function countRouteFiles(dir: string): number {
  let total = 0;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) total += countRouteFiles(abs);
    else if (entry === "route.ts") total += 1;
  }
  return total;
}

const routes = scanRoutes();
const methods = routes.flatMap((r) => r.methods);

/* ── Fixture untuk kasus negatif ──────────────────────────────────────── */

const FIXTURE_FILE = "src/app/api/uji/route.ts";
const FIXTURE_PATH = "/api/uji";

/** Bentuk longgar supaya tes bisa menyusun deklarasi yang justru DILARANG. */
function method(over: Record<string, unknown> = {}): RouteMethod {
  return {
    method: "GET",
    shape: "wrap",
    authz: { kind: "authenticated" },
    hasSchema: true,
    optionKeys: ["authz", "query"],
    file: FIXTURE_FILE,
    path: FIXTURE_PATH,
    ...over,
  } as RouteMethod;
}

function one(m: RouteMethod): AuthzProblem[] {
  const file: RouteFile = { file: FIXTURE_FILE, path: FIXTURE_PATH, methods: [m], problems: [] };
  return verifyAuthz([file]);
}

function messages(problems: AuthzProblem[]): string {
  return problems.map((p) => p.message).join(" | ");
}

/* ── Inventaris nyata ─────────────────────────────────────────────────── */

describe("Inventaris route (src/lib/api/route-inventory.ts)", () => {
  it("memuat SETIAP berkas route.ts di src/app/api", () => {
    expect(routes.length).toBe(countRouteFiles(join("src", "app", "api")));
    expect(routes.length).toBeGreaterThan(0);
  });

  it("setiap berkas punya minimal satu method HTTP", () => {
    expect(routes.filter((r) => r.methods.length === 0)).toEqual([]);
  });

  it("tidak ada method yang terdaftar dua kali", () => {
    const keys = methods.map((m) => `${m.method} ${m.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("setiap method wrapRoute punya authz bertipe dikenal", () => {
    const wrapped = methods.filter((m) => m.shape === "wrap");
    expect(wrapped.length).toBeGreaterThan(0);
    expect(wrapped.filter((m) => m.authz === null)).toEqual([]);
    const kinds = new Set(["public", "authenticated", "route", "service"]);
    expect(wrapped.filter((m) => !kinds.has(m.authz!.kind))).toEqual([]);
  });

  it("setiap method non-wrap terdaftar di MANUAL_ROUTES", () => {
    const manual = methods.filter((m) => m.shape !== "wrap");
    expect(manual.length).toBeGreaterThan(0);
    const unknown = manual.filter((m) => !(`${m.method} ${m.path}` in MANUAL_ROUTES));
    expect(unknown.map((m) => `${m.method} ${m.path}`)).toEqual([]);
  });

  it("setiap method wrapRoute punya skema query/body/params (CONSTRAINT #22)", () => {
    expect(methods.filter((m) => m.shape === "wrap" && !m.hasSchema)).toEqual([]);
  });

  it("tidak ada route publik di luar allowlist", () => {
    const publik = methods.filter((m) => m.authz?.kind === "public");
    expect(publik.length).toBeGreaterThan(0);
    expect(publik.filter((m) => !(`${m.method} ${m.path}` in PUBLIC_ROUTES))).toEqual([]);
  });

  it("seluruh inventaris lolos pemeriksa otorisasi", () => {
    expect(verifyAuthz(routes)).toEqual([]);
  });
});

/* ── Regresi pemindai ─────────────────────────────────────────────────── */

describe("Pemindai tahan komentar & objek bersarang", () => {
  function find(path: string, name: string): RouteMethod {
    const route = routes.find((r) => r.path === path);
    expect(route, `route ${path} tidak ada`).toBeDefined();
    const m = route!.methods.find((x) => x.method === name);
    expect(m, `${name} ${path} tidak ada`).toBeDefined();
    return m!;
  }

  it("komentar setelah koma tidak menelan `authz` (POST /api/questions)", () => {
    // Dulu regex berhenti di `});` pertama / kunci jadi "// ~20 burst, 30/menit".
    const m = find("/api/questions", "POST");
    expect(m.authz).toEqual({ kind: "route", permission: "question:create" });
    expect(m.optionKeys).toContain("authz");
  });

  it("objek rateLimit bersarang tidak memotong opsi (POST /api/questions/batch)", () => {
    const m = find("/api/questions/batch", "POST");
    expect(m.authz?.kind).toBe("service");
    expect(m.hasSchema).toBe(true);
  });

  it("service dengan routeGate terbaca utuh (POST /api/bundles)", () => {
    const m = find("/api/bundles", "POST");
    expect(m.authz).toEqual({
      kind: "service",
      enforcedIn: "src/lib/services/bundle-shared.ts:assertBundleCreate",
      routeGate: "question:view",
    });
  });

  it("delegasi Better Auth dikenali sebagai delegate (auth/[...all])", () => {
    const route = routes.find((r) => r.path === "/api/auth/[...all]");
    expect(route?.methods.map((m) => `${m.method}:${m.shape}`).sort()).toEqual([
      "GET:delegate",
      "POST:delegate",
    ]);
  });
});

/* ── Kasus negatif: pemeriksa harus MENOLAK ───────────────────────────── */

describe("Pemeriksa menolak deklarasi yang salah", () => {
  it("public tanpa reason", () => {
    const problems = one(method({ authz: { kind: "public", reason: "" } }));
    expect(messages(problems)).toContain("tanpa reason");
  });

  it("public pada path yang belum disetujui", () => {
    const problems = one(
      method({ authz: { kind: "public", reason: "Uji saja, bukan keputusan nyata." } }),
    );
    expect(messages(problems)).toContain("belum disetujui");
  });

  it("public pada path yang disetujui → lolos", () => {
    const problems = one(
      method({
        path: "/api/dev/demo-status",
        authz: { kind: "public", reason: "Dibaca halaman /login sebelum ada sesi." },
      }),
    );
    expect(problems).toEqual([]);
  });

  it("izin ber-`own` sebagai gerbang route (kambuh T-M4-3)", () => {
    const problems = one(method({ authz: { kind: "route", permission: "question:edit" } }));
    expect(messages(problems)).toContain("own");
    expect(messages(problems)).toContain("#35");
  });

  it("routeGate ber-`own` juga ditolak", () => {
    const problems = one(
      method({
        authz: {
          kind: "service",
          enforcedIn: "src/lib/services/question-write.ts:updateQuestion",
          routeGate: "bundle:manage",
        },
      }),
    );
    expect(messages(problems)).toContain("routeGate");
  });

  it("izin yang tidak ada di matriks", () => {
    const problems = one(method({ authz: { kind: "route", permission: "nope:read" } }));
    expect(messages(problems)).toContain("tidak ada di matriks");
  });

  it("enforcedIn bukan bentuk path.ts:namaFungsi", () => {
    const problems = one(method({ authz: { kind: "service", enforcedIn: "bukan-format" } }));
    expect(messages(problems)).toContain("tidak berbentuk");
  });

  it("enforcedIn menunjuk berkas yang tidak ada", () => {
    const problems = one(
      method({ authz: { kind: "service", enforcedIn: "src/lib/services/tidak-ada.ts:foo" } }),
    );
    expect(messages(problems)).toContain("tidak ditemukan");
  });

  it("enforcedIn menunjuk fungsi yang tidak ada", () => {
    const problems = one(
      method({
        authz: {
          kind: "service",
          enforcedIn: "src/lib/services/question-write.ts:fungsiHantu",
        },
      }),
    );
    expect(messages(problems)).toContain("fungsi fungsiHantu tidak ditemukan");
  });

  it("fungsi service tanpa pemeriksaan otorisasi (komentar basi)", () => {
    const problems = one(
      method({
        authz: { kind: "service", enforcedIn: "src/lib/api/route-inventory.ts:skipString" },
      }),
    );
    expect(messages(problems)).toContain("tidak memuat pemeriksaan otorisasi");
  });

  it("method wrapRoute tanpa skema", () => {
    const problems = one(method({ hasSchema: false, optionKeys: ["authz"] }));
    expect(messages(problems)).toContain("#22");
  });

  it("method manual di luar allowlist", () => {
    const problems = one(method({ shape: "manual", authz: null }));
    expect(messages(problems)).toContain("di luar allowlist");
  });

  it("method manual yang terdaftar di allowlist → lolos", () => {
    const problems = one(method({ method: "GET", path: "/api/health", shape: "manual", authz: null }));
    expect(problems).toEqual([]);
  });
});
