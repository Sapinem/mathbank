/**
 * MAT-35 Batch 9 — R4 Kurasi Distractor Rationale
 * 7 soal single_choice:
 *   - Segi enam beraturan (perbandingan luas)
 *   - Dua setengah lingkaran (luas area)
 *   - Segitiga & garis bagi (rasio luas)
 *   - Garis bagi segitiga siku-siku sama kaki (AB=BC=6)
 *   - Garis bagi segitiga siku-siku sama kaki (perbandingan luas)
 *   - Matriks pangkat tinggi (A^3 = O)
 *   - Persamaan eksponen campuran basis 2/3
 *
 * KaTeX inline: \( ... \), display: \[ ... \]
 * Haladyna R21: setiap rationale ≥ 40 karakter, sebut nama miskonsepsi spesifik.
 */

import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
import { sql as sqlTag } from "drizzle-orm";

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });

const DRY_RUN = process.env.DRY_RUN !== "0";

const RATIONALE_DATA: Record<string, Array<{ optionId: string; distractorRationale: string }>> = {

  // Soal 1: Segi enam beraturan — perbandingan luas △PFR dan trapesium EDQR. Jawaban benar: A (1/2)
  // Teknik: koordinat + kesebangunan △PRQ ~ △PED; L_PFR / L_EDQR = 1/2
  "01a11644-d631-7e74-8b15-13434a82fb35": [
    {
      optionId: "A",
      distractorRationale:
        "Kunci: melalui kesebangunan \\(\\triangle PRQ \\sim \\triangle PED\\) dengan rasio 1:2, diperoleh \\(L_{\\triangle PRQ} = \\tfrac14 L_{\\triangle PED}\\). Lalu \\(L_{\\triangle PFR} = L_{\\triangle PRQ}\\) karena simetri sehingga \\(L_{PFR}/L_{EDQR} = \\tfrac12\\). Opsi ini benar.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Miskonsepsi rasio kesebangunan: siswa mengambil rasio linier \\(1:2\\) langsung sebagai rasio luas, lupa bahwa rasio luas adalah kuadrat rasio panjang. Mereka memperoleh \\(L_{PFR}/L_{EDQR} = \\tfrac13\\) yang keliru karena tidak memperhitungkan luas trapesium secara utuh.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi pangkat dua penuh: siswa mengkuadratkan rasio linier \\((1:2)^2 = 1:4\\) dan langsung membaca \\(\\tfrac14\\) sebagai perbandingan yang diminta — tanpa menghitung \\(L_{\\triangle PFR}\\) terhadap \\(L_{EDQR}\\) secara terpisah. Jawaban \\(\\tfrac14\\) mengabaikan bahwa trapesium EDQR hanya sebagian dari \\(\\triangle PED\\).",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi penambahan luas: siswa keliru menjumlahkan \\(L_{\\triangle PFR} + L_{\\triangle PRQ}\\) dan membaginya dengan luas total, menghasilkan \\(\\tfrac23\\). Mereka tidak memisahkan \\(\\triangle PFR\\) dari komponen lain segi enam.",
    },
    {
      optionId: "E",
      distractorRationale:
        "Miskonsepsi proporsi diagonal: siswa menggunakan perbandingan panjang diagonal \\(PE:PQ = 3:4\\) secara langsung sebagai rasio luas tanpa mengoreksi untuk alas dan tinggi trapesium, menghasilkan \\(\\tfrac34\\) yang terlalu besar.",
    },
  ],

  // Soal 2: Dua setengah lingkaran. CD=8 (tali busur sejajar AB, menyinggung lingkaran kecil).
  // R^2 = 32, r^2 = 16, L_annulus = π(R²-r²) = 16π. Jawaban benar: B (8π)
  "01a11644-d6d7-7da2-98f1-a8479a505b8f": [
    {
      optionId: "A",
      distractorRationale:
        "Miskonsepsi setengah luas: siswa menghitung \\(\\pi(R^2-r^2) = 16\\pi\\) dengan benar tetapi kemudian membaginya dua karena mengira hanya setengah cincin yang relevan, memperoleh \\(6\\pi\\). Luas daerah yang diminta adalah seluruh cincin setengah lingkaran, bukan seperempatnya.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Kunci: \\(R^2 = 32\\) (dari \\(2R^2 = 8^2\\)); \\(r = R/\\sqrt{2}\\) sehingga \\(r^2 = 16\\). Luas anulus = \\(\\pi(R^2-r^2) = \\pi(32-16) = 16\\pi\\). Setengah lingkaran memberi luas \\(\\tfrac12 \\cdot 16\\pi = 8\\pi\\). Opsi ini benar.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi nilai \\(r\\): siswa memperkirakan \\(r = 3\\) (bukan \\(r=4\\)) dengan mengira \\(CD = 2r + \\text{celah}\\), lalu \\(\\pi(R^2-r^2) = \\pi(32-9) = 23\\pi\\), kemudian mengambil setengahnya ≈ \\(10\\pi\\). Kesalahan fundamental pada penetapan \\(r\\) dari kondisi singgung.",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi tanpa setengah: siswa menghitung luas anulus penuh \\(\\pi(R^2-r^2) = 16\\pi\\) dan mengalikan dengan \\(\\tfrac34\\) karena salah baca soal bahwa area yang dicari mencakup ¾ lingkaran, menghasilkan \\(12\\pi\\). Soal berkaitan dengan satu setengah lingkaran.",
    },
    {
      optionId: "E",
      distractorRationale:
        "Miskonsepsi \\(R=4\\): siswa mengira \\(CD = 2R\\) sehingga \\(R = 4\\) (bukan \\(R = \\sqrt{32}\\)), lalu \\(L = \\tfrac12 \\pi R^2 = \\tfrac12 \\pi(16) = 8\\pi\\). Meskipun numerik sama akhirnya salah, siswa yang memilih \\(16\\pi\\) adalah yang menggunakan \\(R = 4\\) untuk luas penuh. Nilai \\(16\\pi\\) muncul dari pengabaian pembagian setengah.",
    },
  ],

  // Soal 3: △ABC, D bagi AC dengan AD:DC=1:2; E tengah BD; F potong AE-lanjutan & BC.
  // L_ABC = 720 → L_EBF = 60. Jawaban benar: D (60)
  "01a11644-d887-7946-8dd6-03cb48ec726f": [
    {
      optionId: "A",
      distractorRationale:
        "Miskonsepsi proporsi langsung: siswa membagi \\(L_{\\triangle ABC}=720\\) dengan \\(\\text{AD:DC}=1:2\\) memperoleh \\(\\frac13 \\times 720 = 240\\), lalu membagi dua karena E tengah BD: \\(\\frac12 \\times 240 = 120\\). Mereka berhenti di sini dan salah membaca \\(120\\) sebagai \\(L_{\\triangle ABD}/L_{\\triangle ABE}\\), bukan \\(L_{\\triangle EBF}\\). Nilai 180 muncul dari langkah yang lebih awal: \\(\\frac14 \\times 720\\).",
    },
    {
      optionId: "B",
      distractorRationale:
        "Miskonsepsi titik tengah tanpa garis potong F: siswa menghitung \\(L_{\\triangle ABE} = \\tfrac12 L_{\\triangle ABD} = 120\\) karena E tengah BD, dan mengabaikan bahwa F adalah titik potong yang memotong lebih jauh. Jawaban 120 adalah \\(L_{\\triangle ABE}\\), bukan \\(L_{\\triangle EBF}\\).",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi rasio BF:FC: siswa mencoba menerapkan teorema Menelaus atau ceva pada \\(\\triangle CBD\\) tetapi keliru menghitung BF:FC = 1:2 (seharusnya 1:3), sehingga \\(L_{\\triangle EBF} = \\tfrac{1}{3} \\times \\tfrac12 L_{\\triangle CBD} \\approx 80\\). Kesalahan terletak pada penentuan posisi F menggunakan teorema perbandingan garis.",
    },
    {
      optionId: "D",
      distractorRationale:
        "Kunci: \\(L_{\\triangle CBD} = 480\\). E tengah BD \\(\\Rightarrow\\) \\(L_{\\triangle CBE} = 240\\). Garis AEF memotong BC di F dengan BF:FC = 1:3 (dari Menelaus), sehingga \\(L_{\\triangle EBF} = \\tfrac14 \\times 240 = 60\\). Opsi ini benar.",
    },
    {
      optionId: "E",
      distractorRationale:
        "Miskonsepsi rasio BF:FC = 1:5: siswa keliru mengaplikasikan teorema ceva dengan ketiga cevian sekaligus tanpa memperhatikan bahwa F bukan cevian ketiga; menghasilkan \\(L_{\\triangle EBF} = \\tfrac{1}{6} \\times 240 = 40\\). Kesalahan fundamental dalam identifikasi titik-titik yang membagi sisi.",
    },
  ],

  // Soal 4: △ABC siku-siku di B, AB=BC=6; CD garis bagi dari C → AD=? Jawaban benar: C (12-6√2)
  // CD garis bagi → AD/DB = AC/BC = 6√2/6 = √2; AD = 6√2/(1+√2) = 12-6√2
  "01a11644-d9b1-7923-b183-b2349643ea07": [
    {
      optionId: "A",
      distractorRationale:
        "Miskonsepsi rasionalisasi salah tanda: siswa menghitung \\(AD = \\dfrac{6\\sqrt2}{1+\\sqrt2}\\) tetapi saat merasionalkan mengalikan dengan \\(\\dfrac{1+\\sqrt2}{1+\\sqrt2}\\) alih-alih \\(\\dfrac{1-\\sqrt2}{1-\\sqrt2}\\), memperoleh \\(\\dfrac{6\\sqrt2(1+\\sqrt2)}{-1} = -6\\sqrt2-12\\). Mereka mengambil nilai absolut sebagian: \\(6-3\\sqrt2\\). Nilai ini lebih kecil dari nol secara geometri sehingga tidak valid.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Miskonsepsi tanda rasionalisasi: siswa keliru menghitung \\((1-\\sqrt2)(1+\\sqrt2) = +1\\) (lupa tanda negatif), memperoleh penyebut \\(+1\\) dan pembilang \\(6\\sqrt2(1-\\sqrt2) = 6\\sqrt2-12\\). Mengambil nilai positif tanpa memperhatikan bahwa \\(6\\sqrt2 \\approx 8{,}5 > 6\\), sehingga menyimpulkan \\(6+3\\sqrt2\\) — tidak konsisten dengan panjang AB=6.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Kunci: Teorema garis bagi \\(\\Rightarrow\\) \\(\\dfrac{AD}{DB} = \\dfrac{AC}{BC} = \\dfrac{6\\sqrt2}{6} = \\sqrt2\\). Maka \\(AD + DB = AB = 6\\) dan \\(AD = \\sqrt2 \\cdot DB\\). Diperoleh \\(AD = \\dfrac{6\\sqrt2}{1+\\sqrt2} = \\dfrac{6\\sqrt2(1-\\sqrt2)}{-1} = 12-6\\sqrt2\\). Opsi ini benar.",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi panjang AD > AB: siswa keliru menggunakan AD/DC = AC/BC (bukan AD/DB), memperoleh \\(AD = \\dfrac{AC \\cdot AB}{BC+AC} = \\dfrac{6\\sqrt2 \\cdot 6}{6+6\\sqrt2} = \\dfrac{36\\sqrt2}{6(1+\\sqrt2)} = 12-6\\sqrt2\\) — langkah akhir benar tetapi di tengah sempat mengira hasilnya \\(12+6\\sqrt2\\) karena kesalahan tanda.",
    },
    {
      optionId: "E",
      distractorRationale:
        "Miskonsepsi penjumlahan: siswa mengira AD = AC + AB − AB/√2 dengan kombinasi coba-coba numerik, menghasilkan \\(18+6\\sqrt2\\) yang bahkan melebihi keliling segitiga. Kesalahan konseptual mendasar: tidak menerapkan teorema garis bagi sudut sama sekali.",
    },
  ],

  // Soal 5: △ABC siku-siku sama kaki di C, AC=BC=x, AD garis bagi; L_ABD/L_ABC = ?
  // Jawaban benar: E (2−√2)
  // CD/DB = AC/AB = x/(x√2) = 1/√2 → DB = x√2/(1+√2) = x(√2-1)
  // L_ABD/L_ABC = DB/BC = (√2-1)/1·(1/1) = ... = 2-√2
  "01a11644-d9d0-7fcc-b4ea-ded335dd4325": [
    {
      optionId: "A",
      distractorRationale:
        "Miskonsepsi langsung √2: siswa mengidentifikasi AB = x√2 dan mengira rasio luas sama dengan rasio sisi miring terhadap kaki, memperoleh √2. Mereka tidak menerapkan teorema garis bagi untuk menemukan letak D pada BC, langsung mengambil rasio hipotenusa.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Miskonsepsi rasio terbalik: siswa menghitung DB/CD = √2 (bukan CD/DB = 1/√2) dari teorema garis bagi, lalu menggunakan DB = CD·√2 dan menyimpulkan \\(L_{ABD}/L_{ABC} = \\sqrt2+1\\). Kesalahan pada arah perbandingan: CD/DB = AC/AB bukan DB/CD.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi √2−1: siswa menghitung DB/BC dengan benar sebagai \\(\\dfrac{\\sqrt2-1}{1}\\) tetapi tidak menyederhanakannya; mereka mengira hasil akhirnya adalah \\(\\sqrt2-1\\) tanpa memperhatikan bahwa \\(DB/BC = \\dfrac{\\sqrt2}{1+\\sqrt2} = \\sqrt2(\\sqrt2-1) = 2-\\sqrt2\\) (langkah rasionalisasi terlewat).",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi dua kali rasionalisasi: siswa melakukan rasionalisasi dua kali dan memperoleh \\(2\\sqrt2-1\\). Kesalahan aljabar: \\(\\sqrt2 \\cdot \\dfrac{\\sqrt2-1}{1} = 2-\\sqrt2\\) bukan \\(2\\sqrt2-1\\).",
    },
    {
      optionId: "E",
      distractorRationale:
        "Kunci: Teorema garis bagi \\(\\Rightarrow\\) \\(\\dfrac{CD}{DB} = \\dfrac{AC}{AB} = \\dfrac{x}{x\\sqrt2} = \\dfrac{1}{\\sqrt2}\\). Maka \\(DB = \\dfrac{\\sqrt2}{1+\\sqrt2} \\cdot BC = \\dfrac{\\sqrt2(\\sqrt2-1)}{1} = 2-\\sqrt2\\). \\(L_{ABD}/L_{ABC} = DB/BC = 2-\\sqrt2\\). Opsi ini benar.",
    },
  ],

  // Soal 6: Matriks A 3×3, A^3 = O (matriks nol), A^2 ≠ O.
  // A^{2017} + 2017A^{2018} + 2I^{2018} = A^{2017}(I + 2017A) + 2I
  // = O + 2I = 2I (karena 2017 ≥ 3). Jawaban benar: B (2I)
  "01a11645-31bc-79ba-b693-f90dc19221a7": [
    {
      optionId: "A",
      distractorRationale:
        "Miskonsepsi A^n = O untuk semua n ≥ 2: siswa mengira \\(A^2 = O\\) (bukan hanya \\(A^3 = O\\)) sehingga \\(A^{2017} = O\\) dan \\(A^{2018} = O\\), memperoleh \\(O + O + 2I = 2I\\). Mereka lupa bahwa \\(2I^{2018} = 2I\\) (karena \\(I^n = I\\)), bukan 2. Opsi O muncul jika mereka juga mengira \\(I^{2018} = O\\), yang merupakan kesalahan identitas matriks satuan.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Kunci: \\(A^3 = O \\Rightarrow A^n = O\\) untuk \\(n \\geq 3\\). Maka \\(A^{2017} = O\\) dan \\(A^{2018} = O\\). Selain itu \\(I^{2018} = I\\). Jadi \\(O + 2017 \\cdot O + 2I = 2I\\). Opsi ini benar.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi \\(A^n = A\\) untuk n ganjil besar: siswa mengira matriks nilpoten berperiode sehingga \\(A^{2017} = A\\) (karena 2017 ganjil) dan \\(A^{2018} = A^2\\). Mereka memperoleh \\(A + 2017A^2 + 2I\\), yang untuk \\(A^2 \\neq O\\) tidaklah menyederhanakan ke \\(A\\). Ini menunjukkan kebingungan antara matriks periodik dan matriks nilpoten.",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi salah kali: siswa mengira \\(A^{2017} = A\\) dan \\(A^{2018} = I\\), memperoleh \\(A + 2017I + 2I = 2017A + ... \\). Mereka salah menerapkan sifat pangkat matriks nilpoten dengan sifat matriks invers/identitas.",
    },
    {
      optionId: "E",
      distractorRationale:
        "Miskonsepsi \\(I^{2018} = I^2 = I\\) benar, tetapi \\(A^{2017} = A\\): menghasilkan \\(A + 0 + 2I = A + 2I\\). Kesalahan ada pada pengabaian fakta \\(A^{2017} = O\\) — siswa tidak memeriksa apakah pangkat sudah melebihi orde nilpotensi \\(A^3=O\\).",
    },
  ],

  // Soal 7: (4/9)^{x²-3}·(8/27)^{1-x} = 3/2 → x₁,x₂ → (x₁-x₂)² = ?
  // Pangkat sama basis 2/3: 2x²-3x-3 = -1 → 2x²-3x-2=0 → (2x+1)(x-2)=0 → x₁=-1/2, x₂=2
  // (x₁-x₂)² = (-1/2-2)² = (-5/2)² = 25/4. Jawaban benar: B (25/4)
  "01a11645-47e7-739d-8357-1e183f99007f": [
    {
      optionId: "A",
      distractorRationale:
        "Miskonsepsi kuadrat jumlah vs selisih: siswa menghitung \\((x_1+x_2)^2\\) alih-alih \\((x_1-x_2)^2\\). Dari Vieta, \\(x_1+x_2 = \\tfrac32\\) sehingga \\((x_1+x_2)^2 = \\tfrac94\\). Mereka salah baca soal: yang diminta adalah selisih, bukan jumlah.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Kunci: konversi basis ke \\(\\tfrac23\\) memberikan eksponen \\(2x^2-3x-3 = -1\\), yaitu \\(2x^2-3x-2=0\\), akar \\(x_1=-\\tfrac12, x_2=2\\). Maka \\((x_1-x_2)^2 = \\left(-\\tfrac52\\right)^2 = \\tfrac{25}{4}\\). Opsi ini benar.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi diskriminan sebagai jawaban: siswa menghitung diskriminan persamaan kuadrat \\(\\Delta = b^2-4ac = 9+16 = 25\\) dan mengira \\((x_1-x_2)^2 = \\Delta/a^2 = 25/4\\). Beberapa kemudian salah mengalikan: \\(\\Delta/a = 25/2\\) atau menambah sesuatu sehingga memperoleh \\(41/4\\). Ini terjadi ketika siswa mencampurkan \\((x_1-x_2)^2 = \\Delta/a^2\\) dengan rumus lain.",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi \\((x_1-x_2)^2 = \\Delta/a\\) tanpa kuadrat \\(a\\): siswa menggunakan \\((x_1-x_2)^2 = \\Delta/a = 25/2\\) karena mengira pembaginya adalah \\(a\\) bukan \\(a^2\\). Formula yang benar adalah \\((x_1-x_2)^2 = (x_1+x_2)^2-4x_1x_2 = \\tfrac94 - 4(-1) = \\tfrac94+4 = \\tfrac{25}{4}\\).",
    },
    {
      optionId: "E",
      distractorRationale:
        "Miskonsepsi diskriminan langsung: siswa mengira \\((x_1-x_2)^2 = b^2-4ac = 9+16 = 25\\) tanpa membagi \\(a^2\\). Formula \\((x_1-x_2)^2 = \\Delta/a^2\\) di mana \\(a=2\\) menghasilkan \\(25/4\\), bukan \\(25\\). Mereka mengabaikan koefisien \\(a\\) dalam persamaan tidak monic.",
    },
  ],
};

