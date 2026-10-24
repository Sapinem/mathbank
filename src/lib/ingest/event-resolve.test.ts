import { describe, it, expect, beforeAll } from "vitest";
import { detectEvent } from "./event-detect";
import { eventIndex, mainEventFor } from "./event-resolve";

/**
 * Uji pemetaan label → katalog events menggunakan fungsi SUT (eventIndex & mainEventFor)
 * dari src/lib/ingest/event-resolve.ts.
 */
const KATALOG = [
  { id: "e1", name: "UTBK-SNBT", shortname: "UTBK", aliases: ["SNBT", "TPS"] },
  { id: "e2", name: "OSN Matematika", shortname: "OSN", aliases: ["OSK", "OSP"] },
  { id: "e3", name: "SIMAK UI", shortname: "SIMAK UI", aliases: ["Simak"] },
  { id: "e4", name: "Ujian Mandiri PTN", shortname: "UM PTN", aliases: ["UM", "SMMPTN"] },
  { id: "e5", name: "Ujian Sekolah", shortname: "US", aliases: ["UAS", "PAS"] },
  { id: "e6", name: "TKA", shortname: "TKA", aliases: ["Asesmen"] },
  { id: "e7", name: "PAS-SAS", shortname: "PAS", aliases: ["SAS"] },
  { id: "e8", name: "SBMPTN", shortname: "SBMPTN", aliases: [] },
  { id: "e9", name: "Try Out", shortname: "TO", aliases: ["Simulasi"] },
  { id: "e10", name: "ANBK-AKM", shortname: "ANBK", aliases: ["AKM"] },
  { id: "e11", name: "Ujian Nasional", shortname: "UN", aliases: ["UNBK", "UNAS"] },
];

const mockDb = {
  select: () => ({
    from: async () => KATALOG,
  }),
} as unknown as Parameters<typeof eventIndex>[0];

describe("event-resolve — mainEventFor & eventIndex (SUT)", () => {
  let idx: Map<string, string>;

  beforeAll(async () => {
    idx = await eventIndex(mockDb);
  });

  it("membangun index dari katalog lengkap", () => {
    expect(idx.get("unbk")).toBe("e11");
    expect(idx.get("utbk")).toBe("e1");
    expect(idx.get("simak ui")).toBe("e3");
  });

  it("UNBK → Ujian Nasional (e11)", () => {
    expect(mainEventFor("UNBK Matematika SMA IPS 2019", idx)).toBe("e11");
  });

  it("simulasi UNBK → Ujian Nasional (e11)", () => {
    expect(mainEventFor("Simulasi UNBK Matematika IPA 2018", idx)).toBe("e11");
  });

  it("soal UN → Ujian Nasional (e11)", () => {
    expect(mainEventFor("Soal UN Matematika Kategori Soal Sulit 2015", idx)).toBe("e11");
  });

  it("UTBK SNBT → UTBK-SNBT (e1)", () => {
    expect(mainEventFor("Soal PM UTBK SNBT 2024", idx)).toBe("e1");
  });

  it("TKA → TKA (e6)", () => {
    expect(mainEventFor("Latihan 30 Soal TKA Matematika SD/MI", idx)).toBe("e6");
  });

  it("SIMAK UI → SIMAK UI (e3)", () => {
    expect(mainEventFor("Pembahasan Simak UI Matematika Dasar 2013", idx)).toBe("e3");
  });

  it("artikel cara cepat → null (tanpa event)", () => {
    expect(mainEventFor("Cara Cepat Matematika Perkalian", idx)).toBeNull();
  });

  it("prioritas: UTBK lebih dulu daripada Ujian Sekolah", () => {
    expect(mainEventFor("Soal UTBK 2019", idx)).toBe("e1");
  });
});

describe("katalog: tidak ada duplikat label yang membingungkan", () => {
  it("alias 'PAS' tidak dipakai dua event sekaligus kecuali ambigu yang terdokumentasi", () => {
    const owners = new Map<string, string[]>();
    for (const e of KATALOG) {
      for (const k of [e.name, e.shortname, ...e.aliases]) {
        const key = k.toLowerCase();
        owners.set(key, [...(owners.get(key) ?? []), e.name]);
      }
    }
    const bentrok = [...owners.entries()].filter(([, v]) => v.length > 1);
    const pasBentrok = bentrok.filter(([k]) => k === "pas");
    expect(pasBentrok.length).toBe(1);
  });

  it("detektor 'PAS-SAS' (dgn dash) → label PAS-SAS, bukan Ujian Sekolah", () => {
    expect(detectEvent("Soal PAS-SAS Matematika Kelas 7").events[0]).toBe("PAS-SAS");
  });
});
