import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";
import {
  createTopic,
  updateTopic,
  deleteTopic,
  getTopic,
  listTopics,
  buildTree,
} from "./topic-service";
import { ConflictError, NotFoundError, ForbiddenError } from "@/lib/auth/guards";

/**
 * Tes INTEGRASI service topik (M5) — DB uji nyata.
 * Fokus: penurunan level, **anti-siklus**, dan RESTRICT saat hapus.
 */
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");

const sql = postgres(url, { max: 4 });

const admin: Actor = { id: "t-admin", name: "Admin", roles: ["admin"], via: "session" };
const teacher: Actor = {
  id: "t-teacher",
  name: "Guru",
  roles: ["teacher"],
  via: "session",
};

async function cleanTopics() {
  await sql`UPDATE topics SET parent_id = NULL`;
  await sql`DELETE FROM topics`;
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(cleanTopics);
afterAll(async () => {
  await cleanTopics();
  await sql.end();
});

describe("createTopic — level diturunkan dari induk", () => {
  it("tanpa induk → level 1", async () => {
    const t = await createTopic({ name: "Aljabar" }, admin);
    expect(t.level).toBe(1);
    expect(t.parentId).toBeNull();
    expect(t.slug).toBe("aljabar");
  });

  it("dengan induk → level induk + 1", async () => {
    const l1 = await createTopic({ name: "Aljabar" }, admin);
    const l2 = await createTopic({ name: "Persamaan", parentId: l1.id }, admin);
    const l3 = await createTopic({ name: "Linear", parentId: l2.id }, admin);
    expect(l2.level).toBe(2);
    expect(l3.level).toBe(3);
  });

  it("melebihi 3 level DITOLAK", async () => {
    const l1 = await createTopic({ name: "A" }, admin);
    const l2 = await createTopic({ name: "B", parentId: l1.id }, admin);
    const l3 = await createTopic({ name: "C", parentId: l2.id }, admin);
    await expect(
      createTopic({ name: "D", parentId: l3.id }, admin),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("induk tak ada → NotFound", async () => {
    await expect(
      createTopic(
        { name: "X", parentId: "00000000-0000-7000-8000-000000000000" },
        admin,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("teacher TIDAK boleh (izin taxonomy:manage)", async () => {
    await expect(createTopic({ name: "X" }, teacher)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("updateTopic — anti-siklus", () => {
  it("memindahkan topik ke bawah keturunannya DITOLAK (siklus)", async () => {
    const a = await createTopic({ name: "A" }, admin);
    const b = await createTopic({ name: "B", parentId: a.id }, admin);
    const c = await createTopic({ name: "C", parentId: b.id }, admin);
    // Coba jadikan A sebagai anak C → siklus.
    await expect(
      updateTopic(a.id, { parentId: c.id }, admin),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("memindahkan topik ke dirinya sendiri DITOLAK", async () => {
    const a = await createTopic({ name: "A" }, admin);
    await expect(
      updateTopic(a.id, { parentId: a.id }, admin),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("memindahkan sah: level ikut berubah", async () => {
    const a = await createTopic({ name: "A" }, admin);
    const b = await createTopic({ name: "B" }, admin);
    const moved = await updateTopic(b.id, { parentId: a.id }, admin);
    expect(moved.level).toBe(2);
  });

  it("pemindahan yang membuat keturunan > level 3 DITOLAK", async () => {
    // Pindahkan subtree ber-kedalaman-2 (A→A1) ke bawah induk level-2 (B),
    // sehingga A jadi level 3 dan A1 jadi level 4 → tolak.
    const a = await createTopic({ name: "A" }, admin); // level 1
    await createTopic({ name: "A1", parentId: a.id }, admin); // level 2
    const b = await createTopic({ name: "B" }, admin); // level 1
    const b1 = await createTopic({ name: "B1", parentId: b.id }, admin); // level 2
    // A (subtree dalam 2) dipindah ke bawah B1 (level 2) → A=3, A1=4 → DITOLAK.
    await expect(
      updateTopic(a.id, { parentId: b1.id }, admin),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("deleteTopic — RESTRICT", () => {
  it("menolak hapus topik yang masih punya anak", async () => {
    const a = await createTopic({ name: "A" }, admin);
    await createTopic({ name: "B", parentId: a.id }, admin);
    await expect(deleteTopic(a.id, admin)).rejects.toBeInstanceOf(ConflictError);
  });

  it("hapus daun berhasil", async () => {
    const a = await createTopic({ name: "A" }, admin);
    await deleteTopic(a.id, admin);
    expect(await getTopic(a.id)).toBeNull();
  });
});

describe("buildTree", () => {
  it("menyusun pohon dari daftar datar", async () => {
    const a = await createTopic({ name: "A" }, admin);
    const b = await createTopic({ name: "B", parentId: a.id }, admin);
    await createTopic({ name: "C", parentId: b.id }, admin);
    const tree = buildTree(await listTopics());
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].children).toHaveLength(1);
  });
});
