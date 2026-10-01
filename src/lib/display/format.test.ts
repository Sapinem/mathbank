import { describe, it, expect } from "vitest";
import { formatBytes } from "./format";

describe("formatBytes", () => {
  it("menampilkan byte apa adanya di bawah 1 KB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("naik ke KB tepat di 1024", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("memakai satu angka desimal di bawah 10", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1280)).toBe("1.3 KB");
  });

  it("membulatkan angka besar", () => {
    expect(formatBytes(1024 * 1024 * 15)).toBe("15 MB");
    expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe("2 GB");
  });

  it("naik satuan sampai TB", () => {
    expect(formatBytes(1024 ** 4)).toBe("1 TB");
    expect(formatBytes(1024 ** 5)).toBe("1024 TB");
  });

  it("menerima null/undefined → tanda pisah", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
  });

  it("menolak angka negatif & NaN", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });

  it("0 byte tetap '0 B', bukan dianggap kosong", () => {
    // Penting: guru harus bisa membedakan "0 B" (berkas kosong) dari "—" (tak diketahui).
    expect(formatBytes(0)).not.toBe("—");
  });
});
