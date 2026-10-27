import { describe, expect, it } from "vitest";
import {
  assertVersionMatches,
  etagOf,
  InvalidIfMatchError,
  parseIfMatch,
  PreconditionFailedError,
  PreconditionRequiredError,
} from "./version";

/**
 * ADR-0030 — kontrak `If-Match` / `ETag`.
 *
 * Yang dikunci di sini adalah KEPUTUSAN, bukan implementasi: header yang absen
 * menghasilkan 428 (bukan diam-diam last-write-wins), weak validator ditolak,
 * dan 412 membawa `currentVersion` agar klien bisa memutuskan tanpa menebak.
 */

describe("etagOf", () => {
  it("membungkus versi dengan tanda kutip sesuai RFC 9110", () => {
    expect(etagOf(1)).toBe('"1"');
    expect(etagOf(42)).toBe('"42"');
  });
});

describe("parseIfMatch", () => {
  it("menerima ETag terkutip", () => {
    expect(parseIfMatch('"3"')).toBe(3);
  });

  it("menerima angka tanpa kutip (klien malas)", () => {
    expect(parseIfMatch("3")).toBe(3);
  });

  it("menerima wildcard", () => {
    expect(parseIfMatch("*")).toBe("*");
  });

  it("mengabaikan spasi di tepi", () => {
    expect(parseIfMatch('  "7"  ')).toBe(7);
  });

  it("header absen → PreconditionRequiredError (428)", () => {
    expect(() => parseIfMatch(null)).toThrow(PreconditionRequiredError);
    try {
      parseIfMatch(null);
    } catch (err) {
      expect((err as PreconditionRequiredError).code).toBe("PRECONDITION_REQUIRED");
    }
  });

  it("menolak weak validator — If-Match memakai perbandingan kuat", () => {
    expect(() => parseIfMatch('W/"3"')).toThrow(InvalidIfMatchError);
    expect(() => parseIfMatch('W/"3"')).toThrow(/perbandingan kuat/);
  });

  it("menolak daftar ETag (sumber daya di sini satu baris, satu versi)", () => {
    expect(() => parseIfMatch('"1", "2"')).toThrow(InvalidIfMatchError);
  });

  it("menolak versi 0 / negatif", () => {
    expect(() => parseIfMatch('"0"')).toThrow(InvalidIfMatchError);
    expect(() => parseIfMatch("-1")).toThrow(InvalidIfMatchError);
  });

  it("menolak sampah", () => {
    expect(() => parseIfMatch("abc")).toThrow(InvalidIfMatchError);
    expect(() => parseIfMatch("")).toThrow(InvalidIfMatchError);
  });

  it("galat bentuk salah membawa httpStatus 400 agar dipetakan wrapper", () => {
    try {
      parseIfMatch("abc");
    } catch (err) {
      expect((err as InvalidIfMatchError).httpStatus).toBe(400);
      expect((err as InvalidIfMatchError).code).toBe("INVALID_IF_MATCH");
    }
  });
});

describe("assertVersionMatches", () => {
  it("lolos saat versi sama", () => {
    expect(() => assertVersionMatches(3, 3)).not.toThrow();
  });

  it("lolos untuk wildcard", () => {
    expect(() => assertVersionMatches(3, "*")).not.toThrow();
  });

  it("melempar 412 yang MEMBAWA versi terkini", () => {
    try {
      assertVersionMatches(5, 3);
      throw new Error("seharusnya melempar");
    } catch (err) {
      expect(err).toBeInstanceOf(PreconditionFailedError);
      expect((err as PreconditionFailedError).currentVersion).toBe(5);
      expect((err as PreconditionFailedError).code).toBe("PRECONDITION_FAILED");
    }
  });
});
