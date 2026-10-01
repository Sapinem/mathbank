import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";
import { enqueue, listQueue, listPending, markProcessing, markDone, countByStatus, getQueueItem } from "./queue";
import { commitItems, resolveSourceId, existingItemHashes } from "./commit";
import { articleHash, itemHash, contentHash } from "./hash";
import type { ParsedItem } from "./parsers/types";

/**
 * Tes INTEGRASI ingest (M9-3) — DB uji nyata.
 * Menguji: antrean, dedup artikel, guard balapan, commit → soal draft, idempotensi.
 */

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");

const sql = postgres(url, { max: 4 });

const machine: Actor = { id: "test-machine", name: "Mesin Uji", roles: ["machine"], via: "apikey" };

async function cleanAll() {
  await sql`DELETE FROM question_sources`;
  await sql`DELETE FROM question_options`;
  await sql`DELETE FROM question_topics`;
  await sql`DELETE FROM question_tags`;
  await sql`UPDATE questions SET parent_id = NULL`;
  await sql`DELETE FROM questions`;
  await sql`DELETE FROM ingest_queue`;
  await sql`DELETE FROM sources WHERE slug = 'uji-ingest' OR label = 'uji-ingest' OR slug = 'uji-ingest-2' OR label = 'uji-ingest-2'`;
  // `audit_logs` append-only (trigger immutable) → matikan sementara utk bersih-bersih.
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable`;
  await sql`DELETE FROM audit_logs`;
  await sql`ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable`;
}

function item(over: Partial<ParsedItem> = {}): ParsedItem {
  return {
    type: "single_choice",
    stem: "Berapa $1+1$?",
    options: [
      { label: "A", text: "1", isCorrect: false },
      { label: "B", text: "2", isCorrect: true },
    ],
    correct: ["B"],
    warnings: [],
    ref: { index: 1 },
    ...over,
  };
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(cleanAll);
afterAll(async () => {
  await cleanAll();
  await sql.end();
});

describe("queue (ingest_queue)", () => {
  it("enqueue → baris pending", async () => {
    const r = await enqueue({ title: "Artikel 1", sourceOrigin: "uji-ingest", rawContent: "<p>x</p>" });
    expect(r.deduped).toBe(false);
    const row = await getQueueItem(r.id);
    expect(row?.status).toBe("pending");
    expect(row?.importedQuestionsCount).toBe(0);
  });

  it("dedup: isi sama tidak dibuat ulang", async () => {
    const a = await enqueue({ title: "A", sourceOrigin: "uji-ingest", rawContent: "<p>sama</p>" });
    const b = await enqueue({ title: "B", sourceOrigin: "uji-ingest", rawContent: "<p>sama</p>" });
    expect(b.deduped).toBe(true);
    expect(b.id).toBe(a.id);
    const rows = await listQueue({});
    expect(rows.filter((r) => r.title === "A" || r.title === "B")).toHaveLength(1);
  });

  it("guard balapan: markProcessing dua kali → hanya satu berhasil", async () => {
    const r = await enqueue({ title: "R", sourceOrigin: "uji-ingest", rawContent: "<p>r</p>" });
    expect(await markProcessing(r.id)).toBe(true);
    expect(await markProcessing(r.id)).toBe(false);
    await markDone(r.id, "completed", { importedQuestionsCount: 3, aiNotes: "catatan" });
    const row = await getQueueItem(r.id);
    expect(row?.status).toBe("completed");
    expect(row?.importedQuestionsCount).toBe(3);
    expect(row?.aiNotes).toBe("catatan");
  });

  it("listPending memisahkan id yang bukan pending", async () => {
    const a = await enqueue({ title: "P1", sourceOrigin: "uji-ingest", rawContent: "<p>1</p>" });
    const b = await enqueue({ title: "P2", sourceOrigin: "uji-ingest", rawContent: "<p>2</p>" });
    await markProcessing(b.id);
    await markDone(b.id, "completed");
    const { items, nonPending } = await listPending([a.id, b.id, "00000000-0000-0000-0000-000000000000"]);
    expect(items.map((i) => i.id)).toEqual([a.id]);
    expect(nonPending).toContain(b.id);
  });

  it("markDone skipped + status terhitung", async () => {
    const r = await enqueue({ title: "S", sourceOrigin: "uji-ingest", rawContent: "<p>s</p>" });
    await markProcessing(r.id);
    await markDone(r.id, "skipped", { aiNotes: "artikel teori" });
    const counts = await countByStatus();
    expect(counts.skipped).toBeGreaterThanOrEqual(1);
  });
});

describe("commit (soal draft)", () => {
  it("commitItems membuat soal DRAFT + sumber website", async () => {
    const res = await commitItems([item()], machine, { sourceOrigin: "uji-ingest", grade: "umum" });
    expect(res.created).toBe(1);
    expect(res.skipped).toBe(0);
    const [q] = await sql`SELECT status, content_markdown, source_id FROM questions WHERE id = ${res.questionIds[0]}`;
    expect(q.status).toBe("draft");
    expect(q.source_id).toBeTruthy();
    const [s] = await sql`SELECT kind FROM sources WHERE id = ${q.source_id}`;
    expect(s.kind).toBe("website");
  });

  it("idempoten: soal dengan konten sama (sumber SAMA) tak dibuat ulang", async () => {
    const first = await commitItems([item()], machine, { sourceOrigin: "uji-ingest" });
    expect(first.created).toBe(1);
    const second = await commitItems([item()], machine, { sourceOrigin: "uji-ingest", sourceUrl: "https://a/1" });
    expect(second.created).toBe(0);
    expect(second.linked).toBe(1);
    // Provenance tetap satu baris (UNIQUE question_id+source_id → idempoten).
    const rows = await sql`SELECT count(*)::int AS n FROM question_sources WHERE question_id = ${first.questionIds[0]}`;
    expect(rows[0].n).toBe(1);
  });

  it("MANY-TO-MANY (ADR-0012): konten sama dari sumber BERBEDA → 1 soal, 2 provenance", async () => {
    const a = await commitItems([item()], machine, { sourceOrigin: "uji-ingest" });
    const b = await commitItems([item()], machine, {
      sourceOrigin: "uji-ingest-2",
      sourceUrl: "https://b/2",
      articleTitle: "Artikel B",
    });
    expect(a.created).toBe(1);
    expect(b.created).toBe(0); // TIDAK dibuat ulang
    expect(b.linked).toBe(1); // hanya ditautkan
    expect(b.questionIds[0]).toBe(a.questionIds[0]); // soal yang SAMA

    const total = await sql`SELECT count(*)::int AS n FROM questions`;
    expect(total[0].n).toBe(1);
    const prov = await sql`SELECT count(*)::int AS n FROM question_sources WHERE question_id = ${a.questionIds[0]}`;
    expect(prov[0].n).toBe(2); // dua sumber
    // Judul artikel tersimpan di provenance (cacat lama: dibuang).
    const t = await sql`SELECT title FROM question_sources WHERE question_id = ${a.questionIds[0]} AND title = 'Artikel B'`;
    expect(t.length).toBe(1);
  });

  it("provenance artikel (judul + url + waktu akses) TERSIMPAN saat commit", async () => {
    const at = new Date("2026-10-01T08:00:00Z");
    const res = await commitItems([item()], machine, {
      sourceOrigin: "uji-ingest",
      sourceUrl: "https://sumber/artikel",
      articleTitle: "Pembahasan Limit",
      accessedAt: at,
    });
    const [p] = await sql`SELECT title, url, accessed_at FROM question_sources WHERE question_id = ${res.questionIds[0]}`;
    expect(p.title).toBe("Pembahasan Limit");
    expect(p.url).toBe("https://sumber/artikel");
    expect(new Date(p.accessed_at).toISOString()).toBe(at.toISOString());
  });

  it("kunci kosong tetap draft (tak menebak)", async () => {
    const res = await commitItems([item({ correct: [] })], machine, { sourceOrigin: "uji-ingest" });
    const [q] = await sql`SELECT answer_key FROM questions WHERE id = ${res.questionIds[0]}`;
    expect(q.answer_key.correct).toBeUndefined();
  });

  it("stem kosong dilewati (tak simpan sampah)", async () => {
    const res = await commitItems([item({ stem: "   " })], machine, { sourceOrigin: "uji-ingest" });
    expect(res.created).toBe(0);
    expect(res.skipped).toBe(1);
  });

  it("resolveSourceId idempoten (sumber sama → id sama)", async () => {
    const a = await resolveSourceId("uji-ingest");
    const b = await resolveSourceId("uji-ingest");
    expect(a).toBe(b);
  });

  it("existingItemHashes mengenali soal yang sudah ada", async () => {
    const srcId = await resolveSourceId("uji-ingest");
    await commitItems([item()], machine, { sourceOrigin: "uji-ingest" });
    const hashes = await existingItemHashes(srcId);
    expect(hashes.has(itemHash(srcId, item().stem))).toBe(true);
  });
});

describe("hash (idempotensi)", () => {
  it("articleHash konsisten & menghasilkan 64 char", () => {
    expect(articleHash("<p>x</p>")).toBe(articleHash("<p>x</p>"));
    expect(articleHash("<p>x</p>")).toHaveLength(64);
  });
  it("itemHash tahan perbedaan spasi (legacy)", () => {
    expect(itemHash("s", "a  b\nc")).toBe(itemHash("s", " a b  c "));
  });
  it("contentHash: TANPA sumber — stem+opsi sama walau sumber beda", () => {
    const a = contentHash("Berapa 1+1?", ["1", "2"]);
    const b = contentHash("Berapa  1+1?", ["1", "2"]); // spasi beda
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
  it("contentHash: opsi TERACAK dianggap sama (himpunan, label & urutan diabaikan)", () => {
    expect(contentHash("S?", ["dua", "satu"])).toBe(contentHash("S?", ["satu", "dua"]));
  });
  it("contentHash: opsi BEDA → hash beda (keputusan (b) stem+opsi)", () => {
    expect(contentHash("S?", ["a", "b"])).not.toBe(contentHash("S?", ["a", "c"]));
  });
  it("contentHash: stem beda → hash beda", () => {
    expect(contentHash("Satu?", ["a"])).not.toBe(contentHash("Dua?", ["a"]));
  });
});
