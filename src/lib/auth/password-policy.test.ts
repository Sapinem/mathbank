import { describe, it, expect } from "vitest";
import {
  checkPassword,
  isStrongPassword,
  strengthOf,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "./password-policy";

describe("password-policy (M13 S5)", () => {
  it("menerima sandi kuat", () => {
    expect(isStrongPassword("Bintang7Matematika")).toBe(true);
    const r = checkPassword("Bintang7Matematika");
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it(`menolak sandi < ${MIN_PASSWORD_LENGTH} karakter`, () => {
    const r = checkPassword("Ab1");
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/minimal/i);
  });

  it("menolak sandi tanpa huruf", () => {
    const r = checkPassword("123456789012");
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/huruf/i);
  });

  it("menolak sandi tanpa angka", () => {
    const r = checkPassword("abcdefghijkl");
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/angka/i);
  });

  it("menolak sandi umum (blocklist)", () => {
    expect(isStrongPassword("password123")).toBe(false);
    expect(isStrongPassword("Password123")).toBe(false); // case-insensitive
    expect(checkPassword("password123").errors.join(" ")).toMatch(/umum/i);
  });

  it("menolak sandi karakter berulang semua", () => {
    expect(isStrongPassword("aaaaaaaaaaaa")).toBe(false);
  });

  it("menolak sandi lebih panjang dari batas", () => {
    const long = "A1" + "x".repeat(MAX_PASSWORD_LENGTH);
    expect(isStrongPassword(long)).toBe(false);
  });

  it("strengthOf memberi skor 0 untuk kosong", () => {
    expect(strengthOf("")).toBe(0);
  });

  it("strengthOf memaksa rendah untuk sandi umum", () => {
    expect(strengthOf("password123")).toBe(1);
  });

  it("strengthOf naik seiring kompleksitas", () => {
    expect(strengthOf("abcdefghijkl")).toBeLessThan(4); // lemah
    expect(strengthOf("Bintang7Matematikaku")).toBeGreaterThanOrEqual(3);
  });

  it("menerima sandi dengan spasi internal (passphrase)", () => {
    expect(isStrongPassword("belajar 45 matematika")).toBe(true);
  });
});
