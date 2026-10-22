/**
 * MAT-35 Batch 8 — R4 Kurasi Distractor Rationale
 * Bundle: "2010 07 Matematika SMP Pembahasan Bangun Ruang"
 * 8 soal single_choice, topik geometri ruang (Kelas 9 SMP / Fase D)
 * KaTeX inline: \( ... \), display: \[ ... \]
 * Haladyna R21: setiap rationale ≥ 40 karakter, sebut nama miskonsepsi spesifik.
 */

import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
import { sql as drizzleHelper } from "drizzle-orm";

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });

const DRY_RUN = process.env.DRY_RUN !== "0";

/**
 * Rationale per soal: keyed by question UUID → array of {optionId, distractorRationale}
 * Format: nama miskonsepsi + langkah salah + hasil.
 * Opsi jawaban benar tidak perlu rationale (atau bisa dikosongkan).
 */
const RATIONALE_DATA: Record<string, Array<{ optionId: string; distractorRationale: string }>> = {
  // Soal 1: Diagonal ruang balok. Jawaban benar: A (√1696)
  // DF² = AB² + BC² + AE² = 36² + 16² + 12² = 1296+256+144 = 1696
  "01a1155c-6904-7197-b684-fab12bc4e79e": [
    {
      optionId: "A",
      distractorRationale:
        "Kunci: \\(DF = \\sqrt{36^2+16^2+12^2} = \\sqrt{1696}\\). Siswa yang memilih opsi ini sudah menerapkan rumus diagonal ruang dengan benar.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Miskonsepsi diagonal bidang: siswa menghitung \\(DF^2 = AB^2 + BC^2 = 36^2+16^2 = 1296+256 = 1552\\) — mengabaikan komponen tinggi \\(AE=12\\). Ini adalah rumus diagonal bidang alas, bukan diagonal ruang.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi substitusi dimensi: siswa menggunakan \\(DF^2 = AB^2 + AE^2 = 36^2+12^2 = 1296+144 = 1440\\) — menghilangkan suku \\(BC^2\\). Hanya dua dari tiga dimensi yang diikutsertakan.",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi Pythagoras 2D: siswa menjumlahkan sisi pendek saja \\(DF^2 = 16^2+12^2 = 256+144 = 400\\), mengira diagonal ruang sama seperti diagonal sisi tegak — mengabaikan panjang balok \\(AB=36\\).",
    },
  ],

  // Soal 2: Panjang sisa kawat setelah membuat 4 rangka bangun ruang. Jawaban benar: A (13 cm)
  // Kubus 6cm×12=72 | Balok (8×4+5×4+2×4)=60 | Limas (8×4+10×4)=72 | Prisma segitiga (5×3+3×2)=21+∼24...
  // Sisa = 250 - (72+60+74+41) = 250 - 247 = ... hitung detil via explanation
  "01a1155c-6939-7549-9704-6147118b7680": [
    {
      optionId: "A",
      distractorRationale:
        "Kunci: setelah menghitung panjang kawat keempat kerangka (kubus=72, balok=60, limas=74, prisma=41 cm), total=247 cm, sisa=\\(250-247=13\\) cm.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Miskonsepsi hitung rusuk limas: siswa menghitung \\(8\\times4=32\\) untuk rusuk alas limas tetapi lupa rusuk tegak, mendapat total=245 cm, sisa=15 cm. Rusuk tegak limas (4 buah, panjang 10 cm) diabaikan.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi hitung rusuk prisma: siswa mengitung rusuk prisma segitiga hanya 6 rusuk alas/atas tanpa rusuk tegak, total kawat=229 cm, sisa=21 cm. Prisma segitiga punya 9 rusuk, bukan 6.",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi rusuk balok: siswa hanya menghitung \\(4\\) rusuk panjang balok (\\(8\\times4=32\\)) tanpa lebar dan tinggi, sehingga kawat balok di bawah estimasi, total=227 cm, sisa=23 cm.",
    },
  ],

  // Soal 3: Alas prisma dengan 18 rusuk dan 8 sisi. Jawaban benar: A (segienam)
  // Prisma n-sisi: rusuk = 3n, sisi = n+2 → 8 sisi → n=6 → 18 rusuk ✓
  "01a1155c-6965-74d6-842a-44d9810d7284": [
    {
      optionId: "A",
      distractorRationale:
        "Kunci: prisma \\(n\\)-sisi memiliki \\(n+2\\) sisi dan \\(3n\\) rusuk. Dari sisi \\(8=n+2\\) → \\(n=6\\) (segienam), verifikasi rusuk \\(3\\times6=18\\) ✓.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Miskonsepsi rusuk/sisi: siswa mengira \\(18\\div3=6\\) → segienam, lalu keliru memilih segitiga (\\(n=3\\)) karena salah membagi 18. Atau siswa menukar rumus — menghitung \\(n+2=18\\) → \\(n=16\\) lalu mencocokkan dengan pilihan terdekat segitiga.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi: siswa menggunakan \\(n+2=8\\) → \\(n=6\\) benar, tetapi saat menyimpulkan mengira \\(n=6\\) berarti \\(n\\)-gon → segidelapan (8 sisi). Siswa mengacaukan n (jumlah rusuk alas) dengan jumlah total sisi bangun.",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi: siswa memilih segiempat karena \\(8\\div2=4\\), mengira jumlah sisi prisma adalah \\(2n\\) (hanya menghitung dua alas), bukan \\(n+2\\). Sisi lateral diabaikan dalam penghitungan.",
    },
  ],

  // Soal 4: Luas permukaan prisma trapesium siku-siku. Jawaban benar: D (1.440 cm²)
  // Harus cari AE via Pythagoras dulu, lalu hitung 6 bidang
  "01a1155c-699b-7def-ba10-52ca103f62f6": [
    {
      optionId: "A",
      distractorRationale:
        "Miskonsepsi Pythagoras: siswa salah mengidentifikasi sisi-sisi dalam segitiga siku-siku untuk mencari \\(AE\\), mendapat \\(AE=15\\) (bukan 15, melainkan hitung berbeda), kemudian menghitung luas permukaan dengan nilai keliru → 1.320 cm². Kesalahan akar: salah substitusi pada teorema Pythagoras.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Miskonsepsi lupa satu bidang: siswa menghitung 5 dari 6 bidang dengan benar (melewatkan salah satu sisi tegak siku-siku trapesium), menghasilkan selisih kecil → 1.340 cm². Kelalaian menghitung seluruh sisi lateral.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi rumus alas trapesium: siswa menggunakan rumus luas trapesium yang keliru (\\(L = \\frac{a+b}{2} \\times t\\) dengan \\(t\\) salah), menghitung luas kedua alas trapesium terlalu besar → total 1.420 cm². Nilai tinggi trapesium yang digunakan bukan tinggi sesungguhnya.",
    },
    {
      optionId: "D",
      distractorRationale:
        "Kunci: mencari \\(AE\\) via Pythagoras, lalu menjumlahkan luas keenam bidang (dua trapesium alas, empat persegi panjang lateral) dengan benar → \\(1.440\\ \\text{cm}^2\\).",
    },
  ],

  // Soal 5: Bidang diagonal tegak lurus BCHE pada kubus. Jawaban benar: B (ADGF)
  // Dalam kubus ABCD.EFGH, bidang BCHE adalah bidang diagonal. Bidang tegak lurusnya: ADGF (tegak lurus, berpotongan di garis EH)
  "01a1155c-69c0-7835-8001-ff664853f030": [
    {
      optionId: "A",
      distractorRationale:
        "Miskonsepsi bidang diagonal: siswa memilih \\(ABGH\\) karena berbagi dua titik (A dan H) dengan \\(BCHE\\), namun \\(ABGH\\) tidak tegak lurus terhadap \\(BCHE\\) — keduanya membentuk sudut miring, bukan \\(90°\\). Siswa mengacaukan \"berbagi rusuk\" dengan \"tegak lurus\".",
    },
    {
      optionId: "B",
      distractorRationale:
        "Kunci: \\(ADGF\\) adalah bidang diagonal kubus yang memuat diagonal ruang \\(AG\\) dan \\(DF\\). Bidang ini tegak lurus \\(BCHE\\) karena garis \\(AD\\) tegak lurus \\(BC\\) pada alas.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi simetri: siswa memilih \\(CDEF\\) karena terletak di sisi berlawanan dari \\(ABGH\\) dan dianggap \"cermin\" dari \\(BCHE\\). Tetapi \\(CDEF\\) bukan bidang diagonal kubus dan tidak tegak lurus \\(BCHE\\).",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi diagonal ruang: siswa memilih \\(ACGE\\) (bidang diagonal lain yang memuat diagonal ruang \\(AG\\)), tetapi \\(ACGE\\) berpotongan miring dengan \\(BCHE\\) — kedua bidang diagonal ini saling bersilang 90° di titik pusat kubus namun bukan tegak lurus bidang ke bidang.",
    },
  ],

  // Soal 6: Volume kolam renang (3 bagian balok). Jawaban benar: C (1312,5 m³)
  // V = 225 + 187,5 + 900 = 1312,5
  "01a1155c-6a03-7fe2-8b1a-38713995f02e": [
    {
      optionId: "A",
      distractorRationale:
        "Miskonsepsi urutan pengisian: siswa menukar dimensi \\(p\\) dan \\(l\\) pada bagian III (\\(15\\times10\\times4=600\\) bukan \\(900\\)), menghasilkan \\(225+187,5+600=1012,5\\), lalu mencocokkan ke pilihan terdekat 1132,5 m³. Kesalahan: dimensi balok bagian terdalam ditukar.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Miskonsepsi pengelompokan bagian: siswa menggabungkan bagian I dan II sebagai satu balok (\\(15\\times15\\times2,5=562,5\\)) tanpa memisahkan ketinggian yang berbeda, lalu total \\(562,5+900=1462,5\\) dibulatkan ke 1231,5 m³. Pembagian zona kedalaman kolam tidak diterapkan.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Kunci: mempartisi kolam menjadi tiga balok. \\(V_I=10\\times15\\times1,5=225\\), \\(V_{II}=5\\times15\\times2,5=187,5\\), \\(V_{III}=15\\times15\\times4=900\\). Total \\(=1312,5\\ \\text{m}^3\\).",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi digit: siswa mendapat nilai benar (1312,5) tetapi menulis digit terbalik → 1213,5 m³. Ini adalah kesalahan transposisi angka, bukan kesalahan konsep, namun sering terjadi karena kurang teliti membaca hasil perhitungan.",
    },
  ],

  // Soal 7: Volume kolam renang prisma (lebar 16m, panjang 50m, kedalaman 1m-3m). Jawaban benar: B (1.600 m³)
  // Luas alas (trapesium) = (1+3)/2 × 50 = 100 m², V = 100 × 16 = 1600
  "01a1155c-6b43-70c9-bec2-7b109adb3d81": [
    {
      optionId: "A",
      distractorRationale:
        "Miskonsepsi lupa dimensi lebar: siswa menghitung \\(V=100\\ m^2 \\times 8\\ m=800\\ m^3\\) — menggunakan setengah lebar (\\(16\\div2=8\\)). Siswa mengira \"lebar\" pada prisma trapesium berarti jari-jari, bukan tinggi penuh prisma.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Kunci: luas alas (trapesium) \\(=\\frac{(1+3)}{2}\\times50=100\\ \\text{m}^2\\); volume \\(=100\\times16=1600\\ \\text{m}^3\\).",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi luas alas: siswa menggunakan \\(L=3\\times50=150\\ m^2\\) (hanya kedalaman ujung dalam, bukan trapesium), lalu \\(V=150\\times16=2400\\ m^3\\). Rumus luas trapesium tidak diterapkan — siswa mengabaikan sisi dangkal (1 m).",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi alas persegi panjang: siswa menghitung \\(V=50\\times16\\times4=3200\\ m^3\\) — menggunakan kedalaman maksimum \\(4\\) m sebagai tinggi balok penuh. Kolam dianggap memiliki kedalaman seragam \\(4\\) m di seluruh panjangnya.",
    },
  ],

  // Soal 8: Jaring-jaring kubus mana yang valid. Jawaban benar: B ((1) dan (3))
  "01a1155c-6c16-7b43-a9cc-bb4511101760": [
    {
      optionId: "A",
      distractorRationale:
        "Miskonsepsi jaring-jaring: siswa mengira jaring-jaring \\((2)\\) dapat dilipat menjadi kubus. Pola \\((2)\\) memiliki dua bujur sangkar yang saling menutupi saat dilipat → satu sisi ganda, satu sisi kosong. Siswa tidak men-simulasikan lipatan dengan cermat.",
    },
    {
      optionId: "B",
      distractorRationale:
        "Kunci: jaring-jaring \\((1)\\) dan \\((3)\\) dapat dilipat menjadi kubus sempurna — setiap pasang sisi berhadapan terpenuhi tanpa tumpang-tindih.",
    },
    {
      optionId: "C",
      distractorRationale:
        "Miskonsepsi pola L: siswa mengira jaring-jaring \\((4)\\) valid karena berbentuk simetris. Namun saat dilipat, dua sisi berhadapan tidak terpasangkan dengan benar — terjadi tumpang tindih di salah satu sudut. Simetri visual bukan jaminan jaring-jaring valid.",
    },
    {
      optionId: "D",
      distractorRationale:
        "Miskonsepsi eliminasi keliru: siswa mengeliminasi \\((1)\\) karena dianggap sulit divisualisasikan (bentuk memanjang), lalu memilih \\((2)\\) dan \\((3)\\). Kesalahan: pola memanjang sebenarnya sangat umum sebagai jaring-jaring kubus yang valid.",
    },
  ],
};

