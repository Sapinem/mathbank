import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";
import {
  createSource,
  listSources,
  updateSource,
  deleteSource,
  createEvent,
  listEvents,
  deleteEvent,
  createTag,
  listTags,
  deleteTag,
} from "./taxonomy-service";
import { ForbiddenError, NotFoundError } from "@/lib/auth/guards";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");

const sql = postgres(url, { max: 4 });

const admin: Actor = { id: "t-admin", name: "Admin", roles: ["admin"], via: "session" };
const teacher: Actor = { id: "t-teacher", name: "Guru", roles: ["teacher"], via: "session" };

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(async () => {
  await sql`DELETE FROM sources`;
  await sql`DELETE FROM events`;
  await sql`DELETE FROM tags`;
});
afterAll(async () => {
  await sql`DELETE FROM sources`;
  await sql`DELETE FROM events`;
  await sql`DELETE FROM tags`;
  await sql.end();
});

describe("sumber", () => {
  it("buat + slug otomatis", async () => {
    const s = await createSource({ kind: "book", label: "Buku Matematika X" }, admin);
    expect(s.slug).toBe("buku-matematika-x");
    expect(s.kind).toBe("book");
  });

  it("uang berubah saat label diubah", async () => {
    const s = await createSource({ kind: "website", label: "Situs A" }, admin);
    const u = await updateSource(s.id, { label: "Situs B" }, admin);
    expect(u.slug).toBe("situs-b");
  });

  it("list menyertakan usageCount", async () => {
    await createSource({ kind: "book", label: "A" }, admin);
    const list = await listSources();
    expect(list[0].usageCount).toBe(0);
  });

  it("teacher TIDAK boleh (taxonomy:manage)", async () => {
    await expect(createSource({ kind: "book", label: "X" }, teacher)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("hapus sumber tak ada → NotFound", async () => {
    await expect(
      deleteSource("00000000-0000-7000-8000-000000000000", admin),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("event", () => {
  it("buat event dengan subtes & alias", async () => {
    const e = await createEvent(
      { name: "UTBK SNBT", shortname: "UTBK", category: "utbk", subtests: ["PU", "PPU"] },
      admin,
    );
    expect(e.subtests).toEqual(["PU", "PPU"]);
    expect(e.category).toBe("utbk");
  });

  it("list event", async () => {
    await createEvent({ name: "OSN", shortname: "OSN", category: "osn" }, admin);
    const list = await listEvents();
    expect(list.some((e) => e.name === "OSN")).toBe(true);
  });

  it("hapus event", async () => {
    const e = await createEvent({ name: "X", shortname: "X", category: "c" }, admin);
    await deleteEvent(e.id, admin);
    expect((await listEvents()).find((x) => x.id === e.id)).toBeUndefined();
  });
});

describe("label", () => {
  it("buat label + slug", async () => {
    const t = await createTag({ name: "HOTS" }, admin);
    expect(t.slug).toBe("hots");
  });

  it("usageCount dihitung dari DB (0 saat baru)", async () => {
    await createTag({ name: "Sulit" }, admin);
    const list = await listTags();
    expect(list[0].usageCount).toBe(0);
  });

  it("hapus label", async () => {
    const t = await createTag({ name: "Hapus Aku" }, admin);
    await deleteTag(t.id, admin);
    expect((await listTags()).find((x) => x.id === t.id)).toBeUndefined();
  });
});
