import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes INTEGRASI enrichment (M10-d) — DB uji nyata.
 * LLM & embedding di-mock (tak panggil jaringan) — fokus alur DB.
 */

const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

// Mock LLM & embedding.
const mockChatJson = vi.fn();
const mockEmbedText = vi.fn();
vi.mock("@/lib/ai/client", () => ({
  chatJson: (...a: unknown[]) => mockChatJson(...a),
  chat: vi.fn(),
  listModels: vi.fn(),
  health: vi.fn(),
}));
vi.mock("@/lib/embedding/bge-m3", () => ({
  embedText: (...a: unknown[]) => mockEmbedText(...a),
  embedTexts: vi.fn(),
  embeddingModel: () => "bge-m3",
  EMBEDDING_DIM: 1024,
}));

const { enrichQuestion, enrichQuestions, embedQuestions } = await import("@/lib/services/enrichment-service");
const { saveAiSettings } = await import("@/lib/services/ai-settings-service");
const { db } = await import("@/lib/db");
const { appSettings } = await import("@/lib/db/schema/system");
const { eq } = await import("drizzle-orm");

const guru: Actor = { id: "guru-enrich", name: "Guru", roles: ["teacher"], via: "session" };
const noone: Actor = { id: "noone", name: "X", roles: [], via: "session" };

