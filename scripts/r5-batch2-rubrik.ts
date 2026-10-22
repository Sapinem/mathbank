/**
 * R5 Batch 2: Rubrik penilaian esai — 5 soal
 * MAT-35 — Pedagogy enrichment, target JSONB answer_key.scoringRubric
 *
 * Soal:
 *  1. 01a1155f-57db — Matriks ordo ABCD (p,q,r,s,t,u)
 *  2. 01a1155f-e97b — Invers komposisi f∘g fungsi
 *  3. 01a11562-6ca2 — Ogive dari histogram (statistika)
 *  4. 01a11564-6134 — Pemetaan/fungsi identifikasi
 *  5. 01a11564-f959 — Optimasi pagar dua kandang
 *
 * Standar: rubrik per langkah, total 10 poin, mengikuti SKILL_PEDAGOGY.md §4.
 * Target field: answer_key.scoringRubric (JSONB string)
 *
 * Jalankan (dry):  DRY_RUN=1 pnpm exec tsx scripts/r5-batch2-rubrik.ts
 * Jalankan (live): DRY_RUN=0 pnpm exec tsx scripts/r5-batch2-rubrik.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN !== "0";
const sql = postgres(DB_URL, { max: 1, connect_timeout: 30, idle_timeout: 30 });

interface EssayRubric {
  questionId: string;
  note: string;
  scoringRubric: string;
}

const rubrics: EssayRubric[] = [
  {
    questionId: "01a1155f-57db-777c-be30-d0b029676f07",
    note: "Matriks ordo: (2A+B)×4C=5D, tentukan p,q,r,s,t,u",
    scoringRubric: [
      "Rubrik Penilaian — Ordo Matriks (2A+B)×4C=5D (Total 10 poin)",
      "",
      "Langkah 1 — Syarat kompatibilitas A+B (2 poin):",
      "  Untuk \\(2A_{p\\times 3}+B_{2\\times q}\\) terdefinisi, maka ordo harus sama: \\(p=2\\) dan \\(q=3\\).",
      "  Nilai penuh jika menyebutkan kedua syarat. Parsial (1 poin) jika hanya salah satu.",
      "",
      "Langkah 2 — Syarat perkalian (A+B)×4C (3 poin):",
      "  \\(A+B\\) berordo \\(2\\times 3\\); agar \\((A+B)\\times C_{r\\times s}\\) valid, kolom kiri = baris kanan: \\(r=3\\).",
      "  Nilai penuh jika menyebutkan \\(r=3\\) dengan alasan kolom = baris. Parsial (1 poin) jika \\(r=3\\) tanpa alasan.",
      "",
      "Langkah 3 — Ordo hasil dan syarat D (3 poin):",
      "  Hasil \\((A+B)\\times C\\) berordo \\(2\\times s\\); agar sama dengan \\(D_{t\\times u}\\): \\(t=2\\) (baris) dan \\(s=u\\) (kolom bebas).",
      "  Nilai penuh jika menyimpulkan \\(t=2\\) dan \\(s=u\\). Parsial (1 poin) jika hanya \\(t=2\\).",
      "",
      "Langkah 4 — Kesimpulan pernyataan yang benar (2 poin):",
      "  Menyatakan pernyataan 4 (\\(p=2,q=3\\)) dan 5 (\\(r=3\\)) benar, atau menyebutkan nilai secara eksplisit.",
      "  Nilai penuh jika ≥2 pernyataan benar teridentifikasi. Parsial (1 poin) jika hanya 1.",
    ].join("\n"),
  },
  {
    questionId: "01a1155f-e97b-7744-ad22-2d38de12fdaf",
    note: "Invers fungsi komposisi: f(x)=g(4+2x) → f^{-1}(x)",
    scoringRubric: [
      "Rubrik Penilaian — Invers Komposisi f(x)=g(4+2x) (Total 10 poin)",
      "",
      "Langkah 1 — Pemisalan awal (2 poin):",
      "  Memisalkan \\(f(x)=g(4+2x)=y\\) sehingga \\(f(x)=y\\) dan \\(g(4+2x)=y\\) secara eksplisit.",
      "  Nilai penuh jika kedua relasi ditulis. Parsial (1 poin) jika hanya salah satu.",
      "",
      "Langkah 2 — Menerapkan \\(g^{-1}\\) kedua sisi (4 poin):",
      "  \\(g^{-1}(y)=4+2x \\Rightarrow 2x=g^{-1}(y)-4 \\Rightarrow x=\\dfrac{1}{2}(g^{-1}(y)-4)\\).",
      "  Nilai penuh (4) jika isolasi \\(x\\) benar dengan langkah lengkap.",
      "  Parsial (2 poin) jika \\(g^{-1}(y)=4+2x\\) benar tapi isolasi \\(x\\) salah.",
      "  Parsial (1 poin) jika hanya menerapkan \\(g^{-1}\\) tanpa mengisolasi \\(x\\).",
      "",
      "Langkah 3 — Hubungkan ke \\(f^{-1}\\) (2 poin):",
      "  Karena \\(f(x)=y\\), maka \\(x=f^{-1}(y)\\); substitusi: \\(f^{-1}(y)=\\dfrac{1}{2}(g^{-1}(y)-4)\\).",
      "  Nilai penuh jika relasi \\(x=f^{-1}(y)\\) digunakan. Parsial (1 poin) jika hasil benar tapi notasi tidak dihubungkan.",
      "",
      "Langkah 4 — Ganti variabel ke \\(x\\) (2 poin):",
      "  \\(f^{-1}(x)=\\dfrac{1}{2}g^{-1}(x)-2\\). Nilai penuh jika \\(y\\) diganti \\(x\\) dan bentuk sederhana.",
    ].join("\n"),
  },
  {
    questionId: "01a11562-6ca2-7622-b342-435eee4b5762",
    note: "Ogive dari histogram (statistika deskriptif)",
    scoringRubric: [
      "Rubrik Penilaian — Ogive dari Histogram (Total 10 poin)",
      "",
      "Langkah 1 — Membuat tabel distribusi frekuensi kumulatif (3 poin):",
      "  Menentukan batas kelas (bawah/atas) dan menghitung frekuensi kumulatif naik (\\(\\leq\\)) DAN turun (\\(\\geq\\)).",
      "  Nilai penuh (3) jika tabel lengkap dengan semua interval dan kedua kolom kumulatif benar.",
      "  Parsial (2 poin) jika hanya satu arah kumulatif (naik atau turun saja).",
      "  Parsial (1 poin) jika tabel frekuensi ada tapi batas kelas salah atau kumulatif tidak dihitung.",
      "",
      "Langkah 2 — Menentukan titik koordinat ogive (3 poin):",
      "  Ogive naik: titik \\((\\text{batas atas kelas},\\ F_k^{\\leq})\\); ogive turun: \\((\\text{batas bawah kelas},\\ F_k^{\\geq})\\).",
      "  Nilai penuh (3) jika ≥4 pasang koordinat benar untuk masing-masing ogive.",
      "  Parsial (2 poin) jika ≥2 pasang koordinat benar. Parsial (1) jika konsep titik koordinat benar tapi nilai salah.",
      "",
      "Langkah 3 — Menggambar kurva ogive (4 poin):",
      "  Ogive naik berbentuk S-curve monoton naik mulai dari \\((\\text{batas bawah kelas pertama}, 0)\\).",
      "  Ogive turun berbentuk S-curve monoton turun mulai dari \\((\\text{batas bawah kelas pertama}, n)\\).",
      "  Nilai penuh (4) jika kedua ogive digambar dengan bentuk dan skala yang proporsional.",
      "  Parsial (2 poin) jika hanya satu ogive benar atau bentuk kurva tidak proporsional.",
    ].join("\n"),
  },
  {
    questionId: "01a11564-6134-7e66-881b-31c21e63475a",
    note: "Identifikasi pemetaan/fungsi yang valid dari tabel",
    scoringRubric: [
      "Rubrik Penilaian — Identifikasi Pemetaan yang Tepat (Total 10 poin)",
      "",
      "Langkah 1 — Menyebutkan definisi fungsi (2 poin):",
      "  Fungsi/pemetaan: setiap anggota domain memiliki tepat satu pasangan di kodomain.",
      "  Nilai penuh (2) jika definisi dinyatakan dengan jelas (setiap domain → tepat satu). Parsial (1) jika definisi tidak lengkap.",
      "",
      "Langkah 2 — Memeriksa setiap pemetaan (5 poin):",
      "  Untuk setiap tabel/diagram, verifikasi apakah ada anggota domain yang tidak terpetakan atau terpetakan ke lebih dari satu nilai.",
      "  Nilai penuh (5) jika memeriksa semua pilihan dan menyimpulkan benar-salah masing-masing.",
      "  Parsial (3 poin) jika memeriksa ≥3 pilihan dengan alasan. Parsial (1 poin) jika hanya menyebutkan jawaban tanpa verifikasi.",
      "",
      "Langkah 3 — Menyimpulkan pemetaan yang tepat (3 poin):",
      "  Memilih pemetaan yang memenuhi definisi fungsi dan memberikan alasan penolakan untuk yang tidak memenuhi.",
      "  Nilai penuh (3) jika pilihan benar disertai alasan penolakan minimal 1 pilihan yang salah.",
      "  Parsial (2 poin) jika pilihan benar tanpa alasan penolakan. Parsial (1) jika hanya menyebutkan jawaban akhir.",
    ].join("\n"),
  },
  {
    questionId: "01a11564-f959-7d03-a14e-11da54731a2b",
    note: "Optimasi panjang pagar minimum dua kandang 12 m²",
    scoringRubric: [
      "Rubrik Penilaian — Optimasi Pagar Dua Kandang (Total 10 poin)",
      "",
      "Langkah 1 — Menentukan variabel dan kendala luas (2 poin):",
      "  \\(L=xy=12\\) sehingga \\(y=\\dfrac{12}{x}\\). Nilai penuh jika hubungan \\(xy=12\\) dituliskan secara eksplisit.",
      "",
      "Langkah 2 — Menyusun fungsi total panjang pagar (3 poin):",
      "  Dua kandang berdampingan: pagar terdiri dari 3 sisi panjang \\(x\\) dan 2 sisi lebar \\(y\\) (ditambah pembatas tengah).",
      "  \\(P=3x+2y=3x+\\dfrac{24}{x}\\).",
      "  Nilai penuh (3) jika fungsi \\(P(x)\\) tepat. Parsial (2 poin) jika ekspresi salah satu suku. Parsial (1 poin) jika ide penjumlahan sisi benar tapi rumus tidak selesai.",
      "",
      "Langkah 3 — Turunkan dan selesaikan \\(P'(x)=0\\) (3 poin):",
      "  \\(P'(x)=3-\\dfrac{24}{x^2}=0\\Rightarrow x^2=8\\Rightarrow x=2\\sqrt{2}\\).",
      "  Nilai penuh (3) jika derivasi dan penyelesaian benar. Parsial (2 poin) jika derivasi benar tapi salah menyelesaikan. Parsial (1 poin) jika konsep turunan digunakan tapi salah hasil.",
      "",
      "Langkah 4 — Hitung \\(P_{\\min}\\) dan konfirmasi minimum (2 poin):",
      "  \\(x=2\\sqrt{2}\\Rightarrow y=\\dfrac{12}{2\\sqrt{2}}=3\\sqrt{2}\\); \\(P_{\\min}=3(2\\sqrt{2})+2(3\\sqrt{2})=12\\sqrt{2}\\).",
      "  Konfirmasi \\(P''(x)>0\\) atau uji nilai sekitar untuk membuktikan minimum.",
      "  Nilai penuh (2) jika \\(P_{\\min}=12\\sqrt{2}\\) disertai konfirmasi. Parsial (1) jika nilai benar tanpa konfirmasi.",
    ].join("\n"),
  },
];

async function updateRubric(r: EssayRubric): Promise<boolean> {
  const [row] = await sql`
    SELECT id FROM questions
    WHERE id = ${r.questionId}
    AND deleted_at IS NULL
    AND (answer_key->>'scoringRubric' IS NULL OR length(answer_key->>'scoringRubric') < 10)
  `;
  if (!row) {
    console.warn(`  SKIP — not found or already has rubric: ${r.questionId}`);
    return false;
  }

  if (DRY_RUN) {
    console.log(`  [DRY] Would write rubric for ${r.questionId} (${r.note})`);
    console.log(`    Length: ${r.scoringRubric.length} chars`);
    console.log(`    Preview: ${r.scoringRubric.substring(0, 100)}...`);
    return true;
  }

  await sql`
    UPDATE questions
    SET answer_key = jsonb_set(answer_key, '{scoringRubric}', ${sql.json(r.scoringRubric)})
    WHERE id = ${r.questionId} AND deleted_at IS NULL
  `;
  console.log(`  LIVE wrote rubric for ${r.questionId} (${r.note})`);
  return true;
}

async function main() {
  console.log(`\nMAT-35 R5 Batch 2 — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Essays: ${rubrics.length}`);

  let written = 0;
  for (const r of rubrics) {
    console.log(`\nProcessing: ${r.questionId}`);
    const ok = await updateRubric(r);
    if (ok) written++;
  }

  // Verify count
  const [stats] = await sql`
    SELECT
      COUNT(*) FILTER (
        WHERE answer_key->>'scoringRubric' IS NOT NULL
        AND length(answer_key->>'scoringRubric') > 10
      ) AS essays_with_rubric,
      COUNT(*) AS total_essays
    FROM questions
    WHERE question_type = 'essay' AND deleted_at IS NULL
  `;

  console.log(`\n── Summary ──`);
  console.log(`  Written: ${written}/${rubrics.length}`);
  console.log(`\n── DB State (all essays) ──`);
  console.log(`  Essays with scoringRubric: ${(stats as any).essays_with_rubric} / ${(stats as any).total_essays}`);

  await sql.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
