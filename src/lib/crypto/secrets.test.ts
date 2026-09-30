import { describe, it, expect } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  getEncryptionKey,
  generateEncryptionKey,
} from "./secrets";

const KEY = Buffer.from(generateEncryptionKey(), "hex");

describe("crypto/secrets", () => {
  it("enkripsi → dekripsi kembali sama", () => {
    const plain = "sk-rahasia-12345";
    const enc = encryptSecret(plain, KEY);
    expect(enc).not.toContain(plain);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptSecret(enc, KEY)).toBe(plain);
  });

  it("ciphertext berbeda tiap kali (IV acak)", () => {
    const a = encryptSecret("sama", KEY);
    const b = encryptSecret("sama", KEY);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, KEY)).toBe(decryptSecret(b, KEY));
  });

  it("kunci salah → gagal dekripsi (auth tag)", () => {
    const enc = encryptSecret("x", KEY);
    const wrong = Buffer.from(generateEncryptionKey(), "hex");
    expect(() => decryptSecret(enc, wrong)).toThrow();
  });

  it("format rusak → melempar", () => {
    expect(() => decryptSecret("bukan-format", KEY)).toThrow();
    expect(() => decryptSecret("v1:a:b", KEY)).toThrow();
  });

  it("isEncrypted benar", () => {
    expect(isEncrypted("v1:x:y:z")).toBe(true);
    expect(isEncrypted("plain")).toBe(false);
    expect(isEncrypted(123)).toBe(false);
    expect(isEncrypted(null)).toBe(false);
  });

  it("getEncryptionKey: hex 64 char diterima", () => {
    const hex = generateEncryptionKey();
    expect(getEncryptionKey({ SETTINGS_ENC_KEY: hex }).length).toBe(32);
  });

  it("getEncryptionKey: base64 32-byte diterima", () => {
    const b64 = Buffer.alloc(32, 7).toString("base64");
    expect(getEncryptionKey({ SETTINGS_ENC_KEY: b64 }).length).toBe(32);
  });

  it("getEncryptionKey: kosong → melempar", () => {
    expect(() => getEncryptionKey({})).toThrow(/SETTINGS_ENC_KEY/);
  });

  it("getEncryptionKey: panjang salah → melempar", () => {
    expect(() => getEncryptionKey({ SETTINGS_ENC_KEY: "abcd" })).toThrow(/32 byte/);
  });
});
