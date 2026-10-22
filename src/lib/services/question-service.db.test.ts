import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";
import {
  createQuestion,
  getQuestion,
  updateQuestion,
  changeQuestionStatus,
  setQuestionFlag,
  deleteQuestion,
  hardDeleteQuestion,
  getQuestionInternal,
  listQuestions,
} from "./question-service";
import { NotFoundError, ConflictError } from "@/lib/auth/guards";
import { buildQuestionFilter, collectTopicDescendants } from "@/lib/question/filters";
import { createTopic } from "./topic-service";
import { NotReadyError } from "@/lib/fsm/question-fsm";

/**
 * Tes INTEGRASI service soal (L5 ↔ L8) — DB uji nyata (lihat STRATEGI-TES §5).
 *
 * Menguji perilaku lintas-lapisan yang TAK bisa diuji unit:
 * - transaksi (soal + opsi + topik/label)
 * - invarian DB (stimulus depth, difficulty, siklus)
 * - guard FSM + kesiapan (`ready` wajib answer_key) via service
 * - audit tercatat
 */

const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");

const sql = postgres(url, { max: 4 });

const teacher: Actor = {
  id: "test-teacher",
  name: "Guru Uji",
  roles: ["teacher"],
  via: "session",
};
const admin: Actor = {
  id: "test-admin",
  name: "Admin Uji",
  roles: ["admin"],
  via: "session",
};

/** Bentuk input minimal yang valid. */
function baseInput(over: Record<string, unknown> = {}) {
  return {
    questionType: "single_choice" as const,
    difficulty: 3,
    cognitiveLevel: "remember" as const,
    grade: "g1",
    contentMarkdown: "Berapa $1+1$?",
    dataPayload: {},
    answerKey: {},
    status: "draft" as const,
    childOrder: 0,
    options: [],
    topicIds: [],
    tagIds: [],
    ...over,
  };
}

