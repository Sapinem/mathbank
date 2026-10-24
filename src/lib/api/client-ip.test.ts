import { describe, it, expect } from "vitest";
import { getClientIp } from "./client-ip";

describe("getClientIp — resolusi IP klien aman", () => {
  it("memprioritaskan header X-Real-IP dari reverse proxy tepercaya", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-real-ip": "203.0.113.195",
        "x-forwarded-for": "10.0.0.1, 192.168.1.1",
      },
    });
    expect(getClientIp(req)).toBe("203.0.113.195");
  });

  it("mengambil IP paling kanan (terakhir) dari rantai X-Forwarded-For untuk mencegah spoofing", () => {
    // Penyerang menyuntikkan IP palsu di awal: "spoofed-ip, real-ip"
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "1.1.1.1, 203.0.113.50",
      },
    });
    expect(getClientIp(req)).toBe("203.0.113.50");
  });

  it("bekerja dengan IP tunggal di X-Forwarded-For", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "198.51.100.2",
      },
    });
    expect(getClientIp(req)).toBe("198.51.100.2");
  });

  it("mengembalikan null jika header IP tidak tersedia", () => {
    const req = new Request("http://localhost/api/test");
    expect(getClientIp(req)).toBeNull();
  });

  it("mengembalikan null jika header hanya spasi kosong", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": " , , ",
      },
    });
    expect(getClientIp(req)).toBeNull();
  });

  it("menolak nilai X-Real-IP non-IP dan fallback ke X-Forwarded-For yang valid", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-real-ip": "malicious-header-value; drop table",
        "x-forwarded-for": "198.51.100.42",
      },
    });
    expect(getClientIp(req)).toBe("198.51.100.42");
  });

  it("menolak nilai X-Forwarded-For jika bukan IP yang valid", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "x-forwarded-for": "invalid-ip-string",
      },
    });
    expect(getClientIp(req)).toBeNull();
  });
});