async function cleanAll() {
  await sql`DELETE FROM question_topics`;
  await sql`DELETE FROM question_tags`;
  await sql`DELETE FROM questions`;
  // MAT-131A: baris baru tidak punya slug → bersihkan berdasarkan nama uji.
  // Tetap hapus sisa slug legacy (data lama) agar tidak mengganggu.
  await sql`DELETE FROM tags WHERE lower(name) IN ('a b', 'a-b', 'kalkulus', 'turunan') OR slug IN ('a-b','kalkulus','turunan') OR length(slug) >= 90`;
  await sql`DELETE FROM topics WHERE lower(name) IN ('aljabar', 'bilangan') OR slug IN ('a-b','aljabar','bilangan') OR length(slug) >= 90`;
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable`;
  await sql`DELETE FROM audit_logs`;
  await sql`ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable`;
  for (const k of ["ai.enabled", "ai.base_url", "ai.api_key", "ai.model", "ai.max_tokens", "ai.timeout_ms"]) {
    await db.delete(appSettings).where(eq(appSettings.key, k));
  }
}

async function makeQuestion(stem = "Tentukan turunan dari $x^2$."): Promise<string> {
  const [r] = await sql`
    INSERT INTO questions (question_type, difficulty, cognitive_level, grade, content_markdown, answer_key, status, author_id)
    VALUES ('single_choice', 3, 'apply', 'sma-10', ${stem}, '{"correct":["A"]}'::jsonb, 'draft', ${guru.id})
    RETURNING id`;
  return r.id;
}

/**
 * Soal PG dengan opsi A–E (A kunci, B–E pengecoh) untuk uji rationale.
 * MAT-146: opsi ditulis ke `data_payload.options` (JSONB) — bukan tabel lagi.
 */
async function makePgQuestion(stem = "Berapa $1+1$?"): Promise<string> {
  const labels = ["A", "B", "C", "D", "E"];
  const dataPayload = {
    type: "multiple_choice",
    shuffleOptions: true,
    options: labels.map((label, i) => ({
      id: label,
      contentMarkdown: String(i + 1),
    })),
  };
  const [r] = await sql`
    INSERT INTO questions (question_type, difficulty, cognitive_level, grade, content_markdown, data_payload, answer_key, status, author_id)
    VALUES ('single_choice', 2, 'apply', 'sma-10', ${stem},
            ${sql.json(dataPayload)}, '{"correct":["A"]}'::jsonb, 'draft', ${guru.id})
    RETURNING id`;
  return r.id;
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(async () => {
  await cleanAll();
  mockChatJson.mockReset();
  mockEmbedText.mockReset();
  // Default: AI siap.
  await saveAiSettings({ enabled: true, baseUrl: "https://ai.test/v1", model: "m", apiKey: "k" });
});
afterAll(async () => {
  await cleanAll();
  await sql.end();
});

describe("enrichment — enrichQuestion", () => {
  it("menerapkan usulan + status draft → review", async () => {
    const id = await makeQuestion();
    mockChatJson.mockResolvedValue({
      ok: true,
      data: { topics: ["Aljabar"], difficulty: 2, cognitiveLevel: "understand", tags: ["Kalkulus"], notes: "ok" },
    });
    const r = await enrichQuestion(id, guru, ["topics", "difficulty", "cognitiveLevel", "tags"]);
    expect(r.ok).toBe(true);
    expect(r.status).toBe("review");

    const [q] = await sql`SELECT status, difficulty, cognitive_level, ai_tagged FROM questions WHERE id = ${id}`;
    expect(q.status).toBe("review");
    expect(q.difficulty).toBe(2);
    expect(q.cognitive_level).toBe("understand");
    expect(q.ai_tagged).toBe(true);

    const t = await sql`SELECT t.name FROM question_topics qt JOIN topics t ON t.id = qt.topic_id WHERE qt.question_id = ${id}`;
    expect(t.map((x) => x.name)).toContain("Aljabar");
    const tg = await sql`SELECT g.name FROM question_tags qt JOIN tags g ON g.id = qt.tag_id WHERE qt.question_id = ${id}`;
    expect(tg.map((x) => x.name)).toContain("kalkulus");
  });

  it("idempoten: enrich dua kali tidak menggandakan topik", async () => {
    const id = await makeQuestion();
    mockChatJson.mockResolvedValue({ ok: true, data: { topics: ["Aljabar"], tags: [] } });
    await enrichQuestion(id, guru, ["topics"]);
    await enrichQuestion(id, guru, ["topics"]);
    const t = await sql`SELECT count(*)::int n FROM question_topics WHERE question_id = ${id}`;
    expect(t[0].n).toBe(1);
  });

  it("tidak menyentuh answer_key", async () => {
    const id = await makeQuestion();
    mockChatJson.mockResolvedValue({ ok: true, data: { difficulty: 5 } });
    await enrichQuestion(id, guru, ["difficulty"]);
    const [q] = await sql`SELECT answer_key FROM questions WHERE id = ${id}`;
    expect(q.answer_key.correct).toEqual(["A"]);
  });

  it("AI gagal → soal tak berubah, ok:false", async () => {
    const id = await makeQuestion();
    mockChatJson.mockResolvedValue({ ok: false, error: "timeout" });
    const r = await enrichQuestion(id, guru);
    expect(r.ok).toBe(false);
    const [q] = await sql`SELECT status, ai_tagged FROM questions WHERE id = ${id}`;
    expect(q.status).toBe("draft");
    expect(q.ai_tagged).toBe(false);
  });

  it("AI belum siap → ok:false tanpa memanggil LLM", async () => {
    const id = await makeQuestion();
    await saveAiSettings({ enabled: false });
    const r = await enrichQuestion(id, guru);
    expect(r.ok).toBe(false);
    expect(mockChatJson).not.toHaveBeenCalled();
  });

  it("status ready TIDAK diturunkan", async () => {
    const id = await makeQuestion();
    await sql`UPDATE questions SET status='ready' WHERE id=${id}`;
    mockChatJson.mockResolvedValue({ ok: true, data: { difficulty: 2 } });
    const r = await enrichQuestion(id, guru, ["difficulty"]);
    expect(r.status).toBe("ready");
  });

  it("menulis audit (action update)", async () => {
    const id = await makeQuestion();
    mockChatJson.mockResolvedValue({ ok: true, data: { difficulty: 3 } });
    await enrichQuestion(id, guru, ["difficulty"]);
    const a = await sql`SELECT action FROM audit_logs WHERE entity_id = ${id} AND entity_type = 'question'`;
    expect(a.map((x) => x.action)).toContain("update");
  });

  it("izin: peran tanpa question:edit → melempar", async () => {
    const id = await makeQuestion();
    await expect(enrichQuestion(id, noone)).rejects.toThrow();
  });

  it("batch: ringkas ok/failed", async () => {
    const a = await makeQuestion("Soal A");
    const b = await makeQuestion("Soal B");
    mockChatJson.mockResolvedValue({ ok: true, data: { difficulty: 2 } });
    const r = await enrichQuestions([a, b], guru, ["difficulty"]);
    expect(r.ok).toBe(2);
    expect(r.failed).toBe(0);
  });
});

describe("enrichment — kontrak pedagogi (MAT-41)", () => {
  const RATIONALE = {
    B: "Siswa keliru menganggap turunan x^2 menjadi x sehingga memilih nilai yang terlalu kecil.",
    C: "Siswa lupa menambahkan konstanta sehingga hasilnya bergeser satu satuan dari jawaban benar.",
    D: "Siswa tertukar urutan operasi sehingga mengalikan sebelum menjumlahkan dan hasilnya salah.",
    E: "Siswa membalik tanda saat memindahkan ruas sehingga memperoleh nilai negatif yang keliru.",
  };

  it("menerapkan distractor_rationale ke SETIAP opsi salah saja (kunci utuh)", async () => {
    const id = await makePgQuestion();
    mockChatJson.mockResolvedValue({
      ok: true,
      data: { distractorRationale: RATIONALE, notes: "ok" },
    });
    const r = await enrichQuestion(id, guru, ["distractorRationale"]);
    expect(r.ok).toBe(true);
    expect(r.pedagogy?.rationaleApplied).toBe(4);

    // MAT-146: rationale dibaca dari `data_payload.options` (JSONB).
    const [q] = await sql`SELECT data_payload, answer_key FROM questions WHERE id = ${id}`;
    const opts = q.data_payload.options as { id: string; distractorRationale?: string }[];
    // Opsi benar (A) TIDAK diisi rationale.
    expect(opts.find((o) => o.id === "A")!.distractorRationale ?? null).toBeNull();
    // Semua pengecoh (B–E) terisi.
    for (const label of ["B", "C", "D", "E"]) {
      expect(opts.find((o) => o.id === label)!.distractorRationale).toBeTruthy();
    }
    // Kunci tidak berubah.
    expect(q.answer_key.correct).toEqual(["A"]);
  });

  it("laporan kontrak pedagogi ok bila rationale lengkap & KaTeX bersih", async () => {
    const id = await makePgQuestion();
    mockChatJson.mockResolvedValue({ ok: true, data: { distractorRationale: RATIONALE } });
    const r = await enrichQuestion(id, guru, ["distractorRationale"]);
    expect(r.pedagogy?.ok).toBe(true);
    expect(r.pedagogy?.katexIssues).toBe(0);
    expect(r.pedagogy?.rationaleIssues).toBe(0);
  });

  it("laporan kontrak pedagogi menandai rationale yang belum lengkap", async () => {
    const id = await makePgQuestion();
    // Hanya B yang diisi → C, D, E belum ber-rationale.
    mockChatJson.mockResolvedValue({ ok: true, data: { distractorRationale: { B: RATIONALE.B } } });
    const r = await enrichQuestion(id, guru, ["distractorRationale"]);
    expect(r.pedagogy?.rationaleApplied).toBe(1);
    expect(r.pedagogy?.rationaleIssues).toBe(3);
    expect(r.pedagogy?.ok).toBe(false);
  });

  it("menerapkan rubrik ke answer_key.rubric tanpa mengubah kunci", async () => {
    const id = await makePgQuestion();
    mockChatJson.mockResolvedValue({
      ok: true,
      data: {
        rubric: {
          totalPoints: 5,
          criteria: [
            { description: "Menuliskan model persamaan yang benar", points: 3 },
            { description: "Menyelesaikan dan menafsirkan hasil", points: 2 },
          ],
        },
      },
    });
    const r = await enrichQuestion(id, guru, ["rubric"]);
    expect(r.pedagogy?.rubricApplied).toBe(true);
    const [q] = await sql`SELECT answer_key FROM questions WHERE id = ${id}`;
    expect(q.answer_key.rubric.totalPoints).toBe(5);
    expect(q.answer_key.rubric.criteria).toHaveLength(2);
    expect(q.answer_key.correct).toEqual(["A"]); // kunci tak tersentuh
  });

  it("menandai galat KaTeX pada konten soal lewat laporan pedagogi", async () => {
    const id = await makePgQuestion("Rumus rusak: $\\frac{1}$");
    mockChatJson.mockResolvedValue({ ok: true, data: { difficulty: 2 } });
    const r = await enrichQuestion(id, guru, ["difficulty"]);
    expect(r.pedagogy?.katexIssues).toBeGreaterThan(0);
    expect(r.pedagogy?.ok).toBe(false);
  });

  it("esai tanpa rubrik → laporan pedagogi menandai rubrik kosong", async () => {
    const [row] = await sql`
      INSERT INTO questions (question_type, difficulty, cognitive_level, grade, content_markdown, answer_key, status, author_id)
      VALUES ('essay', 3, 'analyze', 'sma-11', 'Uraikan pembuktiannya.', '{}'::jsonb, 'draft', ${guru.id})
      RETURNING id`;
    mockChatJson.mockResolvedValue({ ok: true, data: { difficulty: 4 } });
    const r = await enrichQuestion(row.id, guru, ["difficulty"]);
    expect(r.pedagogy?.rubricIssues).toBeGreaterThan(0);
    expect(r.pedagogy?.ok).toBe(false);
  });

  it("MAT-131A: nama panjang/ligatur disimpan utuh & slug NULL (tak ada batas varchar slug)", async () => {
    const id = await makeQuestion();
    // Dulu: nama 50 char → slug NFKD 150 char → error varchar(100). Kini slug
    // tidak ditulis (NULL), jadi nama apa pun aman dan tersimpan utuh.
    const ligatureName = "ﬃ".repeat(50);
    mockChatJson.mockResolvedValue({ ok: true, data: { tags: [ligatureName] } });
    const r = await enrichQuestion(id, guru, ["tags"]);
    expect(r.ok).toBe(true);
    const [t] = await sql`SELECT name, slug FROM tags WHERE name = ${ligatureName}`;
    expect(t).toBeTruthy();
    expect(t.slug).toBeNull();
  });

  it("MAT-131A: lookup tag berbasis nama — dua nama mirip-slug tetap dua baris", async () => {
    // Dulu slug "a-b" bentrok. Kini identitas = nama (dinormalisasi lowercase
    // oleh normalizeProposal), jadi keduanya sah berdiri sendiri.
    await sql`INSERT INTO tags (name) VALUES ('A B')`;
    const id = await makeQuestion();
    mockChatJson.mockResolvedValue({ ok: true, data: { tags: ["A-B"] } });
    const r = await enrichQuestion(id, guru, ["tags"]);
    expect(r.ok).toBe(true);
    const rows = await sql`SELECT name FROM tags WHERE lower(name) IN ('a b', 'a-b')`;
    expect(rows.length).toBe(2);
  });
});

describe("enrichment — embedQuestions", () => {
  it("menyimpan embedding + hash + model", async () => {
    const id = await makeQuestion();
    mockEmbedText.mockResolvedValue({ ok: true, vector: Array.from({ length: 1024 }, () => 0.01) });
    const r = await embedQuestions([id], guru);
    expect(r.ok).toBe(1);
    // ADR-0019: vektor kini di tabel `question_embeddings`.
    const [q] = await sql`SELECT embedding IS NOT NULL AS has_emb, embedding_content_hash, embedding_model_name FROM question_embeddings WHERE question_id = ${id}`;
    expect(q.has_emb).toBe(true);
    expect(q.embedding_content_hash).toBeTruthy();
    expect(q.embedding_model_name).toBe("bge-m3");
  });

  it("konten tak berubah → dilewati (skipped)", async () => {
    const id = await makeQuestion();
    mockEmbedText.mockResolvedValue({ ok: true, vector: Array.from({ length: 1024 }, () => 0.02) });
    await embedQuestions([id], guru);
    mockEmbedText.mockClear();
    const r = await embedQuestions([id], guru);
    expect(r.results[0].skipped).toBe(true);
    expect(mockEmbedText).not.toHaveBeenCalled();
  });

  it("gagal embedding → tak simpan, lapor error", async () => {
    const id = await makeQuestion();
    mockEmbedText.mockResolvedValue({ ok: false, error: "timeout" });
    const r = await embedQuestions([id], guru);
    expect(r.ok).toBe(0);
    // ADR-0019: cek di tabel `question_embeddings` — baris tidak ada.
    const rows = await sql`SELECT 1 FROM question_embeddings WHERE question_id = ${id}`;
    expect(rows.length).toBe(0);
  });

  it("id tak ditemukan → dilaporkan", async () => {
    const r = await embedQuestions(["00000000-0000-0000-0000-000000000000"], guru);
    expect(r.results[0].ok).toBe(false);
  });
});
