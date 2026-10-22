import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes INTEGRASI MCP (M11) — server nyata + DB uji, lewat transport in-memory.
 *
 * Membuktikan:
 *  1. tool terdaftar (create/search/get/enrich/embed) — TANPA ubah-status/hapus/bundle;
 *  2. agen TIDAK PERNAH melihat `answer_key` di keluaran tool;
 *  3. izin ditegakkan (`own` untuk edit; machine ditolak);
 *  4. alur nyata: create → get → search mengembalikan soal yang baru dibuat.
 */

const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const { createMcpServer } = await import("@/lib/mcp/server");
const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");

const agent: Actor = { id: "srv-mcp-agent", name: "Agent Uji", roles: ["agent"], via: "apikey" };
const mesin: Actor = { id: "srv-mcp-machine", name: "Machine", roles: ["machine"], via: "apikey" };

/** Buka klien MCP pada server untuk aktor tertentu. */
async function connect(a: Actor) {
  const server = createMcpServer(a);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(ct);
  return { client, server };
}

/** Panggil tool & kembalikan teksnya (di-parse bila JSON). */
async function call(client: { callTool: (x: never) => Promise<unknown> }, name: string, args: Record<string, unknown>) {
  const r = (await (client as unknown as { callTool: (a: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }> }).callTool({ name, arguments: args }));
  const text = r.content[0]?.text ?? "";
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* biarkan teks */
  }
  return { text, parsed: parsed as Record<string, unknown>, isError: r.isError === true };
}

async function cleanAll() {
  await sql`DELETE FROM question_options`;
  await sql`DELETE FROM question_topics`;
  await sql`DELETE FROM question_tags`;
  await sql`DELETE FROM questions`;
}

let client: Awaited<ReturnType<typeof connect>>["client"];
let server: Awaited<ReturnType<typeof connect>>["server"];

beforeAll(async () => {
  ({ client, server } = await connect(agent));
});
afterAll(async () => {
  await client.close();
  await server.close();
  await sql.end();
});
beforeEach(async () => {
  await cleanAll();
});

describe("M11 — MCP tools", () => {
  it("mendaftarkan tool yang diizinkan & TIDAK membuka status/hapus/bundle", async () => {
    const list = await client.listTools();
    const names = list.tools.map((t) => t.name);
    expect(names).toContain("search_questions");
    expect(names).toContain("get_question");
    expect(names).toContain("create_question");
    expect(names).toContain("enrich_question");
    expect(names).toContain("embed_questions");
    // Terlarang:
    expect(names.some((n) => /delete|bundle|set_?ready|archive|status/i.test(n))).toBe(false);
  });

  it("create_question → draft, lalu get_question mengembalikannya", async () => {
    const c = await call(client, "create_question", {
      questionType: "single_choice",
      difficulty: 3,
      cognitiveLevel: "apply",
      grade: "SMA-11",
      contentMarkdown: "Hitung $1+1$.",
      topicIds: [],
      options: [
        { label: "A", contentMarkdown: "1", isCorrect: false },
        { label: "B", contentMarkdown: "2", isCorrect: true },
      ],
      answerKey: { type: "single", value: ["B"] },
    });
    expect(c.isError).toBe(false);
    expect(c.parsed.status).toBe("draft"); // paksa draft
    const id = c.parsed.id as string;

    const g = await call(client, "get_question", { id });
    expect(g.isError).toBe(false);
    expect(g.parsed.id).toBe(id);
  });

  it("AGEN TIDAK PERNAH melihat answer_key di keluaran tool", async () => {
    const c = await call(client, "create_question", {
      questionType: "single_choice",
      difficulty: 2,
      cognitiveLevel: "remember",
      grade: "SMA-10",
      contentMarkdown: "Soal ber-kunci.",
      topicIds: [],
      answerKey: { type: "single", value: ["A"], secret: "JANGAN-BOCOR" },
    });
    const id = c.parsed.id as string;
    const g = await call(client, "get_question", { id });
    expect(g.text).not.toMatch(/answerKey|answer_key/i);
    expect(g.text).not.toContain("JANGAN-BOCOR");

    const s = await call(client, "search_questions", { q: "ber-kunci" });
    expect(s.text).not.toMatch(/answerKey|answer_key/i);
    expect(s.text).not.toContain("JANGAN-BOCOR");
  });

  it("search menemukan soal yang baru dibuat", async () => {
    await call(client, "create_question", {
      questionType: "essay",
      difficulty: 4,
      cognitiveLevel: "analyze",
      grade: "SMA-12",
      contentMarkdown: "Buktikan identitas trigonometri unik-xyz.",
      topicIds: [],
    });
    const s = await call(client, "search_questions", { q: "unik-xyz" });
    expect(s.isError).toBe(false);
    const items = (s.parsed.items as { id: string }[]) ?? [];
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("role machine DITOLAK baca soal (hanya ingest)", async () => {
    const { client: mc, server: ms } = await connect(mesin);
    // ARC-06: tool tak berkapabilitas tak didaftarkan → tak muncul di list.
    const list = await mc.listTools();
    expect(list.tools.map((t) => t.name)).not.toContain("search_questions");
    const r = await call(mc, "search_questions", { q: "apa" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/not found|question\.read|izin|kapabilitas/i);
    await mc.close();
    await ms.close();
  });

  it("enrich_question pada soal ORANG LAIN ditolak (own)", async () => {
    // Soal dibuat aktor lain (bukan srv-mcp-agent).
    const rows = await sql`
      INSERT INTO questions (question_type, difficulty, cognitive_level, grade, content_markdown, author_id, status)
      VALUES ('essay', 3, 'apply', 'SMA-11', 'Soal milik orang lain.', 'pemilik-lain', 'draft')
      RETURNING id`;
    const id = rows[0].id as string;
    const r = await call(client, "enrich_question", { questionId: id });
    expect(r.isError).toBe(true);
  });

  it("ARC-06: agent (izin penuh) melihat SELURUH tool yang diizinkan", async () => {
    const list = await client.listTools();
    const names = list.tools.map((t) => t.name);
    for (const n of [
      "search_questions",
      "get_question",
      "create_question",
      "list_topics",
      "list_sources",
      "enrich_question",
      "embed_questions",
    ]) {
      expect(names).toContain(n);
    }
  });

  it("ARC-06: API key menyempit → tool di luar izin TIDAK didaftarkan", async () => {
    // Agen dengan izin `question` hanya baca → tak punya create/enrichment.
    const sempit: Actor = {
      id: "srv-mcp-sempit",
      name: "Agen Sempit",
      roles: ["agent"],
      via: "apikey",
      apiKeyPermissions: { question: ["read"] },
    };
    const { client: sc, server: ss } = await connect(sempit);
    const names = (await sc.listTools()).tools.map((t) => t.name);
    expect(names).toContain("search_questions");
    expect(names).toContain("get_question");
    expect(names).not.toContain("create_question");
    expect(names).not.toContain("enrich_question");
    expect(names).not.toContain("embed_questions");
    await sc.close();
    await ss.close();
  });
});
