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
    it("halaman detail dengan UUID diterjemahkan ramah pengguna", () => {
      const qUuid = "01a11561-705a-78aa-9fd5-ba89f436cc64";
      expect(breadcrumbFromPath(`/questions/${qUuid}`, GROUPS)).toEqual([
        { label: "Bank Soal", href: "/questions" },
        { label: "Detail Soal", href: `/questions/${qUuid}` },
      ]);

      const groupsWithBundle = [
        {
          items: [
            { label: "Paket Soal", href: "/bundles" },
          ],
        },
      ];
      const bUuid = "01a1155c-801a-71fb-942e-30ad4c946306";
      expect(breadcrumbFromPath(`/bundles/${bUuid}`, groupsWithBundle)).toEqual([
        { label: "Paket Soal", href: "/bundles" },
        { label: "Detail Paket", href: `/bundles/${bUuid}` },
      ]);
      expect(breadcrumbFromPath(`/bundles/${bUuid}/edit`, groupsWithBundle)).toEqual([
        { label: "Paket Soal", href: "/bundles" },
        { label: "Detail Paket", href: `/bundles/${bUuid}` },
        { label: "Susun Paket", href: `/bundles/${bUuid}/edit` },
      ]);
      expect(breadcrumbFromPath(`/bundles/${bUuid}/print`, groupsWithBundle)).toEqual([
        { label: "Paket Soal", href: "/bundles" },
        { label: "Detail Paket", href: `/bundles/${bUuid}` },
        { label: "Cetak Naskah", href: `/bundles/${bUuid}/print` },
      ]);
      expect(breadcrumbFromPath(`/questions/new`, GROUPS)).toEqual([
        { label: "Bank Soal", href: "/questions" },
        { label: "Buat Soal", href: `/questions/new` },
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
