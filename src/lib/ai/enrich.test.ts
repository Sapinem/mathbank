import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildUserPrompt,
  normalizeProposal,
  ALL_FIELDS,
} from "./enrich";

describe("ai/enrich — prompt", () => {
  it("system prompt menegaskan keluaran JSON & bukan penentu jawaban", () => {
    const s = buildSystemPrompt();
    expect(s).toMatch(/JSON/);
    expect(s).toMatch(/TIDAK menentukan jawaban/i);
  });

  it("user prompt memuat soal + kunci yang diminta", () => {
    const p = buildUserPrompt({
      content: "Hitung $1+1$",
      ctx: { topics: ["Aljabar", "Bilangan"] },
      fields: ALL_FIELDS,
    });
    expect(p).toContain("Hitung $1+1$");
    expect(p).toContain("topics");
    expect(p).toContain("difficulty");
    expect(p).toContain("cognitiveLevel");
    expect(p).toContain("tags");
    expect(p).toContain("Aljabar");
  });

  it("memotong soal sangat panjang", () => {
    const p = buildUserPrompt({ content: "x".repeat(10000), ctx: { topics: [] }, fields: ["difficulty"] });
    expect(p.length).toBeLessThan(8000);
  });
});

describe("ai/enrich — normalizeProposal", () => {
  const topics = ["Aljabar", "Bilangan", "Geometri"];

  it("memetakan topik ke huruf besar-besar daftar resmi", () => {
    const r = normalizeProposal({ topics: ["aljabar"] }, ALL_FIELDS, topics);
    expect(r.topics).toEqual(["Aljabar"]);
  });

  it("topik di luar daftar tetap dibawa (huruf asli)", () => {
    const r = normalizeProposal({ topics: ["Trigonometri"] }, ALL_FIELDS, topics);
    expect(r.topics).toEqual(["Trigonometri"]);
  });

  it("difficulty (1-5) & cognitiveLevel (enum Bloom) divalidasi", () => {
    expect(normalizeProposal({ difficulty: 4, cognitiveLevel: "analyze" }, ALL_FIELDS, topics)).toMatchObject({
      difficulty: 4,
      cognitiveLevel: "analyze",
    });
    // string angka diterima
    expect(normalizeProposal({ difficulty: "2" }, ALL_FIELDS, topics).difficulty).toBe(2);
    // nilai tak sah → null
    expect(normalizeProposal({ difficulty: 9, cognitiveLevel: "C9" }, ALL_FIELDS, topics)).toMatchObject({
      difficulty: null,
      cognitiveLevel: null,
    });
    expect(normalizeProposal({ difficulty: "susah" }, ALL_FIELDS, topics).difficulty).toBeNull();
  });

  it("tags dinormalkan huruf kecil & dipotong", () => {
    const r = normalizeProposal({ tags: ["KALKULUS", "Turunan"] }, ALL_FIELDS, topics);
    expect(r.tags).toEqual(["kalkulus", "turunan"]);
  });

  it("field yang TIDAK diminta diabaikan", () => {
    const r = normalizeProposal({ topics: ["Aljabar"], difficulty: 1 }, ["difficulty"], topics);
    expect(r.topics).toEqual([]);
    expect(r.difficulty).toBe(1);
  });

  it("masukan rusak tidak melempar", () => {
    expect(normalizeProposal(null, ALL_FIELDS, topics)).toMatchObject({ topics: [], difficulty: null });
    expect(normalizeProposal({ topics: "bukan array" }, ALL_FIELDS, topics).topics).toEqual([]);
    expect(normalizeProposal({ topics: [1, "Aljabar", null] }, ALL_FIELDS, topics).topics).toEqual(["Aljabar"]);
  });

  it("notes dipotong 500 char", () => {
    const r = normalizeProposal({ notes: "a".repeat(1000) }, ALL_FIELDS, topics);
    expect(r.notes?.length).toBe(500);
  });
});
