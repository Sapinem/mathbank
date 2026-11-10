import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fase 1 — gerbang persetujuan soal, diuji unit murni (tanpa DB).
 *
 * Pola mengikuti `question-status.test.ts`: `@/lib/db` di-mock, begitu juga
 * pembaca/audit/sinkron media, sehingga yang diuji murni keputusan service:
 *   - createQuestion: `ready`/`archived` langsung wajib izin tujuan.
 *   - updateQuestion: soal `ready`/`archived` terkunci dari edit.
 *   - bulkQuestionAction: self-approve massal ditolak per butir.
 *
 * Tes DB yang sudah ada (`question-service.db.test.ts`,
 * `question-bulk.db.test.ts`) tetap menjadi lapisan integrasi; tes di sini
 * tidak menggantikannya, hanya mengunci regresi tanpa perlu Postgres.
 */

const RATIONALE =
  "Siswa lupa mengalikan dengan 1/2 pada rumus jumlah sehingga memperoleh 30, bukan 20.";

const dbTransaction = vi.hoisted(() => vi.fn());
const dbUpdate = vi.hoisted(() => vi.fn());

const tx = vi.hoisted(() => ({
  insert: () => ({
    values: () => ({
      returning: async () => [{ id: "q-1" }],
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => ({
        returning: async () => [{ id: "q-1" }],
      }),
    }),
  }),
  delete: () => ({ where: async () => undefined }),
  select: () => ({
    from: () => ({
      where: async () => [],
    }),
  }),
  execute: async () => [{ id: "q-1" }],
}));

vi.mock("@/lib/db", () => ({
  db: { transaction: dbTransaction, update: dbUpdate },
}));
vi.mock("./audit", () => ({ recordAudit: vi.fn(async () => undefined) }));
vi.mock("./media/shortcode-link", () => ({
  syncQuestionShortcodeMediaTx: vi.fn(async () => undefined),
}));
vi.mock("@/lib/ingest/dedup", () => ({
  findQuestionByContentHash: vi.fn(async () => null),
}));
vi.mock("./bundle-service", () => ({
  isQuestionUsedInBundles: vi.fn(async () => false),
}));
vi.mock("./question-read", () => ({
  getQuestionInternal: vi.fn(),
  getQuestion: vi.fn(async () => ({ id: "q-1", status: "draft" })),
}));

import { createQuestion, updateQuestion } from "./question-write";
import { bulkQuestionAction } from "./question-bulk";
import { getQuestionInternal, getQuestion } from "./question-read";
import { ForbiddenError, ConflictError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";

const mockedInternal = vi.mocked(getQuestionInternal);
const mockedGet = vi.mocked(getQuestion);

const teacher: Actor = { id: "u-teacher", name: "Guru", roles: ["teacher"], via: "session" };
const reviewer: Actor = {
  id: "u-reviewer",
  name: "Penelaah",
  roles: ["teacher", "reviewer"],
  via: "session",
};
const admin: Actor = { id: "u-admin", name: "Admin", roles: ["admin"], via: "session" };

function baseCreate(over: Record<string, unknown> = {}) {
  return {
    questionType: "single_choice",
    difficulty: 3,
    cognitiveLevel: "remember",
    grade: "11",
    contentMarkdown: "Berapa $1+1$?",
    dataPayload: {},
    answerKey: {
      correctOptionIds: ["A"],
      explanationMarkdown: "1 + 1 = 2 karena dua satuan digabung.",
    },
    status: "draft",
    childOrder: 0,
    options: [
      { label: "A", contentMarkdown: "2", isCorrect: true, orderIndex: 0 },
      {
        label: "B",
        contentMarkdown: "3",
        isCorrect: false,
        distractorRationale: RATIONALE,
        orderIndex: 1,
      },
      {
        label: "C",
        contentMarkdown: "4",
        isCorrect: false,
        distractorRationale: RATIONALE,
        orderIndex: 2,
      },
    ],
    solutions: [],
    topicIds: [],
    tagIds: [],
    ...over,
  } as unknown as Parameters<typeof createQuestion>[0];
}

function internalRow(status: string, authorId: string) {
  return {
    id: "q-1",
    status,
    questionType: "single_choice",
    contentMarkdown: "Berapa $1+1$?",
    dataPayload: { options: [] },
    answerKey: {},
    contentHash: "hash-lama",
    authorId,
  } as unknown as Awaited<ReturnType<typeof getQuestionInternal>>;
}

function bulkRow(authorId: string) {
  return {
    id: "q-1",
    status: "review",
    questionType: "single_choice",
    dataPayload: {
      type: "multiple_choice",
      options: [
        { id: "A", contentMarkdown: "2" },
        { id: "B", contentMarkdown: "3", distractorRationale: RATIONALE },
        { id: "C", contentMarkdown: "4", distractorRationale: RATIONALE },
      ],
    },
    answerKey: {
      correctOptionIds: ["A"],
      explanationMarkdown: "1 + 1 = 2 karena dua satuan digabung.",
    },
    authorId,
  };
}

describe("Fase 1 — createQuestion: bypass create-ready/archived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbTransaction.mockImplementation(async (cb: (t: unknown) => unknown) => {
      await cb(tx);
      return "q-1";
    });
    mockedGet.mockResolvedValue({ id: "q-1", status: "draft" } as never);
  });

  it("guru tanpa setReady tidak boleh membuat soal langsung ready (403, tanpa transaksi)", async () => {
    const err = await createQuestion(baseCreate({ status: "ready" }), teacher).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(dbTransaction).not.toHaveBeenCalled();
  });

  it("guru tanpa archive tidak boleh membuat soal langsung archived (403, tanpa transaksi)", async () => {
    const err = await createQuestion(baseCreate({ status: "archived" }), teacher).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(dbTransaction).not.toHaveBeenCalled();
  });

  it("penelaah dengan setReady boleh membuat soal langsung ready", async () => {
    mockedGet.mockResolvedValue({ id: "q-1", status: "ready" } as never);
    const created = await createQuestion(baseCreate({ status: "ready" }), reviewer);
    expect(created).toMatchObject({ id: "q-1" });
    expect(dbTransaction).toHaveBeenCalledTimes(1);
  });

  it("guru tetap boleh membuat soal draft", async () => {
    const created = await createQuestion(baseCreate({ status: "draft" }), teacher);
    expect(created).toMatchObject({ id: "q-1" });
    expect(dbTransaction).toHaveBeenCalledTimes(1);
  });
});

