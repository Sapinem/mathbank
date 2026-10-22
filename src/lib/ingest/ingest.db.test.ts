import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";
import { enqueue, listQueue, listPending, markProcessing, markDone, countByStatus, getQueueItem } from "./queue";
import { commitItems, resolveSourceId, existingItemHashes } from "./commit";
import { getQuestion } from "@/lib/services/question-read";
import { articleHash, itemHash, contentHash } from "./hash";
import type { ParsedItem } from "./parsers/types";

/**
 * Tes INTEGRASI ingest (M9-3) — DB uji nyata.
 * Menguji: antrean, dedup artikel, guard balapan, commit → soal draft, idempotensi.
 */

const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");

const sql = postgres(url, { max: 4 });

const machine: Actor = { id: "test-machine", name: "Mesin Uji", roles: ["machine"], via: "apikey" };

async function cleanAll() {
  // ADR-0014: `question_sources` dihapus; asal soal kini lewat bundle_items.
  await sql`DELETE FROM bundle_items`;
  await sql`DELETE FROM bundles WHERE bundle_type = 'source'`;
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
  it("commitItems membuat soal DRAFT + BUNDLE bersumber website (ADR-0014)", async () => {
    const res = await commitItems([item()], machine, { sourceOrigin: "uji-ingest", grade: "umum" });
    expect(res.created).toBe(1);
    expect(res.skipped).toBe(0);
    const [q] = await sql`SELECT status, content_markdown FROM questions WHERE id = ${res.questionIds[0]}`;
    expect(q.status).toBe("draft");
    // Soal TIDAK lagi punya source_id — asalnya lewat bundle.
    const cols = await sql`SELECT column_name FROM information_schema.columns
      WHERE table_name='questions' AND column_name='source_id'`;
    expect(cols.length).toBe(0);
    // Bundle dibuat oleh ingest, bertipe `source`, menunjuk sumber website.
    const [b] = await sql`SELECT b.bundle_type, b.grade, s.kind
      FROM bundles b
      JOIN bundle_items bi ON bi.bundle_id = b.id
      JOIN sources s ON s.id = b.source_id
      WHERE bi.question_id = ${res.questionIds[0]}`;
    expect(b.bundle_type).toBe("source");
    expect(b.grade).toBe("umum");
    expect(b.kind).toBe("website");
  });

  it("idempoten: naskah SAMA di-ingest dua kali → 1 soal, 1 keanggotaan bundle", async () => {
    const opts = { sourceOrigin: "uji-ingest", sourceUrl: "https://a/1", articleTitle: "Artikel A" };
    const first = await commitItems([item()], machine, opts);
    expect(first.created).toBe(1);
    // Ingest ULANG naskah yang sama (URL sama) → bundle dipakai ulang.
    const second = await commitItems([item()], machine, opts);
    expect(second.created).toBe(0);
    expect(second.linked).toBe(1);
    // UNIQUE bundle_id+question_id → tak menggandakan keanggotaan.
    const rows = await sql`SELECT count(*)::int AS n FROM bundle_items WHERE question_id = ${first.questionIds[0]}`;
    expect(rows[0].n).toBe(1);
    // Dan bundle-nya memang cuma satu (tak dibuat ulang).
    const bs = await sql`SELECT count(*)::int AS n FROM bundles WHERE url = 'https://a/1'`;
    expect(bs[0].n).toBe(1);
  });

  it("MANY-TO-MANY (ADR-0014): konten sama dari sumber BERBEDA → 1 soal, 2 bundle", async () => {
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
    const prov = await sql`SELECT count(*)::int AS n FROM bundle_items WHERE question_id = ${a.questionIds[0]}`;
    expect(prov[0].n).toBe(2); // dua naskah → soal yang sama
    // Judul artikel tersimpan di BUNDLE (bukan lagi per-butir).
    const t = await sql`SELECT b.title FROM bundles b
      JOIN bundle_items bi ON bi.bundle_id = b.id
      WHERE bi.question_id = ${a.questionIds[0]} AND b.title = 'Artikel B'`;
    expect(t.length).toBe(1);
  });

  it("bundle (judul + url artikel) TERSIMPAN saat commit — ADR-0014 #3", async () => {
    const res = await commitItems([item()], machine, {
      sourceOrigin: "uji-ingest",
      sourceUrl: "https://sumber/artikel",
      articleTitle: "Pembahasan Limit",
    });
    // URL artikel hidup di BUNDLE (`sources.url` = situsnya, bukan artikelnya).
    const [b] = await sql`SELECT b.title, b.url FROM bundles b
      JOIN bundle_items bi ON bi.bundle_id = b.id
      WHERE bi.question_id = ${res.questionIds[0]}`;
    expect(b.title).toBe("Pembahasan Limit");
    expect(b.url).toBe("https://sumber/artikel");
  });

  it("T5: getQuestion menyertakan asal-usul (bundles) — multi-naskah", async () => {
    const a = await commitItems([item()], machine, {
      sourceOrigin: "uji-ingest",
      articleTitle: "Artikel A",
    });
    await commitItems([item()], machine, {
      sourceOrigin: "uji-ingest-2",
      articleTitle: "Artikel B",
    });
    const q = await getQuestion(a.questionIds[0]!, { viewer: machine });
    expect(q).not.toBeNull();
    expect(q!.bundles).toBeDefined();
    expect(q!.bundles!.length).toBe(2);
    const titles = q!.bundles!.map((b) => b.title).sort();
    expect(titles).toEqual(["Artikel A", "Artikel B"]);
  });

  it("kunci kosong tetap draft (tak menebak)", async () => {
    const res = await commitItems([item({ correct: [] })], machine, { sourceOrigin: "uji-ingest" });
    const [q] = await sql`SELECT answer_key FROM questions WHERE id = ${res.questionIds[0]}`;
    expect(q.answer_key.correct).toBeUndefined();
  });

  // ── Peringatan parser → isFlagged (STRATEGI-INGEST §3.2) ──────────
  // Sebelumnya `warnings` DIBUANG di commit: soal tanpa kunci masuk sebagai
  // draft biasa tanpa tanda, jadi guru tak tahu mana yang perlu ditelaah.
  it("peringatan parser → isFlagged + flagNotes tersimpan", async () => {
    const res = await commitItems(
      [item({ correct: [], warnings: ["Kunci jawaban tidak ditemukan — perlu telaah"] })],
      machine,
      { sourceOrigin: "uji-ingest" },
    );
    const [q] = await sql`SELECT is_flagged, flag_notes FROM questions WHERE id = ${res.questionIds[0]}`;
    expect(q.is_flagged).toBe(true);
    expect(q.flag_notes).toContain("Kunci jawaban tidak ditemukan");
  });

  it("tanpa peringatan → TIDAK ditandai (tak semua soal dicap bermasalah)", async () => {
    const res = await commitItems([item()], machine, { sourceOrigin: "uji-ingest" });
    const [q] = await sql`SELECT is_flagged, flag_notes FROM questions WHERE id = ${res.questionIds[0]}`;
    expect(q.is_flagged).toBe(false);
    expect(q.flag_notes).toBeNull();
  });

  it("beberapa peringatan → digabung jadi satu catatan", async () => {
    const res = await commitItems(
      [
        item({
          options: [
            { label: "A", text: "1", isCorrect: true },
            { label: "B", text: "2", isCorrect: false },
            { label: "C", text: "3", isCorrect: false },
          ],
          warnings: ["Opsi hanya 3 — mungkin parsing kurang", "Kunci jawaban tidak ditemukan — perlu telaah"],
        }),
      ],
      machine,
      { sourceOrigin: "uji-ingest" },
    );
    const [q] = await sql`SELECT flag_notes FROM questions WHERE id = ${res.questionIds[0]}`;
    expect(q.flag_notes).toContain("Opsi hanya 3");
    expect(q.flag_notes).toContain("Kunci jawaban tidak ditemukan");
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