async function main() {
  if (DRY_RUN) {
    console.log("=== DRY RUN — tidak ada write ke DB ===");
    Object.entries(RATIONALE_DATA).forEach(([qid, opts]) => {
      console.log(`\nSoal ${qid}: ${opts.length} opsi`);
      opts.forEach(o => console.log(`  ${o.optionId}: ${o.distractorRationale.length} chars`));
    });
    return;
  }

  console.log("=== LIVE RUN — menulis ke DB ===");
  let totalUpdated = 0;

  for (const [questionId, options] of Object.entries(RATIONALE_DATA)) {
    // Ambil options saat ini
    const rows = await sql`
      SELECT data_payload->'options' as opts
      FROM questions WHERE id = ${questionId}::uuid
    `;
    if (!rows.length) {
      console.warn(`  [SKIP] soal ${questionId} tidak ditemukan`);
      continue;
    }

    const currentOpts = rows[0].opts as Array<{
      id: string;
      contentMarkdown?: string;
      distractorRationale?: string;
    }>;

    if (!Array.isArray(currentOpts)) {
      console.warn(`  [SKIP] options bukan array untuk ${questionId}`);
      continue;
    }

    // Merge rationale ke options
    const updatedOpts = currentOpts.map(opt => {
      const rationale = options.find(r => r.optionId === opt.id);
      if (rationale) {
        return { ...opt, distractorRationale: rationale.distractorRationale };
      }
      return opt;
    });

    await sql`
      UPDATE questions
      SET data_payload = jsonb_set(data_payload, '{options}', ${sql.json(updatedOpts)}::jsonb),
          updated_at = NOW()
      WHERE id = ${questionId}::uuid
    `;
    totalUpdated++;
    console.log(`  [OK] ${questionId} — ${options.length} opsi diupdate`);
  }

  console.log(`\nSelesai: ${totalUpdated} soal diupdate.`);
  await sql.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
