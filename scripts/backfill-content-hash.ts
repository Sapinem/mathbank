/**
 * backfill-content-hash.ts
 *
 * Menghitung ulang `questions.content_hash` dari `content_markdown` +
 * `data_payload` yang tersimpan (ADR-0012).
 *
 * Diperlukan setelah skrip perbaikan data yang menulis ulang naskah tanpa
 * memperbarui hash (lihat temuan review #1). Idempoten: hanya baris yang
 * hash-nya berbeda yang ditulis.
 *
 * Usage:
 *   pnpm tsx --env-file=.env scripts/backfill-content-hash.ts          # dry-run
 *   pnpm tsx --env-file=.env scripts/backfill-content-hash.ts --apply  # tulis
 */
import { config } from "dotenv";
import postgres from "postgres";
import { questionContentHash } from "./lib/question-hash";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib");

const APPLY = process.argv.includes("--apply");
const sql = postgres(url, { max: 4 });

interface Row {
  id: string;
  content_markdown: string | null;
  data_payload: unknown;
  content_hash: string | null;
}

async function main() {
  console.log("=== Backfill content_hash (ADR-0012) ===");
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  const rows = await sql<Row[]>`
    SELECT id, content_markdown, data_payload, content_hash
    FROM questions
    WHERE deleted_at IS NULL
  `;

  const mismatched = rows.filter(
    (r) => questionContentHash(r.content_markdown ?? "", r.data_payload) !== r.content_hash,
  );

  console.log(`Total soal aktif      : ${rows.length}`);
  console.log(`Hash tidak konsisten  : ${mismatched.length}`);

  if (!APPLY) {
    console.log("\n(dry-run) Tidak ada data yang diubah. Jalankan dengan --apply untuk menulis.");
    await sql.end();
    return;
  }

  let updated = 0;
  for (const row of mismatched) {
    const next = questionContentHash(row.content_markdown ?? "", row.data_payload);
    await sql`
      UPDATE questions
      SET content_hash = ${next}
      WHERE id = ${row.id}
        AND content_hash IS DISTINCT FROM ${next}
    `;
    updated++;
  }

  console.log(`\n✓ ${updated} baris diperbarui.`);
  await sql.end();
}

main().catch(async (err) => {
  console.error("✗ Gagal:", err);
  await sql.end();
  process.exit(1);
});
