import { describe, it, expect } from "vitest";
import { isUniqueViolation, withUniqueGuard } from "./errors";
import { ConflictError } from "@/lib/auth/guards";

/**
 * D8 — pelanggaran UNIQUE Postgres harus jadi `ConflictError` (409), bukan 500.
 */
describe("withUniqueGuard (D8)", () => {
  it("mengubah error 23505 (via .code) → ConflictError", async () => {
    const err = Object.assign(new Error("duplicate key value"), { code: "23505" });
    await expect(
      withUniqueGuard(() => Promise.reject(err), "Sudah ada."),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("mengubah error 23505 (via .cause.code) → ConflictError", async () => {
    const err = Object.assign(new Error("wrap"), { cause: { code: "23505" } });
    await expect(withUniqueGuard(() => Promise.reject(err))).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("mengenali lewat pesan 'unique constraint'", () => {
    expect(isUniqueViolation(new Error("unique constraint violated"))).toBe(true);
    expect(isUniqueViolation(new Error("duplicate key value violates"))).toBe(true);
  });

  it("error lain diteruskan apa adanya (bukan ConflictError)", async () => {
    const boom = new Error("koneksi putus");
    await expect(withUniqueGuard(() => Promise.reject(boom))).rejects.toBe(boom);
  });

  it("mengembalikan hasil saat sukses", async () => {
    await expect(withUniqueGuard(() => Promise.resolve(42))).resolves.toBe(42);
  });

  it("pesan kustom dipakai pada ConflictError", async () => {
    const err = Object.assign(new Error("dup"), { code: "23505" });
    await expect(
      withUniqueGuard(() => Promise.reject(err), "Nama label sudah dipakai."),
    ).rejects.toThrow("Nama label sudah dipakai.");
  });
});
