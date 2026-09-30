import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import { inflateRawSync } from "node:zlib";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes INTEGRASI ekspor Moodle/GitSync (M12) — DB uji nyata.
 * Menyentuh JALUR NYATA: service → bundle-service → taxonomy → ZIP.
 */

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const { exportBundleToGitsync } = await import("@/lib/services/moodle-export-service");
const { createBundle, addItem } = await import("@/lib/services/bundle-service");
const { createQuestion } = await import("@/lib/services/question-service");
const { createTopic } = await import("@/lib/services/topic-service");
const { ForbiddenError } = await import("@/lib/auth/guards");

const admin: Actor = { id: "mx-admin", name: "Admin", roles: ["admin"], via: "session" };
const agent: Actor = { id: "mx-agent", name: "Agen", roles: ["agent"], via: "apikey" };

async function clean() {
  await sql`DELETE FROM bundle_items`;
  await sql`DELETE FROM bundles`;
  await sql`DELETE FROM question_topics`;
  await sql`DELETE FROM questions`;
  await sql`DELETE FROM topics`;
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(clean);
afterAll(async () => {
  await clean();
  await sql.end();
});

/** Baca nama entri dari buffer ZIP. */
function zipNames(buf: Buffer): string[] {
  const out: string[] = [];
  for (let i = 0; i + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(i) === 0x02014b50) {
      const len = buf.readUInt16LE(i + 28);
      out.push(buf.subarray(i + 46, i + 46 + len).toString("utf8"));
    }
  }
  return out;
}

function zipRead(buf: Buffer, want: string): Buffer | null {
  for (let i = 0; i + 30 <= buf.length; i++) {
    if (buf.readUInt32LE(i) !== 0x04034b50) continue;
    const method = buf.readUInt16LE(i + 8);
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    if (buf.subarray(i + 30, i + 30 + nameLen).toString("utf8") !== want) continue;
    const start = i + 30 + nameLen + extraLen;
    const data = buf.subarray(start, start + compSize);
    return method === 8 ? inflateRawSync(data) : Buffer.from(data);
  }
  return null;
}

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

describe("M12 — ekspor GitSync", () => {
  it("agent TIDAK boleh ekspor (bundle:manage: no untuk agent)", async () => {
    const b = await createBundle({ title: "P", bundleType: "exam" }, admin);
    await expect(exportBundleToGitsync(b.id, agent)).rejects.toThrow(ForbiddenError);
  });

  it("menghasilkan ZIP dengan struktur folder topik + LaTeX \\( \\)", async () => {
    const topic = await createTopic({ name: "Aljabar" }, admin);
    const q = await mkQuestion("Hitung $2+2$", true, [topic.id]);
    const b = await createBundle({ title: "Paket Uji", bundleType: "exam" }, admin);
    await addItem(b.id, q.id, admin, { role: "question" });

    const { summary, result } = await exportBundleToGitsync(b.id, admin);
    expect(summary.ok).toBe(true);
    expect(result.exported).toBe(1);

    const names = zipNames(result.zip!);
    expect(names.some((n) => n.startsWith("top/Aljabar/") && n.endsWith(".xml"))).toBe(true);

    const soalName = names.find((n) => n.endsWith(".xml") && !n.includes("gitsync_category"))!;
    const xml = zipRead(result.zip!, soalName)!.toString("utf8");
    expect(xml).toContain("<quiz>");
    expect(xml).toContain("\\(2+2\\)"); // $ → \( \)
    expect(xml).toContain('fraction="100"');
  });

  it("soal tanpa topik → folder 'Tanpa Topik'", async () => {
    const q = await mkQuestion("Soal tanpa topik", true, []);
    const b = await createBundle({ title: "P2", bundleType: "exam" }, admin);
    await addItem(b.id, q.id, admin, { role: "question" });
    const { result } = await exportBundleToGitsync(b.id, admin);
    expect(zipNames(result.zip!).some((n) => n.startsWith("top/Tanpa-Topik/"))).toBe(true);
  });

  it("D4: soal tanpa kunci → ekspor DITOLAK (ok=false, zip=null)", async () => {
    const q = await mkQuestion("Soal tanpa kunci", false, []);
    const b = await createBundle({ title: "P3", bundleType: "exam" }, admin);
    await addItem(b.id, q.id, admin, { role: "question" });
    const { summary, result } = await exportBundleToGitsync(b.id, admin);
    expect(result.ok).toBe(false);
    expect(result.zip).toBeNull();
    expect(summary.withoutAnswerKey.length).toBe(1);
  });
});
