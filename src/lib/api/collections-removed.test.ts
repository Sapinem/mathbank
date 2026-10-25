import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Fase 3: route stub 410 `/api/collections*` (MAT-39) sudah DIHAPUS, bukan
 * lagi stub. Tes ini mengunci penghapusan itu: tidak boleh ada lagi file
 * route collections di `src/app/api/`, dan tidak boleh ada referensi impor
 * dari kode produk (di luar dokumen/arsip & spec e2e manual yang memang
 * sudah basi dan tidak masuk gerbang `pnpm check`).
 */
describe("Fase 3: /api/collections sudah dihapus", () => {
  function walk(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) results = results.concat(walk(full));
      else results.push(full);
    }
    return results;
  }

  it("tidak ada file route collections di src/app/api", () => {
    const files = walk("src/app/api");
    expect(files.filter((f) => f.includes("/collections/") || f.endsWith("/collections/route.ts"))).toEqual([]);
    expect(fs.existsSync("src/app/api/collections")).toBe(false);
  });

  it("tidak ada impor/referensi api/collections dari kode produk src/", () => {
    const offenders: string[] = [];
    const walkSrc = (dir: string): void => {
      for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
          walkSrc(full);
        } else if (/\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts")) {
          const content = fs.readFileSync(full, "utf8");
          if (content.includes("api/collections") && !full.includes("app/api/collections")) {
            offenders.push(full);
          }
        }
      }
    };
    walkSrc("src");
    expect(offenders).toEqual([]);
  });
});
