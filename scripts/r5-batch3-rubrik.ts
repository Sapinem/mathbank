/**
 * MAT-35 R5 Batch 3 — Rubrik Penilaian Esai
 * 5 soal esai: 2 IMSO + 3 soal pembuktian/analitik tingkat tinggi (SMA/olimpiade)
 * Setiap rubrik mencakup: langkah kunci, poin per langkah, total poin.
 * Format KaTeX: \( ... \) inline, \[ ... \] display.
 */

import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });

const DRY_RUN = process.env.DRY_RUN !== "0";

/**
 * Rubrik penilaian per soal. Format:
 * - Total poin: jumlah poin seluruh langkah
 * - Tiap langkah: deskripsi + poin
 */
interface EssayRubric {
  questionId: string;
  totalPoints: number;
  scoringRubric: string;
}

const RUBRICS: EssayRubric[] = [
  // ───────────────────────────────────────────────────────────────────
  // Essay 1: Grafik fungsi linear f(x) = 2x + 2 (SMP Grade 9, apply)
  // ───────────────────────────────────────────────────────────────────
  {
    questionId: "01a11567-4556-70c7-8e48-248857c93c88",
    totalPoints: 10,
    scoringRubric: `## Rubrik Penilaian — Grafik Fungsi Linear \\(f(x) = 2x + 2\\)

**Total Skor: 10 poin**

| Langkah | Deskripsi | Poin |
|:-------:|-----------|:----:|
| **L1** | Substitusi minimal 2 nilai \\(x\\) yang tepat ke dalam \\(f(x)=2x+2\\) dan mendapat pasangan titik \\((x, f(x))\\) yang benar | 3 |
| **L2** | Tabel nilai (minimal 2–3 titik) lengkap dan benar, misal: \\((-1,0),\\ (0,2),\\ (1,4)\\) | 3 |
| **L3** | Menggambarkan grafik garis lurus melalui titik-titik yang tepat, dengan kemiringan \\(m=2\\) dan titik potong sumbu-\\(y\\) di \\((0,2)\\) | 4 |

**Catatan pengurang:**
- Kesalahan aritmetika pada satu titik: −1 poin
- Grafik tidak melewati titik potong sumbu yang tepat: −2 poin
- Tidak ada tabel/substitusi sama sekali: maks 3 poin (hanya jika grafik benar)`,
  },

  // ───────────────────────────────────────────────────────────────────
  // Essay 2: IMSO — Kubus net, maksimum A×(B²+C) dengan syarat pasangan muka=7
  // ───────────────────────────────────────────────────────────────────
  {
    questionId: "01a1163a-a912-7509-8be8-d8519fe8fb99",
    totalPoints: 10,
    scoringRubric: `## Rubrik Penilaian — Kubus Jaring-Jaring: Maksimum \\(A \\times (B^2 + C)\\)

**Total Skor: 10 poin**

| Langkah | Deskripsi | Poin |
|:-------:|-----------|:----:|
| **L1** | Menyatakan tiga pasang muka berhadapan yang berjumlah 7: \\(\\{1,6\\},\\{2,5\\},\\{3,4\\}\\) | 2 |
| **L2** | Mengidentifikasi strategi: memaksimalkan \\(B\\) terlebih dahulu (karena dikuadratkan) \\(\\Rightarrow B=6\\) | 2 |
| **L3** | Menentukan \\(A\\) dan \\(C\\) dari pasangan sisa; \\(B=6\\) berarti pasangannya \\(1\\) (bukan dipilih untuk \\(A\\) atau \\(C\\) dari pasangan \\(\\{1,6\\}\\)); mencoba kombinasi \\(A\\in\\{5,4\\},C\\in\\{3,2\\}\\) atau sebaliknya | 3 |
| **L4** | Menghitung dan membandingkan nilai \\(A\\times(B^2+C)\\) untuk semua kombinasi valid, mendapatkan nilai maksimum \\(5\\times(36+2)=190\\) atau \\(4\\times(36+3)=156\\), menyimpulkan **190** | 3 |

**Catatan:**
- Jawaban benar (190) tanpa langkah sistematis: maks 5 poin
- Kesalahan pada identifikasi pasangan muka tetapi langkah selanjutnya konsisten: −1 poin per langkah`,
  },

  // ───────────────────────────────────────────────────────────────────
  // Essay 3: IMSO — Rata-rata 20 bilangan setelah penambahan berurutan
  // ───────────────────────────────────────────────────────────────────
  {
    questionId: "01a1163a-a957-7307-ab95-a4479d1cc2bd",
    totalPoints: 10,
    scoringRubric: `## Rubrik Penilaian — Rata-Rata Baru Setelah Penambahan Berurutan

**Total Skor: 10 poin**

| Langkah | Deskripsi | Poin |
|:-------:|-----------|:----:|
| **L1** | Menghitung jumlah awal: \\(20 \\times 18 = 360\\) | 2 |
| **L2** | Mengidentifikasi total penambahan sebagai deret aritmetika: \\(2+4+6+\\cdots+40\\) | 2 |
| **L3** | Menghitung jumlah deret: \\(S = \\dfrac{20}{2}(2+40) = 10 \\times 42 = 420\\) | 3 |
| **L4** | Menghitung jumlah baru \\(360+420=780\\) dan rata-rata baru \\(\\dfrac{780}{20} = 39\\) | 3 |

**Catatan:**
- Menggunakan rumus \\(S_n = \\frac{n}{2}(a+l)\\) dengan benar: poin penuh L3
- Hanya menjumlahkan deret manual tanpa rumus: beri L3 = 2 poin jika hasil benar
- Kesalahan aritmetika tapi metode benar: −1 poin`,
  },

  // ───────────────────────────────────────────────────────────────────
  // Essay 4: Induksi matematika — n³−n habis dibagi 6
  // ───────────────────────────────────────────────────────────────────
  {
    questionId: "01a11641-2a66-73c3-91d7-393fc3919e69",
    totalPoints: 15,
    scoringRubric: `## Rubrik Penilaian — Induksi Matematika: \\(n^3 - n\\) Habis Dibagi 6

**Total Skor: 15 poin**

| Langkah | Deskripsi | Poin |
|:-------:|-----------|:----:|
| **L1 — Basis** | Verifikasi \\(P(1)\\): \\(1^3-1=0\\), habis dibagi 6. Pernyataan valid. | 3 |
| **L2 — Hipotesis** | Mengasumsikan \\(P(k)\\) benar: \\(k^3-k = 6m\\) untuk suatu bilangan bulat \\(m\\) | 3 |
| **L3 — Langkah Induktif** | Menghitung \\((k+1)^3-(k+1)\\) dan mengekspansi: \\(= k^3+3k^2+3k+1-k-1 = (k^3-k)+3k^2+3k = (k^3-k)+3k(k+1)\\) | 4 |
| **L4 — Kesimpulan** | Menyatakan \\(k^3-k\\) habis dibagi 6 (hipotesis induksi) dan \\(3k(k+1)\\) habis dibagi 6 karena \\(k(k+1)\\) adalah hasil kali dua bilangan berurutan (salah satunya genap). Menyimpulkan \\(P(k+1)\\) benar. | 5 |

**Catatan:**
- Alternatif pembuktian langsung (misal: \\(n^3-n = n(n-1)(n+1)\\), tiga bilangan berurutan ⇒ habis dibagi 6): poin penuh jika argumentasi lengkap
- Basis benar tanpa langkah induktif: maks 5 poin
- Langkah induktif tanpa kesimpulan eksplisit mengapa habis dibagi 6: −2 poin di L4`,
  },

  // ───────────────────────────────────────────────────────────────────
  // Essay 5: Fibonacci — pembuktian Σfₖ = f_{n+2} − 1
  // ───────────────────────────────────────────────────────────────────
  {
    questionId: "01a1163b-3b07-7008-bdd3-1116499874dc",
    totalPoints: 15,
    scoringRubric: `## Rubrik Penilaian — Pembuktian Fibonacci: \\(\\displaystyle\\sum_{k=1}^n f_k = f_{n+2}-1\\)

**Total Skor: 15 poin**

| Langkah | Deskripsi | Poin |
|:-------:|-----------|:----:|
| **L1 — Identitas kunci** | Menyatakan identitas \\(f_k = f_{k+2} - f_{k+1}\\) (turunan dari definisi Fibonacci) yang akan digunakan dalam penjumlahan teleskopik | 4 |
| **L2 — Substitusi** | Mensubstitusikan identitas ke dalam jumlah: \\(\\displaystyle\\sum_{k=1}^n f_k = \\sum_{k=1}^n (f_{k+2}-f_{k+1})\\) | 3 |
| **L3 — Teleskopik** | Mengevaluasi jumlah teleskopik: suku-suku yang berdekatan saling menghilangkan, tersisa \\(f_{n+2} - f_2 = f_{n+2} - 1\\) | 5 |
| **L4 — Verifikasi basis** | Memverifikasi untuk \\(n=1\\): \\(f_1 = 1\\) dan \\(f_3 - 1 = 2-1=1\\) ✓ | 3 |

**Alternatif (Induksi Matematika):**
- L1=3: basis \\(n=1\\) benar
- L2=3: hipotesis \\(\\sum_{k=1}^n f_k = f_{n+2}-1\\)
- L3=5: langkah induktif \\(\\sum_{k=1}^{n+1} = (f_{n+2}-1)+f_{n+1} = f_{n+3}-1\\)
- L4=4: kesimpulan

**Catatan:**
- Pendekatan berbeda tapi logis: poin full jika argumen valid dan lengkap`,
  },
];

