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
import { ConflictError, NotFoundError, ForbiddenError } from "@/lib/auth/guards";

/**
 * Tes INTEGRASI paket soal (M7) — DB uji nyata.
 * Fokus: urutan item, stimulus 1×, RESTRICT hapus soal, duplikasi, soft-delete.
 */
const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const admin: Actor = { id: "b-admin", name: "Admin", roles: ["admin"], via: "session" };
const teacher: Actor = { id: "b-teacher", name: "Guru", roles: ["teacher"], via: "session" };

async function clean() {
  // Use Drizzle db (same pool as service code) so deletes see all
  // committed data from previous test. MAT-39: nullify parent_id first
  // (self-ref FK is RESTRICT).
  const { db } = await import("@/lib/db");
  const { bundles, bundleItems } = await import("@/lib/db/schema/bundle");
  const { questions } = await import("@/lib/db/schema/question");
  await db.delete(bundleItems);
  await db.delete(bundles);
  await db.update(questions).set({ parentId: null });
  await db.delete(questions);
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
      // MAT-146: `isCorrect` = sumber tunggal kunci (tidak ada tabel opsi lagi),
      // jadi soal "tanpa kunci" harus tanpa opsi bertanda benar juga.
      options: [
        { label: "A", contentMarkdown: "1", isCorrect: false, orderIndex: 0 },
        { label: "B", contentMarkdown: "2", isCorrect: withKey, orderIndex: 1 },
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
  it("membuat paket baru", async () => {
    const b = await createBundle(
      { title: "UTS Matematika Kelas X", bundleType: "exam" },
      admin,
    );
    expect(b.title).toBe("UTS Matematika Kelas X");
    expect(b.status).toBe("draft");
    expect(b.itemCount).toBe(0);
  });

  it("MAT-39: origin default 'manual' bila tak disebut", async () => {
    const b = await createBundle(
      { title: "Paket Default Origin", bundleType: "exam" },
      admin,
    );
    expect(b.origin).toBe("manual");
  });

  it("MAT-39: origin 'ingest' bila diberikan", async () => {
    const b = await createBundle(
      { title: "Paket Ingest", bundleType: "source", origin: "ingest" },
      admin,
    );
    expect(b.origin).toBe("ingest");
  });

  it("MAT-39: listBundles filter by bundleType", async () => {
    await createBundle({ title: "Arsip A", bundleType: "source" }, admin);
    await createBundle({ title: "Ujian A", bundleType: "exam" }, admin);
    const sources = await listBundles(admin, { bundleType: "source" });
    expect(sources.items.every((b) => b.bundleType === "source")).toBe(true);
    expect(sources.items.length).toBe(1);
    const exams = await listBundles(admin, { bundleType: "exam" });
    expect(exams.items.every((b) => b.bundleType === "exam")).toBe(true);
    expect(exams.items.length).toBe(1);
  });

  it("MAT-39: listBundles filter by origin", async () => {
    await createBundle(
      { title: "Manual Paket", bundleType: "exam" },
      admin,
    );
    await createBundle(
      { title: "Ingest Paket", bundleType: "source", origin: "ingest" },
      admin,
    );
    const ingest = await listBundles(admin, { origin: "ingest" });
    expect(ingest.items.every((b) => b.origin === "ingest")).toBe(true);
    expect(ingest.items.length).toBe(1);
    const manual = await listBundles(admin, { origin: "manual" });
    expect(manual.items.every((b) => b.origin === "manual")).toBe(true);
    expect(manual.items.length).toBe(1);
  });

  it("MAT-39: updateBundle mengubah origin", async () => {
    const b = await createBundle(
      { title: "Paket Ubah Origin", bundleType: "source" },
      admin,
    );
    const updated = await updateBundle(b.id, { origin: "ingest" }, admin);
    expect(updated.origin).toBe("ingest");
  });

  it("MAT-39: duplicateBundle menyalin origin", async () => {
    const b = await createBundle(
      { title: "Paket Asli Origin", bundleType: "source", origin: "ingest" },
      admin,
    );
    const copy = await duplicateBundle(b.id, admin);
    expect(copy.origin).toBe("ingest");
  });

  it("Pilar 4: createBundle menyimpan default printConfig", async () => {
    const b = await createBundle(
      { title: "Paket Default Print", bundleType: "exam" },
      admin,
    );
    expect(b.printConfig).toBeDefined();
    expect(b.printConfig.institutionName).toBe("Math My ID");
    expect(b.printConfig.twoColumnLayout).toBe(true);
    expect(b.printConfig.pageSize).toBe("A4");
  });

  it("Pilar 4: updateBundle memperbarui printConfig", async () => {
    const b = await createBundle(
      { title: "Paket Cetak Kustom", bundleType: "exam" },
      admin,
    );
    const updated = await updateBundle(
      b.id,
      {
        printConfig: {
          institutionName: "SMA Negeri 1 Jakarta",
          tagline: "Maju Bersama",
          twoColumnLayout: false,
          includeAnswerKey: true,
          showQuestionNumber: true,
          pageSize: "Letter",
        },
      },
      admin,
    );
    expect(updated.printConfig.institutionName).toBe("SMA Negeri 1 Jakarta");
    expect(updated.printConfig.tagline).toBe("Maju Bersama");
    expect(updated.printConfig.twoColumnLayout).toBe(false);
    expect(updated.printConfig.includeAnswerKey).toBe(true);
    expect(updated.printConfig.pageSize).toBe("Letter");
  });

  it("Pilar 4: updateBundle MENGGABUNG printConfig (patch sebagian tidak menghapus field lain)", async () => {
    const b = await createBundle(
      {
        title: "Paket Tambal Cetak",
        bundleType: "exam",
        printConfig: {
          institutionName: "SMA Tambal",
          twoColumnLayout: false,
          pageSize: "A4",
        },
      },
      admin,
    );

    const updated = await updateBundle(b.id, { printConfig: { pageSize: "Letter" } }, admin);

    expect(updated.printConfig.pageSize).toBe("Letter");
    expect(updated.printConfig.institutionName).toBe("SMA Tambal");
    expect(updated.printConfig.twoColumnLayout).toBe(false);
  });

  it("Pilar 4: duplicateBundle menyalin printConfig", async () => {
    const b = await createBundle(
      {
        title: "Paket Cetak Asli",
        bundleType: "exam",
        printConfig: {
          institutionName: "Institut Teknologi",
          twoColumnLayout: false,
          pageSize: "A4",
        },
      },
      admin,
    );
    const copy = await duplicateBundle(b.id, admin);
    expect(copy.printConfig.institutionName).toBe("Institut Teknologi");
    expect(copy.printConfig.twoColumnLayout).toBe(false);
  });

  it("paket diarsip tak muncul di daftar", async () => {
    const b = await createBundle({ title: "Arsip", bundleType: "exam" }, admin);
    await archiveBundle(b.id, admin);
    const list = await listBundles(admin);
    expect(list.items.find((x) => x.id === b.id)).toBeUndefined();
    // API-05: paket ter-soft-delete juga tak dihitung di `total`.
    expect(list.total).toBe(0);
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
    expect(copy.durationMinutes).toBe(120);
    expect(copy.itemCount).toBe(2);
    // soal berbeda objeknya tapi menunjuk soal yang sama
    const items = await listBundleItems(copy.id);
    expect(items.map((i) => i.item.questionId)).toEqual([q1.id, q2.id]);
  });

  it("menolak duplikasi oleh aktor tanpa wewenang (ForbiddenError)", async () => {
    const b = await createBundle({ title: "Paket Privat", bundleType: "exam" }, admin);
    const unauthorizedActor: Actor = {
      id: "b-unauth",
      name: "Siswa",
      roles: [],
      via: "session",
    };
    await expect(duplicateBundle(b.id, unauthorizedActor)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
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

describe("PERF-05 — paginasi listBundles", () => {
  it("default limit 20 & offset menghormati urutan updatedAt desc", async () => {
    // Buat 25 paket → default hanya 20 pertama yang kembali.
    for (let i = 0; i < 25; i++) {
      await createBundle({ title: `Paket Pag ${i}`, bundleType: "exam" }, admin);
    }
    const page1 = await listBundles(admin);
    expect(page1.items).toHaveLength(20);

    const page2 = await listBundles(admin, { limit: 20, offset: 20 });
    expect(page2.items.length).toBe(5);

    // Tanpa tumpang tindih antar halaman.
    const ids1 = new Set(page1.items.map((b) => b.id));
    expect(page2.items.some((b) => ids1.has(b.id))).toBe(false);

    // `limit` eksplisit dihormati.
    const small = await listBundles(admin, { limit: 3 });
    expect(small.items).toHaveLength(3);
  });

  it("API-05: amplop mengembalikan total SELURUH paket + limit/offset ter-echo", async () => {
    for (let i = 0; i < 7; i++) {
      await createBundle({ title: `Paket Env ${i}`, bundleType: "exam" }, admin);
    }
    const page = await listBundles(admin, { limit: 3, offset: 0 });
    // `total` = 7 (bukan 3) → klien tahu ada halaman lanjutan.
    expect(page.total).toBe(7);
    expect(page.items).toHaveLength(3);
    expect(page.limit).toBe(3);
    expect(page.offset).toBe(0);

    // Halaman terakhir: total tetap 7, items = sisa.
    const last = await listBundles(admin, { limit: 3, offset: 6 });
    expect(last.total).toBe(7);
    expect(last.items).toHaveLength(1);
    expect(last.offset).toBe(6);
  });

  it("API-05: `total` menghormati filter (bukan total global)", async () => {
    await createBundle({ title: "Filter Src 1", bundleType: "source" }, admin);
    await createBundle({ title: "Filter Src 2", bundleType: "source" }, admin);
    await createBundle({ title: "Filter Exam", bundleType: "exam" }, admin);
    const src = await listBundles(admin, { bundleType: "source" });
    expect(src.total).toBe(2);
    expect(src.items).toHaveLength(2);
  });
});
