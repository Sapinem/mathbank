import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

/**
 * Tes penjaga penamaan (M16, CONSTRAINTS #28b).
 *
 * Menjalankan `scripts/check-names.mjs` nyata terhadap repo → harus LULUS
 * (semua nama file/folder/route berbahasa Inggris). Bila ada nama Indonesia
 * yang ditambahkan, tes ini gagal — menjaga aturan tetap ditegakkan.
 */
describe("check-names (CONSTRAINTS #28b)", () => {
  it("repo bersih: semua nama file/folder/route berbahasa Inggris", () => {
    const out = execFileSync("node", ["scripts/check-names.mjs"], {
      encoding: "utf8",
      cwd: process.cwd(),
    });
    expect(out).toContain("semua nama file/folder/route berbahasa INGGRIS");
  });
});
