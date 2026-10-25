/**
 * Orkestrasi satu putaran commit ingest — antrean `pending` → soal draft → event.
 *
 * KENAPA berkas terpisah (ADR-0022 + CONSTRAINTS #16): route cukup memvalidasi
 * body lalu memanggil satu fungsi domain. Sebelumnya route handler meng-`import()`
 * db + event-resolve sendiri dan merakit agregatnya — orkestrasi domain bocor ke
 * lapisan HTTP, sehingga alur ini hanya bisa diuji lewat route. Fungsi ini
 * sempat ditaruh di `service.ts`, tetapi membuat berkas itu melewati plafon
 * ~300 baris untuk lapisan service.
 *
 * Modul ini SENGAJA mengimpor `db` di module scope: ia memang lapisan yang
 * menulis ke DB. `service.ts` tidak lagi, supaya `processQueueItem` bisa
 * diimpor tanpa membuka pool.
 *
 * EVENT: hanya menempelkan event yang SUDAH ada di katalog. Event baru tidak
 * dibuat otomatis; dilaporkan lewat `unknownEvents` agar pemilik memutuskan.
 */
import type { Actor } from "@/lib/auth/actor";
import { db } from "@/lib/db";
import type { IngestQueueItem } from "@/lib/db/schema/system";
import { mediaStorageRoot } from "./config";
import { resolveEventsForBundles, findUnknownEvents } from "./event-resolve";
import { processQueueItem, type ProcessResult } from "./service";
import { log } from "@/lib/telemetry/logger";
import type { CommitFailure } from "./commit";

/** Ringkasan satu putaran commit batch. */
export interface CommitBatchSummary {
  processed: number;
  created: number;
  linked: number;
  skipped: number;
  /** Soal gagal dibuat (galat DB) + artikel yang gagal total. */
  failed: number;
  storedCount: number;
  failedCount: number;
  failures: CommitFailure[];
  /** Sisa antrean yang belum diproses pada putaran ini. */
  remaining: number;
}

/** Hasil satu putaran commit: ringkasan, detail per artikel, dan event. */
export interface CommitBatchResult {
  summary: CommitBatchSummary;
  results: ProcessResult[];
  eventsTagged: number;
  unknownEvents: string[];
  /**
   * Terisi bila penandaan event GAGAL setelah batch ter-commit.
   *
   * Soal sudah tersimpan dan item antrean sudah `done` pada titik itu; tanpa
   * penanda ini pemanggil menerima 500 dan mengira tidak ada yang tersimpan,
   * lalu pengulangan dengan id yang sama kena 409.
   */
  eventsError?: string;
}

export async function commitIngestBatch(
  items: IngestQueueItem[],
  opts: {
    actor: Actor;
    limit: number;
    mediaDelayMs?: number;
    grade?: string | null;
    totalRemaining?: number;
  },
): Promise<CommitBatchResult> {
  const batch = items.slice(0, opts.limit);
  const root = mediaStorageRoot();
  const results: ProcessResult[] = [];
  for (const item of batch) {
    results.push(
      await processQueueItem(item, {
        actor: opts.actor,
        mediaRoot: root,
        mediaDelayMs: opts.mediaDelayMs,
        grade: opts.grade ?? null,
      }),
    );
  }

  let created = 0;
  let linked = 0;
  let skipped = 0;
  let failed = 0;
  let storedCount = 0;
  let failedCount = 0;
  const failures: CommitFailure[] = [];

  for (const r of results) {
    created += r.created;
    linked += r.linked;
    skipped += r.skipped;
    failed += r.failed + (r.status === "failed" ? 1 : 0);
    storedCount += r.storedCount;
    failedCount += r.failedCount;
    if (r.failures.length) failures.push(...r.failures);
  }

  const summary: CommitBatchSummary = {
    processed: results.length,
    created,
    linked,
    skipped,
    failed,
    storedCount,
    failedCount,
    failures,
    remaining:
      opts.totalRemaining !== undefined
        ? Math.max(0, opts.totalRemaining - batch.length)
        : Math.max(0, items.length - batch.length),
  };

  const bundleIds = results.map((r) => r.bundleId).filter((x): x is string => Boolean(x));
  if (bundleIds.length === 0) {
    return { summary, results, eventsTagged: 0, unknownEvents: [] };
  }

  // Batch SUDAH ter-commit di titik ini (soal tersimpan, item antrean `done`).
  // Kegagalan penandaan event tidak boleh membatalkan laporan itu: kalau ia
  // melempar, route menjawab 500 dan pemanggil tak pernah tahu batch berhasil.
  try {
    const ev = await resolveEventsForBundles(db, bundleIds);
    return {
      summary,
      results,
      eventsTagged: ev.bundlesTagged,
      unknownEvents: await findUnknownEvents(db, bundleIds),
    };
  } catch (err) {
    log.error({
      msg: "penandaan event gagal setelah batch ter-commit",
      code: "INGEST_EVENT_TAGGING_FAILED",
      err,
    });
    return {
      summary,
      results,
      eventsTagged: 0,
      unknownEvents: [],
      // Pesan generik: detail ada di log, bukan di respons API.
      eventsError: "Penandaan event gagal; soal sudah tersimpan.",
    };
  }
}
