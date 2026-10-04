/**
 * Tes DB: koleksi (ADR-0016) — arsip soal PUBLIK.
 *
 * Menguji invarian yang membedakan `collections` dari `bundles`:
 *  - **Publik** — semua peran boleh lihat & kelola (bukan `own`)
 *  - **Idempoten** — menambah soal sama dua kali tak menggandakan
 *  - **RESTRICT** — soal yang diarsipkan tak bisa dihapus
 *  - **CASCADE** — hapus koleksi TIDAK menghapus soalnya
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";
import { ConflictError } from "@/lib/auth/guards";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");

const sql = postgres(url, { max: 4 });

const ADMIN: Actor = { id: "test-admin", name: "Admin Uji", roles: ["admin"], via: "system" };
const TEACHER_A: Actor = { id: "teacher-a", name: "Guru A", roles: ["teacher"], via: "session" };
const TEACHER_B: Actor = { id: "teacher-b", name: "Guru B", roles: ["teacher"], via: "session" };
const AGENT: Actor = { id: "test-agent", name: "Agen", roles: ["agent"], via: "apikey" };

async function cleanAll() {
  await sql`DELETE FROM collection_items`;
  await sql`DELETE FROM collections`;
  await sql`DELETE FROM bundle_items`;
  await sql`DELETE FROM question_options`;
  await sql`UPDATE questions SET parent_id = NULL`;
  await sql`DELETE FROM questions`;
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable`;
  await sql`DELETE FROM audit_logs`;
  await sql`ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable`;
}

/** Buat soal minimal lewat SQL (tak perlu service soal untuk uji koleksi). */
async function makeQuestion(stem = "Soal uji koleksi"): Promise<string> {
  const [row] = await sql`
    INSERT INTO questions (question_type, difficulty, cognitive_level, grade,
                           content_markdown, data_payload, answer_key)
    VALUES ('essay', 3, 'understand', 'umum', ${stem}, '{}'::jsonb, '{}'::jsonb)
    RETURNING id`;
  return row!.id;
}

