/**
 * rebuild-media-relations.ts — ACT-08 (Sprint 1).
 *
 * Rekonstruksi tabel `question_media` dari shortcode `{{img:<ref>}}` yang
 * tertanam di `questions.content_markdown`.
 *
 * Konteks masalah:
 *   - `media_assets` = 2.617 baris, `question_media` = 0 baris.
 *   - 1.520 soal memuat 1.660 referensi `{{img:...}}`.
 *   - Tanpa baris `question_media`, frontend tidak bisa memuat gambar soal.
 *
 * Aturan resolusi (berurutan, berhenti di yang pertama cocok):
 *   1. `media_assets.short_id`  — kunci kanonik shortcode (lihat schema media.ts).
 *   2. `media_assets.original_image_path` — basename / path penuh (kompatibilitas
 *      data lama yang menulis nama berkas, mis. `{{img:2b/2b30...jpg}}`).
 *
 * Idempotent: INSERT ... ON CONFLICT DO NOTHING pada UNIQUE
 * (question_id, media_id, role, order_index) — aman dijalankan berulang.
 *
 * Jalankan:
 *   pnpm tsx scripts/rebuild-media-relations.ts            # kering (dry-run)
 *   pnpm tsx scripts/rebuild-media-relations.ts --apply    # tulis ke DB
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib (jalankan lewat pnpm tsx)");

const APPLY = process.argv.includes("--apply");
const IMG_RE = /\{\{img:([^}]+)\}\}/g;
const ROLE = "content" as const;

const sql = postgres(url, { max: 4 });

interface MediaRow {
  id: string;
  short_id: string;
  original_image_path: string | null;
}

/** Bangun indeks resolusi: short_id → media, dan path/basename → media. */
function buildIndex(rows: MediaRow[]) {
  const byShortId = new Map<string, string>();
  const byPath = new Map<string, string>();
  for (const r of rows) {
    byShortId.set(r.short_id, r.id);
    if (!r.original_image_path) continue;
    const path = r.original_image_path;
    byPath.set(path.toLowerCase(), r.id);
    const base = path.split("/").pop();
    if (base) byPath.set(base.toLowerCase(), r.id);
  }
  return { byShortId, byPath };
}

function resolve(ref: string, index: ReturnType<typeof buildIndex>): string | null {
  const clean = ref.trim();
  const direct = index.byShortId.get(clean);
  if (direct) return direct;
  const lower = clean.toLowerCase();
  return index.byPath.get(lower) ?? index.byPath.get(lower.split("/").pop() ?? lower) ?? null;
}

async function main() {
  const mediaRows = await sql<MediaRow[]>`
    SELECT id::text AS id, short_id, original_image_path
    FROM media_assets
  `;
  const index = buildIndex(mediaRows);
  console.log(`media_assets: ${mediaRows.length} baris (indeks resolusi siap)`);

  const questions = await sql<{ id: string; content_markdown: string }[]>`
    SELECT id::text AS id, content_markdown
    FROM questions
    WHERE content_markdown LIKE '%{{img:%'
      AND deleted_at IS NULL
    ORDER BY id
  `;
  console.log(`questions dengan {{img:...}}: ${questions.length}`);

  let totalRefs = 0;
  let matchedRefs = 0;
  const pending: { questionId: string; mediaId: string; orderIndex: number }[] = [];
  const orphanCounter = new Map<string, number>();
  const perQuestionFailures: { questionId: string; orphans: string[] }[] = [];

  for (const q of questions) {
    const refs = [...q.content_markdown.matchAll(IMG_RE)].map((m) => m[1]!.trim());
    if (refs.length === 0) continue;
    const orphans: string[] = [];
    const seen = new Set<string>();
    let orderIndex = 0;
    for (const ref of refs) {
      totalRefs++;
      const mediaId = resolve(ref, index);
      if (!mediaId) {
        orphans.push(ref);
        orphanCounter.set(ref, (orphanCounter.get(ref) ?? 0) + 1);
        continue;
      }
      matchedRefs++;
      // Referensi ganda di satu soal: cukup satu baris (posisi pertama).
      if (seen.has(mediaId)) continue;
      seen.add(mediaId);
      pending.push({ questionId: q.id, mediaId, orderIndex: orderIndex++ });
    }
    if (orphans.length > 0) perQuestionFailures.push({ questionId: q.id, orphans });
  }

  const questionsWithRelations = new Set(pending.map((p) => p.questionId)).size;
  const distinctMedia = new Set(pending.map((p) => p.mediaId)).size;
  const pct = totalRefs === 0 ? 0 : (matchedRefs / totalRefs) * 100;

  console.log("\n=== RINGKASAN EKSTRAKSI ===");
  console.log(`Total referensi {{img:...}}   : ${totalRefs}`);
  console.log(`Referensi terpetakan          : ${matchedRefs} (${pct.toFixed(1)}%)`);
  console.log(`Referensi orphan (tak ketemu) : ${totalRefs - matchedRefs}`);
  console.log(`Soal akan punya relasi        : ${questionsWithRelations}`);
  console.log(`Media unik terpakai           : ${distinctMedia}`);
  console.log(`Baris question_media (rencana): ${pending.length}`);

  if (orphanCounter.size > 0) {
    const top = [...orphanCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    console.log(`\nOrphan unik: ${orphanCounter.size} (top 20):`);
    for (const [ref, n] of top) console.log(`  - ${ref} × ${n}`);
  }

  if (!APPLY) {
    console.log("\n(dry-run) Tidak ada perubahan. Jalankan dengan --apply untuk menulis.");
    await sql.end();
    return;
  }

  // Insert bertahap (batch 500) — hindari parameter limit & transaksi raksasa.
  const CHUNK = 500;
  const [before] = await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM question_media`;
  let inserted = 0;
  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = pending.slice(i, i + CHUNK);
    const rows = chunk.map((c) => ({
      question_id: c.questionId,
      media_id: c.mediaId,
      role: ROLE,
      order_index: c.orderIndex,
    }));
    const res = await sql`
      INSERT INTO question_media ${sql(rows, "question_id", "media_id", "role", "order_index")}
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    inserted += res.count ?? res.length;
  }
  const [after] = await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM question_media`;
  console.log(
    `\nSelesai: ${inserted} baris baru dilaporkan driver; delta tabel = ${Number(after!.n) - Number(before!.n)} (dari ${pending.length} rencana).`,
  );

  const [counts] = await sql<{ total: string; q_with: string; media_used: string }[]>`
    SELECT
      (SELECT count(*)::text FROM question_media) AS total,
      (SELECT count(DISTINCT question_id)::text FROM question_media) AS q_with,
      (SELECT count(DISTINCT media_id)::text FROM question_media) AS media_used
  `;
  console.log(
    `Verifikasi DB: question_media=${counts!.total} baris, soal tercakup=${counts!.q_with}, media unik=${counts!.media_used}`,
  );

  if (perQuestionFailures.length > 0) {
    console.log(`Soal dengan orphan (${perQuestionFailures.length}), contoh 10:`);
    for (const f of perQuestionFailures.slice(0, 10)) {
      console.log(`  - ${f.questionId}: ${f.orphans.join(", ")}`);
    }
  }

  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end({ timeout: 5 });
  process.exit(1);
});