describe("Fase 1 — updateQuestion: status lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbTransaction.mockImplementation(async (cb: (t: unknown) => unknown) => {
      await cb(tx);
      return undefined;
    });
    mockedGet.mockResolvedValue({ id: "q-1", status: "draft" } as never);
  });

  it("edit soal ready ditolak 409, tanpa transaksi", async () => {
    mockedInternal.mockResolvedValue(internalRow("ready", "u-teacher"));
    const err = await updateQuestion(
      "q-1",
      { contentMarkdown: "Berapa $2+2$?" } as Parameters<typeof updateQuestion>[1],
      teacher,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(dbTransaction).not.toHaveBeenCalled();
  });

  it("edit soal archived ditolak 409, tanpa transaksi", async () => {
    mockedInternal.mockResolvedValue(internalRow("archived", "u-teacher"));
    const err = await updateQuestion(
      "q-1",
      { contentMarkdown: "Berapa $2+2$?" } as Parameters<typeof updateQuestion>[1],
      admin,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(dbTransaction).not.toHaveBeenCalled();
  });

  it("edit soal draft milik sendiri tetap boleh", async () => {
    mockedInternal.mockResolvedValue(internalRow("draft", "u-teacher"));
    const updated = await updateQuestion(
      "q-1",
      { contentMarkdown: "Berapa $2+2$?" } as Parameters<typeof updateQuestion>[1],
      teacher,
    );
    expect(updated).toMatchObject({ id: "q-1" });
    expect(dbTransaction).toHaveBeenCalledTimes(1);
  });
});

describe("Fase 1 — bulkQuestionAction: self-approve massal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // tx.select mengembalikan satu baris review; tx.execute mengembalikan
    // id yang berhasil; tx.insert audit tidak dipakai bila tidak ada ok.
    (tx.select as unknown as () => { from: () => { where: () => Promise<unknown[]> } }) =
      () => ({
        from: () => ({
          where: async () => [bulkRow("u-reviewer")],
        }),
      });
    (tx as unknown as { insert: () => { values: () => Promise<unknown> } }).insert =
      () => ({ values: async () => undefined });
    dbTransaction.mockImplementation(async (cb: (t: unknown) => Promise<unknown>) =>
      cb(tx),
    );
  });

  it("penelaah menyetujui soal sendiri secara massal → gagal per butir, bukan ok", async () => {
    const res = await bulkQuestionAction(["q-1"], "set_ready", reviewer);
    expect(res.ok).toHaveLength(0);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0]?.error).toMatch(/buatannya sendiri/i);
  });

  it("penelaah menyetujui soal orang lain secara massal → ok", async () => {
    (tx.select as unknown as () => { from: () => { where: () => Promise<unknown[]> } }) =
      () => ({
        from: () => ({
          where: async () => [bulkRow("u-teacher-lain")],
        }),
      });
    const res = await bulkQuestionAction(["q-1"], "set_ready", reviewer);
    expect(res.ok).toEqual(["q-1"]);
    expect(res.failed).toHaveLength(0);
  });

  it("admin dikecualikan dari larangan self-approve massal", async () => {
    (tx.select as unknown as () => { from: () => { where: () => Promise<unknown[]> } }) =
      () => ({
        from: () => ({
          where: async () => [bulkRow("u-admin")],
        }),
      });
    const res = await bulkQuestionAction(["q-1"], "set_ready", admin);
    expect(res.ok).toEqual(["q-1"]);
    expect(res.failed).toHaveLength(0);
  });
});
