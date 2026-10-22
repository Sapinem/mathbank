/**
 * migrate-options-to-jsonb.ts — MAT-146 (lanjutan MAT-144 / MAT-145).
 *
 * Memindahkan opsi soal dari tabel anak relasional `question_options` ke
 * penyimpanan JSONB di `questions`:
 *
 *   question_options.label/content_markdown/distractor_rationale
 *     → questions.data_payload.options = [{ id, contentMarkdown, distractorRationale? }]
 *   question_options.is_correct
 *     → questions.answer_key.correctOptionIds = ["A", ...]
 *   questions.answer_key.explanation
 *     → questions.answer_key.explanationMarkdown (kanonik; `explanation` tetap
 *        dipertahankan sebagai mirror legacy agar ekspor Moodle & dedup utuh)
 *
 * Sifat skrip:
 *   - **Zero data loss**: setiap soal diverifikasi field-per-field setelah
 *     UPDATE (jumlah opsi, label, urutan, kunci, rationale). Bila ada satu saja
 *     yang tidak cocok, skrip berhenti dengan exit code 1 dan TIDAK men-drop
 *     tabel.
 *   - **Idempotent**: soal yang `data_payload`-nya sudah punya `options`
 *     dilewati (bisa dijalankan berulang / dilanjutkan setelah terputus).
 *   - **Bulkhead**: pool DB kecil (`max: 2`) + batch 200 soal, supaya tidak
 *     menghabiskan koneksi Postgres saat aplikasi berjalan bersamaan.
 *   - **Dua fase**: (1) backfill data, (2) `--drop` untuk `DROP TABLE`.
 *
 * Pemakaian:
 *   pnpm tsx scripts/migrate-options-to-jsonb.ts            # backfill + verifikasi
 *   pnpm tsx scripts/migrate-options-to-jsonb.ts --dry-run  # hitung saja
 *   pnpm tsx scripts/migrate-options-to-jsonb.ts --drop     # backfill + verifikasi + DROP
 *
 * ⚠️ `--drop` menolak berjalan bila tabel `question_options` masih memuat baris
 * yang belum termigrasi (mis. soal baru dibuat setelah backfill).
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("✗ DATABASE_URL belum diatur (lihat .env.example)");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const DROP = args.has("--drop");
const BATCH = 200;

const sql = postgres(DB_URL, { max: 2, idle_timeout: 20, connect_timeout: 10 });

interface OptionRow {
  question_id: string;
  label: string;
  content_markdown: string;
  is_correct: boolean;
  distractor_rationale: string | null;
  order_index: number;
}

interface QuestionRow {
  id: string;
  question_type: string;
  data_payload: Record<string, unknown>;
  answer_key: Record<string, unknown>;
}

/** Tipe payload kanonik (MAT-145) untuk tipe soal yang punya opsi A–E. */
function payloadTypeOf(questionType: string): string {
  return questionType === "multiple_choice_checkbox"
    ? "complex_multiple_choice"
    : "multiple_choice";
}

/** Bentuk kanonik satu opsi di `data_payload.options`. */
interface CanonicalOption {
  id: string;
  contentMarkdown: string;
  distractorRationale?: string;
}

function buildOptions(rows: OptionRow[]): CanonicalOption[] {
  return [...rows]
    .sort((a, b) => a.order_index - b.order_index || a.label.localeCompare(b.label))
    .map((r) => {
      const item: CanonicalOption = {
        id: r.label.trim().toUpperCase(),
        contentMarkdown: r.content_markdown,
      };
      const rationale = r.distractor_rationale?.trim();
      if (rationale) item.distractorRationale = r.distractor_rationale as string;
      return item;
    });
}

/** Kunci jawaban kanonik dari flag `is_correct`. */
function buildCorrectLabels(rows: OptionRow[]): string[] {
  return [...rows]
    .sort((a, b) => a.order_index - b.order_index || a.label.localeCompare(b.label))
    .filter((r) => r.is_correct)
    .map((r) => r.label.trim().toUpperCase());
}

