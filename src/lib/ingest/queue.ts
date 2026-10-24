/**
 * Antrean ingest (M9-3) — operasi DB atas `ingest_queue`.
 *
 * Siklus status: `pending` → `processing` → `done` | `failed` | `skipped`.
 * Idempotensi: artikel dengan `rawContent` sama yang belum `failed` → tak dibuat ulang.
 */
import { and, eq, inArray, desc, sql, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { ingestQueue, type IngestQueueItem } from "@/lib/db/schema/system";
import { articleHash } from "./hash";

/** Status antrean (selaras `ingestStatusEnum`). */
export type IngestStatus = "pending" | "processing" | "completed" | "failed" | "skipped";

/** Masukan untuk memasukkan artikel ke antrean. */
export interface EnqueueInput {
  title: string;
  sourceOrigin: string;
  sourceUrl?: string | null;
  rawContent: string;
  rawFormat?: "html" | "json" | "text";
  targetGrade?: string | null;
  targetTopicId?: string | null;
}

/** Hasil enqueue. */
export interface EnqueueResult {
  id: string;
  status: IngestStatus;
  deduped: boolean;
}

/**
 * Masukkan satu artikel ke antrean. Bila artikel dengan isi sama
 * (hash `rawContent` cocok) dan belum `failed` → tak dibuat ulang (dedup).
 */
export async function enqueue(input: EnqueueInput): Promise<EnqueueResult> {
  const contentHash = articleHash(input.rawContent);

  const existing = await findByContentHash(contentHash);
  if (existing) {
    return { id: existing.id, status: existing.status as IngestStatus, deduped: true };
  }

  const [row] = await db
    .insert(ingestQueue)
    .values({
      title: input.title.slice(0, 255),
      sourceOrigin: input.sourceOrigin.slice(0, 50),
      sourceUrl: input.sourceUrl ?? null,
      rawContent: input.rawContent,
      rawFormat: input.rawFormat ?? "html",
      mediaManifest: [],
      targetType: "question",
      targetGrade: input.targetGrade ?? null,
      targetTopicId: input.targetTopicId ?? null,
      status: "pending",
    })
    .returning({ id: ingestQueue.id, status: ingestQueue.status });

  return { id: row!.id, status: row!.status as IngestStatus, deduped: false };
}

/**
 * Cari baris antrean dengan isi (`rawContent`) yang hash-nya sama.
 * Menggunakan pencarian SQL langsung dengan `sha256()` untuk menghindari penarikan
 * ratusan naskah besar ke memori Node.js (PERF).
 */
async function findByContentHash(contentHash: string): Promise<IngestQueueItem | null> {
  const [match] = await db
    .select()
    .from(ingestQueue)
    .where(
      and(
        inArray(ingestQueue.status, ["pending", "processing", "completed"]),
        sql`encode(sha256(btrim(${ingestQueue.rawContent}, E' \t\n\r')::bytea), 'hex') = ${contentHash}`,
      ),
    )
    .orderBy(desc(ingestQueue.createdAt))
    .limit(1);
  return match ?? null;
}

/** Ambil daftar antrean (opsional filter status), terbaru dulu. */
export async function listQueue(
  opts: { status?: IngestStatus; limit?: number } = {},
): Promise<IngestQueueItem[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const rows = opts.status
    ? await db
        .select()
        .from(ingestQueue)
        .where(eq(ingestQueue.status, opts.status))
        .orderBy(desc(ingestQueue.createdAt))
        .limit(limit)
    : await db
        .select()
        .from(ingestQueue)
        .orderBy(desc(ingestQueue.createdAt))
        .limit(limit);
  return rows;
}

/** Ambil satu baris antrean. */
export async function getQueueItem(id: string): Promise<IngestQueueItem | null> {
  const [row] = await db.select().from(ingestQueue).where(eq(ingestQueue.id, id)).limit(1);
  return row ?? null;
}

/**
 * Ambil baris `pending` untuk diproses.
 * @param ids bila diberikan, batasi ke id tsb. Id yang **bukan** pending
 *            dikembalikan lewat `nonPending`.
 */
export async function listPending(
  ids?: string[],
  limit?: number,
): Promise<{ items: IngestQueueItem[]; nonPending: string[]; totalPending?: number }> {
  if (ids && ids.length) {
    const rows = await db
      .select()
      .from(ingestQueue)
      .where(inArray(ingestQueue.id, ids))
      .orderBy(ingestQueue.createdAt);
    const found = new Set(rows.map((r) => r.id));
    const nonPending = rows.filter((r) => r.status !== "pending").map((r) => r.id);
    const missing = ids.filter((id) => !found.has(id));
    return { items: rows.filter((r) => r.status === "pending"), nonPending: [...nonPending, ...missing] };
  }

  const [totalRow] = await db
    .select({ n: count() })
    .from(ingestQueue)
    .where(eq(ingestQueue.status, "pending"));
  const totalPending = totalRow?.n ?? 0;

  let query = db
    .select()
    .from(ingestQueue)
    .where(eq(ingestQueue.status, "pending"))
    .orderBy(ingestQueue.createdAt);

  if (typeof limit === "number" && limit > 0) {
    query = query.limit(limit) as typeof query;
  }

  const items = await query;
  return { items, nonPending: [], totalPending };
}

/** Tandai satu baris sedang diproses (guard balapan). `false` bila sudah bukan pending. */
export async function markProcessing(id: string): Promise<boolean> {
  const res = await db
    .update(ingestQueue)
    .set({ status: "processing", updatedAt: new Date() })
    .where(and(eq(ingestQueue.id, id), eq(ingestQueue.status, "pending")))
    .returning({ id: ingestQueue.id });
  return res.length > 0;
}

/** Tandai selesai/gagal/dilewati + catatan hasil (jumlah soal, catatan AI). */
export async function markDone(
  id: string,
  status: Extract<IngestStatus, "completed" | "failed" | "skipped">,
  opts: {
    errorMessage?: string;
    mediaManifest?: IngestQueueItem["mediaManifest"];
    importedQuestionsCount?: number;
    aiNotes?: string;
  } = {},
): Promise<void> {
  await db
    .update(ingestQueue)
    .set({
      status,
      errorMessage: opts.errorMessage ?? null,
      ...(opts.mediaManifest ? { mediaManifest: opts.mediaManifest } : {}),
      ...(opts.importedQuestionsCount !== undefined
        ? { importedQuestionsCount: opts.importedQuestionsCount }
        : {}),
      ...(opts.aiNotes !== undefined ? { aiNotes: opts.aiNotes } : {}),
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ingestQueue.id, id));
}

/** Bangun manifest media (untuk disimpan setelah unduh). */
export function toMediaManifest(
  outcomes: Array<{ sourceUrl: string; localUrl?: string; ok: boolean }>,
): IngestQueueItem["mediaManifest"] {
  return outcomes
    .filter((o) => o.ok && o.localUrl)
    .map((o) => ({
      sourcePath: o.sourceUrl,
      originalName: o.sourceUrl.split("/").pop() ?? "image",
      destFileName: o.localUrl,
    }));
}

/** Hapus baris antrean (mis. bersihkan yang gagal). */
export async function deleteQueueItems(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const res = await db
    .delete(ingestQueue)
    .where(inArray(ingestQueue.id, ids))
    .returning({ id: ingestQueue.id });
  return res.length;
}

/** Hitung jumlah per status (untuk ringkasan UI). */
export async function countByStatus(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: ingestQueue.status, n: sql<number>`count(*)::int` })
    .from(ingestQueue)
    .groupBy(ingestQueue.status);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}