describe("collections (ADR-0016)", () => {
  beforeEach(cleanAll);
  afterAll(async () => {
    await cleanAll();
    await sql.end();
  });

  it("buat koleksi → tersimpan, slug otomatis", async () => {
    const { createCollection, listCollections } = await import(
      "@/lib/services/collection-service"
    );
    const c = await createCollection({ title: "Arsip Persamaan Kuadrat" }, TEACHER_A);
    expect(c.id).toBeTruthy();
    expect(c.slug).toBe("arsip-persamaan-kuadrat");
    expect(c.itemCount).toBe(0);

    const all = await listCollections();
    expect(all.length).toBe(1);
    expect(all[0]!.title).toBe("Arsip Persamaan Kuadrat");
  });

  it("PUBLIK: guru LAIN boleh lihat & kelola (beda dari bundles yang `own`)", async () => {
    const { createCollection, updateCollection, getCollection } = await import(
      "@/lib/services/collection-service"
    );
    const c = await createCollection({ title: "Arsip Bersama" }, TEACHER_A);
    // Guru B (bukan pembuat) tetap boleh ubah — arsip institusional.
    const updated = await updateCollection(c.id, { title: "Arsip Bersama (revisi)" }, TEACHER_B);
    expect(updated.title).toBe("Arsip Bersama (revisi)");
    expect((await getCollection(c.id))!.title).toBe("Arsip Bersama (revisi)");
  });

  it("agent TIDAK boleh kelola (collection:manage = no)", async () => {
    const { createCollection } = await import("@/lib/services/collection-service");
    await expect(
      createCollection({ title: "Coba Agent" }, AGENT),
    ).rejects.toThrow();
  });

  it("tambah soal → itemCount naik; IDEMPOTEN bila diulang", async () => {
    const { createCollection, addCollectionItem, getCollection } = await import(
      "@/lib/services/collection-service"
    );
    const c = await createCollection({ title: "Koleksi A" }, ADMIN);
    const q = await makeQuestion();

    await addCollectionItem(c.id, q, ADMIN);
    await addCollectionItem(c.id, q, ADMIN); // ulang → tak menggandakan
    await addCollectionItem(c.id, q, ADMIN);

    const got = await getCollection(c.id);
    expect(got!.itemCount).toBe(1);
    expect(got!.questionIds).toEqual([q]);
  });

  it("tambah soal tak ada → NotFound", async () => {
    const { createCollection, addCollectionItem } = await import(
      "@/lib/services/collection-service"
    );
    const c = await createCollection({ title: "Koleksi B" }, ADMIN);
    await expect(
      addCollectionItem(c.id, "00000000-0000-7000-8000-000000000000", ADMIN),
    ).rejects.toThrow(/Soal tidak ditemukan/);
  });

  it("koleksi tak ada → NotFound saat tambah soal", async () => {
    const { addCollectionItem } = await import("@/lib/services/collection-service");
    const q = await makeQuestion();
    await expect(
      addCollectionItem("00000000-0000-7000-8000-000000000000", q, ADMIN),
    ).rejects.toThrow(/Koleksi tidak ditemukan/);
  });

  it("RESTRICT: soal yang diarsipkan TAK BISA dihapus", async () => {
    const { createCollection, addCollectionItem } = await import(
      "@/lib/services/collection-service"
    );
    const c = await createCollection({ title: "Koleksi C" }, ADMIN);
    const q = await makeQuestion();
    await addCollectionItem(c.id, q, ADMIN);

    await expect(sql`DELETE FROM questions WHERE id = ${q}`).rejects.toThrow(
      /violates foreign key|RESTRICT/i,
    );
  });

  it("deleteQuestion & hardDeleteQuestion menolak (409 Conflict) bila soal ada di koleksi", async () => {
    const { createCollection, addCollectionItem } = await import(
      "@/lib/services/collection-service"
    );
    const { deleteQuestion, hardDeleteQuestion } = await import(
      "@/lib/services/question-service"
    );
    const c = await createCollection({ title: "Koleksi E" }, ADMIN);
    const q = await makeQuestion();
    await addCollectionItem(c.id, q, ADMIN);

    // Soft delete harus menolak
    await expect(deleteQuestion(q, ADMIN)).rejects.toBeInstanceOf(ConflictError);

    // Hard delete juga harus menolak dengan ConflictError (bukan unhandled Postgres 500)
    await expect(hardDeleteQuestion(q, ADMIN)).rejects.toBeInstanceOf(ConflictError);
  });

  it("CASCADE: hapus koleksi → soal TETAP ada (hanya arsipnya yang hilang)", async () => {
    const { createCollection, addCollectionItem, deleteCollection } = await import(
      "@/lib/services/collection-service"
    );
    const c = await createCollection({ title: "Koleksi D" }, ADMIN);
    const q = await makeQuestion();
    await addCollectionItem(c.id, q, ADMIN);

    await deleteCollection(c.id, ADMIN);
    const [left] = await sql`SELECT count(*)::int AS n FROM collection_items WHERE collection_id = ${c.id}`;
    expect(left!.n).toBe(0);
    const [qStill] = await sql`SELECT count(*)::int AS n FROM questions WHERE id = ${q}`;
    expect(qStill!.n).toBe(1); // soal TIDAK terhapus
  });

  it("keluarkan soal dari koleksi → itemCount turun", async () => {
    const { createCollection, addCollectionItem, removeCollectionItem, getCollection } =
      await import("@/lib/services/collection-service");
    const c = await createCollection({ title: "Koleksi E" }, ADMIN);
    const q = await makeQuestion();
    await addCollectionItem(c.id, q, ADMIN);
    await removeCollectionItem(c.id, q, ADMIN);
    expect((await getCollection(c.id))!.itemCount).toBe(0);
  });

  it("susun ulang urutan → order_index berubah", async () => {
    const { createCollection, addCollectionItem, reorderCollectionItems } = await import(
      "@/lib/services/collection-service"
    );
    const c = await createCollection({ title: "Koleksi F" }, ADMIN);
    const q1 = await makeQuestion("Soal 1");
    const q2 = await makeQuestion("Soal 2");
    const q3 = await makeQuestion("Soal 3");
    await addCollectionItem(c.id, q1, ADMIN);
    await addCollectionItem(c.id, q2, ADMIN);
    await addCollectionItem(c.id, q3, ADMIN);

    await reorderCollectionItems(c.id, [q3, q1, q2], ADMIN);
    const rows = await sql`SELECT question_id FROM collection_items
      WHERE collection_id = ${c.id} ORDER BY order_index`;
    expect(rows.map((r) => r.question_id)).toEqual([q3, q1, q2]);
  });

  it("susun ulang dengan daftar tak cocok → Conflict", async () => {
    const { createCollection, addCollectionItem, reorderCollectionItems } = await import(
      "@/lib/services/collection-service"
    );
    const c = await createCollection({ title: "Koleksi G" }, ADMIN);
    const q1 = await makeQuestion("Soal X");
    await addCollectionItem(c.id, q1, ADMIN);
    await expect(reorderCollectionItems(c.id, [], ADMIN)).rejects.toThrow(/tak cocok/);
  });

  it("satu soal bisa ada di BANYAK koleksi (M:N)", async () => {
    const { createCollection, addCollectionItem, listCollectionsOfQuestion } = await import(
      "@/lib/services/collection-service"
    );
    const a = await createCollection({ title: "Koleksi M1" }, ADMIN);
    const b = await createCollection({ title: "Koleksi M2" }, ADMIN);
    const q = await makeQuestion();
    await addCollectionItem(a.id, q, ADMIN);
    await addCollectionItem(b.id, q, ADMIN);

    const inBoth = await listCollectionsOfQuestion(q);
    expect(inBoth.length).toBe(2);
    expect(inBoth.map((c) => c.title).sort()).toEqual(["Koleksi M1", "Koleksi M2"]);
  });

  it("hapus koleksi tak ada → NotFound", async () => {
    const { deleteCollection } = await import("@/lib/services/collection-service");
    await expect(
      deleteCollection("00000000-0000-7000-8000-000000000000", ADMIN),
    ).rejects.toThrow(/tidak ditemukan/i);
  });
});
