import { describe, it, expect } from "vitest";
import { detectEvent } from "./event-detect";

describe("detectEvent — deteksi event dari judul", () => {
  it("UNBK → Ujian Nasional (contoh pemilik)", () => {
    const r = detectEvent("Soal UNBK Matematika SMA IPS 2019");
    expect(r.events).toContain("Ujian Nasional");
    expect(r.year).toBe(2019);
  });

  it("UTBK-SNBT + subtest Penalaran Matematika", () => {
    const r = detectEvent("Soal PM (Penalaran Matematika) UTBK SNBT 2024 dan Pembahasan");
    expect(r.events).toContain("UTBK-SNBT");
    expect(r.subtests).toContain("Penalaran Matematika");
    expect(r.year).toBe(2024);
  });

  it("TKA terdeteksi", () => {
    const r = detectEvent("Latihan 30 Soal TKA Matematika SD/MI Kelas VI + Kunci Jawaban");
    expect(r.events).toContain("TKA");
  });

  it("SIMAK UI terdeteksi", () => {
    expect(detectEvent("Pembahasan Simak UI Matematika Dasar 2013").events).toContain("SIMAK UI");
  });

  it("PAS/SAS terdeteksi", () => {
    const r = detectEvent("Soal PAS Matematika Kelas 7 Semester 1 Kurikulum Merdeka");
    expect(r.events).toContain("PAS-SAS");
    expect(r.subtests).not.toContain("Penalaran Matematika");
  });

  it("Matematika Pilihan → subtest Matematika Lanjut", () => {
    const r = detectEvent("Soal Matematika Pilihan SMA Kelas 12");
    expect(r.subtests).toContain("Matematika Lanjut");
  });

  it("kode naskah terbaca", () => {
    expect(detectEvent("Soal UM UGM Matematika SAINTEK 2019 Kode 624").code).toBe("624");
  });

  it("artikel biasa (tanpa event) → events kosong", () => {
    const r = detectEvent("Cara Cepat Matematika Perkalian");
    expect(r.events).toEqual([]);
    expect(r.year).toBeNull();
  });

  it("tahun di luar rentang (2013 ok, 1899 no)", () => {
    expect(detectEvent("Soal 2013").year).toBe(2013);
    expect(detectEvent("Soal 1899").year).toBeNull();
  });

  it("OSN terdeteksi", () => {
    expect(detectEvent("Soal dan Pembahasan OSN-K Matematika SMA 2024").events).toContain("OSN Matematika");
  });
});
