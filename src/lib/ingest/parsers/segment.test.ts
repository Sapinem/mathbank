import { describe, it, expect } from "vitest";
import { segmentArticle, segmentJson } from "./segment";
import type { ArticleMeta } from "./types";

/**
 * Tes segmentasi artikel → soal (M9). Fokus **cabang** yang sebelumnya belum
 * tersentuh: HTML kosong, sumber tak dikenal, JSON null/undefined.
 */

const meta = (source: string): ArticleMeta => ({ source, url: "https://x/y", title: "T" });

describe("segmentArticle", () => {
  it("HTML kosong → hasil kosong + peringatan", () => {
    const r = segmentArticle("", meta("mathcyber"));
    expect(r.items).toEqual([]);
    expect(r.skipped).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/kosong/i);
  });

  it("HTML hanya spasi → dianggap kosong", () => {
    const r = segmentArticle("   \n\t  ", meta("mathcyber"));
    expect(r.items).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/kosong/i);
  });

  it("sumber tak dikenal → dilewati + peringatan menyebut sumber", () => {
    const r = segmentArticle("<p>halo</p>", meta("sumber_ajaib"));
    expect(r.items).toEqual([]);
    expect(r.warnings[0]).toMatch(/sumber_ajaib/);
    expect(r.warnings[0]).toMatch(/dilewati/i);
  });

  it("sumber dikenal → delegasi ke adapter (tak ada peringatan 'tak dikenal')", () => {
    const r = segmentArticle("<article><p>Soal 1. Berapa $1+1$?</p></article>", meta("mathcyber"));
    expect(Array.isArray(r.items)).toBe(true);
    expect(r.warnings.join(" ")).not.toMatch(/tak dikenal/i);
  });

  it("defantri non-matematika → DILEWATI dengan alasan jelas (bukan senyap)", () => {
    const r = segmentArticle("<blockquote>radio</blockquote>", {
      source: "defantri",
      title: "100 Contoh Soal OSN-K IPS SMP 2014 dan Kunci Jawaban",
      url: "https://www.defantri.com/2014/09/soal-osn-ips-smp.html",
    });
    expect(r.items).toEqual([]);
    expect(r.warnings[0]).toMatch(/bukan artikel matematika/i);
    expect(r.warnings[0]).toMatch(/dilewati/i);
  });

  it("defantri matematika → TIDAK dilewati", () => {
    const r = segmentArticle("<blockquote>radio</blockquote>", {
      source: "defantri",
      title: "Soal Limit Fungsi Aljabar Matematika SMA dan Pembahasan",
      url: "https://www.defantri.com/2019/05/limit-fungsi-aljabar.html",
    });
    expect(r.warnings.join(" ")).not.toMatch(/bukan artikel matematika/i);
  });

  it("sumber LAIN (bukan defantri) tak kena gerbang mapel", () => {
    const r = segmentArticle("<article><p>x</p></article>", {
      source: "mathcyber",
      title: "Soal OSN IPS SMP",
      url: "https://mathcyber/x",
    });
    expect(r.warnings.join(" ")).not.toMatch(/bukan artikel matematika/i);
  });
});

describe("segmentJson", () => {
  it("null → hasil kosong + peringatan", () => {
    const r = segmentJson(null, meta("pusmendik_dayaserap"));
    expect(r.items).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/kosong/i);
  });

  it("undefined → hasil kosong + peringatan", () => {
    const r = segmentJson(undefined, meta("pusmendik_dayaserap"));
    expect(r.items).toEqual([]);
    expect(r.warnings.join(" ")).toMatch(/kosong/i);
  });

  it("sumber JSON tak dikenal → dilewati + peringatan", () => {
    const r = segmentJson({ a: 1 }, meta("json_ajaib"));
    expect(r.items).toEqual([]);
    expect(r.warnings[0]).toMatch(/json_ajaib/);
  });

  it("sumber JSON dikenal → delegasi ke adapter", () => {
    const r = segmentJson([], meta("pusmendik_dayaserap"));
    expect(Array.isArray(r.items)).toBe(true);
    expect(r.warnings.join(" ")).not.toMatch(/tak dikenal/i);
  });
});
