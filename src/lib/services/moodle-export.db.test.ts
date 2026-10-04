import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import { readFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes INTEGRASI ekspor Moodle/GitSync (M12) — DB uji + **disk nyata**.
 * Menyentuh JALUR NYATA: service → bundle-service → taxonomy → tulis folder + Git.
 *
 * Folder ekspor dialihkan ke direktori sementara via `MATHBANK_EXPORT_DIR`.
 */

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const EXPORT_DIR = join(tmpdir(), `mathbank-export-test-${process.pid}`);
process.env.MATHBANK_EXPORT_DIR = EXPORT_DIR;

const { exportBundleToGitsync } = await import("@/lib/services/moodle-export-service");
const { createBundle, addItem } = await import("@/lib/services/bundle-service");
const { createQuestion } = await import("@/lib/services/question-service");
const { createTopic } = await import("@/lib/services/topic-service");
const { ForbiddenError } = await import("@/lib/auth/guards");

const admin: Actor = { id: "mx-admin", name: "Admin", roles: ["admin"], via: "session" };
const agent: Actor = { id: "mx-agent", name: "Agen", roles: ["agent"], via: "apikey" };
const teacher: Actor = { id: "00000000-0000-7000-8000-000000000002", name: "Guru", roles: ["teacher"], via: "session" };
const otherTeacher: Actor = { id: "00000000-0000-7000-8000-000000000003", name: "Guru Lain", roles: ["teacher"], via: "session" };

async function clean() {
  await sql`DELETE FROM bundle_items`;
  await sql`DELETE FROM bundles`;
  await sql`DELETE FROM question_topics`;
  await sql`DELETE FROM questions`;
  await sql`DELETE FROM topics`;
}

async function cleanDisk() {
  await rm(EXPORT_DIR, { recursive: true, force: true });
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(async () => {
  await clean();
  await cleanDisk();
});
afterAll(async () => {
  await clean();
  await cleanDisk();
  await sql.end();
});

async function mkQuestion(content: string, withKey = true, topicIds: string[] = []) {
  return createQuestion(
    {
      questionType: "single_choice",
      difficulty: 3,
      cognitiveLevel: "remember",
      grade: "g1",
      contentMarkdown: content,
      dataPayload: {},
      answerKey: withKey ? { correct: ["B"] } : { correct: [] },
      status: "draft",
      childOrder: 0,
      options: [
        { label: "A", contentMarkdown: "1", isCorrect: false, orderIndex: 0 },
        { label: "B", contentMarkdown: "2", isCorrect: withKey, orderIndex: 1 },
      ],
      topicIds,
      tagIds: [],
    },
    admin,
  );
}

/** Kumpulkan semua jalur berkas (relatif) di bawah sebuah direktori. */
async function walk(dir: string, base = ""): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === ".git") continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(join(dir, e.name), rel)));
    else out.push(rel);
  }
  return out;
}

describe("M12 — ekspor GitSync ke disk", () => {
  it("agent TIDAK boleh ekspor (bundle:manage: no untuk agent)", async () => {
    const b = await createBundle({ title: "P", bundleType: "exam" }, admin);
    await expect(exportBundleToGitsync(b.id, agent)).rejects.toThrow(ForbiddenError);
  });

  it("guru BOLEH mengekspor paket miliknya sendiri", async () => {
    const topic = await createTopic({ name: "Aljabar Guru" }, admin);
    const q = await mkQuestion("Hitung $3+3$", true, [topic.id]);
    const b = await createBundle({ title: "Paket Guru", bundleType: "exam" }, teacher);
    await addItem(b.id, q.id, teacher, { role: "question" });

    const { summary, result, write } = await exportBundleToGitsync(b.id, teacher);
    expect(summary.ok).toBe(true);
    expect(result.exported).toBe(1);
    expect(write).not.toBeNull();
  });

  it("guru TIDAK boleh mengekspor paket milik guru lain (ForbiddenError)", async () => {
    const topic = await createTopic({ name: "Aljabar Privat" }, admin);
    const q = await mkQuestion("Hitung $4+4$", true, [topic.id]);
    const b = await createBundle({ title: "Paket Privat", bundleType: "exam" }, teacher);
    await addItem(b.id, q.id, teacher, { role: "question" });

    await expect(exportBundleToGitsync(b.id, otherTeacher)).rejects.toThrow(ForbiddenError);
  });

  it("menulis folder topik + berkas soal ber-LaTeX \\( \\) ke disk", async () => {
    const topic = await createTopic({ name: "Aljabar" }, admin);
    const q = await mkQuestion("Hitung $2+2$", true, [topic.id]);
    const b = await createBundle({ title: "Paket Uji", bundleType: "exam" }, admin);
    await addItem(b.id, q.id, admin, { role: "question" });

    const { summary, result, write } = await exportBundleToGitsync(b.id, admin);
    expect(summary.ok).toBe(true);
    expect(result.exported).toBe(1);
    expect(write).not.toBeNull();
    expect(write!.written).toBeGreaterThan(0);

    // Berkas NYATA di disk.
    const paths = await walk(write!.directory);
    expect(paths.some((p) => p.startsWith("top/Aljabar/") && p.endsWith(".xml"))).toBe(true);
    expect(paths).toContain("top/Aljabar/gitsync_category.xml");

    const questionRel = paths.find((p) => p.endsWith(".xml") && !p.includes("gitsync_category"))!;
    const xml = await readFile(join(write!.directory, questionRel), "utf8");
    expect(xml).toContain("<quiz>");
    expect(xml).toContain("\\(2+2\\)"); // $ → \( \)
    expect(xml).toContain('fraction="100"');

    // Kategori memakai bentuk <question><category><text>.
    const cat = await readFile(join(write!.directory, "top/Aljabar/gitsync_category.xml"), "utf8");
    expect(cat).toContain("<text>top/Aljabar</text>");
  });

  it("D8: folder otomatis jadi repo Git + commit", async () => {
    const q = await mkQuestion("Soal commit", true, []);
    const b = await createBundle({ title: "Repo Uji", bundleType: "exam" }, admin);
    await addItem(b.id, q.id, admin, { role: "question" });
    const { write } = await exportBundleToGitsync(b.id, admin);
    expect(write!.committed).toBe(true);
    expect(write!.commitHash).toMatch(/^[0-9a-f]{7,}$/);
  });

  it("soal tanpa topik → folder 'Tanpa Topik'", async () => {
    const q = await mkQuestion("Soal tanpa topik", true, []);
    const b = await createBundle({ title: "P2", bundleType: "exam" }, admin);
    await addItem(b.id, q.id, admin, { role: "question" });
    const { write } = await exportBundleToGitsync(b.id, admin);
    const paths = await walk(write!.directory);
    expect(paths.some((p) => p.startsWith("top/Tanpa-Topik/"))).toBe(true);
  });

  it("D4: soal tanpa kunci → ekspor DITOLAK (ok=false, tak menulis)", async () => {
    const q = await mkQuestion("Soal tanpa kunci", false, []);
    const b = await createBundle({ title: "P3", bundleType: "exam" }, admin);
    await addItem(b.id, q.id, admin, { role: "question" });
    const { summary, result, write } = await exportBundleToGitsync(b.id, admin);
    expect(result.ok).toBe(false);
    expect(write).toBeNull();
    expect(summary.withoutAnswerKey.length).toBe(1);
  });
});
