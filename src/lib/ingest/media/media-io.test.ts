import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchImage } from "./fetch";
import { storeImage, relativePath } from "./store";
import { ingestArticleMedia, collectUrls, type MediaCache } from "./ingest-media";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchImage (mock fetch)", () => {
  it("berhasil → bytes, mime, hash", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(PNG, {
      status: 200, headers: { "content-type": "image/png" },
    })));
    const r = await fetchImage("https://a.com/x.png", { retries: 0 });
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
      "file:///etc/passwd",
    ];
    for (const target of targets) {
      const r = await fetchImage(target, { retries: 0 });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/diblokir|tidak diizinkan|URL tidak valid/i);
    }
  });

  it("404 → gagal, tanpa retry", async () => {
    const spy = vi.fn(async () => new Response("no", { status: 404 }));
    vi.stubGlobal("fetch", spy);
    const r = await fetchImage("https://a.com/x.png", { retries: 2 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("404");
    expect(spy).toHaveBeenCalledTimes(1); // 4xx tak di-retry
  });

  it("bukan gambar (mime salah) → gagal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!DOCTYPE html>x", {
      status: 200, headers: { "content-type": "text/html" },
    })));
    const r = await fetchImage("https://a.com/x", { retries: 0 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("bukan gambar");
  });

  it("terlalu besar → gagal", async () => {
    const big = new Uint8Array(200);
    big.set(PNG);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(big, {
      status: 200, headers: { "content-type": "image/png" },
    })));
    const r = await fetchImage("https://a.com/x", { retries: 0, maxBytes: 50 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("besar");
  });

  it("retry lalu berhasil", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      n++;
      if (n === 1) throw new Error("jaringan");
      return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
    }));
    const r = await fetchImage("https://a.com/x", { retries: 2 });
    expect(r.ok).toBe(true);
    expect(n).toBe(2);
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

describe("ingestArticleMedia (orkestrasi, mock fetch)", () => {
  it("unduh → simpan → cache; yang gagal ditandai", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("ok")) {
        return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
      }
      return new Response("no", { status: 404 });
    }));
    const dir = await mkdtemp(join(tmpdir(), "mb-ing-"));
    try {
      // Tanpa `register` = uji murni unduh+simpan (tanpa DB); pendaftaran
      // short_id diuji terpisah lewat callback yang disuntikkan.
      const cache = await ingestArticleMedia(
        [{ text: "![a](https://a.com/ok.png) ![b](https://a.com/bad.png)", role: "content" }],
        { rootDir: dir, articleUrl: "https://a.com/a/" },
      );
      expect(cache.get("https://a.com/ok.png")?.ok).toBe(true);
      expect(cache.get("https://a.com/ok.png")?.contentHash).toBeTruthy();
      expect(cache.get("https://a.com/bad.png")?.ok).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("cache dipakai ulang (tak unduh dua kali)", async () => {
    const spy = vi.fn(async () => new Response(PNG, { status: 200, headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", spy);
    const dir = await mkdtemp(join(tmpdir(), "mb-ing2-"));
    try {
      const cache: MediaCache = new Map();
      const t = [{ text: "![a](https://a.com/same.png)", role: "content" as const }];
      await ingestArticleMedia(t, { rootDir: dir, cache });
      await ingestArticleMedia(t, { rootDir: dir, cache });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("collectUrls: role dipertahankan", () => {
    const u = collectUrls("![x](https://a.com/x.png)", undefined, "solution");
    expect(u[0]!.role).toBe("solution");
  });
});

describe("fetchImage — jalur TLS dilonggarkan (server lokal)", () => {
  // Host yang di-pin relaxed = 127.0.0.1 → memakai modul https/http Node,
  // bukan fetch global. Diuji dengan server HTTP lokal nyata.
  async function withServer(
    handler: (res: import("node:http").ServerResponse) => void,
    fn: (port: number) => Promise<void>,
  ) {
    const { createServer } = await import("node:http");
    const server = createServer((_req, res) => handler(res));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    try {
      await fn(port);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  }

  it("berhasil lewat modul http + host relaxed", async () => {
    await withServer(
      (res) => {
        res.writeHead(200, { "content-type": "image/png" });
        res.end(Buffer.from(PNG));
      },
      async (port) => {
        const r = await fetchImage(`http://127.0.0.1:${port}/x.png`, {
          retries: 0,
          tlsRelaxedHosts: ["127.0.0.1"],
        });
        expect(r.ok).toBe(true);
        expect(r.contentType).toBe("image/png");
      },
    );
  });

  it("mengikuti redirect lalu gagal 404 (tanpa retry)", async () => {
    await withServer(
      (res) => {
        if (res.req.url === "/redirect") {
          res.writeHead(302, { location: "/missing" });
          res.end();
        } else {
          res.writeHead(404);
          res.end("no");
        }
      },
      async (port) => {
        const r = await fetchImage(`http://127.0.0.1:${port}/redirect`, {
          retries: 2,
          tlsRelaxedHosts: ["127.0.0.1"],
        });
        expect(r.ok).toBe(false);
        expect(r.error).toContain("404");
      },
    );
  });
});