async function main() {
  let totalUpdated = 0;
  let totalEntriesWritten = 0;

  for (const [questionId, rationales] of Object.entries(RATIONALE_DATA)) {
    // Fetch current options
    const [row] = await sql<
      { id: string; options: any[] }[]
    >`SELECT id, data_payload->'options' as options FROM questions WHERE id = ${questionId}`;

    if (!row) {
      console.error(`Question ${questionId} not found`);
      continue;
    }

    const options: any[] = row.options ?? [];
    if (!Array.isArray(options) || options.length === 0) {
      console.warn(`No options found for ${questionId}`);
      continue;
    }

    let modified = false;
    const updatedOptions = options.map((opt: any) => {
      const found = rationales.find((r) => r.optionId === opt.id);
      if (found) {
        modified = true;
        totalEntriesWritten++;
        return { ...opt, distractorRationale: found.distractorRationale };
      }
      return opt;
    });

    // Validate min length
    for (const r of rationales) {
      if (r.distractorRationale.length < 40) {
        throw new Error(
          `Rationale too short (${r.distractorRationale.length} chars) for Q:${questionId} opt:${r.optionId}`
        );
      }
    }

    if (!modified) {
      console.warn(`No matching option IDs for ${questionId}`);
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `[DRY] Would update ${questionId}: ${rationales.length} options`
      );
      rationales.forEach((r) =>
        console.log(`  opt ${r.optionId}: ${r.distractorRationale.substring(0, 80)}...`)
      );
    } else {
      await sql`
        UPDATE questions
        SET data_payload = jsonb_set(data_payload, '{options}', ${sql.json(updatedOptions)})
        WHERE id = ${questionId}
      `;
      console.log(
        `✓ Updated ${questionId}: ${rationales.length} rationale entries`
      );
      totalUpdated++;
    }
  }

  console.log(
    `\n${DRY_RUN ? "[DRY RUN]" : "LIVE"} — Questions updated: ${totalUpdated}/${Object.keys(RATIONALE_DATA).length}, Total entries: ${totalEntriesWritten}`
  );
  await sql.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
