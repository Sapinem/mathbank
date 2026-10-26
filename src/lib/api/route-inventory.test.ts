/**
 * Pemindai route — diuji dengan **berkas route sungguhan** di direktori sementara.
 *
 * Yang dijaga: pemindai bekerja pada teks (bukan AST), jadi ia harus tahan
 * terhadap komentar, string, dan objek bersarang — dan tetap **melaporkan**
 * berkas yang tak bisa dipastikan, bukan melewatinya diam-diam.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanRoutes, verifyAuthz } from "./route-inventory";

let root = "";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "mathbank-routes-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Tulis berkas di bawah src/app/api pada root sementara. */
function writeRoute(relativePath: string, body: string): void {
  const absolute = join(root, "src", "app", "api", relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, body);
}

function handler(options: string, method = "GET"): string {
  return (
    "export const " +
    method +
    " = wrapRoute({ " +
    options +
    " }, async () => Response.json({ data: {} }));\n"
  );
}

/** Pindai satu berkas dan kembalikan method pertamanya. */
function scanOne(options: string, method = "GET") {
  writeRoute("probe/route.ts", handler(options, method));
  const [file] = scanRoutes(root);
  return file.methods[0];
}

function messages(): string[] {
  return verifyAuthz(scanRoutes(root), root).map((problem) => problem.message);
}

describe("scanRoutes — membaca deklarasi", () => {
  it("membaca method, bentuk, path, dan authz", () => {
    const method = scanOne('authz: { kind: "authenticated" }, query: z.object({})');
    expect(method).toMatchObject({
      method: "GET",
      shape: "wrap",
      path: "/api/probe",
      hasSchema: true,
    });
    expect(method.authz).toEqual({ kind: "authenticated" });
  });

  it("path mengikuti struktur direktori, termasuk segmen dinamis", () => {
    writeRoute("things/[id]/route.ts", handler('authz: { kind: "authenticated" }'));
    expect(scanRoutes(root)[0].path).toBe("/api/things/[id]");
  });

  it("mengabaikan berkas selain route.ts", () => {
    writeRoute("probe/handler.ts", handler('authz: { kind: "authenticated" }'));
    expect(scanRoutes(root)).toEqual([]);
  });

  it("mengembalikan daftar kosong bila direktori route tidak ada", () => {
    expect(scanRoutes(join(root, "tidak-ada"))).toEqual([]);
  });

  it("komentar ber-kolon di antara opsi tidak menelan authz", () => {
    const method = scanOne(
      [
        "rateLimit: { limit: 10 },",
        "// catatan: bukan authz, hanya prosa",
        'authz: { kind: "authenticated" },',
      ].join("\n"),
    );
    expect(method.optionKeys).toContain("authz");
    expect(method.authz).toEqual({ kind: "authenticated" });
  });

  it("teks authz di dalam string bukan deklarasi", () => {
    const method = scanOne(
      'notes: "authz: { kind: public, reason: palsu }", authz: { kind: "authenticated" }',
    );
    expect(method.authz).toEqual({ kind: "authenticated" });
  });

  it("teks authz di dalam komentar blok bukan deklarasi", () => {
    const method = scanOne(
      '/* authz: { kind: "public", reason: "palsu" } */ authz: { kind: "authenticated" }',
    );
    expect(method.authz).toEqual({ kind: "authenticated" });
  });

  it("membaca service beserta routeGate-nya", () => {
    const method = scanOne(
      'authz: { kind: "service", enforcedIn: "src/lib/services/x.ts:update", routeGate: "question:view" }',
    );
    expect(method.authz).toEqual({
      kind: "service",
      enforcedIn: "src/lib/services/x.ts:update",
      routeGate: "question:view",
    });
  });

  it("membaca public beserta alasannya", () => {
    const method = scanOne('authz: { kind: "public", reason: "probe monitoring" }');
    expect(method.authz).toEqual({ kind: "public", reason: "probe monitoring" });
  });

  it("string tak tertutup tidak membuat pemindai menggantung", () => {
    writeRoute("probe/route.ts", 'const catatan = "tidak ditutup;\n');
    expect(scanRoutes(root)).toHaveLength(1);
    expect(scanRoutes(root)[0].methods).toEqual([]);
  });
});

