import { describe, it, expect } from "vitest";
import { NAV_GROUPS } from "./nav-config";

describe("nav-config", () => {
  it("punya 4 grup sesuai RENCANA-UI §2", () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual([
      "Kerja",
      "Referensi",
      "Studio",
      "Sistem",
    ]);
  });

  it("grup Kerja punya 4 item dengan Telaah berbadge", () => {
    const kerja = NAV_GROUPS[0].items;
    expect(kerja).toHaveLength(4);
    expect(kerja.map((i) => i.label)).toEqual([
      "Dasbor",
      "Bank Soal",
      "Telaah",
      "Paket Soal",
    ]);
    expect(kerja.find((i) => i.label === "Telaah")?.badge).toBe("telaah");
  });

  it("Referensi memakai URL berprefix /referensi/*", () => {
    const ref = NAV_GROUPS[1].items;
    expect(ref).toHaveLength(4);
    expect(ref.every((i) => i.href.startsWith("/referensi/"))).toBe(true);
  });

  it("Ingest disembunyikan sampai M9, Pengaturan tampil", () => {
    const sistem = NAV_GROUPS[3].items;
    const ingest = sistem.find((i) => i.href === "/sistem/ingest");
    const settings = sistem.find((i) => i.href === "/sistem/pengaturan");
    expect(ingest?.hidden).toBe(true);
    expect(settings?.hidden).toBeUndefined();
  });

  it("setiap item punya href unik (mulai /)", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h.startsWith("/"))).toBe(true);
  });
});
