import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * SEC-01: `fetchImage` melakukan resolusi DNS pra-koneksi. Di tes unit kita
 * ganti resolver modul dengan alamat PUBLIK agar tes tetap hermetik (tanpa
 * jaringan) dan tidak bergantung DNS nyata untuk nama contoh.
 */
vi.mock("node:dns/promises", () => {
  const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
  return { lookup, default: { lookup } };
});

import {
  fetchImage,
  fetchMedia,
  validateMediaUrl,
  requestPinned,
  resolvePinnedTarget,
  type DnsResolver,
  type FetchTransport,
  type PinnedTarget,
} from "./fetch";
import { storeImage, relativePath } from "./store";
import { ingestArticleMedia, collectUrls, type MediaCache } from "./ingest-media";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

/**
 * Resolver DNS tiruan (SEC-01) — tes tak boleh bergantung DNS nyata.
 * Default: alamat publik.
 */
const PUBLIC_IP = "93.184.216.34";
function dns(ips: string[] = [PUBLIC_IP]): DnsResolver {
  return async () => ips;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchImage (transport ter-pin, bukan mock fetch global)", () => {
  // Setelah Fase 2, fetchImage TIDAK LAGI memakai global fetch (fetch akan
  // me-resolve ulang hostname = TOCTOU). Tes hermetik memakai transport
  // suntikan yang menerima PinnedTarget — persis seperti dnsResolver yang
  // sudah disuntikkan sejak awal di file ini.
  function pngTransport(): FetchTransport {
    return async () => ({
      status: 200,
      contentType: "image/png",
      body: PNG,
      location: null,
    });
  }

  it("berhasil → bytes, mime, hash", async () => {
    const r = await fetchImage("https://a.com/x.png", {
      retries: 0,
      dnsResolver: dns(),
      transport: pngTransport(),
    });
    expect(r.ok).toBe(true);
    expect(r.contentType).toBe("image/png");
    expect(r.contentHash).toHaveLength(64);
  });

  it("anti-SSRF: menolak akses ke loopback & private IP", async () => {
    const targets = [
      "http://127.0.0.1/test.png",
      "http://localhost/test.png",
      "http://169.254.169.254/latest/meta-data",
      "http://10.0.0.1/secret.png",
      "http://192.168.1.1/admin.png",
      "http://0.0.0.0/test.png",
      "http://[::]/test.png",
      "http://[::1]/test.png",
      "http://[0:0:0:0:0:0:0:0]/test.png",
      "http://[::ffff:127.0.0.1]/test.png",
      "http://100.64.0.1/metadata",
      "file:///etc/passwd",
    ];
    for (const target of targets) {
      const r = await fetchImage(target, { retries: 0, dnsResolver: dns(), transport: pngTransport() });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/diblokir|terblokir|tidak diizinkan|URL tidak valid/i);
    }
  });

  it("validateMediaUrl menolak URL metadata cloud (Pilar 2)", async () => {
    await expect(
      validateMediaUrl("http://169.254.169.254/latest/meta-data/")
    ).rejects.toThrow(/terblokir|diblokir/);
  });

  it("fetchMedia alias untuk fetchImage bekerja identik (Pilar 2)", async () => {
    const r = await fetchMedia("https://a.com/x.png", {
      retries: 0,
      dnsResolver: dns(),
      transport: pngTransport(),
    });
    expect(r.ok).toBe(true);
    expect(r.contentType).toBe("image/png");
  });

  it("SEC-01: DNS rebinding — domain publik yang resolve ke 127.0.0.1 DIBLOKIR", async () => {
    let transportCalls = 0;
    const transport: FetchTransport = async () => {
      transportCalls++;
      return { status: 200, contentType: "image/png", body: PNG, location: null };
    };
    const r = await fetchImage("https://evil.example/x.png", {
      retries: 0,
      dnsResolver: dns(["127.0.0.1"]),
      transport,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/diblokir|anti-SSRF/i);
    expect(transportCalls).toBe(0); // tak pernah menyentuh jaringan
  });

  it("SEC-01: metadata AWS via DNS (169.254.169.254) DIBLOKIR sebelum koneksi", async () => {
    let transportCalls = 0;
    const transport: FetchTransport = async () => {
      transportCalls++;
      return { status: 200, contentType: "image/png", body: PNG, location: null };
    };
    const r = await fetchImage("https://metadata.example/latest/meta-data", {
      retries: 0,
      dnsResolver: dns(["169.254.169.254"]),
      transport,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/anti-SSRF/i);
    expect(transportCalls).toBe(0);
  });

  it("SEC-01: redirect (manual) ke host privat DIBLOKIR", async () => {
    let n = 0;
    const transport: FetchTransport = async () => {
      n++;
      return {
        status: 302,
        contentType: "",
        body: new Uint8Array(0),
        location: "http://127.0.0.1/secret.png",
      };
    };
    const r = await fetchImage("https://a.com/redir.png", { retries: 0, dnsResolver: dns(), transport });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/diblokir|anti-SSRF|redirect/i);
    expect(n).toBe(1); // hop privat tidak pernah dieksekusi
  });

  it("SEC-01: redirect manual diikuti untuk host publik (tiap hop divalidasi)", async () => {
    let n = 0;
    const transport: FetchTransport = async () => {
      n++;
      if (n === 1) {
        return { status: 301, contentType: "", body: new Uint8Array(0), location: "/final.png" };
      }
      return { status: 200, contentType: "image/png", body: PNG, location: null };
    };
    const r = await fetchImage("https://a.com/start.png", { retries: 0, dnsResolver: dns(), transport });
    expect(r.ok).toBe(true);
    expect(n).toBe(2);
  });

  it("404 → gagal, tanpa retry", async () => {
    let n = 0;
    const transport: FetchTransport = async () => {
      n++;
      return { status: 404, contentType: "text/plain", body: new TextEncoder().encode("no"), location: null };
    };
    const r = await fetchImage("https://a.com/x.png", { retries: 2, dnsResolver: dns(), transport });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("404");
    expect(n).toBe(1); // 4xx tak di-retry
  });

  it("bukan gambar (mime salah) → gagal", async () => {
    const transport: FetchTransport = async () => ({
      status: 200,
      contentType: "text/html",
      body: new TextEncoder().encode("<!DOCTYPE html>x"),
      location: null,
    });
    const r = await fetchImage("https://a.com/x", { retries: 0, dnsResolver: dns(), transport });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("bukan gambar");
  });

  it("terlalu besar → gagal", async () => {
    const big = new Uint8Array(200);
    big.set(PNG);
    const transport: FetchTransport = async () => ({
      status: 200,
      contentType: "image/png",
      body: big,
      location: null,
    });
    const r = await fetchImage("https://a.com/x", { retries: 0, maxBytes: 50, dnsResolver: dns(), transport });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("besar");
  });

  it("retry lalu berhasil", async () => {
    let n = 0;
    const transport: FetchTransport = async () => {
      n++;
      if (n === 1) throw new Error("jaringan");
      return { status: 200, contentType: "image/png", body: PNG, location: null };
    };
    const r = await fetchImage("https://a.com/x", { retries: 2, dnsResolver: dns(), transport });
    expect(r.ok).toBe(true);
    expect(n).toBe(2);
  });
});

