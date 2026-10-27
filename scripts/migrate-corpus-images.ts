/**
 * migrate-corpus-images.ts
 *
 * Migrates offline corpus images (corpus://mathcyber/..., etc.) from
 * /home/hari/projects/qbank/data/corpora/ into MathBank's official media storage
 * (storage/media/) and registers them in `media_assets`.
 *
 * Then updates all questions in `questions`:
 * - `content_markdown`
 * - `data_payload`
 * - `answer_key`
 *
 * Replacing `![alt](corpus://...)` and `corpus://...` with `{{img:<shortId>}}`,
 * and inserting into `question_media`.
 *
 * Usage:
 *   pnpm tsx --env-file=.env scripts/migrate-corpus-images.ts          # dry-run
 *   pnpm tsx --env-file=.env scripts/migrate-corpus-images.ts --apply  # write to disk & DB
 */
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, extname } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib (jalankan lewat pnpm tsx)");

const APPLY = process.argv.includes("--apply");
const corporaBase =
  process.env.CORPORA_BASE?.trim() ||
  process.env.CORPUS_IMAGE_BASE?.trim() ||
  "/home/hari/projects/qbank/data/corpora";
const mediaRoot = process.env.MEDIA_STORAGE_PATH || join(process.cwd(), "storage", "media");

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const sql = postgres(url, { max: 4 });

interface QuestionRow {
  id: string;
  content_markdown: string;
  data_payload: Record<string, unknown> | null;
  answer_key: Record<string, unknown> | null;
}

