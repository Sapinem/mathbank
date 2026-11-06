import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_THEME_ID,
  getPrintTheme,
  listPrintThemes,
  registerPrintTheme,
  resetPrintThemeRegistryForTesting,
} from "./registry";
import type { PrintTheme } from "./types";

const dummyTheme: PrintTheme = {
  id: "math-my-id",
  name: "Standar MathBank",
  description: "Format naskah standar MathBank.",
  Kop: () => null,
};

const dummyCustomTheme: PrintTheme = {
  id: "formal-exam",
  name: "Ujian Formal",
  description: "Format ujian sekolah resmi.",
  Kop: () => null,
};

describe("PrintTheme Registry", () => {
  beforeEach(() => {
    resetPrintThemeRegistryForTesting();
    registerPrintTheme(dummyTheme);
  });

  it("DEFAULT_THEME_ID bernilai 'math-my-id'", () => {
    expect(DEFAULT_THEME_ID).toBe("math-my-id");
  });

  it("mengembalikan tema default jika themeId undefined, null, atau string kosong", () => {
    expect(getPrintTheme()).toBe(dummyTheme);
    expect(getPrintTheme(undefined)).toBe(dummyTheme);
    expect(getPrintTheme(null)).toBe(dummyTheme);
    expect(getPrintTheme("")).toBe(dummyTheme);
  });

  it("mengembalikan tema yang cocok jika ID terdaftar", () => {
    registerPrintTheme(dummyCustomTheme);
    expect(getPrintTheme("formal-exam")).toBe(dummyCustomTheme);
  });

  it("melakukan fallback ke tema default jika ID tidak dikenal tanpa error", () => {
    expect(getPrintTheme("tema-hantu-999")).toBe(dummyTheme);
  });

  it("listPrintThemes mengembalikan seluruh tema yang terdaftar", () => {
    registerPrintTheme(dummyCustomTheme);
    const list = listPrintThemes();
    expect(list).toHaveLength(2);
    expect(list.map((t) => t.id)).toEqual(["math-my-id", "formal-exam"]);
  });
});
