/**
 * Fix: Un-escape double-encoded data_payload.options (string → proper JSONB array)
 * MAT-35 data quality fix
 *
 * 37 questions have options stored as a JSON string (double-encoded) instead of a JSONB array.
 * This script parses and re-stores them as proper JSONB arrays.
 *
 * Jalankan (dry):  DRY_RUN=1 pnpm exec tsx scripts/fix-double-encoded-options.ts
 * Jalankan (live): DRY_RUN=0 pnpm exec tsx scripts/fix-double-encoded-options.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN !== "0";
const sql = postgres(DB_URL, { max: 1, connect_timeout: 30, idle_timeout: 30 });

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE UPDATE"}`);
  console.log("Fix: double-encoded data_payload.options (string → JSONB array)\n");

  const affected = await sql`
    SELECT id, data_payload->'options' as opts_string
    FROM questions
    WHERE deleted_at IS NULL
      AND jsonb_typeof(data_payload->'options') = 'string'
    ORDER BY id
  ` as Array<{ id: string; opts_string: string }>;

  console.log(`Found ${affected.length} questions with double-encoded options\n`);

  let fixed = 0;
  let failed = 0;

  for (const row of affected) {
    const id = row.id;
    // The value comes as a JSON string (the string itself is a serialized array)
    const optsString = row.opts_string as unknown as string;

    let parsed: unknown;
    try {
      // optsString arrives from postgres as a JS string (the JSONB string value)
      // We need to parse it to get the actual array
      parsed = JSON.parse(optsString);
    } catch {
      console.log(`  [FAIL] ${id.substring(0, 8)}: cannot parse opts_string: ${String(optsString).substring(0, 60)}`);
      failed++;
      continue;
    }

    if (!Array.isArray(parsed)) {
      console.log(`  [FAIL] ${id.substring(0, 8)}: parsed value is not an array (got ${typeof parsed})`);
      failed++;
      continue;
    }

    const hasRationale = (parsed as Array<Record<string, unknown>>).some(
      (opt) => typeof opt.distractorRationale === "string" && (opt.distractorRationale as string).length > 10
    );

    console.log(`  [${DRY_RUN ? "DRY" : "FIX"}] ${id.substring(0, 8)}: ${parsed.length} options${hasRationale ? " (has rationale)" : ""}`);

    if (!DRY_RUN) {
      // sql.json() mengirim nilai sebagai JSONB sungguhan. Bentuk
      // `${JSON.stringify(parsed)}::jsonb` di-stringify LAGI oleh postgres.js
      // (cast ::jsonb memicu serialisasi JSON), sehingga kolom tetap string —
      // skrip melaporkan "Fixed: 8" tanpa satu pun baris berubah.
      const updated = await sql`
        UPDATE questions
        SET data_payload = jsonb_set(data_payload, '{options}', ${sql.json(parsed)})
        WHERE id = ${id}::uuid
          AND jsonb_typeof(data_payload->'options') = 'string'
        RETURNING jsonb_typeof(data_payload->'options') AS t
      `;
      if (updated[0]?.t === "array") {
        fixed++;
      } else {
        console.log(`  [FAIL] ${id.substring(0, 8)}: tipe setelah update masih ${String(updated[0]?.t ?? "tidak tersentuh")}`);
        failed++;
      }
    } else {
      fixed++;
    }
  }

  // ── FIX 2: double-encoded answer_key (string → proper JSONB object) ──
  console.log("\nFix: double-encoded answer_key (string → JSONB object)\n");
  const affectedKeys = (await sql`
    SELECT id, answer_key as key_val
    FROM questions
    WHERE deleted_at IS NULL
      AND jsonb_typeof(answer_key) = 'string'
    ORDER BY id
  `) as Array<{ id: string; key_val: unknown }>;

  console.log(`Found ${affectedKeys.length} questions with double-encoded answer_key\n`);
  let fixedKeys = 0;
  let failedKeys = 0;

  for (const row of affectedKeys) {
    const id = row.id;
    let parsed: unknown;
    try {
      parsed = typeof row.key_val === "string" ? JSON.parse(row.key_val) : row.key_val;
    } catch {
      console.log(`  [FAIL] ${id.substring(0, 8)}: cannot parse answer_key string`);
      failedKeys++;
      continue;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.log(`  [FAIL] ${id.substring(0, 8)}: parsed answer_key is not an object`);
      failedKeys++;
      continue;
    }

    console.log(`  [${DRY_RUN ? "DRY" : "FIX"}] ${id.substring(0, 8)}: keys=${Object.keys(parsed).join(",")}`);

    if (!DRY_RUN) {
      const updated = await sql`
        UPDATE questions
        SET answer_key = ${sql.json(parsed as postgres.JSONValue)}
        WHERE id = ${id}::uuid
          AND jsonb_typeof(answer_key) = 'string'
        RETURNING jsonb_typeof(answer_key) AS t
      `;
      if (updated[0]?.t === "object") {
        fixedKeys++;
      } else {
        console.log(`  [FAIL] ${id.substring(0, 8)}: tipe setelah update masih ${String(updated[0]?.t ?? "tidak tersentuh")}`);
        failedKeys++;
      }
    } else {
      fixedKeys++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Options Fixed: ${fixed}, Failed: ${failed}`);
  console.log(`Answer Keys Fixed: ${fixedKeys}, Failed: ${failedKeys}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN — no changes" : "LIVE — JSONB updated"}`);

  await sql.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