async function main() {
  console.log("── MAT-146 · migrasi question_options → JSONB ──");
  console.log(`   target : ${DB_URL?.replace(/:[^:@/]*@/, ":***@")}`);
  console.log(`   mode   : ${DRY_RUN ? "DRY-RUN" : DROP ? "BACKFILL + DROP" : "BACKFILL"}`);

  // ── 1. Hitung kondisi awal ────────────────────────────────────────────────
  const [{ count: questionCount }] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM questions
  `;
  const [{ count: optionCount }] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM question_options
  `;
  const [{ count: questionWithOptions }] = await sql<{ count: number }[]>`
    SELECT count(DISTINCT question_id)::int AS count FROM question_options
  `;
  console.log("\n[1/4] Kondisi awal");
  console.log(`   soal            : ${questionCount}`);
  console.log(`   opsi            : ${optionCount}`);
  console.log(`   soal ber-opsi   : ${questionWithOptions}`);

  if (DRY_RUN) {
    console.log("\n✓ Dry-run selesai — tidak ada perubahan.");
    return;
  }

  // ── 2. Backfill (idempotent) ──────────────────────────────────────────────
  console.log("\n[2/4] Backfill data_payload.options + answer_key.correctOptionIds");

  const optionRows = await sql<OptionRow[]>`
    SELECT question_id, label, content_markdown, is_correct,
           distractor_rationale, order_index
    FROM question_options
    ORDER BY question_id, order_index, label
  `;
  const byQuestion = new Map<string, OptionRow[]>();
  for (const row of optionRows) {
    const list = byQuestion.get(row.question_id);
    if (list) list.push(row);
    else byQuestion.set(row.question_id, [row]);
  }

  const ids = [...byQuestion.keys()];
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  // Satu statement per batch (unnest 3 larik) — bukan N UPDATE per soal.
  // Alasan: `questions` menyimpan vektor 1024-dim (baris ~16 KB), jadi menulis
  // 9.358 baris satu per satu butuh ~2 jam; satu UPDATE per 200 baris selesai
  // dalam hitungan detik.
  for (let i = 0; i < ids.length; i += BATCH) {
    const batchIds = ids.slice(i, i + BATCH);
    const questions = await sql<QuestionRow[]>`
      SELECT id, question_type, data_payload, answer_key
      FROM questions WHERE id = ANY(${batchIds}::uuid[])
    `;
    const byId = new Map(questions.map((q) => [q.id, q]));

    const targetIds: string[] = [];
    const payloads: string[] = [];
    const keys: string[] = [];

    for (const id of batchIds) {
      const q = byId.get(id);
      const rows = byQuestion.get(id);
      if (!q || !rows) continue;

      // Idempotent: sudah punya `options` → lewati (jangan timpa hasil edit).
      if (Array.isArray((q.data_payload ?? {}).options)) {
        skipped += 1;
        continue;
      }

      const prevPayload = (q.data_payload ?? {}) as Record<string, unknown>;
      const dataPayload = {
        ...prevPayload,
        type: payloadTypeOf(q.question_type),
        options: buildOptions(rows),
        shuffleOptions:
          typeof prevPayload.shuffleOptions === "boolean"
            ? prevPayload.shuffleOptions
            : true,
      };

      const prevKey = (q.answer_key ?? {}) as Record<string, unknown>;
      const correct = buildCorrectLabels(rows);
      const answerKey: Record<string, unknown> = {
        ...prevKey,
        correctOptionIds: correct,
        // Mirror legacy (dedup + ekspor Moodle masih membacanya).
        correct,
      };
      if (typeof prevKey.explanation === "string") {
        answerKey.explanationMarkdown = prevKey.explanation;
      }

      targetIds.push(id);
      payloads.push(JSON.stringify(dataPayload));
      keys.push(JSON.stringify(answerKey));
    }

    if (targetIds.length > 0) {
      try {
        const res = await sql`
          UPDATE questions q
          SET data_payload = v.payload::jsonb,
              answer_key   = v.akey::jsonb
          FROM unnest(${targetIds}::uuid[], ${payloads}::text[], ${keys}::text[])
               AS v(id, payload, akey)
          WHERE q.id = v.id
        `;
        migrated += res.count;
      } catch (e) {
        failed += targetIds.length;
        console.error(`   ✗ batch ${i}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const done = Math.min(i + BATCH, ids.length);
    if (done % 2000 === 0 || done === ids.length) {
      console.log(`   … ${done}/${ids.length} soal diproses`);
    }
  }

  console.log(`   dimigrasi       : ${migrated}`);
  console.log(`   dilewati (idem) : ${skipped}`);
  console.log(`   gagal           : ${failed}`);

  // ── 3. Verifikasi zero-data-loss ──────────────────────────────────────────
  console.log("\n[3/4] Verifikasi (jumlah, label, urutan, kunci, rationale)");

  const verifyRows = await sql<
    (QuestionRow & { opt_count: number; opt_labels: string[]; correct_labels: string[] })[]
  >`
    SELECT q.id, q.question_type, q.data_payload, q.answer_key,
           o.opt_count, o.opt_labels, o.correct_labels
    FROM questions q
    JOIN (
      SELECT question_id,
             count(*)::int AS opt_count,
             jsonb_agg(label ORDER BY order_index, label) AS opt_labels,
             COALESCE(
               jsonb_agg(label ORDER BY order_index, label) FILTER (WHERE is_correct),
               '[]'::jsonb
             ) AS correct_labels
      FROM question_options
      GROUP BY question_id
    ) o ON o.question_id = q.id
  `;

  const mismatches: string[] = [];
  for (const row of verifyRows) {
    const stored = Array.isArray(row.data_payload?.options)
      ? (row.data_payload.options as CanonicalOption[])
      : [];
    const storedLabels = stored.map((o) => o.id);
    const expectedLabels = row.opt_labels.map((l: string) => l.trim().toUpperCase());
    const storedCorrect = Array.isArray(row.answer_key?.correctOptionIds)
      ? (row.answer_key.correctOptionIds as string[])
      : [];
    const expectedCorrect = row.correct_labels.map((l: string) => l.trim().toUpperCase());

    if (row.opt_count !== stored.length) {
      mismatches.push(`${row.id}: jumlah opsi ${row.opt_count} → ${stored.length}`);
    } else if (JSON.stringify(storedLabels) !== JSON.stringify(expectedLabels)) {
      mismatches.push(`${row.id}: label ${expectedLabels} → ${storedLabels}`);
    } else if (JSON.stringify(storedCorrect) !== JSON.stringify(expectedCorrect)) {
      mismatches.push(`${row.id}: kunci ${expectedCorrect} → ${storedCorrect}`);
    }
  }

  const totalStoredOptions = verifyRows.reduce(
    (acc, r) => acc + (Array.isArray(r.data_payload?.options) ? (r.data_payload.options as unknown[]).length : 0),
    0,
  );
  console.log(`   soal diverifikasi : ${verifyRows.length}`);
  console.log(`   opsi tersimpan    : ${totalStoredOptions} (harus = ${optionCount})`);
  console.log(`   ketidakcocokan    : ${mismatches.length}`);

  if (mismatches.length || totalStoredOptions !== optionCount) {
    console.error("\n✗ VERIFIKASI GAGAL — tabel TIDAK di-drop.");
    for (const m of mismatches.slice(0, 20)) console.error(`   - ${m}`);
    process.exitCode = 1;
    return;
  }
  console.log("   ✓ zero data loss: seluruh opsi termigrasi utuh");

  // ── 4. Drop tabel (opsional, hanya setelah verifikasi lolos) ──────────────
  if (!DROP) {
    console.log("\n[4/4] DROP dilewati (jalankan ulang dengan --drop).");
    console.log("\n✓ Backfill selesai.");
    return;
  }

  console.log("\n[4/4] DROP TABLE question_options");
  const [{ count: remaining }] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM question_options
  `;
  if (remaining !== optionCount) {
    console.error(
      `✗ Ada ${remaining - optionCount} baris opsi BARU sejak backfill — jalankan ulang tanpa --drop. Tabel TIDAK di-drop.`,
    );
    process.exitCode = 1;
    return;
  }

  await sql`DROP TABLE IF EXISTS question_options CASCADE`;
  const [{ count: stillThere }] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'question_options'
  `;
  console.log(`   tabel question_options tersisa: ${stillThere}`);
  console.log(`   soal total (harus tetap ${questionCount}): ${
    (await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM questions`)[0].count
  }`);
  console.log("\n✓ Migrasi + DROP selesai.");
}

main()
  .catch((e) => {
    console.error("\n✗ Migrasi gagal:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
