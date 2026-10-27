/**
 * resolve-all-pusmendik-questions.ts
 *
 * Resolves all remaining `corpus://pusmendik_tka/Simulasi TKA-img-*.png` references
 * to their verified MathBank media shortId (`{{img:<shortId>}}`).
 *
 * Maps:
 *   cbt_images/<name> -> <slug>-img-<N>.<ext> -> media_assets.short_id
 *
 * Usage:
 *   pnpm tsx --env-file=.env scripts/resolve-all-pusmendik-questions.ts          # dry-run
 *   pnpm tsx --env-file=.env scripts/resolve-all-pusmendik-questions.ts --apply  # apply to DB
 */
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib");

const APPLY = process.argv.includes("--apply");
const sql = postgres(url, { max: 4 });

const dir = "/home/hari/projects/qbank/data/corpora/pusmendik_tka";
const imgDir = join(dir, "images");
const jsonFiles = [
  "sd-matematika-p1.json",
  "sd-matematika-p2.json",
  "smp-matematika-p1.json",
  "sma-matematika-lanjut-p1.json",
  "sma-matematika-lanjut-p2.json",
  "sma-matematika-wajib-p1.json",
  "sma-matematika-wajib-p2.json",
  "smp-matematika-p2.json",
];

function clean(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function main() {
  console.log("=== Resolve All Pusmendik TKA Questions ===");
  console.log(`Mode: ${APPLY ? "APPLY (writing to DB)" : "DRY-RUN (read only)"}\n`);

  // 1. Build map of content_hash -> shortId & id
  const assets = await sql`SELECT id, short_id, content_hash FROM media_assets`;
  const assetByHash = new Map(assets.map((a) => [a.content_hash, { id: a.id, shortId: a.short_id }]));

  // 2. Build map of (slug:cbtName) -> { shortId, id }
  const cbtMap = new Map<string, { shortId: string; id: string }>();
  for (const jf of jsonFiles) {
    const slug = jf.replace(".json", "");
    const data = JSON.parse(readFileSync(join(dir, jf), "utf8"));
    const rawHtml = data.rawHtml || "";

    const imgsInFile: string[] = [];
    for (const m of rawHtml.matchAll(/cbt_images\/([A-Za-z0-9_.-]+?\.(?:png|jpg|jpeg))/gi)) {
      if (!imgsInFile.includes(m[1]!)) imgsInFile.push(m[1]!);
    }

    for (let i = 0; i < imgsInFile.length; i++) {
      const cbtName = imgsInFile[i]!;
      const fileNum = i + 1;
      const diskFiles = readdirSync(imgDir).filter((f) => f.startsWith(`${slug}-img-${fileNum}.`));
      if (diskFiles.length > 0) {
        const diskFile = diskFiles[0]!;
        const bytes = readFileSync(join(imgDir, diskFile));
        const hash = createHash("sha256").update(bytes).digest("hex");
        const a = assetByHash.get(hash);
        if (a) {
          cbtMap.set(`${slug}:${cbtName}`, a);
        }
      }
    }
  }
  console.log(`Peta gambar cbt_image siap: ${cbtMap.size} entri terdaftar.`);

  // 3. Parse all question blocks in all 8 files
  interface BlockInfo {
    slug: string;
    soalNum: number;
    cleanText: string;
    cbtImgs: string[];
  }
  const allBlocks: BlockInfo[] = [];

  for (const jf of jsonFiles) {
    const slug = jf.replace(".json", "");
    const data = JSON.parse(readFileSync(join(dir, jf), "utf8"));
    const rawHtml = data.rawHtml || "";
    const blocks = rawHtml.split(/(?=<div class="soal-soal)/i).filter((b: string) => /soal-no-\d+/i.test(b));

    for (const b of blocks) {
      const numMatch = b.match(/id="soal-no-(\d+)"/i);
      const soalNum = numMatch ? Number(numMatch[1]) : 0;
      const bImgs: string[] = [];
      for (const m of b.matchAll(/cbt_images\/([A-Za-z0-9_.-]+?\.(?:png|jpg|jpeg))/gi)) {
        if (!bImgs.includes(m[1]!)) bImgs.push(m[1]!);
      }
      allBlocks.push({
        slug,
        soalNum,
        cleanText: clean(b),
        cbtImgs: bImgs,
      });
    }
  }

  // 4. Fetch questions from DB that have Simulasi TKA
  const qs = await sql<{
    id: string;
    content_markdown: string;
    data_payload: Record<string, unknown> | null;
    order_index: number | null;
  }[]>`
    SELECT q.id, q.content_markdown, q.data_payload, bi.order_index
    FROM questions q
    LEFT JOIN bundle_items bi ON bi.question_id = q.id
    WHERE q.content_markdown LIKE '%Simulasi TKA%'
       OR q.data_payload::text LIKE '%Simulasi TKA%'
    ORDER BY q.id
  `;
  console.log(`Soal di database dengan Simulasi TKA: ${qs.length}`);

  let updatedCount = 0;
  let unresolvedCount = 0;
  const pendingLinks: { questionId: string; mediaId: string; orderIndex: number }[] = [];

  for (const q of qs) {
    // Match question to block
    const lines = (q.content_markdown || "")
      .split("\n")
      .map((l) => clean(l.replace(/!\[.*?\]\(.*?\)/g, "")))
      .filter((l) => l.length > 15);

    let match: BlockInfo | null = null;
    for (const l of lines) {
      const probe = l.slice(0, 30);
      match = allBlocks.find((b) => b.cleanText.includes(probe)) ?? null;
      if (match) break;
    }

    if (!match) {
      const opts = (q.data_payload as { options?: { contentMarkdown?: string }[] } | null)?.options;
      if (opts && Array.isArray(opts) && opts.length >= 3) {
        const optTexts = opts.map((o) => clean(o.contentMarkdown || "")).filter(Boolean);
        match = allBlocks.find((b) => optTexts.every((ot) => b.cleanText.includes(ot))) ?? null;
      }
    }

    if (!match) {
      const rows = (q.data_payload as { rows?: { text?: string }[] } | null)?.rows;
      if (rows && Array.isArray(rows) && rows.length >= 2) {
        const rowTexts = rows.map((r) => clean(r.text || "")).filter(Boolean);
        match = allBlocks.find((b) => rowTexts.some((rt) => rt.length > 10 && b.cleanText.includes(rt.slice(0, 25)))) ?? null;
      }
    }

    // Try finding by significant phrases
    if (!match) {
      const allText = clean(q.content_markdown || "");
      const phrases = ["invers dari fungsi", "fungsi f(x)", "pecahan", "persamaan lingkaran", "grafik fungsi"];
      for (const p of phrases) {
        if (allText.includes(p)) {
          match = allBlocks.find((b) => b.cleanText.includes(p)) ?? null;
          if (match) break;
        }
      }
    }

    // Fallback: match by bundle order_index
    if (!match && q.order_index !== null) {
      const idx = q.order_index;
      let targetSlug = "";
      let targetNum = 0;
      if (idx >= 1 && idx <= 30) {
        targetSlug = "sd-matematika-p1";
        targetNum = idx;
      } else if (idx >= 31 && idx <= 60) {
        targetSlug = "sd-matematika-p2";
        targetNum = idx - 30;
      } else if (idx >= 61 && idx <= 90) {
        targetSlug = "smp-matematika-p1";
        targetNum = idx - 60;
      } else if (idx >= 91 && idx <= 120) {
        targetSlug = "sma-matematika-lanjut-p1";
        targetNum = idx - 90;
      } else if (idx >= 121 && idx <= 150) {
        targetSlug = "sma-matematika-lanjut-p2";
        targetNum = idx - 120;
      } else if (idx >= 151 && idx <= 180) {
        targetSlug = "sma-matematika-wajib-p1";
        targetNum = idx - 150;
      } else if (idx >= 181 && idx <= 210) {
        targetSlug = "sma-matematika-wajib-p2";
        targetNum = idx - 180;
      } else if (idx >= 211 && idx <= 233) {
        targetSlug = "smp-matematika-p2";
        targetNum = idx - 210;
      }

      if (targetSlug && targetNum > 0) {
        match = allBlocks.find((b) => b.slug === targetSlug && b.soalNum === targetNum) ?? null;
      }
    }

    if (!match) {
      unresolvedCount++;
      console.log(`  [LEWAT] Tidak cocok dengan block korpus: ${q.id} (order: ${q.order_index})`);
      continue;
    }

    // Replace Simulasi TKA-img-N.png with the corresponding cbtImg's shortId
    let newStem = q.content_markdown || "";
    let newPayload = q.data_payload;
    let changed = false;

    // Map each 1-based index (Simulasi TKA-img-1, 2, 3...) to shortId
    for (let i = 0; i < match.cbtImgs.length; i++) {
      const blockIdx = i + 1;
      const cbtName = match.cbtImgs[i]!;
      const asset = cbtMap.get(`${match.slug}:${cbtName}`);
      if (!asset) continue;

      const targetUrl = `corpus://pusmendik_tka/Simulasi TKA-img-${blockIdx}.png`;
      const shortcode = `{{img:${asset.shortId}}}`;

      // In stem
      if (newStem.includes(targetUrl)) {
        const mdRegex = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(targetUrl)}\\)`, "g");
        newStem = newStem.replace(mdRegex, shortcode).replaceAll(targetUrl, shortcode);
        changed = true;
        pendingLinks.push({ questionId: q.id, mediaId: asset.id, orderIndex: i });
      }

      // In payload
      if (newPayload) {
        const pStr = JSON.stringify(newPayload);
        if (pStr.includes(targetUrl)) {
          const mdRegex = new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(targetUrl)}\\)`, "g");
          const newPStr = pStr.replace(mdRegex, shortcode).replaceAll(targetUrl, shortcode);
          newPayload = JSON.parse(newPStr);
          changed = true;
          pendingLinks.push({ questionId: q.id, mediaId: asset.id, orderIndex: i });
        }
      }
    }

    if (changed) {
      updatedCount++;
      if (APPLY) {
        await sql`
          UPDATE questions
          SET content_markdown = ${newStem},
              data_payload = ${newPayload ? JSON.stringify(newPayload) : null}::jsonb,
              updated_at = NOW()
          WHERE id = ${q.id}
        `;
      }
    }
  }

  console.log(`\nHasil:`);
  console.log(`Soal berhasil dipetakan & diperbarui: ${updatedCount}`);
  console.log(`Soal belum cocok                   : ${unresolvedCount}`);

  if (APPLY && pendingLinks.length > 0) {
    const seen = new Set<string>();
    const unique = pendingLinks.filter((l) => {
      const k = `${l.questionId}:${l.mediaId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const CHUNK = 500;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const chunk = unique.slice(i, i + CHUNK);
      await sql`
        INSERT INTO question_media ${sql(
          chunk.map((c) => ({
            question_id: c.questionId,
            media_id: c.mediaId,
            role: "content" as const,
            order_index: c.orderIndex,
          })),
          "question_id",
          "media_id",
          "role",
          "order_index",
        )}
        ON CONFLICT DO NOTHING
      `;
    }
    console.log(`Ditambahkan ${unique.length} relasi ke question_media.`);
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
