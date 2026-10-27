/**
 * fix-remaining-tka-questions.ts
 *
 * Updates the 4 remaining TKA questions with their exact media shortcodes.
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib");

const sql = postgres(url, { max: 2 });

async function main() {
  console.log("=== Updating 4 Remaining TKA Questions ===");

  // 1. 01a1186e-09ac-7883-bc0b-4abd0813058e
  const q1Payload = {
    type: "multiple_choice",
    options: [
      { id: "A", contentMarkdown: "{{img:9370ehFc}}" },
      { id: "B", contentMarkdown: "{{img:PSD1ik0h}}" },
      { id: "C", contentMarkdown: "{{img:i1hzQOSM}}" },
      { id: "D", contentMarkdown: "{{img:pkrzWsDh}}" },
      { id: "E", contentMarkdown: "{{img:88gLt5UK}}" },
    ],
    shuffleOptions: true,
  };
  await sql`
    UPDATE questions
    SET content_markdown = '{{img:HIE2Ldeh}}',
        data_payload = ${sql.json(q1Payload)},
        updated_at = NOW()
    WHERE id = '01a1186e-09ac-7883-bc0b-4abd0813058e'
  `;
  console.log("✓ Updated 01a1186e-09ac-7883-bc0b-4abd0813058e");

  // 2. 01a1186e-1652-7e42-9125-32e928eabcfa
  const q2Payload = {
    type: "multiple_choice",
    options: [
      { id: "A", contentMarkdown: "{{img:6lg0Cr7I}}" },
      { id: "B", contentMarkdown: "{{img:d7mFihMb}}" },
      { id: "C", contentMarkdown: "{{img:4xOsek6D}}" },
      { id: "D", contentMarkdown: "{{img:ErkZx6QN}}" },
    ],
    shuffleOptions: true,
  };
  await sql`
    UPDATE questions
    SET content_markdown = 'Nilai {{img:WyB8Bpt6}} adalah ....',
        data_payload = ${sql.json(q2Payload)},
        updated_at = NOW()
    WHERE id = '01a1186e-1652-7e42-9125-32e928eabcfa'
  `;
  console.log("✓ Updated 01a1186e-1652-7e42-9125-32e928eabcfa");

  // 3. 01a1186e-0e18-77fc-9a18-c271b1803a22
  const q3Payload = {
    type: "multiple_choice",
    options: [
      { id: "A", contentMarkdown: "{{img:AkmCsrdb}}" },
      { id: "B", contentMarkdown: "0" },
      { id: "C", contentMarkdown: "{{img:tb8kQp0B}}" },
      { id: "D", contentMarkdown: "1" },
      { id: "E", contentMarkdown: "3" },
    ],
    shuffleOptions: true,
  };
  await sql`
    UPDATE questions
    SET content_markdown = '{{img:pMqL8DcF}}',
        data_payload = ${sql.json(q3Payload)},
        updated_at = NOW()
    WHERE id = '01a1186e-0e18-77fc-9a18-c271b1803a22'
  `;
  console.log("✓ Updated 01a1186e-0e18-77fc-9a18-c271b1803a22");

  // 4. 01a1186e-0e92-72ab-a4c1-8b148e39acac
  const q4Stem = `{{img:sOJA20Ce}}\n\nBerdasarkan informasi tersebut, pilihlah semua pernyataan berikut yang benar. Jawaban benar lebih dari satu!`;
  const q4Payload = {
    type: "multiple_choice",
    options: [
      { id: "A", contentMarkdown: "{{img:psb7oNkx}}" },
      { id: "B", contentMarkdown: "{{img:ElrjzRL2}}" },
      { id: "C", contentMarkdown: "{{img:WQEAKP1c}}" },
      { id: "D", contentMarkdown: "{{img:StibwCXU}}" },
      { id: "E", contentMarkdown: "{{img:FMyFUMu6}}" },
    ],
    shuffleOptions: true,
  };
  await sql`
    UPDATE questions
    SET content_markdown = ${q4Stem},
        data_payload = ${sql.json(q4Payload)},
        updated_at = NOW()
    WHERE id = '01a1186e-0e92-72ab-a4c1-8b148e39acac'
  `;
  console.log("✓ Updated 01a1186e-0e92-72ab-a4c1-8b148e39acac");

  // Sync question_media for these questions
  const shortIds = [
    "HIE2Ldeh", "9370ehFc", "PSD1ik0h", "i1hzQOSM", "pkrzWsDh", "88gLt5UK",
    "WyB8Bpt6", "6lg0Cr7I", "d7mFihMb", "4xOsek6D", "ErkZx6QN",
    "pMqL8DcF", "AkmCsrdb", "tb8kQp0B",
    "sOJA20Ce", "psb7oNkx", "ElrjzRL2", "WQEAKP1c", "StibwCXU", "FMyFUMu6"
  ];
  const assets = await sql`SELECT id, short_id FROM media_assets WHERE short_id IN ${sql(shortIds)}`;
  const assetMap = new Map(assets.map(a => [a.short_id, a.id]));

  const links = [
    { qId: '01a1186e-09ac-7883-bc0b-4abd0813058e', sid: 'HIE2Ldeh' },
    { qId: '01a1186e-1652-7e42-9125-32e928eabcfa', sid: 'WyB8Bpt6' },
    { qId: '01a1186e-0e18-77fc-9a18-c271b1803a22', sid: 'pMqL8DcF' },
    { qId: '01a1186e-0e92-72ab-a4c1-8b148e39acac', sid: 'sOJA20Ce' },
  ];

  for (const l of links) {
    const mId = assetMap.get(l.sid);
    if (mId) {
      await sql`
        INSERT INTO question_media (question_id, media_id, role, order_index)
        VALUES (${l.qId}, ${mId}, 'content', 0)
        ON CONFLICT DO NOTHING
      `;
    }
  }

  console.log("\nSelesai!");
  await sql.end({ timeout: 1 });
  process.exit(0);
}

main().catch(async (e) => {
  console.error("GAGAL:", e);
  await sql.end();
  process.exit(1);
});
