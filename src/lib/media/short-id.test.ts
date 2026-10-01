import { describe, it, expect } from "vitest";
import {
  generateShortId,
  isValidShortId,
  generateUniqueShortId,
  SHORT_ID_LENGTH,
} from "./short-id";

describe("generateShortId", () => {
  it("menghasilkan 8 karakter", () => {
    expect(generateShortId()).toHaveLength(SHORT_ID_LENGTH);
  });

  it("hanya memakai base62 (0-9A-Za-z)", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateShortId()).toMatch(/^[0-9A-Za-z]{8}$/);
    }
  });

  it("tidak berulang pada 1000 undian", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateShortId());
    // Ruang 62^8 ≈ 2,2e14 — tabrakan pada 1000 undian praktis mustahil.
    expect(seen.size).toBe(1000);
  });

  it("menyebar (tidak selalu karakter pertama sama)", () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 200; i++) firsts.add(generateShortId()[0]!);
    expect(firsts.size).toBeGreaterThan(10);
  });
});

describe("isValidShortId", () => {
  it("menerima bentuk sah", () => {
    expect(isValidShortId("a7Kx9mP2")).toBe(true);
    expect(isValidShortId("00000000")).toBe(true);
    expect(isValidShortId("ZZZZZZZZ")).toBe(true);
  });

  it("menolak panjang salah", () => {
    expect(isValidShortId("a7Kx9mP")).toBe(false); // 7
    expect(isValidShortId("a7Kx9mP2z")).toBe(false); // 9
    expect(isValidShortId("")).toBe(false);
  });

  it("menolak karakter di luar base62", () => {
    expect(isValidShortId("a7Kx9m-2")).toBe(false); // tanda hubung
    expect(isValidShortId("a7Kx9m_2")).toBe(false); // garis bawah
    expect(isValidShortId("a7Kx9m 2")).toBe(false); // spasi
    expect(isValidShortId("../etc/x")).toBe(false); // traversal
    expect(isValidShortId("a7Kx9m\u00002")).toBe(false); // NUL byte
  });
});

describe("generateUniqueShortId", () => {
  it("mengembalikan kandidat yang belum terpakai", async () => {
    const taken = new Set(["AAAAAAAA"]);
    const id = await generateUniqueShortId(async (c) => taken.has(c));
    expect(isValidShortId(id)).toBe(true);
    expect(taken.has(id)).toBe(false);
  });

  it("mencoba ulang saat kandidat terpakai (memakai mock berurutan)", async () => {
    let calls = 0;
    // Tolak dua kali, terima ketiga — memastikan loop retry berjalan.
    const id = await generateUniqueShortId(async () => {
      calls++;
      return calls <= 2;
    });
    expect(calls).toBe(3);
    expect(isValidShortId(id)).toBe(true);
  });

  it("melempar bila selalu terpakai (pengaman anti-loop-tak-berujung)", async () => {
    await expect(generateUniqueShortId(async () => true, 5)).rejects.toThrow(
      /setelah 5 percobaan/,
    );
  });
});
