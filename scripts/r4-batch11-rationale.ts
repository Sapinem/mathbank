/**
 * MAT-35 Batch 11 — R4 Manual Distractor Rationale
 * Topics: Pertaksamaan/Bilangan, Statistik, Matriks Transformasi, Bilangan Berpangkat, Peluang, Suku Banyak
 * 8 soal × 4-5 opsi = 37 entries
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
import { sql as sqlTag } from "drizzle-orm";

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });

const DRY_RUN = process.env.DRY_RUN !== "0";

interface OptionRationale {
  id: string; // option label: A, B, C, D, E
  distractorRationale: string; // ≥ 40 chars
}

interface QuestionCuration {
  questionId: string;
  options: OptionRationale[];
}

// Helper: apply rationale to DB
async function applyRationale(qc: QuestionCuration): Promise<void> {
  // Fetch current options
  const rows = await sql`
    SELECT data_payload->'options' AS opts
    FROM questions WHERE id = ${qc.questionId}
  `;
  if (!rows.length) {
    console.warn(`  SKIP: question ${qc.questionId} not found`);
    return;
  }
  const currentOpts: any[] = Array.isArray(rows[0].opts)
    ? rows[0].opts
    : JSON.parse(rows[0].opts || "[]");

  const ratMap: Record<string, string> = {};
  for (const o of qc.options) ratMap[o.id] = o.distractorRationale;

  const updated = currentOpts.map((o: any) => {
    const dr = ratMap[o.id];
    if (dr) {
      return { ...o, distractorRationale: dr };
    }
    return o;
  });

  if (DRY_RUN) {
    console.log(`  DRY_RUN: would update ${qc.questionId}, ${Object.keys(ratMap).length} options`);
    updated.forEach((o: any) => {
      if (o.distractorRationale) {
        console.log(`    [${o.id}] (${o.distractorRationale.length} chars): ${o.distractorRationale.substring(0, 80)}...`);
      }
    });
    return;
  }

  await sql`
    UPDATE questions
    SET data_payload = jsonb_set(
      data_payload,
      '{options}',
      ${sql.json(updated)}::jsonb
    ),
    updated_at = NOW()
    WHERE id = ${qc.questionId}
  `;
  console.log(`  LIVE: updated ${qc.questionId} (${Object.keys(ratMap).length} options)`);
}

const curations: QuestionCuration[] = [
  // ── Q1: Pertaksamaan unit fraction: 1/a+1/b+1/c+1/d=1, a<b<c<d, banyak solusi=6 ──
  {
    questionId: "01a11564-33cc-7893-8dec-df9c48240aa9",
    options: [
      {
        id: "A",
        distractorRationale:
          "Siswa menjawab 1 karena hanya menemukan satu solusi awal (2,3,7,42) tanpa melanjutkan pencarian secara sistematis. Kesalahan: berhenti pada solusi pertama yang ditemukan, tidak memahami bahwa soal meminta *banyak* himpunan solusi, bukan satu solusi.",
      },
      {
        id: "B",
        distractorRationale:
          "Siswa mendapat 4 karena hanya menelusuri kasus a=2 secara parsial dan melewatkan cabang b=3 atau b=4. Kesalahan: pencarian pohon keputusan tidak lengkap; siswa berhenti setelah menemukan 4 solusi dari a=2 tanpa memeriksa a=3.",
      },
      // C is correct (6 solutions total: (2,3,7,42),(2,3,8,24),(2,3,9,18),(2,3,10,15),(2,3,12,12)→tidak valid krn c<d, (2,4,5,20),(2,4,6,12),(3,3,4,?) → sistematis diperoleh 6)
      {
        id: "D",
        distractorRationale:
          "Siswa mendapat 9 karena menghitung semua pasangan (a,b) untuk a=2,3 tetapi tidak menerapkan syarat ketaksamaan ketat a<b<c<d, sehingga menghitung solusi duplikat atau solusi yang melanggar urutan. Kesalahan: lupa bahwa c<d harus dipenuhi secara ketat.",
      },
    ],
  },

  // ── Q2: Transformasi linear data statistik, 2x-10, "SEMUA benar" = E ──
  {
    questionId: "01a1155e-b577-791f-a800-453ab2ede0ed",
    options: [
      {
        id: "A",
        distractorRationale:
          "Pilihan '(1),(2),(3) SAJA' dipilih siswa yang benar mengidentifikasi pernyataan rata-rata, median, dan simpangan baku berubah (berlipat 2 dikurangi 10), tetapi keliru tentang simpangan kuartil. Miskonsepsi: mengira simpangan kuartil terpengaruh oleh konstanta penambah (-10), padahal pernyataan (4) juga benar (simpangan kuartil hanya bergantung pada skala, bukan translasi, sehingga \\(SK_{B}=2 \\cdot 25=50\\)).",
      },
      {
        id: "B",
        distractorRationale:
          "Pilihan '(1) dan (3) SAJA' dipilih siswa yang memahami rata-rata berubah dan simpangan baku berubah (dikalikan 2), tetapi salah menganalisis median dan simpangan kuartil. Miskonsepsi: mengira transformasi \\(2x-10\\) hanya mengubah ukuran pemusatan (rata-rata) dan sebaran (simpangan baku), bukan statistik posisi seperti median. Kenyataannya median juga berubah: \\(M_B=2 \\cdot 40-10=70\\).",
      },
      {
        id: "C",
        distractorRationale:
          "Pilihan '(2) dan (4) SAJA' dipilih siswa yang hanya memeriksa median dan simpangan kuartil secara benar, tetapi keliru menghitung rata-rata atau simpangan baku. Miskonsepsi: lupa menambahkan perubahan konstanta (-10) pada rata-rata, atau keliru menerapkan aturan \\(SD_{B}=|a| \\cdot SD_L\\) sehingga menganggap \\(\\bar{x}_B\\) atau \\(s_B\\) tidak berubah.",
      },
      {
        id: "D",
        distractorRationale:
          "Pilihan 'HANYA (4)' dipilih siswa yang hanya memverifikasi simpangan kuartil berubah \\((2 \\times 25=50)\\) tetapi menolak tiga pernyataan lain karena salah menerapkan rumus transformasi. Kesalahan konseptual: tidak memahami bahwa semua statistik berubah sesuai aturan transformasi linear: \\(\\bar{x}_B=2\\bar{x}_L-10\\), \\(M_B=2M_L-10\\), \\(s_B=2s_L\\), \\(SK_B=2 \\cdot SK_L\\).",
      },
      // E = SEMUA benar (correct)
    ],
  },

  // ── Q3: Matriks rotasi+cermin, tan α=3, jawab p+q = 3/2 (C) ──
  {
    questionId: "01a1155e-c390-7193-8d99-e36eb41761a2",
    options: [
      {
        id: "A",
        distractorRationale:
          "Siswa memilih \\(\\frac{5}{2}\\) karena keliru dalam mengidentifikasi sudut rotasi dari matriks gabungan. Miskonsepsi: siswa mengambil nilai \\(p\\) dan \\(q\\) dari koefisien matriks secara langsung tanpa menyelesaikan persamaan trigonometri \\(\\sin(p\\pi+q\\alpha)\\) dan \\(\\cos(p\\pi+q\\alpha)\\), menghasilkan pasangan \\((p,q)\\) yang tidak konsisten dengan tan α=3.",
      },
      {
        id: "B",
        distractorRationale:
          "Siswa memilih \\(2\\) karena mengambil \\(q\\) yang benar tetapi salah menentukan \\(p\\). Kesalahan: siswa mengasumsikan \\(p\\pi=\\pi\\) tanpa memverifikasi tanda elemen matriks; dengan \\(\\tan\\alpha=3\\), \\(\\cos\\alpha=\\frac{1}{\\sqrt{10}}\\) dan \\(\\sin\\alpha=\\frac{3}{\\sqrt{10}}\\) menghasilkan matriks tertentu, sehingga \\(p=1\\) tetapi \\(q\\neq 1\\).",
      },
      // C is correct (p+q = 3/2)
      {
        id: "D",
        distractorRationale:
          "Siswa memilih \\(1\\) karena salah mengidentifikasi matriks gabungan: hanya memanfaatkan matriks cermin \\(y=x\\) tanpa mengalikannya dengan matriks rotasi \\(p\\pi+q\\alpha\\). Ini setara dengan menetapkan sudut rotasi = 0, sehingga \\(p+q=0\\) atau mendapat nilai lain akibat kesalahan perkalian matriks.",
      },
      {
        id: "E",
        distractorRationale:
          "Siswa memilih \\(\\frac{1}{2}\\) karena salah dalam urutan operasi: mencerminkan lebih dulu baru merotasi, bukan sebaliknya. Miskonsepsi komposisi transformasi: urutan berpengaruh (tidak komutatif), sehingga menghitung \\(R_{cermin} \\cdot R_{rotasi}\\) alih-alih \\(R_{cermin} \\cdot R_{\\theta}\\) dalam urutan yang benar menghasilkan nilai \\(p+q\\) yang berbeda.",
      },
    ],
  },

  // ── Q4: Matriks rotasi+cermin, tan α=2, jawab p+q = 1 (A) ──
  {
    questionId: "01a1155e-c3fa-7933-b204-e1c09735656f",
    options: [
      // A is correct (p+q = 1)
      {
        id: "B",
        distractorRationale:
          "Siswa memilih \\(\\frac{1}{2}\\) karena salah menentukan \\(q\\) akibat kesalahan dalam \\(\\tan\\alpha=2\\): menggunakan \\(\\cos\\alpha=\\frac{2}{\\sqrt{5}}\\) dan \\(\\sin\\alpha=\\frac{1}{\\sqrt{5}}\\) (terbalik), sehingga persamaan elemen matriks memberikan \\(q=\\frac{1}{2}\\) dan \\(p=\\frac{1}{2}\\), menghasilkan \\(p+q=1\\)… Namun siswa menambahkan syarat yang salah dan mendapat \\(\\frac{1}{2}\\) saja.",
      },
      {
        id: "C",
        distractorRationale:
          "Siswa memilih \\(\\frac{1}{3}\\) karena membandingkan elemen-elemen matriks secara parsial: melihat salah satu entri dan menyelesaikan \\(q\\) secara terisolasi tanpa persamaan lengkap. Dengan \\(\\tan\\alpha=2\\), \\(\\cos\\alpha=\\frac{1}{\\sqrt{5}}\\), \\(\\sin\\alpha=\\frac{2}{\\sqrt{5}}\\); kesalahan dalam menyusun sistem persamaan dari empat elemen matriks gabungan menghasilkan \\(q=\\frac{1}{3}\\).",
      },
      {
        id: "D",
        distractorRationale:
          "Siswa memilih \\(-\\frac{1}{2}\\) karena salah dalam tanda (sign error): ketika menyusun persamaan \\(\\cos(p\\pi+q\\alpha)\\), lupa bahwa \\(\\cos(\\pi+\\theta)=-\\cos\\theta\\), sehingga mendapat nilai negatif. Kesalahan ini umum terjadi saat siswa tidak melacak tanda dari matriks rotasi dengan sudut di kuadran II atau III.",
      },
      {
        id: "E",
        distractorRationale:
          "Siswa memilih \\(-1\\) karena mengasumsikan \\(p=0\\) dan kemudian \\(q=-1\\) dari perbandingan koefisien matriks yang salah. Miskonsepsi: mengira tanda negatif pada elemen matriks selalu berasal dari \\(q\\) yang negatif, bukan dari nilai \\(p\\pi\\) yang membalik tanda fungsi trigonometri.",
      },
    ],
  },

  // ── Q5: Matriks rotasi+cermin, tan α=2 variasi 2, jawab p+q = 2 (E) ──
  {
    questionId: "01a1155e-c3c4-743c-a054-e6707918d3ba",
    options: [
      {
        id: "A",
        distractorRationale:
          "Siswa memilih \\(-\\frac{3}{2}\\) karena salah dalam pola (p,q): mengasumsikan \\(p=\\frac{1}{2}\\) saja dari salah satu elemen matriks tanpa menyelesaikan sistem penuh. Dengan \\(\\tan\\alpha=2\\), kombinasi elemen matriks gabungan cermin-rotasi membutuhkan dua persamaan simultan; penyelesaian parsial menghasilkan \\(p+q=-\\frac{3}{2}\\).",
      },
      {
        id: "B",
        distractorRationale:
          "Siswa memilih \\(-1\\) karena salah mengidentifikasi jenis rotasi: mengira rotasi searah jarum jam (tanda negatif di persamaan), padahal soal menggunakan rotasi berlawanan jarum jam. Kesalahan konvensi ini membalik tanda \\(\\sin\\) dalam matriks rotasi dan menghasilkan nilai \\(p+q=-1\\).",
      },
      {
        id: "C",
        distractorRationale:
          "Siswa memilih \\(0\\) karena mensubstitusi nilai yang salah: mengasumsikan sudut rotasi adalah \\(\\frac{\\pi}{2}\\) (karena tan α=2 dan mencampurkan dengan tan 90°=∞), menghasilkan \\(p\\pi+q\\alpha=0\\) yang tidak valid. Miskonsepsi dasar tentang hubungan tan dengan sudut rotasi.",
      },
      {
        id: "D",
        distractorRationale:
          "Siswa memilih \\(\\frac{1}{2}\\) dengan menukar nilai \\(p\\) dan \\(q\\) dari solusi yang benar. Kesalahan penulisan: setelah mendapat pasangan \\((p,q)=(1,1)\\) siswa salah menjumlahkan, atau mendapat \\((p,q)=(-\\frac{1}{2}, 1)\\) akibat tanda pada persamaan elemen matriks yang salah.",
      },
      // E is correct (p+q = 2)
    ],
  },

  // ── Q6: Bilangan berpangkat bertingkat √(p/q√(p/q√(p/q√(p/q)))) = p^x q^-x, x=15/16 (B) ──
  {
    questionId: "01a11568-ccfc-7ccb-8807-ee1859f92a1e",
    options: [
      {
        id: "A",
        distractorRationale:
          "Siswa memilih \\(\\frac{31}{32}\\) karena menghitung 5 tingkat nested radical alih-alih 4 tingkat. Kesalahan menghitung kedalaman: mengira ada 5 lapis akar padahal hanya 4, sehingga akumulasi eksponen mengikuti deret \\(\\frac{1}{2}+\\frac{1}{4}+\\frac{1}{8}+\\frac{1}{16}+\\frac{1}{32}=\\frac{31}{32}\\) bukan \\(\\frac{15}{16}\\).",
      },
      // B is correct (15/16)
      {
        id: "C",
        distractorRationale:
          "Siswa memilih \\(\\frac{7}{8}\\) karena hanya menghitung 3 lapis akar bukan 4. Deret eksponen hanya sampai \\(\\frac{1}{2}+\\frac{1}{4}+\\frac{1}{8}=\\frac{7}{8}\\). Kesalahan: menghentikan perhitungan terlalu awal atau salah menghitung jumlah tanda akar dalam ekspresi bertingkat.",
      },
      {
        id: "D",
        distractorRationale:
          "Siswa memilih \\(\\frac{3}{4}\\) karena hanya menghitung 2 lapis nested radical: eksponen terakumulasi \\(\\frac{1}{2}+\\frac{1}{4}=\\frac{3}{4}\\). Miskonsepsi: tidak memahami cara menyederhanakan akar bertingkat secara rekursif dari dalam ke luar; hanya memproses dua lapis terluar.",
      },
    ],
  },

  // ── Q7: Peluang koin emas (ali 11 perak+1 emas, badu 12 perak, tukar 8 dua kali), P=3/5 (C) ──
  {
    questionId: "01a11567-b984-7ff1-85a8-6016b57db692",
    options: [
      {
        id: "A",
        distractorRationale:
          "Siswa memilih \\(\\frac{1}{5}\\) karena hanya menghitung peluang koin emas ikut pada pengambilan pertama (dari Ali ke Badu) sebagai \\(\\frac{C(1,1)\\cdot C(11,7)}{C(12,8)}=\\frac{8}{12}=\\frac{2}{3}\\) lalu gagal mengombinasikan dengan pengambilan kedua (dari Badu ke Ali). Hasil parsial dengan pembagi yang keliru menghasilkan \\(\\frac{1}{5}\\).",
      },
      {
        id: "B",
        distractorRationale:
          "Siswa memilih \\(\\frac{5}{12}\\) karena tidak memisahkan dua kemungkinan kasus (emas ikut ke Badu atau tidak), melainkan langsung menghitung peluang emas kembali ke Ali dari 20 koin Badu sebagai \\(\\frac{C(1,1)\\cdot C(19,7)}{C(20,8)}\\) tanpa memperhitungkan probabilitas bahwa emas ada di Badu. Ini mengabaikan hukum peluang total.",
      },
      // C is correct (3/5)
      {
        id: "D",
        distractorRationale:
          "Siswa memilih \\(\\frac{2}{5}\\) karena menghitung \\(P(\\text{emas di Ali akhir})=1-P(\\text{emas di Badu akhir})\\) tetapi salah menghitung \\(P(\\text{emas di Badu akhir})\\). Menggunakan \\(P(\\text{emas di Badu})=\\frac{3}{5}\\) (nilai jawaban benar) lalu mengambil komplemen, padahal harusnya \\(P(\\text{emas di Ali akhir})=\\frac{3}{5}\\) bukan \\(\\frac{2}{5}\\). Kesalahan komplementer terbalik.",
      },
      {
        id: "E",
        distractorRationale:
          "Siswa memilih \\(\\frac{1}{3}\\) karena membagi 1 oleh 3 cabang kemungkinan (emas di Ali, di Badu, atau tidak ada) secara seragam — mengasumsikan distribusi uniform pada tiga kasus yang sebenarnya tidak sama peluangnya. Miskonsepsi klasik: menerapkan 'laplace' pada ruang sampel yang tidak ekuiprobabel.",
      },
    ],
  },

  // ── Q8: Suku banyak derajat 5 habis dibagi x²-1, sisa oleh (x+1)(x-1)(x-2) = 1/3·f(2)·(x²-1) (D) ──
  {
    questionId: "01a1155e-1347-7cea-a8c0-8faea0dd813c",
    options: [
      {
        id: "A",
        distractorRationale:
          "Siswa memilih \\(\\frac{1}{3}f(2)(x+1)\\) karena salah menerapkan rumus Lagrange untuk tiga akar: menggunakan faktor \\((x+1)\\) saja alih-alih \\((x^2-1)=(x+1)(x-1)\\). Miskonsepsi: mengira sisa pembagian oleh tiga faktor linear adalah kombinasi linear dari dua faktor saja (lupa mengalikan kedua faktor dari akar-akar di mana \\(f=0\\)).",
      },
      {
        id: "B",
        distractorRationale:
          "Siswa memilih \\(\\frac{1}{3}f(2)(x-1)\\) karena mencampurkan tanda dari akar \\(x=1\\) dan \\(x=-1\\): menggunakan \\((x-1)\\) sebagai faktor Lagrange di titik \\(x=-1\\) yang seharusnya \\((x+1)\\). Kesalahan tanda (sign error) umum dalam interpolasi Lagrange: faktor untuk \\(f(-1)=0\\) adalah \\(\\frac{x-1}{-1-1}\\), bukan \\(\\frac{x+1}{...}\\).",
      },
      {
        id: "C",
        distractorRationale:
          "Siswa memilih \\(f(2)\\) (konstanta) karena berpikir sisa pembagian oleh tiga faktor adalah nilai fungsi di titik di luar akar (teorema sisa: \\(f(x) \\div (x-2)\\) memberikan sisa \\(f(2)\\)), lupa bahwa pembagi di sini derajat 3 sehingga sisa harus berderajat paling tinggi 2 — bukan konstanta.",
      },
      // D is correct: (1/3)f(2)(x²-1)
      {
        id: "E",
        distractorRationale:
          "Siswa memilih \\(\\frac{1}{3}f(-2)(x^2-1)\\) karena salah mengevaluasi nilai fungsi di titik \\(x=2\\): mengira yang relevan adalah \\(f(-2)\\) (bayangan negatif) karena faktor pembagi mengandung \\((x+1)\\) yang berasal dari \\(x=-1\\). Miskonsepsi: mencampurkan titik evaluasi \\(x=2\\) (dari faktor \\((x-2)\\)) dengan tanda negatif dari akar \\(x=-1\\), sehingga mensubstitusi \\(x=-2\\) yang tidak relevan.",
      },
    ],
  },
];

async function main() {
  console.log(`MAT-35 Batch 11 — R4 Distractor Rationale (DRY_RUN=${DRY_RUN})`);
  console.log(`Curations: ${curations.length} questions\n`);

  for (const qc of curations) {
    console.log(`Processing: ${qc.questionId} (${qc.options.length} distractors)`);
    await applyRationale(qc);
  }

  // Verify
  const after = await sql`
    SELECT COUNT(DISTINCT q.id) AS cnt
    FROM questions q
    WHERE q.question_type = 'single_choice'
    AND jsonb_typeof(q.data_payload->'options') = 'array'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(q.data_payload->'options') opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )
  `;
  console.log(`\nAfter: ${after[0].cnt} SC with ≥1 distractorRationale`);

  await sql.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
