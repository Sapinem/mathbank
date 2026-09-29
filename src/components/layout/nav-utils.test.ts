import { describe, it, expect } from "vitest";
import { isActive, breadcrumbFromPath } from "./nav-utils";

const GROUPS = [
  {
    items: [
      { label: "Dasbor", href: "/" },
      { label: "Bank Soal", href: "/bank-soal" },
      { label: "Topik", href: "/referensi/topik" },
    ],
  },
];

describe("nav-utils", () => {
  describe("isActive", () => {
    it("dasbor hanya aktif di tepat /", () => {
      expect(isActive("/", "/")).toBe(true);
      expect(isActive("/bank-soal", "/")).toBe(false);
    });
    it("rute induk aktif untuk anaknya", () => {
      expect(isActive("/bank-soal", "/bank-soal")).toBe(true);
      expect(isActive("/bank-soal/abc", "/bank-soal")).toBe(true);
    });
    it("tak salah cocokkan prefix serupa", () => {
      expect(isActive("/bank-soal-lain", "/bank-soal")).toBe(false);
    });
  });

  describe("breadcrumbFromPath", () => {
    it("halaman tingkat atas → satu crumb", () => {
      expect(breadcrumbFromPath("/bank-soal", GROUPS)).toEqual([
        { label: "Bank Soal", href: "/bank-soal" },
      ]);
    });
    it("halaman detail → crumb bertingkat", () => {
      expect(breadcrumbFromPath("/bank-soal/abc", GROUPS)).toEqual([
        { label: "Bank Soal", href: "/bank-soal" },
        { label: "abc", href: "/bank-soal/abc" },
      ]);
    });
    it("rute tak dikenal → fallback Dasbor", () => {
      expect(breadcrumbFromPath("/entah", GROUPS)).toEqual([
        { label: "Dasbor", href: "/" },
      ]);
    });
    it("segmen di-decode (spasi, dll)", () => {
      const r = breadcrumbFromPath("/bank-soal/a%20b", GROUPS);
      expect(r[1].label).toBe("a b");
    });
  });
});
