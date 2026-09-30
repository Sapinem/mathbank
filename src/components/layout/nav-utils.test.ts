import { describe, it, expect } from "vitest";
import { isActive, breadcrumbFromPath } from "./nav-utils";

const GROUPS = [
  {
    items: [
      { label: "Dasbor", href: "/" },
      { label: "Bank Soal", href: "/questions" },
      { label: "Topik", href: "/references/topics" },
    ],
  },
];

describe("nav-utils", () => {
  describe("isActive", () => {
    it("dasbor hanya aktif di tepat /", () => {
      expect(isActive("/", "/")).toBe(true);
      expect(isActive("/questions", "/")).toBe(false);
    });
    it("rute induk aktif untuk anaknya", () => {
      expect(isActive("/questions", "/questions")).toBe(true);
      expect(isActive("/questions/abc", "/questions")).toBe(true);
    });
    it("tak salah cocokkan prefix serupa", () => {
      expect(isActive("/questions-lain", "/questions")).toBe(false);
    });
  });

  describe("breadcrumbFromPath", () => {
    it("halaman tingkat atas → satu crumb", () => {
      expect(breadcrumbFromPath("/questions", GROUPS)).toEqual([
        { label: "Bank Soal", href: "/questions" },
      ]);
    });
    it("halaman detail → crumb bertingkat", () => {
      expect(breadcrumbFromPath("/questions/abc", GROUPS)).toEqual([
        { label: "Bank Soal", href: "/questions" },
        { label: "abc", href: "/questions/abc" },
      ]);
    });
    it("rute tak dikenal → fallback Dasbor", () => {
      expect(breadcrumbFromPath("/entah", GROUPS)).toEqual([
        { label: "Dasbor", href: "/" },
      ]);
    });
    it("segmen di-decode (spasi, dll)", () => {
      const r = breadcrumbFromPath("/questions/a%20b", GROUPS);
      expect(r[1].label).toBe("a b");
    });
  });
});
