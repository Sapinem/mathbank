import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";
import {
  createBundle,
  getBundle,
  listBundles,
  updateBundle,
  archiveBundle,
  addItem,
  removeItem,
  reorderItems,
  listBundleItems,
  validateBundle,
  duplicateBundle,
} from "./bundle-service";
import { createQuestion, deleteQuestion, getQuestionInternal } from "./question-service";
import { ConflictError, NotFoundError } from "@/lib/auth/guards";

/**
 * Tes INTEGRASI paket soal (M7) — DB uji nyata.
 * Fokus: urutan item, stimulus 1×, RESTRICT hapus soal, duplikasi, soft-delete.
 */
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const admin: Actor = { id: "b-admin", name: "Admin", roles: ["admin"], via: "session" };
const teacher: Actor = { id: "b-teacher", name: "Guru", roles: ["teacher"], via: "session" };

async function clean() {
  await sql`DELETE FROM bundle_items`;
  await sql`DELETE FROM bundles`;
  await sql`DELETE FROM questions`;
}

async function mkQuestion(content = "Soal contoh $1+1$?", withKey = true) {
  const q = await createQuestion(
    {
      questionType: "single_choice",
      difficulty: 3,
      cognitiveLevel: "remember",
      grade: "g1",
      contentMarkdown: content,
      dataPayload: {},
      answerKey: withKey ? { correct: ["B"] } : {},
      status: "draft",
      childOrder: 0,
      options: [
        { label: "A", contentMarkdown: "1", isCorrect: false, orderIndex: 0 },
        { label: "B", contentMarkdown: "2", isCorrect: true, orderIndex: 1 },
      ],
      topicIds: [],
      tagIds: [],
    },
    admin,
  );
  return q;
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(clean);
afterAll(async () => {
  await clean();
  await sql.end();
});

describe("createBundle / listBundles", () => {
  it("membuat paket dengan slug dari judul", async () => {
    const b = await createBundle(
      { title: "UTS Matematika Kelas X", bundleType: "exam" },
      admin,
    );
    expect(b.slug).toBe("uts-matematika-kelas-x");
    expect(b.status).toBe("draft");
    expect(b.itemCount).toBe(0);
  });

  it("slug unik: judul sama → akhiran -2", async () => {
    await createBundle({ title: "Latihan", bundleType: "exam" }, admin);
    const b2 = await createBundle({ title: "Latihan", bundleType: "exam" }, admin);
    expect(b2.slug).toBe("latihan-2");
  });

  it("paket diarsip tak muncul di daftar", async () => {
    const b = await createBundle({ title: "Arsip", bundleType: "exam" }, admin);
    await archiveBundle(b.id, admin);
    const list = await listBundles(admin);
    expect(list.find((x) => x.id === b.id)).toBeUndefined();
  });
});

describe("item paket — urutan & jumlah", () => {
  it("menambah soal berurutan & menghitung itemCount", async () => {
    const b = await createBundle({ title: "Paket A", bundleType: "exam" }, admin);
    const q1 = await mkQuestion("Soal 1");
    const q2 = await mkQuestion("Soal 2");
    await addItem(b.id, q1.id, admin);
    await addItem(b.id, q2.id, admin);

    const items = await listBundleItems(b.id);
    expect(items.map((i) => i.item.orderIndex)).toEqual([1, 2]);
    expect((await getBundle(b.id))!.itemCount).toBe(2);
  });

  it("menolak menambah soal yang sama dua kali (409)", async () => {
    const b = await createBundle({ title: "Paket B", bundleType: "exam" }, admin);
    const q = await mkQuestion();
    await addItem(b.id, q.id, admin);
    await expect(addItem(b.id, q.id, admin)).rejects.toBeInstanceOf(ConflictError);
  });

  it("M8: listBundleItems melampirkan opsi (untuk naskah cetak)", async () => {
    const b = await createBundle({ title: "Paket Opsi", bundleType: "exam" }, admin);
    const q = await mkQuestion();
    await addItem(b.id, q.id, admin);

    const items = await listBundleItems(b.id);
    expect(items).toHaveLength(1);
    // mkQuestion membuat 2 opsi (A salah, B benar) — harus ikut ter-lampir.
    expect(items[0]!.question.options).toHaveLength(2);
    expect(items[0]!.question.options.map((o) => o.label)).toEqual(["A", "B"]);
  });

  it("M8: answerKey hanya terkirim bila aktor berhak melihat kunci", async () => {
    const b = await createBundle({ title: "Paket Kunci", bundleType: "exam" }, admin);
    const q = await mkQuestion("Soal kunci", true);
    await addItem(b.id, q.id, admin);

    // Guru berhak (canSeeAnswerKey true) → answerKey ada + isCorrect tersedia.
    const asTeacher = await listBundleItems(b.id, teacher);
    expect(asTeacher[0]!.question.answerKey).toMatchObject({ correct: ["B"] });
    expect(asTeacher[0]!.question.options[1]).toHaveProperty("isCorrect", true);

    // Tanpa aktor (mis. jalur tanpa izin) → answerKey TAK ada.
    const anon = await listBundleItems(b.id);
    expect(anon[0]!.question.answerKey).toBeUndefined();
  });

  it("reorder mengubah order_index sesuai daftar", async () => {
    const b = await createBundle({ title: "Paket C", bundleType: "exam" }, admin);
    const q1 = await mkQuestion("A");
    const q2 = await mkQuestion("B");
    const q3 = await mkQuestion("C");
    const i1 = await addItem(b.id, q1.id, admin);
    const i2 = await addItem(b.id, q2.id, admin);
    const i3 = await addItem(b.id, q3.id, admin);

    await reorderItems(b.id, [i3.id, i1.id, i2.id], admin);
    const items = await listBundleItems(b.id);
    expect(items.map((it) => it.item.id)).toEqual([i3.id, i1.id, i2.id]);
    expect(items.map((it) => it.item.orderIndex)).toEqual([1, 2, 3]);
  });

  it("hapus item mengeluarkan soal dari paket", async () => {
    const b = await createBundle({ title: "Paket D", bundleType: "exam" }, admin);
    const q = await mkQuestion();
    const it = await addItem(b.id, q.id, admin);
    await removeItem(b.id, it.id, admin);
    expect((await listBundleItems(b.id)).length).toBe(0);
  });
});

describe("stimulus tampil 1×", () => {
  it("stimulus disimpan sekali; anak merujuk lewat parent_id", async () => {
    const b = await createBundle({ title: "Paket Stimulus", bundleType: "exam" }, admin);
    const stimulus = await mkQuestion("Bacaan panjang…");
    const anak1 = await mkQuestion("Soal 1 tentang bacaan");
    const anak2 = await mkQuestion("Soal 2 tentang bacaan");

    // Stimulus sebagai baris role='stimulus' (1×).
    await addItem(b.id, stimulus.id, admin, { role: "stimulus" });
    await addItem(b.id, anak1.id, admin);
    await addItem(b.id, anak2.id, admin);

    const items = await listBundleItems(b.id);
    const stimRows = items.filter((i) => i.item.role === "stimulus");
    expect(stimRows).toHaveLength(1);
    expect(stimRows[0]!.item.questionId).toBe(stimulus.id);
  });
});

describe("validasi paket", () => {
  it("soal tanpa kunci → peringatan (valid tetap true bila lengkap)", async () => {
    const b = await createBundle({ title: "Paket Val", bundleType: "exam" }, admin);
    const q = await mkQuestion("Jelaskan…", false); // tanpa kunci jawaban
    await addItem(b.id, q.id, admin);
    const v = await validateBundle(b.id);
    expect(v.itemCount).toBe(1);
    expect(v.withoutAnswerKey.length).toBe(1);
    expect(v.valid).toBe(true);
  });
});

describe("RESTRICT: soal terpakai tak bisa dihapus", () => {
  it("deleteQuestion menolak (409) bila soal ada di paket", async () => {
    const b = await createBundle({ title: "Paket RESTRICT", bundleType: "exam" }, admin);
    const q = await mkQuestion();
    await addItem(b.id, q.id, admin);

    await expect(deleteQuestion(q.id, admin)).rejects.toBeInstanceOf(ConflictError);
    // masih ada (belum ter-soft-delete)
    expect(await getQuestionInternal(q.id)).not.toBeNull();
  });

  it("setelah item dikeluarkan, soal boleh dihapus", async () => {
    const b = await createBundle({ title: "Paket Lepas", bundleType: "exam" }, admin);
    const q = await mkQuestion();
    const it = await addItem(b.id, q.id, admin);
    await removeItem(b.id, it.id, admin);
    await expect(deleteQuestion(q.id, admin)).resolves.toBeUndefined();
    const after = await getQuestionInternal(q.id, { includeDeleted: true });
    expect(after!.deletedAt).not.toBeNull();
  });

  // T-M7-3: paket TERARSIP tidak boleh menyandera soal (dead-end).
  it("T-M7-3: paket terarsip tidak lagi memblokir hapus soal", async () => {
    const b = await createBundle({ title: "Paket Arsip", bundleType: "exam" }, admin);
    const q = await mkQuestion();
    await addItem(b.id, q.id, admin);
    // selama paket AKTIF → tetap terblokir
    await expect(deleteQuestion(q.id, admin)).rejects.toBeInstanceOf(ConflictError);
    // arsipkan paket → soal harus bisa dihapus
    await archiveBundle(b.id, admin);
    await expect(deleteQuestion(q.id, admin)).resolves.toBeUndefined();
    const after = await getQuestionInternal(q.id, { includeDeleted: true });
    expect(after!.deletedAt).not.toBeNull();
  });
});

describe("reorderItems — urutan item (T-M7-2)", () => {
  it("menerima daftar LENGKAP & menerapkan urutan baru", async () => {
    const b = await createBundle({ title: "Paket Urut", bundleType: "exam" }, admin);
    const qs: Awaited<ReturnType<typeof addItem>>[] = [];
    for (let i = 0; i < 3; i++) {
      const q = await mkQuestion(`Soal urut ${i}`);
      qs.push(await addItem(b.id, q.id, admin));
    }
    const reversed = [qs[2]!.id, qs[1]!.id, qs[0]!.id];
    await reorderItems(b.id, reversed, admin);
    const items = await listBundleItems(b.id);
    expect(items.map((i) => i.item.id)).toEqual(reversed);
    expect(items.map((i) => i.item.orderIndex)).toEqual([1, 2, 3]);
  });

  it("T-M7-2: menolak daftar PARSIAL (cegah orderIndex bentrok)", async () => {
    const b = await createBundle({ title: "Paket Parsial", bundleType: "exam" }, admin);
    const q1 = await mkQuestion("S1");
    const q2 = await mkQuestion("S2");
    const it1 = await addItem(b.id, q1.id, admin);
    await addItem(b.id, q2.id, admin);
    // hanya 1 dari 2 → ditolak (dulu diterima → orderIndex duplikat [1,1])
    await expect(reorderItems(b.id, [it1.id], admin)).rejects.toBeInstanceOf(
      ConflictError,
    );
    const items = await listBundleItems(b.id);
    expect(items.map((i) => i.item.orderIndex)).toEqual([1, 2]); // tak rusak
  });

  it("T-M7-2: menolak daftar ber-DUPLIKAT id", async () => {
    const b = await createBundle({ title: "Paket Dup", bundleType: "exam" }, admin);
    const q = await mkQuestion("S1");
    const it = await addItem(b.id, q.id, admin);
    await expect(reorderItems(b.id, [it.id, it.id], admin)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe("duplikasi paket", () => {
  it("menyalin metadata + seluruh item dengan judul baru", async () => {
    const b = await createBundle(
      { title: "Paket Asli", bundleType: "exam", durationMinutes: 120 },
      admin,
    );
    const q1 = await mkQuestion("S1");
    const q2 = await mkQuestion("S2");
    await addItem(b.id, q1.id, admin);
    await addItem(b.id, q2.id, admin);

    const copy = await duplicateBundle(b.id, admin);
    expect(copy.title).toBe("Paket Asli (salinan)");
    expect(copy.slug).toBe("paket-asli-salinan");
    expect(copy.durationMinutes).toBe(120);
    expect(copy.itemCount).toBe(2);
    // soal berbeda objeknya tapi menunjuk soal yang sama
    const items = await listBundleItems(copy.id);
    expect(items.map((i) => i.item.questionId)).toEqual([q1.id, q2.id]);
  });
});

describe("error paths", () => {
  it("update paket tak ada → NotFound", async () => {
    await expect(
      updateBundle("00000000-0000-7000-8000-000000000000", { title: "X" }, admin),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("guru boleh mengelola paket (bundle:manage)", async () => {
    const b = await createBundle({ title: "Paket Guru", bundleType: "exam" }, teacher);
    expect(b.title).toBe("Paket Guru");
  });
});
