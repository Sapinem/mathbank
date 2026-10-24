/**
 * MAT-35 R5 Batch 5 — Rubrik Penilaian Esai
 * 8 soal esai (persamaan kuadrat, FPB/KPK, aljabar dasar)
 * Format: answer_key.scoringRubric (JSONB canonical per MAT-144)
 */

import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { max: 2 });

const DRY_RUN = process.env.DRY_RUN !== "0";

const rubrics: Array<{ id: string; scoringRubric: string }> = [
  {
    id: "01a11581-1467-7cf6-8501-d159d2b9c9a1",
    scoringRubric: `**Rubrik Penilaian — Faktorisasi \\(x^2+5x+6=0\\)** (Total: 10 poin)\n\n| # | Langkah | Kriteria | Poin |\n|---|---------|----------|------|\n| 1 | Identifikasi koefisien | Menentukan perlu mencari dua bilangan berjumlah \\(b=5\\) dan berproduk \\(c=6\\) | 2 |\n| 2 | Temukan pasangan bilangan | Menemukan \\(2\\) dan \\(3\\) (karena \\(2+3=5\\), \\(2\\times3=6\\)) | 3 |\n| 3 | Faktorisasi | Menulis \\((x+2)(x+3)=0\\) dengan benar | 3 |\n| 4 | Kesimpulan akar | Menerapkan sifat hasil kali nol: \\(x=-2\\) atau \\(x=-3\\) | 2 |\n\n**Catatan:** Jika menggunakan rumus kuadrat \\(\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}\\) dengan benar, kredit penuh diberikan.`,
  },
  {
    id: "01a11581-149e-7e47-bbc3-a3a33f4a635a",
    scoringRubric: `**Rubrik Penilaian — Faktorisasi \\(x^2-x-12=0\\)** (Total: 10 poin)\n\n| # | Langkah | Kriteria | Poin |\n|---|---------|----------|------|\n| 1 | Identifikasi koefisien | Menentukan perlu mencari dua bilangan berjumlah \\(-1\\) dan berproduk \\(-12\\) | 2 |\n| 2 | Temukan pasangan bilangan | Menemukan \\(-4\\) dan \\(3\\) (perhatikan tanda negatif pada produk) | 3 |\n| 3 | Faktorisasi | Menulis \\((x-4)(x+3)=0\\) dengan benar | 3 |\n| 4 | Kesimpulan akar | Menerapkan sifat hasil kali nol: \\(x=4\\) atau \\(x=-3\\) | 2 |\n\n**Catatan:** Kesalahan tanda pada faktor (mis. \\((x+4)(x-3)\\)) mengurangi poin langkah 2–3.`,
  },
  {
    id: "01a11581-14d8-7ca4-a415-c13e22081092",
    scoringRubric: `**Rubrik Penilaian — Faktorisasi \\(2x^2+7x+3=0\\)** (Total: 10 poin)\n\n| # | Langkah | Kriteria | Poin |\n|---|---------|----------|------|\n| 1 | Strategi faktorisasi | Menentukan bahwa \\(2x^2+7x+3=(2x+1)(x+3)\\) dengan verifikasi perkalian silang | 4 |\n| 2 | Persamaan faktor 1 | Menyelesaikan \\(2x+1=0 \\Rightarrow x=-\\tfrac{1}{2}\\) | 3 |\n| 3 | Persamaan faktor 2 | Menyelesaikan \\(x+3=0 \\Rightarrow x=-3\\) | 2 |\n| 4 | Kesimpulan | Menyimpulkan akar-akarnya \\(-\\tfrac{1}{2}\\) dan \\(-3\\) | 1 |\n\n**Catatan:** Faktorisasi persamaan kuadrat \\(ax^2+bx+c\\) dengan \\(a\\neq1\\) memerlukan uji perkalian silang.`,
  },
  {
    id: "01a11582-6bdb-7156-83d2-4f2c5a17a131",
    scoringRubric: `**Rubrik Penilaian — Melengkapkan Kuadrat \\(x^2+6x=7\\)** (Total: 10 poin)\n\n| # | Langkah | Kriteria | Poin |\n|---|---------|----------|------|\n| 1 | Hitung bilangan pelengkap | Menghitung \\(\\left(\\tfrac{6}{2}\\right)^2=9\\) dengan benar | 3 |\n| 2 | Tambah ke kedua ruas | Menuliskan \\(x^2+6x+9=16\\), menyatakan \\((x+3)^2=16\\) | 3 |\n| 3 | Akar kedua ruas | Mengambil akar: \\(x+3=\\pm4\\), memperoleh \\(x=1\\) atau \\(x=-7\\) | 3 |\n| 4 | Kesimpulan | Menyimpulkan akar-akarnya \\(1\\) dan \\(-7\\) | 1 |\n\n**Catatan:** Kesalahan menambahkan \\(9\\) hanya ke satu ruas mengurangi poin langkah 2 sebesar 2 poin.`,
  },
  {
    id: "01a11582-6faf-7edc-b869-4a4887a9360a",
    scoringRubric: `**Rubrik Penilaian — FPB(252, 105) dengan Algoritma Euclid** (Total: 10 poin)\n\n| # | Langkah | Kriteria | Poin |\n|---|---------|----------|------|\n| 1 | Langkah 1 Euclid | Menghitung \\(252 = 105 \\cdot 2 + 42\\) dengan benar | 3 |\n| 2 | Langkah 2 Euclid | Menghitung \\(105 = 42 \\cdot 2 + 21\\) dengan benar | 3 |\n| 3 | Langkah 3 Euclid | Menghitung \\(42 = 21 \\cdot 2 + 0\\) (sisa nol) | 2 |\n| 4 | Kesimpulan | Menyimpulkan \\(\\operatorname{FPB}(252,105)=21\\) (sisa tak nol terakhir) | 2 |\n\n**Catatan:** Kesalahan perhitungan di langkah awal yang diselesaikan konsisten tetap mendapat kredit parsial langkah berikutnya.`,
  },
  {
    id: "01a11582-701d-7d04-a009-9fb23b384aa9",
    scoringRubric: `**Rubrik Penilaian — KPK(144, 60) via Euclid** (Total: 10 poin)\n\n| # | Langkah | Kriteria | Poin |\n|---|---------|----------|------|\n| 1 | Mencari FPB | Menjalankan Algoritma Euclid: \\(144=60\\cdot2+24\\), \\(60=24\\cdot2+12\\), \\(24=12\\cdot2+0\\) | 4 |\n| 2 | Nilai FPB | Menyimpulkan \\(\\operatorname{FPB}(144,60)=12\\) | 2 |\n| 3 | Rumus KPK | Menggunakan \\(\\operatorname{KPK}=\\tfrac{144\\times60}{12}=\\tfrac{8640}{12}\\) | 3 |\n| 4 | Kesimpulan | Menyimpulkan \\(\\operatorname{KPK}(144,60)=720\\) | 1 |\n\n**Catatan:** Penggunaan faktorisasi prima sebagai metode alternatif diterima penuh jika hasilnya benar.`,
  },
  {
    id: "01a11583-7d66-713b-8677-c5215d191e48",
    scoringRubric: `**Rubrik Penilaian — Sederhanakan \\(4x+7-2x+5\\)** (Total: 10 poin)\n\n| # | Langkah | Kriteria | Poin |\n|---|---------|----------|------|\n| 1 | Identifikasi suku sejenis | Mengelompokkan suku bervaribel (\\(4x\\) dan \\(-2x\\)) dan suku konstan (\\(7\\) dan \\(5\\)) | 3 |\n| 2 | Penyederhanaan suku variabel | Menghitung \\(4x-2x=2x\\) dengan benar | 4 |\n| 3 | Penyederhanaan suku konstan | Menghitung \\(7+5=12\\) dengan benar | 2 |\n| 4 | Hasil akhir | Menuliskan \\(2x+12\\) sebagai hasil simplifikasi | 1 |\n\n**Catatan:** Kesalahan tanda pada suku sejenis (mis. \\(4x-2x=6x\\)) mengurangi poin langkah 2.`,
  },
  {
    id: "01a11583-7dc6-74a8-b117-8d32ab0135b9",
    scoringRubric: `**Rubrik Penilaian — Perkalian \\((2x-3)(x+4)\\)** (Total: 10 poin)\n\n| # | Langkah | Kriteria | Poin |\n|---|---------|----------|------|\n| 1 | Distribusi perkalian | Menggunakan distribusi/FOIL: \\(2x(x+4)-3(x+4)\\) atau menyebut empat pasang perkalian | 3 |\n| 2 | Perkalian suku per suku | Menghasilkan \\(2x^2+8x-3x-12\\) dengan tanda benar pada semua suku | 5 |\n| 3 | Penyederhanaan | Menggabungkan suku sejenis: \\(2x^2+5x-12\\) | 2 |\n\n**Catatan:** Kesalahan tanda (mis. \\(-3\\times4=+12\\)) mengurangi poin langkah 2 sebesar 2 poin; kesalahan tersebut yang konsisten dibawa langkah 3 tidak mengurangi lagi.`,
  },
];

async function main() {
  if (DRY_RUN) {
    console.log("=== DRY RUN ===");
    rubrics.forEach((r) => {
      console.log(`  ${r.id}: ${r.scoringRubric.length} chars`);
    });
    console.log(`Total: ${rubrics.length} rubrik`);
    return;
  }

  console.log("=== LIVE RUN ===");
  let updated = 0;
  for (const { id, scoringRubric } of rubrics) {
    const rows = await sql`
      SELECT id, answer_key->>'scoringRubric' as sr
      FROM questions WHERE id = ${id}::uuid
    `;
    if (!rows.length) {
      console.log(`SKIP ${id}: not found`);
      continue;
    }
    const existing = (rows[0] as Record<string, unknown>).sr as string | null;
    if (existing && existing.trim().length > 50) {
      console.log(`SKIP ${id}: already has rubric`);
      continue;
    }
    await sql`
      UPDATE questions
      SET answer_key = jsonb_set(answer_key, '{scoringRubric}', ${sql.json(scoringRubric)}),
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
    console.log(`UPDATED ${id} (${scoringRubric.length} chars)`);
    updated++;
  }
  console.log(`\nTotal updated: ${updated}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
