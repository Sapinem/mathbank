import { describe, it, expect } from "vitest";
import { NAV_GROUPS } from "./nav-config";

describe("nav-config", () => {
  it("punya 3 grup sesuai RENCANA-UI §2 (revisi: grup Studio dihapus)", () => {
    // Grup "Studio" dihapus 2026-10-01: hanya berisi satu halaman aktif (TikZ
    // ditunda), jadi bukan lagi pengelompokan nyata. Lihat docs/RENCANA-UI.md.
    expect(NAV_GROUPS.map((g) => g.label)).toEqual([
      "Kerja",
      "Referensi",
      "Sistem",
    ]);
  });

  it("grup Kerja punya 5 item dengan Telaah berbadge", () => {
    const kerja = NAV_GROUPS[0].items;
    // "Koleksi" ditambahkan 2026-10-02 (ADR-0016): arsip soal PUBLIK,
    // beda hakikat dari "Paket Soal" (naskah kerja guru, `own`).
    expect(kerja).toHaveLength(5);
    expect(kerja.map((i) => i.label)).toEqual([
      "Dasbor",
      "Bank Soal",
      "Telaah",
      "Paket Soal",
      "Koleksi",
    ]);
    expect(kerja.find((i) => i.label === "Telaah")?.badge).toBe("review");
  });

  it("Referensi berprefix /references/* — KECUALI Galeri Aset di /assets", () => {
    const ref = NAV_GROUPS[1].items;
    expect(ref).toHaveLength(5);
    const refItems = ref.filter((i) => i.href !== "/assets");
    expect(refItems.every((i) => i.href.startsWith("/references/"))).toBe(true);
    // Galeri Aset sengaja TIDAK berprefix — halaman tingkat atas.
    expect(ref.find((i) => i.label === "Galeri Aset")?.href).toBe("/assets");
  });

  it("Ingest disembunyikan sampai M9, Pengaturan tampil", () => {
    const sistem = NAV_GROUPS[2].items;
    const ingest = sistem.find((i) => i.href === "/system/ingest");
    const settings = sistem.find((i) => i.href === "/system/settings");
    expect(ingest?.hidden).toBe(true);
    expect(settings?.hidden).toBeUndefined();
  });

  it("TikZ Studio disembunyikan (ditunda sampai compiler TeX siap)", () => {
    const all = NAV_GROUPS.flatMap((g) => g.items);
    const tikz = all.find((i) => i.href === "/studio/tikz");
    expect(tikz?.hidden).toBe(true);
  });

  it("setiap item punya href unik (mulai /)", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h.startsWith("/"))).toBe(true);
  });

  it("hanya item yang ditandai hidden yang tidak tampil", () => {
    const visible = NAV_GROUPS.flatMap((g) => g.items).filter((i) => !i.hidden);
    expect(visible.map((i) => i.href)).toContain("/assets");
    expect(visible.map((i) => i.href)).not.toContain("/studio/tikz");
  });
});
