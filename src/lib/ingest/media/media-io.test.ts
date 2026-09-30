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
      const cache = await ingestArticleMedia(
        [{ text: "![a](https://a.com/ok.png) ![b](https://a.com/bad.png)", role: "content" }],
        { rootDir: dir, articleUrl: "https://a.com/a/" },
      );
      expect(cache.get("https://a.com/ok.png")?.ok).toBe(true);
      expect(cache.get("https://a.com/ok.png")?.localUrl).toMatch(/^\/media\//);
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
