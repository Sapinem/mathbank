import { describe, it, expect, afterAll } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

/**
 * Tes integrasi DB untuk PINTU MASUK SERAGAM media (G4.1).
 *
 * Memverifikasi bahwa jalur NON-ingest (unggah manual, tempel, lepas) memakai
 * jalur yang sama: tersimpan, terdaftar, tertaut, dan bisa dibersihkan.
 */
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");

const {
  uploadMedia,
  storeAndRegister,
  attachStoredMedia,
  detachAndCleanup,
  findOrphanAssets,
  listQuestionMedia,
  isAssetInUse,
} = await import("@/lib/services/media-service");
const { default: postgres } = await import("postgres");
const sql = postgres(url, { max: 4 });

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PNG2 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 8, 7]);

async function makeQuestion(label: string): Promise<string> {
  const [q] = await sql<{ id: string }[]>`
    INSERT INTO questions (question_type, difficulty, cognitive_level, grade, status, content_markdown)
    VALUES ('single_choice', 2, 'understand', '7', 'draft', ${label})
    RETURNING id
  `;
  return q!.id;
}

async function cleanup() {
  await sql`DELETE FROM question_media WHERE media_id IN (
    SELECT id FROM media_assets WHERE title LIKE 'uji-%'
  )`;
  await sql`DELETE FROM question_media WHERE question_id IN (
    SELECT id FROM questions WHERE content_markdown LIKE 'uji-%'
  )`;
  await sql`DELETE FROM media_assets WHERE title LIKE 'uji-%'`;
  await sql`DELETE FROM questions WHERE content_markdown LIKE 'uji-%'`;
}

describe("uploadMedia (jalur editor)", () => {
  it("menyimpan berkas + mendaftarkan + memberi shortcode", async () => {
    await cleanup();
    const dir = await mkdtemp(join(tmpdir(), "mb-up-"));
    try {
      const res = await uploadMedia(
        dir,
        { bytes: PNG, mimeType: "image/png", fileName: "foto.png" },
        { title: "uji-unggah" },
      );
      expect(res.shortId).toMatch(/^[0-9A-Za-z]{8}$/);
      expect(res.shortcode).toBe(`{{img:${res.shortId}}}`);
      expect(res.reused).toBe(false);

      // Berkas benar-benar tertulis di storage (sharded).
      const hash = createHash("sha256").update(PNG).digest("hex");
      const written = await readFile(join(dir, hash.slice(0, 2), `${hash}.png`));
      expect(written.length).toBe(PNG.length);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("unggahan identik → dedup (short_id sama)", async () => {
    await cleanup();
    const dir = await mkdtemp(join(tmpdir(), "mb-dup-"));
    try {
      const a = await uploadMedia(dir, { bytes: PNG, mimeType: "image/png" }, { title: "uji-dup" });
      const b = await uploadMedia(dir, { bytes: PNG, mimeType: "image/png" }, { title: "uji-dup" });
      expect(b.reused).toBe(true);
      expect(b.shortId).toBe(a.shortId);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("attachStoredMedia (jalur soal tanpa ingest-media)", () => {
  it("mendaftarkan + menautkan beberapa gambar sekaligus", async () => {
    await cleanup();
    const qId = await makeQuestion("uji-attach");
    const h1 = createHash("sha256").update(PNG2).digest("hex");
    const h2 = createHash("sha256").update(PNG).digest("hex");

    const handles = await attachStoredMedia(qId, [
      { relativePath: `aa/${h1}.png`, contentHash: h1, mimeType: "image/png", fileSize: PNG2.length },
      { relativePath: `bb/${h2}.png`, contentHash: h2, mimeType: "image/png", fileSize: PNG.length },
    ]);

    expect(handles.length).toBe(2);
    expect(handles[0]!.shortId).not.toBe(handles[1]!.shortId);

    const linked = await listQuestionMedia(qId);
    expect(linked.length).toBeGreaterThanOrEqual(2);
    expect(linked.map((l) => l.orderIndex)).toContain(0);
    expect(linked.map((l) => l.orderIndex)).toContain(1);
  });
});

describe("detachAndCleanup", () => {
  it("hapus aset hanya bila tak dipakai soal lain", async () => {
    await cleanup();
    const q1 = await makeQuestion("uji-lepas-1");
    const q2 = await makeQuestion("uji-lepas-2");
    const h = createHash("sha256").update(PNG).digest("hex");
    const [asset] = await attachStoredMedia(q1, [
      { relativePath: `cc/${h}.png`, contentHash: h, mimeType: "image/png", fileSize: PNG.length },
    ]);
    // Pakai juga di soal kedua — aset jadi dipakai 2 soal.
    await attachStoredMedia(q2, [
      { relativePath: `cc/${h}.png`, contentHash: h, mimeType: "image/png", fileSize: PNG.length },
    ]);
    expect(await isAssetInUse(asset!.id)).toBe(true);

    // Lepas dari soal 1 → masih dipakai soal 2 → HARUS tetap hidup.
    const removed1 = await detachAndCleanup(q1, [asset!.id]);
    expect(removed1).toBe(0);
    expect(await isAssetInUse(asset!.id)).toBe(true);

    // Lepas dari soal 2 → tak dipakai siapa pun → dihapus.
    const removed2 = await detachAndCleanup(q2, [asset!.id]);
    expect(removed2).toBe(1);
    expect(await isAssetInUse(asset!.id)).toBe(false);
  });
});

describe("findOrphanAssets", () => {
  it("menemukan aset tanpa rujukan soal", async () => {
    await cleanup();
    // Terdaftar tapi tak pernah ditautkan.
    const dir = await mkdtemp(join(tmpdir(), "mb-orph-"));
    try {
      const res = await storeAndRegister(dir, {
        bytes: new Uint8Array([1, 2, 3, 4, 5]),
        mimeType: "image/png",
        contentHash: createHash("sha256").update(new Uint8Array([1, 2, 3, 4, 5])).digest("hex"),
        title: "uji-orphan",
      });
      expect(res.shortId).toMatch(/^[0-9A-Za-z]{8}$/);
      const orphans = await findOrphanAssets();
      expect(orphans.data.some((o) => o.shortId === res.shortId)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

afterAll(async () => {
  await cleanup();
  await sql.end();
});