/** Bersihkan data soal + audit antar-tes. */
async function cleanAll() {
  await sql`DELETE FROM question_topics`;
  await sql`DELETE FROM question_tags`;
  await sql`UPDATE questions SET parent_id = NULL`;
  await sql`DELETE FROM questions`;
  await sql`UPDATE topics SET parent_id = NULL`;
  await sql`DELETE FROM topics`;
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable`;
  await sql`DELETE FROM audit_logs`;
  await sql`ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable`;
}

beforeAll(async () => {
  // Pastikan terhubung.
  await sql`SELECT 1`;
});

beforeEach(cleanAll);

afterAll(async () => {
  await cleanAll();
  await sql.end();
});

describe("createQuestion", () => {
  it("membuat soal + opsi dalam satu transaksi", async () => {
    const q = await createQuestion(
      baseInput({
        options: [
          { label: "A", contentMarkdown: "1", isCorrect: true, orderIndex: 0 },
          { label: "B", contentMarkdown: "2", isCorrect: false, orderIndex: 1 },
        ],
      }),
      teacher,
    );
    expect(q.id).toBeTruthy();
    expect(q.options).toHaveLength(2);
    expect(q.options.find((o) => o.isCorrect)?.label).toBe("A");
    expect(q.status).toBe("draft");
  });

  it("mencatat audit 'create'", async () => {
    const q = await createQuestion(baseInput(), teacher);
    const rows = await sql`SELECT action FROM audit_logs WHERE entity_id = ${q.id}`;
    expect(rows.map((r) => r.action)).toContain("create");
  });

  it("soal BOLEH dibuat TANPA answer_key (draft)", async () => {
    const q = await createQuestion(baseInput({ answerKey: {} }), teacher);
    expect(q.answerKey).toEqual({});
  });

  it("menolak stimulus dengan parentId", async () => {
    await expect(
      createQuestion(
        baseInput({ questionType: "stimulus", parentId: crypto.randomUUID() }),
        teacher,
      ),
    ).rejects.toThrow();
  });

  it("menolak anak dengan parentId yang bukan stimulus", async () => {
    const plain = await createQuestion(baseInput(), teacher);
    await expect(
      createQuestion(baseInput({ parentId: plain.id }), teacher),
    ).rejects.toThrow();
  });

  it("menerima anak dengan parent stimulus (depth 1)", async () => {
    const stim = await createQuestion(
      baseInput({ questionType: "stimulus", contentMarkdown: "Bacaan..." }),
      teacher,
    );
    const child = await createQuestion(
      baseInput({ parentId: stim.id }),
      teacher,
    );
    expect(child.parentId).toBe(stim.id);
  });

  it("menolak difficulty di luar 1–5 (invarian DB)", async () => {
    await expect(
      createQuestion(baseInput({ difficulty: 9 }), teacher),
    ).rejects.toThrow();
  });

  it("menyimpan dataPayload matrix_grid & matching apa adanya", async () => {
    const m = await createQuestion(
      baseInput({
        questionType: "matrix_grid",
        contentMarkdown: "Nilai tiap pernyataan.",
        dataPayload: {
          columns: ["Benar", "Salah"],
          rows: [{ label: "Sisi miring = 5 cm" }],
        },
      }),
      teacher,
    );
    expect((m.dataPayload as { rows: { label: string }[] }).rows[0].label).toBe(
      "Sisi miring = 5 cm",
    );

    const mt = await createQuestion(
      baseInput({
        questionType: "matching",
        contentMarkdown: "Jodohkan.",
        dataPayload: { left: ["sin 30°"], right: ["1/2"] },
      }),
      teacher,
    );
    const dp = mt.dataPayload as { left: string[]; right: string[] };
    expect(dp.left).toEqual(["sin 30°"]);
    expect(dp.right).toEqual(["1/2"]);
  });
});

describe("getQuestion & listQuestions", () => {
  it("getQuestion null bila tak ada", async () => {
    expect(await getQuestion(crypto.randomUUID())).toBeNull();
  });

  it("listQuestions mengembalikan item + total", async () => {
    await createQuestion(baseInput({ contentMarkdown: "Soal A" }), teacher);
    await createQuestion(baseInput({ contentMarkdown: "Soal B" }), teacher);
    const res = await listQuestions({ includeDeleted: false, mode: "text", limit: 10, offset: 0 });
    expect(res.total).toBeGreaterThanOrEqual(2);
    expect(res.items.length).toBeGreaterThanOrEqual(2);
  });
});

describe("updateQuestion", () => {
  it("memperbarui field parsial", async () => {
    const q = await createQuestion(baseInput(), teacher);
    const upd = await updateQuestion(
      q.id,
      { contentMarkdown: "Diubah", difficulty: 5 },
      teacher,
    );
    expect(upd.contentMarkdown).toBe("Diubah");
    expect(upd.difficulty).toBe(5);
  });

  it("mengganti opsi bila dikirim", async () => {
    const q = await createQuestion(
      baseInput({
        // MAT-146: kontrak Haladyna Rule 2 → minimal 2 opsi.
        options: [
          { label: "A", contentMarkdown: "x", isCorrect: true, orderIndex: 0 },
          { label: "B", contentMarkdown: "w", isCorrect: false, orderIndex: 1 },
        ],
      }),
      teacher,
    );
    const upd = await updateQuestion(
      q.id,
      {
        options: [
          { label: "A", contentMarkdown: "y", isCorrect: false, orderIndex: 0 },
          { label: "B", contentMarkdown: "z", isCorrect: true, orderIndex: 1 },
        ],
      },
      teacher,
    );
    expect(upd.options).toHaveLength(2);
  });

  it("NotFoundError untuk id tak ada", async () => {
    await expect(
      updateQuestion(crypto.randomUUID(), { difficulty: 2 }, teacher),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("changeQuestionStatus — FSM + kesiapan", () => {
  it("draft → review berhasil (tanpa answer_key)", async () => {
    const q = await createQuestion(baseInput(), teacher);
    const upd = await changeQuestionStatus(q.id, "review", admin);
    expect(upd.status).toBe("review");
  });

  it("review → ready TANPA answer_key DITOLAK (NotReadyError)", async () => {
    const q = await createQuestion(baseInput(), admin);
    await changeQuestionStatus(q.id, "review", admin);
    await expect(
      changeQuestionStatus(q.id, "ready", admin),
    ).rejects.toThrow(NotReadyError);
  });

  it("review → ready DENGAN answer_key BERHASIL", async () => {
    const q = await createQuestion(
      baseInput({ answerKey: { correct: "A" } }),
      admin,
    );
    await changeQuestionStatus(q.id, "review", admin);
    const upd = await changeQuestionStatus(q.id, "ready", admin);
    expect(upd.status).toBe("ready");
    expect(upd.lastReviewedAt).toBeTruthy();
  });

  it("stimulus bisa ready walau answer_key kosong", async () => {
    const q = await createQuestion(
      baseInput({ questionType: "stimulus" }),
      admin,
    );
    await changeQuestionStatus(q.id, "review", admin);
    const upd = await changeQuestionStatus(q.id, "ready", admin);
    expect(upd.status).toBe("ready");
  });

  it("transisi tak sah (draft → ready) ditolak FSM", async () => {
    const q = await createQuestion(baseInput({ answerKey: { correct: "A" } }), admin);
    await expect(
      changeQuestionStatus(q.id, "ready", admin),
    ).rejects.toThrow();
  });

  it("mencatat audit status_change", async () => {
    const q = await createQuestion(baseInput(), admin);
    await changeQuestionStatus(q.id, "review", admin);
    const rows = await sql`SELECT action FROM audit_logs
      WHERE entity_id = ${q.id} AND action = 'status_change'`;
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("menyimpan catatan penolakan pada flag_notes dan audit_logs saat tolak ke draft", async () => {
    const q = await createQuestion(baseInput({ status: "review" }), admin);
    const rejectNotes = "Kunci jawaban salah pada opsi C, perbaiki pembahasannya.";

    const rejected = await changeQuestionStatus(q.id, "draft", admin, rejectNotes);

    expect(rejected.status).toBe("draft");
    expect(rejected.flagNotes).toBe(rejectNotes);

    // Verifikasi tabel audit_logs mencatat catatan penolakan
    const rows = await sql`SELECT action, change_summary FROM audit_logs WHERE entity_id = ${q.id}`;
    const statusAudit = rows.find((a) => a.action === "status_change");
    expect(statusAudit?.change_summary).toContain(rejectNotes);
  });
});

describe("setQuestionFlag & deleteQuestion", () => {
  it("menandai soal bermasalah", async () => {
    const q = await createQuestion(baseInput(), teacher);
    const upd = await setQuestionFlag(q.id, true, "perlu cek", admin);
    expect(upd.isFlagged).toBe(true);
    expect(upd.flagNotes).toBe("perlu cek");
  });

  it("teacher TAK boleh menandai (izin flag = kurasi)", async () => {
    const q = await createQuestion(baseInput(), teacher);
    await expect(
      setQuestionFlag(q.id, true, "x", teacher),
    ).rejects.toThrow();
  });

  it("deleteQuestion men-soft-delete (tak lagi di getQuestion)", async () => {
    const q = await createQuestion(baseInput(), teacher);
    await deleteQuestion(q.id, teacher);
    expect(await getQuestion(q.id)).toBeNull();
  });
});

describe("M6 — filter & pencarian", () => {
  it("getQuestion mengembalikan topicIds (jalur baca — editor memakainya)", async () => {
    const kat = await createTopic({ name: `G8 Kat ${Date.now()}` }, admin);
    const sub = await createTopic({ name: "G8 Sub", parentId: kat.id }, admin);

    const q = await createQuestion(
      baseInput({ topicIds: [sub.id], contentMarkdown: `Soal topik ${Date.now()}` }),
      teacher,
    );

    // Round-trip: apa yang disimpan harus terbaca kembali — inilah yang
    // membuat pemilih topik di editor terisi saat menyunting soal lama.
    const read = await getQuestion(q.id, { viewer: teacher });
    expect(read?.topicIds).toBeDefined();
    expect(read?.topicIds).toContain(sub.id);
  });

  it("filter topik TERMASUK anak (rekursif)", async () => {
    // Buat Kategori > Topik > SubTopik, soal dikaitkan ke SubTopik.
    const kat = await createTopic({ name: `M6 Kat ${Date.now()}` }, admin);
    const top = await createTopic({ name: "Topik Anak", parentId: kat.id }, admin);
    const sub = await createTopic({ name: "Sub Soal", parentId: top.id }, admin);

    const q = await createQuestion(baseInput({ topicIds: [sub.id] }), teacher);

    // Filter pada KATEGORI (induk) harus menemukan soal yang terkait SUB-nya.
    const res = await listQuestions(
      { topicId: [kat.id], limit: 20, offset: 0 } as never,
      teacher,
    );
    expect(res.items.map((i) => i.id)).toContain(q.id);
  });

  it("filter MULTI-topik (G1.4) — gabungan keturunan beberapa induk", async () => {
    const katA = await createTopic({ name: `G1 A ${Date.now()}` }, admin);
    const subA = await createTopic({ name: "G1 Sub A", parentId: katA.id }, admin);
    const katB = await createTopic({ name: `G1 B ${Date.now()}` }, admin);
    const subB = await createTopic({ name: "G1 Sub B", parentId: katB.id }, admin);

    const qA = await createQuestion(
      baseInput({ topicIds: [subA.id], contentMarkdown: `Soal A ${Date.now()}` }),
      teacher,
    );
    const qB = await createQuestion(
      baseInput({ topicIds: [subB.id], contentMarkdown: `Soal B ${Date.now()}` }),
      teacher,
    );

    const res = await listQuestions(
      { topicId: [katA.id, katB.id], limit: 50, offset: 0 } as never,
      teacher,
    );
    const ids = res.items.map((i) => i.id);
    expect(ids).toContain(qA.id);
    expect(ids).toContain(qB.id);
  });

  it("collectTopicDescendants mengumpulkan seluruh subtree", async () => {
    const a = await createTopic({ name: `D ${Date.now()}` }, admin);
    const b = await createTopic({ name: "b", parentId: a.id }, admin);
    await createTopic({ name: "c", parentId: b.id }, admin);
    const ids = await collectTopicDescendants(a.id);
    expect(ids).toHaveLength(3);
    expect(ids).toContain(a.id);
  });

  it("PERF-01: filter tag memakai semi-join EXISTS (ditemukan & terisolasi)", async () => {
    const [tag] = await sql`
      INSERT INTO tags (name, slug) VALUES (${`perf1-${Date.now()}`}, ${`perf1-${Date.now()}`})
      RETURNING id`;
    const [other] = await sql`
      INSERT INTO tags (name, slug) VALUES (${`perf1b-${Date.now()}`}, ${`perf1b-${Date.now()}`})
      RETURNING id`;

    const withTag = await createQuestion(
      baseInput({ tagIds: [tag.id], contentMarkdown: `Soal bertag ${Date.now()}` }),
      teacher,
    );
    await createQuestion(
      baseInput({ tagIds: [other.id], contentMarkdown: `Soal tag lain ${Date.now()}` }),
      teacher,
    );

    const res = await listQuestions(
      { tagId: tag.id, limit: 20, offset: 0 } as never,
      teacher,
    );
    const ids = res.items.map((i) => i.id);
    expect(ids).toContain(withTag.id);
    expect(ids).toHaveLength(1);

    // Tag tak dikenal → hasil kosong (paritas perilaku lama).
    const none = await listQuestions(
      { tagId: "00000000-0000-0000-0000-000000000000", limit: 20, offset: 0 } as never,
      teacher,
    );
    expect(none.items).toHaveLength(0);
    await sql`DELETE FROM question_tags WHERE tag_id IN (${tag.id}, ${other.id})`;
    await sql`DELETE FROM tags WHERE id IN (${tag.id}, ${other.id})`;
  });

  it("pencarian trigram toleran typo ringan", async () => {
    await createQuestion(
      baseInput({ contentMarkdown: "Tentukan hasil dari limit fungsi trigonometri" }),
      teacher,
    );
    await createQuestion(
      baseInput({ contentMarkdown: "Hitung luas bangun datar persegi" }),
      teacher,
    );
    // "trigonometri" salah ketik jadi "trigonometr" → tetap menemukan.
    const res = await listQuestions(
      { q: "trigonometr", limit: 20, offset: 0 } as never,
      teacher,
    );
    expect(res.items.length).toBeGreaterThanOrEqual(1);
    expect(res.items[0].contentMarkdown).toContain("trigonometri");
  });

  it("buildQuestionFilter: tanpa q → byRelevance false", async () => {
    const f = await buildQuestionFilter({ limit: 20, offset: 0 } as never);
    expect(f.byRelevance).toBe(false);
  });

  it("mode semantic: fallback ke trigram saat embedding gagal", async () => {
    await createQuestion(baseInput({ contentMarkdown: "Soal semantik limit" }), teacher);
    // embedText tak tersedia (service mati) → tak melempar, tetap mengembalikan hasil.
    const res = await listQuestions(
      { q: "limit", mode: "semantic", limit: 20, offset: 0 } as never,
      teacher,
    );
    expect(Array.isArray(res.items)).toBe(true);
  });
});

describe("M4 — perbaikan audit (T-M4-3/4/5)", () => {
  const reviewer: Actor = {
    id: "test-reviewer",
    name: "Penelaah Uji",
    roles: ["reviewer"],
    via: "session",
  };

  it("T-M4-3: PENELAAH bisa review → ready atas soal ORANG LAIN", async () => {
    // Soal ditulis guru, disetujui penelaah (bukan pemiliknya).
    const q = await createQuestion(
      baseInput({ answerKey: { correct: ["A"] } }),
      teacher,
    );
    await changeQuestionStatus(q.id, "review", admin);
    const upd = await changeQuestionStatus(q.id, "ready", reviewer);
    expect(upd.status).toBe("ready");
  });

  it("T-M4-3: guru (bukan pemilik) TETAP ditolak untuk ready", async () => {
    const q = await createQuestion(
      baseInput({ answerKey: { correct: ["A"] } }),
      admin,
    );
    await changeQuestionStatus(q.id, "review", admin);
    await expect(changeQuestionStatus(q.id, "ready", teacher)).rejects.toThrow();
  });

  it("T-M4-5: transisi tak sah ditolak FSM (sabuk pertama)", async () => {
    const q = await createQuestion(
      baseInput({ answerKey: { correct: ["A"] } }),
      admin,
    );
    await changeQuestionStatus(q.id, "review", admin);
    await changeQuestionStatus(q.id, "ready", admin);
    // ready → draft TIDAK ada di TRANSITIONS → ditolak.
    await expect(
      changeQuestionStatus(q.id, "draft", admin),
    ).rejects.toThrow();
  });

  it("T-M4-4: hard delete HANYA setelah soft-delete", async () => {
    const q = await createQuestion(baseInput(), admin);
    // Belum soft-delete → tolak.
    await expect(hardDeleteQuestion(q.id, admin)).rejects.toThrow(ConflictError);
    // Soft-delete dulu.
    await deleteQuestion(q.id, admin);
    // Baru boleh permanen.
    await hardDeleteQuestion(q.id, admin);
    expect(await getQuestionInternal(q.id, { includeDeleted: true })).toBeNull();
  });
});