async function main() {
  let totalUpdated = 0;

  for (const rubric of RUBRICS) {
    const [row] = await sql<
      { id: string; answer_key: any }[]
    >`SELECT id, answer_key FROM questions WHERE id = ${rubric.questionId} AND question_type = 'essay'`;

    if (!row) {
      console.error(`Essay ${rubric.questionId} not found`);
      continue;
    }

    if (rubric.scoringRubric.length < 100) {
      throw new Error(
        `Rubric too short (${rubric.scoringRubric.length} chars) for ${rubric.questionId}`
      );
    }

    const currentAnswerKey = row.answer_key ?? {};
    const updatedAnswerKey = {
      ...currentAnswerKey,
      scoringRubric: rubric.scoringRubric,
      totalPoints: rubric.totalPoints,
    };

    if (DRY_RUN) {
      console.log(`[DRY] Would update essay ${rubric.questionId}`);
      console.log(`  totalPoints: ${rubric.totalPoints}`);
      console.log(`  rubric length: ${rubric.scoringRubric.length} chars`);
      console.log(`  rubric preview: ${rubric.scoringRubric.substring(0, 100)}...`);
    } else {
      await sql`
        UPDATE questions
        SET answer_key = ${sql.json(updatedAnswerKey)}
        WHERE id = ${rubric.questionId}
      `;
      console.log(
        `✓ Updated essay ${rubric.questionId} (${rubric.totalPoints} pts, ${rubric.scoringRubric.length} chars)`
      );
      totalUpdated++;
    }
  }

  console.log(
    `\n${DRY_RUN ? "[DRY RUN]" : "LIVE"} — Essays updated: ${totalUpdated}/${RUBRICS.length}`
  );
  await sql.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
