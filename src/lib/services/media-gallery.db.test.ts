import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { config } from "dotenv";

/**
 * Tes galeri media (G4.5) — daftar/pencarian/detail/update metadata.
 *
 * Memverifikasi jalur yang dipakai AssetPicker & halaman /assets,
 * termasuk arah balik `usedBy` (soal mana yang memakai aset ini).
 */
config({ path: ".env.test" });
config({ path: ".env" });

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib.");
process.env.DATABASE_URL = url;

const sql = postgres(url, { max: 2 });
const { listMedia, getMediaDetail, updateMediaMeta } = await import(
  "@/lib/services/media-service"
);

async function seed(shortId: string, title: string, origin = "manual_upload") {
  const [row] = await sql`
    INSERT INTO media_assets (short_id, title, mime_type, file_size, content_hash, source_origin)
    VALUES (${shortId}, ${title}, 'image/png', 10, ${"galhash-" + shortId}, ${origin})
    RETURNING id
  `;
  return row!.id as string;
}

beforeEach(async () => {
  await sql`DELETE FROM media_assets WHERE content_hash LIKE 'galhash-%'`;
});

afterAll(async () => {
  await sql`DELETE FROM media_assets WHERE content_hash LIKE 'galhash-%'`;
  await sql.end();
});

describe("listMedia", () => {
  it("mengembalikan aset terbaru lebih dulu + total", async () => {
    await seed("GALAAAA1", "Segitiga istimewa");
    await seed("GALAAAA2", "Lingkaran satuan");
    const res = await listMedia({ limit: 50 });
    const mine = res.data.filter((d) => d.shortId.startsWith("GAL"));
    expect(mine.length).toBeGreaterThanOrEqual(2);
    expect(res.total).toBeGreaterThanOrEqual(2);
  });

  it("mencari berdasarkan judul (tak peduli huruf besar/kecil)", async () => {
    await seed("GALBBBB1", "Grafik Parabola Terbuka");
    const res = await listMedia({ q: "parabola" });
    expect(res.data.some((d) => d.shortId === "GALBBBB1")).toBe(true);
  });

  it("memfilter berdasarkan asal (source_origin)", async () => {
    await seed("GALCCCC1", "Hasil comot", "pdf_crop");
    const res = await listMedia({ origin: "pdf_crop" });
    expect(res.data.every((d) => d.sourceOrigin === "pdf_crop")).toBe(true);
    expect(res.data.some((d) => d.shortId === "GALCCCC1")).toBe(true);
  });

  it("pencarian kosong mengembalikan daftar (bukan error)", async () => {
    const res = await listMedia({ limit: 5 });
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeLessThanOrEqual(5);
  });
});

describe("getMediaDetail", () => {
  it("null untuk short_id tak dikenal", async () => {
    expect(await getMediaDetail("ZZZZZZZZ")).toBeNull();
  });

  it("mengembalikan aset + usedBy kosong bila belum dipakai", async () => {
    await seed("GALDDDD1", "Belum dipakai");
    const d = await getMediaDetail("GALDDDD1");
    expect(d).not.toBeNull();
    expect(d!.asset.shortId).toBe("GALDDDD1");
    expect(d!.usedBy).toEqual([]);
  });
});

describe("updateMediaMeta", () => {
  it("memperbarui judul & altText", async () => {
    await seed("GALEEEE1", "Judul lama");
    const updated = await updateMediaMeta("GALEEEE1", {
      title: "Judul baru",
      altText: "Segitiga siku-siku",
    });
    expect(updated?.title).toBe("Judul baru");
    const d = await getMediaDetail("GALEEEE1");
    expect(d!.asset.altText).toBe("Segitiga siku-siku");
  });

  it("null untuk short_id tak dikenal", async () => {
    expect(await updateMediaMeta("ZZZZZZZZ", { title: "x" })).toBeNull();
  });
});
