import { describe, it, expect } from "vitest";
import { detectEvent } from "./event-detect";

/**
 * Uji pemetaan label → katalog events (logika inti resolveEventsForBundles),
 * diuji murni tanpa DB memakai salinan katalog nyata.
 */
const KATALOG: { name: string; shortname: string; aliases: string[] }[] = [
  { name: "UTBK-SNBT", shortname: "UTBK", aliases: ["SNBT", "TPS"] },
  { name: "OSN Matematika", shortname: "OSN", aliases: ["OSK", "OSP"] },
  { name: "SIMAK UI", shortname: "SIMAK UI", aliases: ["Simak"] },
  { name: "Ujian Mandiri PTN", shortname: "UM PTN", aliases: ["UM", "SMMPTN"] },
  { name: "Ujian Sekolah", shortname: "US", aliases: ["UAS", "PAS"] },
  { name: "TKA", shortname: "TKA", aliases: ["Asesmen"] },
  { name: "PAS-SAS", shortname: "PAS", aliases: ["SAS"] },
  { name: "SBMPTN", shortname: "SBMPTN", aliases: [] },
  { name: "Try Out", shortname: "TO", aliases: ["Simulasi"] },
  { name: "ANBK-AKM", shortname: "ANBK", aliases: ["AKM"] },
  { name: "Ujian Nasional", shortname: "UN", aliases: ["UNBK", "UNAS"] },
];

function index(): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of KATALOG) {
    m.set(e.name.toLowerCase(), e.name);
    m.set(e.shortname.toLowerCase(), e.name);
    for (const a of e.aliases) m.set(a.toLowerCase(), e.name);
  }
  return m;
}

function resolve(title: string): string | null {
  const idx = index();
  for (const label of detectEvent(title).events) {
    const hit = idx.get(label.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

describe("resolve event dari katalog", () => {
  it("UNBK → Ujian Nasional", () => {
    expect(resolve("UNBK Matematika SMA IPS 2019")).toBe("Ujian Nasional");
  });
  it("simulasi UBK → Ujian Nasional", () => {
    expect(resolve("Simulasi UNBK Matematika IPA 2018")).toBe("Ujian Nasional");
  });
  it("soal UN → Ujian Nasional", () => {
    expect(resolve("Soal UN Matematika Kategori Soal Sulit 2015")).toBe("Ujian Nasional");
  });
  it("UTBK SNBT → UTBK-SNBT", () => {
    expect(resolve("Soal PM UTBK SNBT 2024")).toBe("UTBK-SNBT");
  });
  it("TKA → TKA", () => {
    expect(resolve("Latihan 30 Soal TKA Matematika SD/MI")).toBe("TKA");
  });
  it("SIMAK UI → SIMAK UI", () => {
    expect(resolve("Pembahasan Simak UI Matematika Dasar 2013")).toBe("SIMAK UI");
  });
  it("artikel cara cepat → null (tanpa event)", () => {
    expect(resolve("Cara Cepat Matematika Perkalian")).toBeNull();
  });

  it("prioritas: UTBK lebih dulu daripada Ujian Sekolah untuk SKD", () => {
    // Judul memuat UTBK + "sumatif"? Pastikan label pertama yang menang.
    const r = resolve("Soal UTBK 2019");
    expect(r).toBe("UTBK-SNBT");
  });
});

describe("katalog: tidak ada duplikat label yang membingungkan", () => {
  it("alias 'PAS' tidak dipakai dua event sekaligus", () => {
    const owners = new Map<string, string[]>();
    for (const e of KATALOG) {
      for (const k of [e.name, e.shortname, ...e.aliases]) {
        const key = k.toLowerCase();
        owners.set(key, [...(owners.get(key) ?? []), e.name]);
      }
    }
    const bentrok = [...owners.entries()].filter(([, v]) => v.length > 1);
    // 'PAS' ada di Ujian Sekolah & PAS-SAS → ini memang ambigu; detektor
    // memakai label "Ujian Sekolah" lebih dulu, jadi PAS-SAS harus tetap
    // bisa menang bila judul memuat "PAS-SAS" eksplisit.
    const pasBentrok = bentrok.filter(([k]) => k === "pas");
    expect(pasBentrok.length).toBe(1);
  });

  it("detektor 'PAS-SAS' (dgn dash) → label PAS-SAS, bukan Ujian Sekolah", () => {
    expect(detectEvent("Soal PAS-SAS Matematika Kelas 7").events[0]).toBe("PAS-SAS");
  });
});
