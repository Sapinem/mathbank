import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { mkdtemp, mkdir, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";

/**
 * Tes hygiene media (G4.6) — daftar orphan, penghapusan aman, anti path-traversal.
 *
 * Yang paling penting diuji di sini: **aset yang masih dipakai soal TIDAK boleh
 * terhapus**. FK `question_media` memakai ON DELETE RESTRICT, jadi tanpa penjagaan
 * di service, permintaan hapus akan meledak jadi galat DB mentah (500).
 */
config({ path: ".env.test" });
config({ path: ".env" });

const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib.");
process.env.DATABASE_URL = url;

// Storage ke direktori sementara SEBELUM modul service dimuat.
const tmpRoot = await mkdtemp(join(tmpdir(), "mb-hygiene-"));
process.env.MEDIA_STORAGE_PATH = tmpRoot;

const sql = postgres(url, { max: 2 });
const { findOrphanAssets, deleteAsset, registerMediaAsset } = await import(
  "@/lib/services/media-service"
);

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9, 9]);

/** Tulis berkas nyata ke storage uji. */
async function putFile(rel: string, bytes = PNG) {
  const abs = join(tmpRoot, rel);
  await mkdir(join(abs, ".."), { recursive: true });
  await writeFile(abs, bytes);
  return rel;
}

/**
 * Buat aset media lengkap dengan berkasnya.
 *
 * `short_id` DIBANGKITKAN SERVICE (kolom itu UNIQUE, dan generator punya retry
 * anti-tabrakan) — tes tidak boleh menentukannya sendiri. Yang kita kendalikan
 * adalah `contentHash` sebagai penanda milik tes ini.
 */
async function seedAsset(tag: string, altText: string) {
  const rel = await putFile(`hy/${tag}.png`);
  const res = await registerMediaAsset({
    relativePath: rel,
    mimeType: "image/png",
    fileSize: PNG.length,
    contentHash: `hyghash-${tag}`,
    role: "content",
    orderIndex: 0,
    altText,
    sourceOrigin: "manual_upload",
  });
  return res;
}

/** Buat soal yang memakai aset (lewat junction). */
async function linkToQuestion(mediaId: string) {
  const [q] = await sql`
    INSERT INTO questions (content_markdown, question_type, status, grade, difficulty, cognitive_level)
    VALUES ('uji hygiene', 'short_answer', 'draft', '11', 3, 'apply')
    RETURNING id
  `;
  await sql`
    INSERT INTO question_media (question_id, media_id, role, order_index)
    VALUES (${q!.id}, ${mediaId}, 'content', 0)
  `;
  return q!.id as string;
}

beforeEach(async () => {
  // Bersihkan dari tes sebelumnya.
  await sql`DELETE FROM question_media WHERE question_id IN (
    SELECT id FROM questions WHERE content_markdown = 'uji hygiene'
  )`;
  await sql`DELETE FROM questions WHERE content_markdown = 'uji hygiene'`;
  await sql`DELETE FROM media_assets WHERE content_hash LIKE 'hyghash-%'`;
});

afterAll(async () => {
  await sql`DELETE FROM question_media WHERE question_id IN (
    SELECT id FROM questions WHERE content_markdown = 'uji hygiene'
  )`;
  await sql`DELETE FROM questions WHERE content_markdown = 'uji hygiene'`;
  await sql`DELETE FROM media_assets WHERE content_hash LIKE 'hyghash-%'`;
  await sql.end();
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("findOrphanAssets", () => {
  it("memasukkan aset yang belum dipakai soal", async () => {
    const a = await seedAsset("HYA00001", "Belum dipakai");
    const res = await findOrphanAssets();
    expect(res.data.some((o) => o.shortId === a.shortId)).toBe(true);
  });

  it("TIDAK memasukkan aset yang sudah dipakai soal", async () => {
    const a = await seedAsset("HYB00001", "Sudah dipakai");
    await linkToQuestion(a.id);
    const res = await findOrphanAssets();
    expect(res.data.some((o) => o.shortId === a.shortId)).toBe(false);
  });

  it("menghitung total ukuran aset orphan", async () => {
    await seedAsset("HYC00001", "Orphan 1");
    const res = await findOrphanAssets();
    expect(res.total).toBe(res.data.length);
    expect(res.totalBytes).toBeGreaterThanOrEqual(PNG.length);
  });
});

describe("deleteAsset", () => {
  it("menghapus aset orphan + berkas fisiknya", async () => {
    const a = await seedAsset("HYD00001", "Akan dihapus");
    const absPath = join(tmpRoot, `hy/HYD00001.png`);
    await expect(stat(absPath)).resolves.toBeTruthy();

    const res = await deleteAsset(a.shortId);
    expect(res).toMatchObject({ shortId: a.shortId });
    expect((res as { filesRemoved: number }).filesRemoved).toBe(1);

    // Berkas benar-benar hilang dari disk.
    await expect(stat(absPath)).rejects.toBeTruthy();
    // Barisnya juga hilang dari DB.
    const rows = await sql`SELECT 1 FROM media_assets WHERE id = ${a.id}`;
    expect(rows.length).toBe(0);
  });

  it("MENOLAK menghapus aset yang masih dipakai soal", async () => {
    const a = await seedAsset("HYE00001", "Masih dipakai");
    await linkToQuestion(a.id);

    const res = await deleteAsset(a.shortId);
    expect(res).toEqual({ inUse: true });

    // Baris DAN berkas tetap utuh.
    const rows = await sql`SELECT 1 FROM media_assets WHERE id = ${a.id}`;
    expect(rows.length).toBe(1);
    await expect(stat(join(tmpRoot, "hy/HYE00001.png"))).resolves.toBeTruthy();
  });

  it("null untuk short_id tak dikenal", async () => {
    expect(await deleteAsset("ZZZZZZZZ")).toBeNull();
  });

  it("tetap sukses walau berkas fisik sudah hilang", async () => {
    const a = await seedAsset("HYF00001", "Berkas hilang");
    await rm(join(tmpRoot, "hy/HYF00001.png"));
    const res = await deleteAsset(a.shortId);
    // Baris terhapus; berkas yang tak ada tidak dihitung.
    expect(res).toMatchObject({ shortId: a.shortId, filesRemoved: 0 });
    const rows = await sql`SELECT 1 FROM media_assets WHERE id = ${a.id}`;
    expect(rows.length).toBe(0);
  });

  it("TIDAK menghapus berkas di luar storage (path traversal)", async () => {
    // Simulasi baris DB yang menunjuk keluar root storage.
    const a = await seedAsset("HYG00001", "Path jahat");
    await sql`
      UPDATE media_assets SET original_image_path = '../../etc/hosts'
      WHERE id = ${a.id}
    `;
    const res = await deleteAsset(a.shortId);
    // Baris terhapus, tapi berkas luar TIDAK tersentuh (filesRemoved = 0).
    expect(res).toMatchObject({ shortId: a.shortId, filesRemoved: 0 });
    const rows = await sql`SELECT 1 FROM media_assets WHERE id = ${a.id}`;
    expect(rows.length).toBe(0);
    await expect(stat("/etc/hosts")).resolves.toBeTruthy();
  });
});
