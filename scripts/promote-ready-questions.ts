/**
 * Runner Promosi Status Soal: draft → review → ready
 *
 * Mengidentifikasi soal-soal draft yang sudah memenuhi kontrak rilis pedagogis
 * (MAT-150 / CONSTRAINT #27) dan mempromosikannya secara atomik via FSM.
 *
 * Mode:
 *   DRY RUN (default): pnpm exec tsx scripts/promote-ready-questions.ts
 *   LIVE RUN:          pnpm exec tsx scripts/promote-ready-questions.ts --live
 *   LIMIT:             pnpm exec tsx scripts/promote-ready-questions.ts --live --limit 50
 */
import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import { changeQuestionStatus } from "@/lib/services/question-status";
import { assertReleaseContract } from "@/lib/services/question-release";
import type { Actor } from "@/lib/auth/actor";

const adminActor: Actor = {
  id: "system-promotion-runner",
  name: "System Promotion Runner",
  roles: ["admin"],
  via: "system",
};

async function main() {
  const args = process.argv.slice(2);
  const isLive = args.includes("--live");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 && args[limitIdx + 1] ? Number.parseInt(args[limitIdx + 1]!, 10) : 500;

  console.log(`=== RUNNER PROMOSI SOAL KE READY ===`);
  console.log(`Mode  : ${isLive ? "LIVE UPDATE (Menulis ke DB)" : "DRY RUN (Tanpa perubahan)"}`);
  console.log(`Limit : ${limit} soal kandidat`);
  console.log(`Target: questions WHERE status = 'draft' AND is_flagged = false\n`);

  const candidates = await db
    .select({
      id: questions.id,
      questionType: questions.questionType,
      dataPayload: questions.dataPayload,
      answerKey: questions.answerKey,
      status: questions.status,
      contentMarkdown: questions.contentMarkdown,
    })
    .from(questions)
    .where(and(eq(questions.status, "draft"), eq(questions.isFlagged, false), isNull(questions.deletedAt)))
    .limit(limit);

  console.log(`Ditemukan ${candidates.length} kandidat draf untuk diperiksa.\n`);

  let eligible = 0;
  let rejected = 0;
  let promoted = 0;
  let errorCount = 0;
  const rejectReasons = new Map<string, number>();

  for (const q of candidates) {
    try {
      assertReleaseContract({
        questionType: q.questionType,
        dataPayload: q.dataPayload as Record<string, unknown> | null,
        answerKey: q.answerKey as Record<string, unknown> | null,
      });
      eligible++;

      if (isLive) {
        try {
          // FSM: draft -> review -> ready
          await changeQuestionStatus(q.id, "review", adminActor, "Promosi otomatis: masuk telaah");
          await changeQuestionStatus(q.id, "ready", adminActor, "Promosi otomatis: lulus kontrak rilis pedagogis");
          promoted++;
          console.log(`  [PROMOTED] ${q.id.slice(0, 8)} (${q.questionType}) → ready`);
        } catch (err: unknown) {
          errorCount++;
          console.error(`  [FAIL TRANSITION] ${q.id.slice(0, 8)}:`, err instanceof Error ? err.message : err);
        }
      } else {
        console.log(`  [ELIGIBLE] ${q.id.slice(0, 8)} (${q.questionType}) siap dipromosikan ke ready`);
      }
    } catch (e: unknown) {
      rejected++;
      let reason = "Gagal kontrak rilis";
      if (e instanceof Error) {
        reason = e.message.split("\n")[0]!.slice(0, 90);
        if (
          "issues" in e &&
          Array.isArray((e as { issues: unknown }).issues) &&
          (e as { issues: Array<{ message?: string; path?: (string | number)[] }> }).issues[0]?.message
        ) {
          const first = (e as { issues: Array<{ message: string; path?: (string | number)[] }> }).issues[0];
          const pathStr = first.path?.length ? ` pada '${first.path.join(".")}'` : "";
          reason = `${first.message}${pathStr}`;
        }
      }
      rejectReasons.set(reason, (rejectReasons.get(reason) ?? 0) + 1);
    }
  }

  console.log(`\n=== RINGKASAN HASIL ===`);
  console.log(`Total kandidat diperiksa : ${candidates.length}`);
  console.log(`Memenuhi syarat rilis    : ${eligible}`);
  console.log(`Belum memenuhi syarat    : ${rejected}`);
  if (isLive) {
    console.log(`Berhasil dipromosikan    : ${promoted}`);
    console.log(`Gagal saat transisi      : ${errorCount}`);
  }

  if (rejectReasons.size > 0) {
    console.log(`\nTop Alasan Belum Memenuhi Syarat:`);
    for (const [reason, count] of [...rejectReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`  - [${count}x] ${reason}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