describe("fetchImage — pinning IP (Fase 2, TOCTOU)", () => {
  it("resolver yang menjawab publik lalu privat: koneksi tetap ke IP publik tervalidasi, resolver hanya dipanggil sekali", async () => {
    let calls = 0;
    const resolver: DnsResolver = async () => {
      calls++;
      // Jawaban kedua adalah rebinding klasik: bila kode masih me-resolve
      // ulang di transport, koneksi akan mengarah ke metadata cloud.
      return calls === 1 ? [PUBLIC_IP] : ["169.254.169.254"];
    };
    let seen: PinnedTarget | undefined;
    const transport: FetchTransport = async (target) => {
      seen = target;
      return { status: 200, contentType: "image/png", body: PNG, location: null };
    };
    const r = await fetchImage("https://evil.example/x.png", {
      retries: 0,
      dnsResolver: resolver,
      transport,
    });
    expect(r.ok).toBe(true);
    expect(seen?.ip).toBe(PUBLIC_IP);
    expect(seen?.hostname).toBe("evil.example");
    expect(calls).toBe(1); // tidak ada resolve kedua di transport
  });

  it("resolvePinnedTarget mengembalikan IP pertama yang tervalidasi, bukan hostname", async () => {
    const target = await resolvePinnedTarget("https://a.com/x.png", [], dns());
    expect(target.ip).toBe(PUBLIC_IP);
    expect(target.hostname).toBe("a.com");
    expect(target.tlsRelaxed).toBe(false);
  });

  it("requestPinned memakai lookup ter-pin ke server lokal (socket nyata)", async () => {
    const { createServer } = await import("node:http");
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "image/png" });
      res.end(Buffer.from(PNG));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    try {
      // Transport layer saja (tanpa gerbang SSRF): hostname a.com di-pin
      // ke 127.0.0.1, dan server lokal benar-benar menerima request itu.
      const target: PinnedTarget = {
        url: new URL(`http://a.com:${port}/x.png`),
        hostname: "a.com",
        ip: "127.0.0.1",
        family: 4,
        tlsRelaxed: false,
      };
      const r = await requestPinned(target, 5000, 10 * 1024 * 1024, "test");
      expect(r.status).toBe(200);
      expect(r.contentType).toBe("image/png");
      expect(Buffer.from(r.body).equals(Buffer.from(PNG))).toBe(true);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

describe("fetchImage — TLS relaxed HANYA melonggarkan TLS, bukan SSRF (Fase 2)", () => {
  it("host relaxed yang DNS-nya menunjuk privat DIBLOKIR (dulu lolos via early-return)", async () => {
    let transportCalls = 0;
    const transport: FetchTransport = async () => {
      transportCalls++;
      return { status: 200, contentType: "image/png", body: PNG, location: null };
    };
    const r = await fetchImage("https://pusmendik.kemendikdasmen.go.id/x.png", {
      retries: 0,
      dnsResolver: dns(["169.254.169.254"]),
      transport,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/diblokir|anti-SSRF/i);
    expect(transportCalls).toBe(0);
  });

  it("host relaxed yang DNS-nya publik tetap berhasil (relaksasi hanya TLS)", async () => {
    const r = await fetchImage("https://pusmendik.kemendikdasmen.go.id/x.png", {
      retries: 0,
      dnsResolver: dns(),
      transport: async () => ({ status: 200, contentType: "image/png", body: PNG, location: null }),
    });
    expect(r.ok).toBe(true);
  });

  it("host relaxed yang redirect ke host privat tetap DIBLOKIR", async () => {
    let n = 0;
    const transport: FetchTransport = async () => {
      n++;
      if (n === 1) {
        return { status: 302, contentType: "", body: new Uint8Array(0), location: "http://169.254.169.254/latest/meta-data" };
      }
      return { status: 200, contentType: "image/png", body: PNG, location: null };
    };
    const r = await fetchImage("https://pusmendik.kemendikdasmen.go.id/evil", {
      retries: 0,
      dnsResolver: dns(),
      transport,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/diblokir|anti-SSRF/i);
    expect(n).toBe(1);
  });

  it("resolvePinnedTarget menandai host relaxed tanpa melewati validasi", async () => {
    const target = await resolvePinnedTarget(
      "https://pusmendik.kemendikdasmen.go.id/x.png",
      ["pusmendik.kemendikdasmen.go.id"],
      dns(),
    );
    expect(target.tlsRelaxed).toBe(true);
    expect(target.ip).toBe(PUBLIC_IP);
  });
});

describe("storeImage (dir tmp nyata)", () => {
  it("simpan + dedup (konten sama tak ditulis ulang)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mb-store-"));
    try {
      const bytes = PNG;
      const h = "a".repeat(64);
      const r1 = await storeImage(dir, h, "image/png", bytes);
      expect(r1.stored).toBe(true);
      expect(r1.deduped).toBe(false);
      expect(r1.relativePath).toBe(relativePath(h, "image/png"));

      const r2 = await storeImage(dir, h, "image/png", bytes);
      expect(r2.deduped).toBe(true);

      const onDisk = await readFile(join(dir, r1.relativePath));
      expect(onDisk.length).toBe(bytes.length);
      const info = await stat(join(dir, r1.relativePath));
      expect(info.isFile()).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("ingestArticleMedia (orkestrasi, transport suntikan)", () => {
  function transportFor(okUrls: string[]): FetchTransport {
    return async (target) => {
      const url = target.url.toString();
      if (okUrls.some((u) => url.includes(u))) {
        return { status: 200, contentType: "image/png", body: PNG, location: null };
      }
      return { status: 404, contentType: "text/plain", body: new TextEncoder().encode("no"), location: null };
    };
  }

  it("unduh → simpan → cache; yang gagal ditandai", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mb-ing-"));
    try {
      const cache = await ingestArticleMedia(
        [{ text: "![a](https://a.com/ok.png) ![b](https://a.com/bad.png)", role: "content" }],
        {
          rootDir: dir,
          articleUrl: "https://a.com/a/",
          fetchOptions: { dnsResolver: dns(), transport: transportFor(["ok.png"]) },
        },
      );
      expect(cache.get("https://a.com/ok.png")?.ok).toBe(true);
      expect(cache.get("https://a.com/ok.png")?.contentHash).toBeTruthy();
      expect(cache.get("https://a.com/bad.png")?.ok).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("cache dipakai ulang (tak unduh dua kali)", async () => {
    let n = 0;
    const transport: FetchTransport = async () => {
      n++;
      return { status: 200, contentType: "image/png", body: PNG, location: null };
    };
    const dir = await mkdtemp(join(tmpdir(), "mb-ing2-"));
    try {
      const cache: MediaCache = new Map();
      const t = [{ text: "![a](https://a.com/same.png)", role: "content" as const }];
      await ingestArticleMedia(t, {
        rootDir: dir,
        cache,
        fetchOptions: { dnsResolver: dns(), transport },
      });
      await ingestArticleMedia(t, {
        rootDir: dir,
        cache,
        fetchOptions: { dnsResolver: dns(), transport },
      });
      expect(n).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("collectUrls: role dipertahankan", () => {
    const u = collectUrls("![x](https://a.com/x.png)", undefined, "solution");
    expect(u[0]!.role).toBe("solution");
  });
});