async function main() {
  console.log("=== Migrasi Gambar Korpus ke MathBank Media ===");
  console.log(`Corpora Base : ${corporaBase}`);
  console.log(`Media Storage: ${mediaRoot}`);
  console.log(`Mode         : ${APPLY ? "APPLY (eksekusi)" : "DRY-RUN (hanya lapor)"}\n`);

  // 1. Fetch all questions containing corpus://
  const rows = await sql<QuestionRow[]>`
    SELECT id, content_markdown, data_payload, answer_key
    FROM questions
    WHERE content_markdown LIKE '%corpus://%'
       OR data_payload::text LIKE '%corpus://%'
       OR answer_key::text LIKE '%corpus://%'
    ORDER BY id
  `;
  console.log(`Soal dengan referensi corpus://: ${rows.length}`);

  // 2. Collect all distinct corpus URLs
  const urlMap = new Map<string, { fullPath: string; mime: string; bytes: Buffer; hash: string }>();
  const missingUrls = new Set<string>();

  for (const r of rows) {
    const texts = [
      r.content_markdown || "",
      JSON.stringify(r.data_payload || {}),
      JSON.stringify(r.answer_key || {}),
    ];
    for (const t of texts) {
      for (const m of t.matchAll(/corpus:\/\/([A-Za-z0-9_-]+)\/([^)"'\s]+)/g)) {
        const fullUrl = m[0];
        if (urlMap.has(fullUrl) || missingUrls.has(fullUrl)) continue;

        const src = m[1];
        const rel = m[2];
        const filePath = join(corporaBase, src, "images", rel);

        if (existsSync(filePath)) {
          const bytes = readFileSync(filePath);
          const ext = extname(filePath).toLowerCase();
          const mime = MIME_BY_EXT[ext] || "image/png";
          const hash = createHash("sha256").update(bytes).digest("hex");
          urlMap.set(fullUrl, { fullPath: filePath, mime, bytes, hash });
        } else {
          missingUrls.add(fullUrl);
        }
      }
    }
  }

  console.log(`URL corpus:// ditemukan berkas fisiknya : ${urlMap.size}`);
  console.log(`URL corpus:// tidak ada berkas fisiknya: ${missingUrls.size}`);
  if (missingUrls.size > 0) {
    console.log("Contoh URL yang tidak ada berkasnya:");
    for (const u of [...missingUrls].slice(0, 5)) {
      console.log(`  - ${u}`);
    }
  }

  // 3. Register assets in MathBank media
  const { storeAndRegister } = await import("../src/lib/services/media-service");
  const shortIdByUrl = new Map<string, { shortId: string; mediaId: string }>();

  let registeredCount = 0;
  let reusedCount = 0;

  if (APPLY) {
    console.log("\nMendaftarkan berkas ke storage/media dan media_assets...");
    for (const [u, item] of urlMap.entries()) {
      const res = await storeAndRegister(mediaRoot, {
        contentHash: item.hash,
        mimeType: item.mime,
        bytes: new Uint8Array(item.bytes),
        title: null,
        sourceOrigin: "web_ingest",
      });

      shortIdByUrl.set(u, { shortId: res.shortId, mediaId: res.id });
      if (res.reused) reusedCount++;
      else registeredCount++;
    }
    console.log(`Aset baru didaftarkan: ${registeredCount}, aset eksis (reused): ${reusedCount}`);
  } else {
    // In dry-run, check how many hashes exist in media_assets
    const existingHashes = await sql`SELECT content_hash, short_id, id FROM media_assets`;
    const hashMap = new Map(existingHashes.map((r) => [r.content_hash, { shortId: r.short_id, id: r.id }]));
    for (const [u, item] of urlMap.entries()) {
      const match = hashMap.get(item.hash);
      if (match) {
        shortIdByUrl.set(u, { shortId: match.shortId, mediaId: match.id });
        reusedCount++;
      } else {
        shortIdByUrl.set(u, { shortId: "DRYRUNID", mediaId: "DRYRUN_UUID" });
        registeredCount++;
      }
    }
    console.log(`(dry-run) Aset baru yang akan didaftarkan: ${registeredCount}, aset sudah ada: ${reusedCount}`);
  }

  // 4. Update questions contentMarkdown, dataPayload, and answerKey
  console.log("\nMemproses penggantian corpus:// -> {{img:shortId}} pada soal...");
  let updatedQuestions = 0;
  const pendingLinks: { questionId: string; mediaId: string; orderIndex: number }[] = [];

  function replaceCorpusRefs(text: string, qId: string): string {
    let res = text;
    for (const [corpusUrl, { shortId, mediaId }] of shortIdByUrl.entries()) {
      if (!res.includes(corpusUrl)) continue;
      // Pattern 1: ![alt](corpusUrl) -> {{img:shortId}}
      const mdRegex = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(corpusUrl)}\\)`, "g");
      res = res.replace(mdRegex, `{{img:${shortId}}}`);
      // Pattern 2: bare corpusUrl -> {{img:shortId}}
      res = res.replaceAll(corpusUrl, `{{img:${shortId}}}`);

      if (APPLY) {
        pendingLinks.push({ questionId: qId, mediaId, orderIndex: 0 });
      }
    }
    return res;
  }

  for (const q of rows) {
    let changed = false;

    // Stem
    const origCm = q.content_markdown || "";
    const newCm = replaceCorpusRefs(origCm, q.id);
    if (newCm !== origCm) changed = true;

    // Payload (JSON stringified replace, then parse back)
    let newPayload = q.data_payload;
    if (q.data_payload) {
      const origPayloadStr = JSON.stringify(q.data_payload);
      const newPayloadStr = replaceCorpusRefs(origPayloadStr, q.id);
      if (newPayloadStr !== origPayloadStr) {
        newPayload = JSON.parse(newPayloadStr);
        changed = true;
      }
    }

    // Answer Key (explanation)
    let newAnswerKey = q.answer_key;
    if (q.answer_key) {
      const origAkStr = JSON.stringify(q.answer_key);
      const newAkStr = replaceCorpusRefs(origAkStr, q.id);
      if (newAkStr !== origAkStr) {
        newAnswerKey = JSON.parse(newAkStr);
        changed = true;
      }
    }

    if (changed) {
      updatedQuestions++;
      if (APPLY) {
        await sql`
          UPDATE questions
          SET content_markdown = ${newCm},
              data_payload = ${newPayload ? JSON.stringify(newPayload) : null}::jsonb,
              answer_key = ${newAnswerKey ? JSON.stringify(newAnswerKey) : null}::jsonb,
              updated_at = NOW()
          WHERE id = ${q.id}
        `;
      }
    }
  }

  console.log(`Total soal yang ${APPLY ? "berhasil diperbarui" : "akan diperbarui"}: ${updatedQuestions}`);

  // 5. Insert question_media relations
  if (APPLY && pendingLinks.length > 0) {
    console.log(`\nMenautkan ${pendingLinks.length} relasi ke question_media...`);
    const CHUNK = 500;
    let linkedCount = 0;
    // Deduplicate pendingLinks
    const seen = new Set<string>();
    const uniqueLinks = pendingLinks.filter((l) => {
      const k = `${l.questionId}:${l.mediaId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    for (let i = 0; i < uniqueLinks.length; i += CHUNK) {
      const chunk = uniqueLinks.slice(i, i + CHUNK);
      const rowsToInsert = chunk.map((c) => ({
        question_id: c.questionId,
        media_id: c.mediaId,
        role: "content" as const,
        order_index: c.orderIndex,
      }));

      const res = await sql`
        INSERT INTO question_media ${sql(rowsToInsert, "question_id", "media_id", "role", "order_index")}
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      linkedCount += res.count ?? res.length;
    }
    console.log(`Selesai: ${linkedCount} relasi question_media ditambahkan.`);
  }

  console.log("\n=== SELESAI ===");
  await sql.end({ timeout: 1 });
  process.exit(0);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch(async (e) => {
  console.error("GAGAL:", e);
  await sql.end();
  process.exit(1);
});
