/**
 * fix-cbt-scraper-garbage.ts
 *
 * Cleans up CBT crawler artifacts and fixes broken question stems/images:
 * 1. 01a12b73-6ee1-7b1d-953c-6daa33a8c4bb:
 *    - Replaces broken corpus://pusmendik_tka/Simulasi TKA-img-1.png with {{img:MXVr7t4i}}
 *    - Removes redundant single-column options table
 *    - Removes 130 lines of timeout dialog garbage + {{img:TWXYe9Gh}}
 *    - Links MXVr7t4i and unlinks TWXYe9Gh in question_media
 * 2. 01a1186d-b96b-7b3a-8d0c-5ccda862865f:
 *    - Replaces broken image with {{img:hXcAMWLw}}
 *    - Removes duplicate statement table and timeout dialog
 * 3. 01a1186e-31ae-7987-96bc-489cd542fc8d:
 *    - Restores missing context/stimulus text + {{img:i1LPIgPI}}
 *    - Removes duplicate table and timeout dialog
 * 4. 01a11576-2056-79e7-80a4-3440aa5a658e:
 *    - Cleans broken CBT header text
 * 5. 01a11571-1bb5-7958-a603-882b1c89ee99:
 *    - Cleans broken CBT header text
 *
 * Usage:
 *   pnpm tsx --env-file=.env scripts/fix-cbt-scraper-garbage.ts          # dry-run
 *   pnpm tsx --env-file=.env scripts/fix-cbt-scraper-garbage.ts --apply  # write to DB
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib");

const APPLY = process.argv.includes("--apply");
const sql = postgres(url, { max: 2 });

async function main() {
  console.log("=== Fix CBT Scraper Garbage ===");
  console.log(`Mode: ${APPLY ? "APPLY (writing to DB)" : "DRY-RUN (read only)"}\n`);

  // Asset IDs
  // MXVr7t4i: 01a11868-a8cf-7aaa-97e0-69cdf40bc8d3
  // hXcAMWLw: 01a17a4a-7b86-78a0-84e9-bda4b5752565
  // i1LPIgPI: 01a17a4a-983e-7ff8-a5aa-8b6823a2bb79
  // TWXYe9Gh: 01a1186d-af5e-7ee2-8542-dc070547938b
  const twxyAsset = await sql`SELECT id FROM media_assets WHERE short_id = 'TWXYe9Gh'`;
  const twxyId = twxyAsset[0]?.id;

  const mxvrAsset = await sql`SELECT id FROM media_assets WHERE short_id = 'MXVr7t4i'`;
  const mxvrId = mxvrAsset[0]?.id;

  const hxcAsset = await sql`SELECT id FROM media_assets WHERE short_id = 'hXcAMWLw'`;
  const hxcId = hxcAsset[0]?.id;

  const i1lpAsset = await sql`SELECT id FROM media_assets WHERE short_id = 'i1LPIgPI'`;
  const i1lpId = i1lpAsset[0]?.id;

  // 1. Question 01a12b73-6ee1-7b1d-953c-6daa33a8c4bb
  const q1Id = "01a12b73-6ee1-7b1d-953c-6daa33a8c4bb";
  const q1NewContent = `Seorang guru menyiapkan sejumlah kertas soal ujian yang digulung dan dimasukkan ke dalam sebuah kotak. Setiap kertas berisi kode soal A, B, atau C.

{{img:MXVr7t4i}}

Diketahui bahwa jumlah kertas berkode A lebih sedikit daripada kertas berkode B. Guru kemudian mengambil 3 kertas dengan kode yang sama dari dalam kotak. Setelah pengambilan, jumlah seluruh kertas yang tersisa di dalam kotak menjadi 28 lembar dan jumlah kertas berkode B lebih banyak daripada kertas berkode C. Jika kemudian diambil satu kertas secara acak dari kotak tersebut, diketahui bahwa peluang terambilnya kertas berkode C yaitu 2/7.

Berdasarkan informasi tersebut, berapakah kemungkinan jumlah kertas soal ujian kode B mula-mula?

Pilihlah semua jawaban benar! Jawaban benar lebih dari satu.`;

  console.log(`1. Target question ${q1Id}:`);
  console.log("   New content length:", q1NewContent.length, "(was ~1192 chars with 130 blank lines)");

  // 2. Question 01a1186d-b96b-7b3a-8d0c-5ccda862865f
  const q2Id = "01a1186d-b96b-7b3a-8d0c-5ccda862865f";
  const q2NewContent = `Menurut Kementerian Kesehatan RI, ibu hamil harus mengonsumsi lebih banyak makanan yang mengandung protein dan lemak. Hal ini disarankan agar memastikan jaringan dan organ bayi dapat tumbuh dengan baik. Ibu hamil perlu mengonsumsi 70 hingga 100 gram protein setiap hari, sedangkan lemak dapat dikonsumsi sebanyak 62 hingga 67 gram dalam sehari.
Suatu hari, seorang ibu hamil mencatat banyak lemak dan protein yang dikonsumsi sebagai berikut.

{{img:hXcAMWLw}}

Berdasarkan informasi tersebut, tentukanlah Benar atau Salah pernyataan berikut mengenai kebutuhan lemak dan protein seorang ibu hamil jika menambah konsumsi makanan!`;

  console.log(`2. Question ${q2Id}:`);
  console.log("   New content length:", q2NewContent.length);

  // 3. Question 01a1186e-31ae-7987-96bc-489cd542fc8d
  const q3Id = "01a1186e-31ae-7987-96bc-489cd542fc8d";
  const q3NewContent = `Sebuah sensor otomatis diuji untuk mendeteksi kendaraan yang melintas. Pengujian dilakukan dalam tiga tahap dengan hasil sebagai berikut:

{{img:i1LPIgPI}}

Data tersebut digunakan untuk memperkirakan peluang kegagalan sensor pada satu kali deteksi berikutnya.

Berdasarkan hasil pengujian sensor pada tabel, manakah pernyataan yang benar tentang pengujian sensor tersebut?
Pilih semua jawaban benar! Jawaban benar lebih dari satu.`;

  console.log(`3. Question ${q3Id}:`);
  console.log("   New content length:", q3NewContent.length);

  // 4 & 5. Broken CBT headers
  const q4Id = "01a11576-2056-79e7-80a4-3440aa5a658e";
  const q4NewContent = "Tentukan Benar atau Salah untuk setiap pernyataan berikut!";

  const q5Id = "01a11571-1bb5-7958-a603-882b1c89ee99";
  const q5NewContent = "Tentukan Benar atau Salah untuk setiap pernyataan berikut!";

  console.log(`4. Question ${q4Id}: cleaned header`);
  console.log(`5. Question ${q5Id}: cleaned header`);

  if (!APPLY) {
    console.log("\n(dry-run) Tidak ada data yang diubah. Jalankan dengan --apply untuk menulis ke DB.");
    await sql.end();
    return;
  }

  // Update questions
  await sql`UPDATE questions SET content_markdown = ${q1NewContent}, updated_at = NOW() WHERE id = ${q1Id}`;
  await sql`UPDATE questions SET content_markdown = ${q2NewContent}, updated_at = NOW() WHERE id = ${q2Id}`;
  await sql`UPDATE questions SET content_markdown = ${q3NewContent}, updated_at = NOW() WHERE id = ${q3Id}`;
  await sql`UPDATE questions SET content_markdown = ${q4NewContent}, updated_at = NOW() WHERE id = ${q4Id}`;
  await sql`UPDATE questions SET content_markdown = ${q5NewContent}, updated_at = NOW() WHERE id = ${q5Id}`;

  // Update question_media for q1, q2, q3
  if (twxyId) {
    await sql`DELETE FROM question_media WHERE question_id IN (${q1Id}, ${q2Id}, ${q3Id}) AND media_id = ${twxyId}`;
    console.log("   ✓ Unlinked TWXYe9Gh timeout asset from q1, q2, q3");
  }

  if (mxvrId) {
    await sql`
      INSERT INTO question_media (question_id, media_id, role, order_index)
      VALUES (${q1Id}, ${mxvrId}, 'content', 0)
      ON CONFLICT DO NOTHING
    `;
    console.log("   ✓ Linked MXVr7t4i to q1");
  }

  if (hxcId) {
    await sql`
      INSERT INTO question_media (question_id, media_id, role, order_index)
      VALUES (${q2Id}, ${hxcId}, 'content', 0)
      ON CONFLICT DO NOTHING
    `;
    console.log("   ✓ Linked hXcAMWLw to q2");
  }

  if (i1lpId) {
    await sql`
      INSERT INTO question_media (question_id, media_id, role, order_index)
      VALUES (${q3Id}, ${i1lpId}, 'content', 0)
      ON CONFLICT DO NOTHING
    `;
    console.log("   ✓ Linked i1LPIgPI to q3");
  }

  console.log("\n✓ Semua 5 soal berhasil dibersihkan dan diperbarui di database!");
  await sql.end();
}

main().catch(async (e) => {
  console.error("GAGAL:", e);
  await sql.end();
  process.exit(1);
});
