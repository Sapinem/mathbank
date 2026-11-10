import type { Actor } from "@/lib/auth/actor";
import type {
  CanonicalIngestBatchInput,
  CanonicalQuestionItem,
} from "@/lib/contracts/ingest-canonical";
import type {
  QuestionDataPayload,
  AnswerKeyPayload,
} from "@/lib/validations/question-payload";
import { buildQuestionPayload } from "@/lib/ingest/parsers/types";
import type { ParsedItem } from "@/lib/ingest/parsers/types";
import { IngestClient } from "./client";

/** Aktor default untuk eksekusi skrip CLI langsung (mode direct). */
export const MACHINE_ACTOR: Actor = {
  id: "ingest-cli",
  name: "CLI Ingest Runner",
  roles: ["machine"],
  via: "system",
};

/**
 * Konversi ParsedItem (format ramah-parser) ke CanonicalQuestionItem (format kanonik).
 */
export function parsedItemToCanonical(it: ParsedItem): CanonicalQuestionItem {
  const built = buildQuestionPayload(it);
  return {
    type: it.type,
    stem: it.stem,
    dataPayload: built.dataPayload as unknown as QuestionDataPayload,
    answerKey: built.answerKey as unknown as AnswerKeyPayload,
    difficulty: 3,
    explanation: it.explanation,
    warnings: [...(it.warnings || []), ...built.warnings],
    ref: it.ref,
    parentRefIndex: it.parentRefIndex,
    childOrder: it.childOrder,
  };
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export interface IngestRunnerOptions {
  dry?: boolean;
  direct?: boolean;
  apiUrl?: string;
  apiKey?: string;
}

/**
 * Eksekusi pengiriman batch soal kanonik:
 * - mode `--dry`: hanya mempratinjau tanpa menyimpan/mengirim
 * - mode `--direct`: memanggil service `ingestCanonicalBatch` secara in-process (butuh DB)
 * - mode default: mengirim HTTP POST ke endpoint kanonik via `IngestClient`
 */
export async function runIngestBatch(
  input: {
    sourceName: string;
    sourceUrl?: string | null;
    bundleTitle: string;
    bundleUrl?: string | null;
    grade?: string | null;
    items: CanonicalQuestionItem[];
  },
  options: IngestRunnerOptions = {},
): Promise<{
  totalReceived: number;
  created: number;
  linked: number;
  rejectedCount: number;
}> {
  const { sourceName, sourceUrl, bundleTitle, bundleUrl, grade, items } = input;

  if (items.length === 0) {
    console.log(`ℹ️ [${sourceName}] Tidak ada soal untuk dikirim.`);
    return { totalReceived: 0, created: 0, linked: 0, rejectedCount: 0 };
  }

  if (options.dry) {
    console.log(
      `🔍 [DRY-RUN] [${sourceName}] Menemukan ${items.length} butir soal:`,
    );
    console.log(`  Bundle: "${bundleTitle}" (${grade ?? "umum"})`);
    console.log(
      `  Sampel Stem #1: ${items[0]?.stem.slice(0, 100).replace(/\n/g, " ")}…`,
    );
    return {
      totalReceived: items.length,
      created: 0,
      linked: 0,
      rejectedCount: 0,
    };
  }

  const chunks = chunkArray(items, 50);
  let totalCreated = 0;
  let totalLinked = 0;
  let totalRejected = 0;

  if (options.direct) {
    const { ingestCanonicalBatch } = await import(
      "@/lib/services/ingest-gateway-service"
    );
    for (const chunk of chunks) {
      const payload: CanonicalIngestBatchInput = {
        source: { name: sourceName, url: sourceUrl ?? null },
        bundle: {
          title: bundleTitle,
          url: bundleUrl ?? null,
          grade: grade ?? null,
        },
        items: chunk,
      };
      const res = await ingestCanonicalBatch(payload, MACHINE_ACTOR);
      totalCreated += res.created;
      totalLinked += res.linked;
      totalRejected += res.rejectedCount;
    }
  } else {
    const client = new IngestClient({
      apiUrl: options.apiUrl,
      apiKey: options.apiKey,
    });
    for (const chunk of chunks) {
      const payload: CanonicalIngestBatchInput = {
        source: { name: sourceName, url: sourceUrl ?? null },
        bundle: {
          title: bundleTitle,
          url: bundleUrl ?? null,
          grade: grade ?? null,
        },
        items: chunk,
      };
      const res = await client.sendBatch(payload);
      totalCreated += res.created;
      totalLinked += res.linked;
      totalRejected += res.rejectedCount;
    }
  }

  console.log(
    `✅ [${sourceName}] Selesai: ${totalCreated} dibuat, ${totalLinked} ditautkan, ${totalRejected} ditolak dari ${items.length} butir.`,
  );

  return {
    totalReceived: items.length,
    created: totalCreated,
    linked: totalLinked,
    rejectedCount: totalRejected,
  };
}
