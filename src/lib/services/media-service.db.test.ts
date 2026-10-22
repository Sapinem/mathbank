import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";

/**
 * Tes integrasi DB untuk pendaftaran media (G4.1).
 *
 * Menguji JALUR NYATA service terhadap DB uji: dedup hash, keunikan short_id,
 * relasi `question_media`, dan RESTRICT saat aset masih dipakai.
 */
const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const {
  registerMediaAsset,
  linkMediaToQuestion,
  registerAndLink,
  findAssetByShortId,
  isAssetInUse,
  listQuestionMedia,
} = await import("@/lib/services/media-service");

let questionId: string;

beforeEach(async () => {
  // Bersihkan jejak tes sebelumnya (junction dulu — RESTRICT).
  await sql`DELETE FROM question_media WHERE media_id IN (
    SELECT id FROM media_assets WHERE content_hash LIKE 'testhash%'
  )`;
  await sql`DELETE FROM media_assets WHERE content_hash LIKE 'testhash%'`;

  const [q] = await sql<{ id: string }[]>`
    INSERT INTO questions (question_type, difficulty, cognitive_level, grade, status, content_markdown)
    VALUES ('single_choice', 2, 'understand', '7', 'draft', 'Soal uji media')
    RETURNING id
  `;
  questionId = q!.id;
});

afterAll(async () => {
  await sql`DELETE FROM question_media WHERE question_id = ${questionId}`;
  await sql`DELETE FROM media_assets WHERE content_hash LIKE 'testhash%'`;
  await sql`DELETE FROM questions WHERE id = ${questionId}`;
  await sql.end();
});

describe("registerMediaAsset", () => {
  it("membuat baris + short_id 8 karakter base62", async () => {
    const a = await registerMediaAsset({
      relativePath: "aa/aaaa.png",
      contentHash: "testhash-1",
      mimeType: "image/png",
      fileSize: 1234,
      role: "content",
      orderIndex: 0,
    });
    expect(a.shortId).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(a.reused).toBe(false);
  });

  it("dedup: hash sama → baris & short_id sama", async () => {
    const first = await registerMediaAsset({
      relativePath: "aa/aaaa.png",
      contentHash: "testhash-dup",
      mimeType: "image/png",
      fileSize: 10,
      role: "content",
      orderIndex: 0,
    });
    const second = await registerMediaAsset({
      relativePath: "bb/bbbb.png",
      contentHash: "testhash-dup",
      mimeType: "image/png",
      fileSize: 10,
      role: "content",
      orderIndex: 1,
    });
    expect(second.reused).toBe(true);
    expect(second.id).toBe(first.id);
    expect(second.shortId).toBe(first.shortId);
  });

  it("SVG masuk ke svg_path, raster ke original_image_path", async () => {
    const svg = await registerMediaAsset({
      relativePath: "cc/cccc.svg",
      contentHash: "testhash-svg",
      mimeType: "image/svg+xml",
      fileSize: 50,
      role: "content",
      orderIndex: 0,
    });
    const row = await findAssetByShortId(svg.shortId);
    expect(row?.svgPath).toBe("cc/cccc.svg");
    expect(row?.originalImagePath).toBeNull();
  });

  it("short_id berbeda antar aset", async () => {
    const a = await registerMediaAsset({
      relativePath: "a/1.png", contentHash: "testhash-a",
      mimeType: "image/png", fileSize: 1, role: "content", orderIndex: 0,
    });
    const b = await registerMediaAsset({
      relativePath: "b/2.png", contentHash: "testhash-b",
      mimeType: "image/png", fileSize: 1, role: "content", orderIndex: 1,
    });
    expect(a.shortId).not.toBe(b.shortId);
  });
});

describe("linkMediaToQuestion", () => {
  it("mengaitkan aset ke soal (idempotent)", async () => {
    const a = await registerMediaAsset({
      relativePath: "d/1.png", contentHash: "testhash-link",
      mimeType: "image/png", fileSize: 1, role: "content", orderIndex: 0,
    });
    await linkMediaToQuestion(questionId, a.id, "content", 0);
    await linkMediaToQuestion(questionId, a.id, "content", 0); // ganda → diabaikan

    const rows = await sql`SELECT id FROM question_media WHERE question_id = ${questionId} AND media_id = ${a.id}`;
    expect(rows.length).toBe(1);
  });

  it("registerAndLink menautkan + dapat shortId", async () => {
    const handle = await registerAndLink(questionId, {
      relativePath: "e/1.png", contentHash: "testhash-ral",
      mimeType: "image/png", fileSize: 1, role: "solution", orderIndex: 2,
    });
    expect(handle.shortId).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(await isAssetInUse(handle.id)).toBe(true);

    const list = await listQuestionMedia(questionId);
    expect(list.some((m) => m.mediaId === handle.id && m.role === "solution")).toBe(true);
  });
});

describe("isAssetInUse + RESTRICT", () => {
  it("aset tak terpakai → false", async () => {
    const a = await registerMediaAsset({
      relativePath: "f/1.png", contentHash: "testhash-free",
      mimeType: "image/png", fileSize: 1, role: "content", orderIndex: 0,
    });
    expect(await isAssetInUse(a.id)).toBe(false);
  });

  it("DB MENOLAK hapus aset yang masih dipakai (RESTRICT)", async () => {
    const handle = await registerAndLink(questionId, {
      relativePath: "g/1.png", contentHash: "testhash-restrict",
      mimeType: "image/png", fileSize: 1, role: "content", orderIndex: 0,
    });
    await expect(sql`DELETE FROM media_assets WHERE id = ${handle.id}`).rejects.toThrow();
  });
});
