import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";
import { ingestCanonicalBatch } from "./ingest-gateway-service";
import type { CanonicalIngestBatchInput } from "@/lib/contracts/ingest-canonical";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi DB.");

const sql = postgres(url, { max: 4 });

const machine: Actor = {
  id: "test-machine",
  name: "Mesin Ingest Gateway",
  roles: ["machine"],
  via: "apikey",
};

async function cleanAll() {
  await sql`DELETE FROM bundle_items`;
  await sql`DELETE FROM bundles WHERE bundle_type = 'source'`;
  await sql`DELETE FROM question_topics`;
  await sql`DELETE FROM question_tags`;
  await sql`UPDATE questions SET parent_id = NULL`;
  await sql`DELETE FROM questions`;
  await sql`DELETE FROM sources WHERE label IN ('uji-gateway-1', 'uji-gateway-2')`;
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable`;
  await sql`DELETE FROM audit_logs`;
  await sql`ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable`;
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(cleanAll);
afterAll(async () => {
  await cleanAll();
  await sql.end();
});

describe("ingestCanonicalBatch integration (U2)", () => {
  const validItemA = {
    type: "single_choice" as const,
    stem: "Berapa hasil dari $3 + 5$?",
    dataPayload: {
      type: "multiple_choice" as const,
      options: [
        { id: "A", contentMarkdown: "$7$" },
        { id: "B", contentMarkdown: "$8$" },
      ],
    },
    answerKey: {
      correctOptionIds: "B",
      explanationMarkdown: "Penjumlahan $3 + 5 = 8$.",
    },
  };

  it("berhasil menyimpan batch kanonik ke database sebagai draft", async () => {
    const batch: CanonicalIngestBatchInput = {
      source: { name: "uji-gateway-1", url: "https://uji.test" },
      bundle: { title: "Naskah Uji 1", url: "https://uji.test/1", grade: "10" },
      items: [validItemA],
    };

    const res = await ingestCanonicalBatch(batch, machine);

    expect(res.totalReceived).toBe(1);
    expect(res.created).toBe(1);
    expect(res.linked).toBe(0);
    expect(res.rejectedCount).toBe(0);
    expect(res.failures).toHaveLength(0);
    expect(res.questionIds).toHaveLength(1);

    const [q] = await sql`SELECT status, content_markdown FROM questions WHERE id = ${res.questionIds[0]!}`;
    expect(q?.status).toBe("draft");
    expect(q?.content_markdown).toBe("Berapa hasil dari $3 + 5$?");
  });

  it("Covers AE1: menolak butir dengan KaTeX cacat dan melaporkan rincian kegagalan tanpa parsial korup", async () => {
    const invalidKatexItem = {
      type: "single_choice" as const,
      stem: "Tentukan nilai dari $\\frac{1}{2$", // KaTeX rusak: kurung tutup hilang
      dataPayload: {
        type: "multiple_choice" as const,
        options: [
          { id: "A", contentMarkdown: "$1$" },
          { id: "B", contentMarkdown: "$2$" },
        ],
      },
      answerKey: {
        correctOptionIds: "A",
        explanationMarkdown: "Penjelasan.",
      },
    };

    const batch: CanonicalIngestBatchInput = {
      source: { name: "uji-gateway-1", url: "https://uji.test" },
      bundle: { title: "Naskah Campuran", url: "https://uji.test/campur", grade: "10" },
      items: [validItemA, invalidKatexItem],
    };

    const res = await ingestCanonicalBatch(batch, machine);

    expect(res.totalReceived).toBe(2);
    expect(res.created).toBe(1);
    expect(res.rejectedCount).toBe(1);
    expect(res.failures).toHaveLength(1);
    expect(res.failures[0]?.index).toBe(1);
    expect(res.failures[0]?.reason).toContain("KaTeX");

    const totalQuestions = await sql`SELECT COUNT(*)::int as count FROM questions`;
    expect(totalQuestions[0]?.count).toBe(1);
  });

  it("Covers AE2: mendeteksi soal duplikat dan menautkannya ke bundle baru sebagai linked", async () => {
    const batch1: CanonicalIngestBatchInput = {
      source: { name: "uji-gateway-1", url: "https://uji.test" },
      bundle: { title: "Naskah Asal", url: "https://uji.test/asal", grade: "10" },
      items: [validItemA],
    };

    const res1 = await ingestCanonicalBatch(batch1, machine);
    expect(res1.created).toBe(1);

    const batch2: CanonicalIngestBatchInput = {
      source: { name: "uji-gateway-2", url: "https://uji2.test" },
      bundle: { title: "Naskah Kedua", url: "https://uji2.test/kedua", grade: "10" },
      items: [validItemA], // Soal dengan stem dan opsi identik
    };

    const res2 = await ingestCanonicalBatch(batch2, machine);
    expect(res2.created).toBe(0);
    expect(res2.linked).toBe(1);
    expect(res2.rejectedCount).toBe(0);

    // Pastikan total soal di database tetap 1
    const totalQuestions = await sql`SELECT COUNT(*)::int as count FROM questions`;
    expect(totalQuestions[0]?.count).toBe(1);

    // Namun tertaut di kedua bundle
    const bundleItemsCount = await sql`SELECT COUNT(*)::int as count FROM bundle_items WHERE question_id = ${res1.questionIds[0]!}`;
    expect(bundleItemsCount[0]?.count).toBe(2);
  });
});
