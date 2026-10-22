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
  cleanUnusedTags,
  listGrades,
} from "./taxonomy-service";
import { ForbiddenError, NotFoundError } from "@/lib/auth/guards";

const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");

const sql = postgres(url, { max: 4 });

const admin: Actor = { id: "t-admin", name: "Admin", roles: ["admin"], via: "session" };
const teacher: Actor = { id: "t-teacher", name: "Guru", roles: ["teacher"], via: "session" };

beforeAll(async () => {
  await sql`SELECT 1`;
  // Seed grade master (idempotent) — data referensi QBank-style untuk uji.
  await sql`
    INSERT INTO grades (id, label, level_group, curriculum_phase, order_index, is_active)
    VALUES
      ('10', 'Kelas 10 SMA', 'sma', 'Fase E', 10, true),
      ('11', 'Kelas 11 SMA', 'sma', 'Fase F', 11, true)
    ON CONFLICT (id) DO UPDATE SET
      label = EXCLUDED.label,
      level_group = EXCLUDED.level_group,
      is_active = true
  `;
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
  it("buat label tanpa slug (MAT-131A: slug deprecated → NULL)", async () => {
    const t = await createTag({ name: "HOTS" }, admin);
    expect(t.name).toBe("HOTS");
    expect(t.slug ?? null).toBeNull();
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

  it("T-M5-3: cleanUnusedTags hanya hapus label usage_count=0", async () => {
    await createTag({ name: "Tak Terpakai 1" }, admin);
    await createTag({ name: "Tak Terpakai 2" }, admin);
    const removed = await cleanUnusedTags(admin);
    expect(removed).toBeGreaterThanOrEqual(2);
    // setelah bersih, tak ada tag usage_count=0
    const sisa = (await listTags()).filter((x) => x.usageCount === 0);
    expect(sisa).toHaveLength(0);
  });
});

describe("grade (jenjang, selaras QBank)", () => {
  it("listGrades mengembalikan jenjang aktif ber-id QBank (\"1\"..\"12\", varian w/l, utbk, umum)", async () => {
    const rows = await listGrades();
    expect(rows.length).toBeGreaterThan(0);
    const ids = rows.map((r) => r.id);
    // id format QBank — bukan "SMA-10"
    expect(ids).toContain("10");
    expect(ids).toContain("11");
    expect(ids).not.toContain("SMA-10");
    // label manusiawi & levelGroup terisi
    const g10 = rows.find((r) => r.id === "10")!;
    expect(g10.label).toMatch(/Kelas 10/);
    expect(g10.levelGroup).toBe("sma");
  });

  it("listGrades terurut menurut orderIndex", async () => {
    const rows = await listGrades();
    const orders = rows.map((r) => r.orderIndex);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});