describe("verifyAuthz — berkas cacat dilaporkan", () => {
  it("menolak dua authz pada satu method", () => {
    scanOne('authz: { kind: "authenticated" }, authz: { kind: "authenticated" }');
    expect(messages()).toContainEqual(expect.stringContaining("wajib tepat satu"));
  });

  it("menolak kunci warisan permission/auth", () => {
    scanOne('permission: "question:view", authz: { kind: "route", permission: "question:view" }');
    expect(messages()).toContainEqual(expect.stringContaining("kunci warisan"));
  });

  it("menolak spread pada opsi wrapRoute", () => {
    scanOne('...dasar, authz: { kind: "authenticated" }');
    expect(messages()).toContainEqual(expect.stringContaining("memuat spread"));
  });

  it("menolak spread di dalam authz", () => {
    scanOne('authz: { ...dasar, kind: "authenticated" }');
    expect(messages()).toContainEqual(expect.stringContaining("authz memuat spread"));
  });

  it("menolak kind yang bukan string literal", () => {
    scanOne("authz: { kind: JENIS }");
    expect(messages()).toContainEqual(expect.stringContaining("authz.kind wajib string literal"));
  });

  it("menolak kind yang tidak dikenal", () => {
    scanOne('authz: { kind: "superuser" }');
    expect(messages()).toContainEqual(expect.stringContaining("tidak dikenal"));
  });

  it("menolak authz yang bukan objek literal", () => {
    scanOne("authz: AUTHZ");
    expect(messages()).toContainEqual(expect.stringContaining("authz harus objek literal"));
  });

  it("menolak kunci ganda di dalam authz", () => {
    scanOne('authz: { kind: "authenticated", kind: "public" }');
    expect(messages()).toContainEqual(expect.stringContaining("kunci ganda"));
  });

  it("menolak route.ts tanpa method HTTP", () => {
    writeRoute("probe/route.ts", "// tidak ada handler\n");
    expect(messages()).toContainEqual(expect.stringContaining("route tanpa method HTTP"));
  });

  it("menolak method yang diekspor dua kali", () => {
    writeRoute(
      "probe/route.ts",
      handler('authz: { kind: "authenticated" }') + handler('authz: { kind: "authenticated" }'),
    );
    expect(messages()).toContainEqual(expect.stringContaining("lebih dari sekali"));
  });

  it("menolak argumen wrapRoute yang bukan objek literal", () => {
    writeRoute("probe/route.ts", "export const GET = wrapRoute(opsi, async () => {});\n");
    expect(messages()).toContainEqual(
      expect.stringContaining("argumen wrapRoute bukan objek literal"),
    );
  });

  it("menerima berkas yang sah tanpa keluhan", () => {
    scanOne('authz: { kind: "authenticated" }, query: z.object({})');
    expect(messages()).toEqual([]);
  });
});

/** Tulis berkas sembarang di bawah root sementara (mis. berkas service). */
function writeFileAt(relativePath: string, body: string): void {
  const absolute = join(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, body);
}

describe("verifyAuthz — enforcedIn menunjuk kode nyata", () => {
  const SERVICE = "src/lib/services/probe.ts";

  it("menerima fungsi yang benar-benar memanggil assertCan", () => {
    writeFileAt(
      SERVICE,
      "export async function update(actor: Actor) {\n  assertCan(actor, 'question:edit', { ownerId: 1 });\n}\n",
    );
    scanOne(
      'authz: { kind: "service", enforcedIn: "' + SERVICE + ':update" }, query: z.object({})',
    );
    expect(messages()).toEqual([]);
  });

  it("menerima panah async yang badannya memeriksa izin", () => {
    writeFileAt(
      SERVICE,
      "export const update = async (actor: Actor) => {\n  if (!hasRole(actor, 'admin')) throw new Error();\n};\n",
    );
    scanOne('authz: { kind: "service", enforcedIn: "' + SERVICE + ':update" }, query: z.object({})');
    expect(messages()).toEqual([]);
  });

  it("menolak fungsi yang tidak ada di berkas", () => {
    writeFileAt(SERVICE, "export function lain() {}\n");
    scanOne('authz: { kind: "service", enforcedIn: "' + SERVICE + ':update" }');
    expect(messages()).toContainEqual(expect.stringContaining("tidak ditemukan di"));
  });

  it("menolak berkas service yang tidak ada", () => {
    scanOne('authz: { kind: "service", enforcedIn: "src/lib/services/hantu.ts:update" }');
    expect(messages()).toContainEqual(expect.stringContaining("berkas"));
  });

  it("menolak enforcedIn yang tidak berbentuk path.ts:namaFungsi", () => {
    scanOne('authz: { kind: "service", enforcedIn: "src/lib/services/probe" }');
    expect(messages()).toContainEqual(expect.stringContaining("tidak berbentuk path.ts:namaFungsi"));
  });

  it("menolak fungsi yang badannya tanpa pemeriksaan otorisasi", () => {
    writeFileAt(SERVICE, "export async function update() {\n  return 1;\n}\n");
    scanOne('authz: { kind: "service", enforcedIn: "' + SERVICE + ':update" }');
    expect(messages()).toContainEqual(
      expect.stringContaining("tidak memuat pemeriksaan otorisasi"),
    );
  });

  it("menolak routeGate ber-own dan izin yang tak dikenal", () => {
    writeFileAt(SERVICE, "export function update() { assertCan(); }\n");
    scanOne(
      'authz: { kind: "service", enforcedIn: "' +
        SERVICE +
        ':update", routeGate: "question:edit" }',
    );
    expect(messages()).toContainEqual(expect.stringContaining("ber-`own`"));

    scanOne(
      'authz: { kind: "service", enforcedIn: "' +
        SERVICE +
        ':update", routeGate: "tidak:ada" }',
    );
    expect(messages()).toContainEqual(expect.stringContaining("tidak ada di matriks PERMISSIONS"));
  });
});
