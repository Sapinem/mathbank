/**
 * MAT-35 Batch 10 — R4 Distractor Rationale Curation
 * 8 SC soal geometri + PD eksak
 * Author: Faruq (Pedagogy Curator)
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { max: 2 });

type QuestionOption = { id: string; distractorRationale?: string };

interface DistItem {
  questionId: string;
  bundle: string;
  options: {
    id: string;
    distractorRationale: string | null; // null = correct key
  }[];
}

const BATCH10: DistItem[] = [

  // ── Q1: Garis sejajar membagi segitiga, luas daerah biru ─────────────────
  // correct: C = 45%
  // Explanation: sebangun, luas ∝ k², strip berwarna dipilih selang-seling
  {
    questionId: "01a11644-d8bf-718c-b60d-159f0ca43f64",
    bundle: "Bangun Datar Geometri",
    options: [
      {
        id: "A",
        distractorRationale:
          "Opsi A (\\(41{,}75\\%\\)) muncul bila siswa membagi jumlah strip biru (1+5+9+11+15 = 41; ada kesalahan pada strip kelima: menghitung \\(81-64=17\\) menjadi \\(15\\)) atau mencampurkan luas strip yang salah. Kesalahan konseptual: salah menentukan strip mana yang berwarna biru dari gambar, atau salah menghitung selisih luas \\(100-81\\).",
      },
      {
        id: "B",
        distractorRationale:
          "Opsi B (\\(42{,}5\\%\\)) muncul dari perhitungan \\(\\frac{1+5+9+11+17-0{,}5}{100}\\times100\\%\\) — siswa mengurangi setengah satuan karena kebingungan pada strip terakhir atau menghitung \\(36-25=11\\) sebagai \\(10{,}5\\). Kesalahan: aritmetik pada luas strip.",
      },
      { id: "C", distractorRationale: null },
      {
        id: "D",
        distractorRationale:
          "Opsi D (\\(46\\%\\)) timbul jika siswa menyertakan strip ke-4 yang seharusnya bukan biru — yakni menghitung \\(49-36=13\\) padahal strip tersebut tidak diarsir — sehingga totalnya \\(1+5+9+13+17+1=46\\%\\). Kesalahan: salah membaca pola arsiran (memasukkan strip genap sebagai biru).",
      },
      {
        id: "E",
        distractorRationale:
          "Opsi E (\\(48\\%\\)) diperoleh bila siswa menghitung \\(1+5+9+13+17+3=48\\) — kesalahan ganda: memasukkan strip yang salah dan menambah strip terluar. Atau siswa mengambil \\(\\frac{100-4}{2}+\\varepsilon\\approx48\\%\\) dengan pendekatan kasar.",
      },
    ],
  },

  // ── Q2: Segitiga ABC, garis bagi ED & DF, cari FC ─────────────────────────
  // correct: B = 14
  {
    questionId: "01a11644-da65-7558-b545-20be11f21cd7",
    bundle: "Bangun Datar Geometri",
    options: [
      {
        id: "A",
        distractorRationale:
          "Opsi A (\\(16\\)) timbul jika siswa langsung membagi AC secara merata: \\(32\\div2=16\\), mengabaikan rasio garis bagi. Kesalahan konseptual: beranggapan bahwa DF membagi AC menjadi dua bagian sama panjang tanpa menggunakan teorema perbandingan garis bagi.",
      },
      { id: "B", distractorRationale: null },
      {
        id: "C",
        distractorRationale:
          "Opsi C (\\(12\\)) terjadi bila siswa salah menghitung \\(DA\\). Jika siswa menggunakan perbandingan \\(\\frac{BE}{EA}=\\frac{BD}{DA}\\) tetapi keliru menulis \\(\\frac{7}{3}=\\frac{3x}{DA}\\to DA=\\frac{9x}{7}\\) menjadi \\(DA=\\frac{7x}{3}\\), maka rasio \\(\\frac{AF}{FC}\\) berubah dan menghasilkan \\(y=12\\).",
      },
      {
        id: "D",
        distractorRationale:
          "Opsi D (\\(11\\)) berasal dari kesalahan substitusi: siswa menggunakan AC = 32 − y tetapi menyetel \\(\\frac{32-y}{y}=\\frac{DA}{DC}\\) dengan \\(DA\\) yang salah (misal \\(DA=\\frac{3x}{7}\\) karena terbalik), menghasilkan \\(y\\approx11\\).",
      },
      {
        id: "E",
        distractorRationale:
          "Opsi E (\\(10\\)) muncul jika siswa mengacaukan perbandingan antara BD:DC = 3:1 dengan AF:FC, seolah-olah FC = AC ÷ 3{,}2 ≈ 10. Kesalahan: mencampurkan rasio dua garis bagi yang berbeda (ED dan DF) dan menerapkan rasio BD:DC langsung pada AC.",
      },
    ],
  },

  // ── Q3: Persegi panjang + 6 lingkaran kongruen, jarak terpendek ───────────
  // correct: D = 4(√3 − 1)
  {
    questionId: "01a11644-d818-7c28-afb7-1b2125ec8155",
    bundle: "Bangun Datar Geometri",
    options: [
      {
        id: "A",
        distractorRationale:
          "Opsi A (\\(4(3\\sqrt3-2)\\)) muncul bila siswa menggunakan tinggi segitiga penuh \\(4\\sqrt3\\) tetapi kemudian hanya mengurangi satu jari-jari (bukan dua): \\(4\\sqrt3 - 2 \\cdot 2\\) dikerjakan sebagai \\(4\\sqrt3 \\cdot 3 - 2\\). Kesalahan: salah distribusi faktor 4 ke luar tanda kurung.",
      },
      {
        id: "B",
        distractorRationale:
          "Opsi B (\\(4(3\\sqrt3-1)\\)) terjadi bila siswa menghitung jarak antara titik pusat dua lingkaran yang diarsir (tinggi segitiga) lalu hanya mengurangi satu jari-jari saja: \\(4\\sqrt3 - 4\\cdot1\\). Kesalahan: lupa bahwa jarak antara dua lingkaran harus dikurangi dua kali jari-jari, bukan satu kali.",
      },
      {
        id: "C",
        distractorRationale:
          "Opsi C (\\(4(\\sqrt3-2)\\)) timbul dari kesalahan perhitungan jari-jari: siswa mengambil \\(r=12\\div4=3\\) (bukan \\(r=12\\div3=4\\)), sehingga sisi segitiga \\(=6\\) dan tinggi \\(=3\\sqrt3\\), kemudian mengurangi dua jari-jari \\(2\\times3=6\\): \\(3\\sqrt3-6=3(\\sqrt3-2)\\), kemudian mengalikan dengan 4 bukan 3. Kesalahan: salah menentukan jari-jari dari ukuran persegi panjang.",
      },
      { id: "D", distractorRationale: null },
      {
        id: "E",
        distractorRationale:
          "Opsi E (\\(4\\sqrt3-2\\)) terjadi bila siswa menghitung \\(4\\sqrt3 - 4\\cdot\\frac{1}{2}\\) — menggunakan setengah jari-jari — atau salah mem-faktor: menuliskan \\(4(\\sqrt3-1)\\) sebagai \\(4\\sqrt3-4\\) tetapi keliru menjadi \\(4\\sqrt3-2\\) karena salah substitusi \\(r=2\\) menjadi \\(r=1\\) pada langkah akhir.",
      },
    ],
  },

  // ── Q4: Segitiga ABC, titik D & E, titik potong F, luas BFC = 12 ──────────
  // correct: D = 42
  {
    questionId: "01a11644-d850-709e-9251-71f07bf63719",
    bundle: "Bangun Datar Geometri",
    options: [
      {
        id: "A",
        distractorRationale:
          "Opsi A (\\(24\\)) muncul bila siswa mengasumsikan bahwa luas BFC adalah \\(\\frac{1}{2}\\) luas ABC, sehingga luas ABC = \\(2\\times12=24\\). Kesalahan konseptual: beranggapan bahwa F membagi ABC menjadi dua bagian sama rata — padahal F adalah titik potong dua cevian dengan rasio berbeda.",
      },
      {
        id: "B",
        distractorRationale:
          "Opsi B (\\(36\\)) terjadi bila siswa benar menentukan \\(b=8\\) (dari \\(3b=24\\)) tetapi salah menghitung \\(a\\): menggunakan perbandingan yang sama untuk menentukan \\(a=4\\) alih-alih \\(a=2\\), sehingga luas \\(= 12 + 3(4+8) = 48\\). Atau siswa menjumlahkan \\(12 + a + 2a + b + 2b\\) dengan \\(a=4,b=8\\): \\(12+12+16=36\\) (salah karena \\(3a+3b=3\\cdot4+3\\cdot8=36\\)).",
      },
      {
        id: "C",
        distractorRationale:
          "Opsi C (\\(40\\)) muncul dari kesalahan pada sistem persamaan: siswa memperoleh \\(b=8\\) dan \\(a=2\\) dengan benar, tetapi menghitung luas sebagai \\(12 + 3a + 3b + 4 = 40\\) (menambahkan konstanta ekstra) atau salah memaknai \\(3(a+b)=30\\) dan menambah 10 bukan 12 untuk BFC.",
      },
      { id: "D", distractorRationale: null },
      {
        id: "E",
        distractorRationale:
          "Opsi E (\\(48\\)) terjadi bila siswa mendapat \\(a=2, b=8\\) tetapi menghitung luas ABC = \\(2\\times(\\text{luas BFC}+a+b+2a+2b)\\). Atau siswa menggunakan \\(3(a+b)=30\\) alih-alih \\(3(a+b)=30\\): jika \\(a=4\\) (kesalahan), luas \\(=12+3(4+8)=48\\). Kesalahan: menghitung \\(a=4\\) bukan \\(a=2\\) karena membagi \\(6a=12\\) menjadi \\(a=4\\).",
      },
    ],
  },

  // ── Q5: Persegi panjang lebar 4, satu lingkaran besar + dua kecil ─────────
  // correct: B = 3 + 2√2
  {
    questionId: "01a11644-d8f6-7d44-a8a8-218d87f6a8b2",
    bundle: "Bangun Datar Geometri",
    options: [
      {
        id: "A",
        distractorRationale:
          "Opsi A (\\(6\\)) diperoleh bila siswa menghitung panjang persegi panjang sebagai \\(2R + 2r = 4 + 2 = 6\\), berasumsi bahwa kedua lingkaran kecil terletak di samping lingkaran besar secara horizontal. Kesalahan: mengabaikan offset vertikal dari lingkaran kecil — posisi pusat lingkaran kecil tidak setinggi pusat lingkaran besar saat bersinggungan.",
      },
      { id: "B", distractorRationale: null },
      {
        id: "C",
        distractorRationale:
          "Opsi C (\\(4\\sqrt2\\)) timbul bila siswa menghitung jarak \\(OQ\\) dengan benar (\\(2\\sqrt2\\)) tetapi mengalikannya dengan 2 alih-alih menambah \\(AO + QB = 3\\): \\(AB = 2 \\times 2\\sqrt2 = 4\\sqrt2\\). Kesalahan: beranggapan bahwa kedua ujung lingkaran besar berada tepat di tepi persegi panjang dan melupakan komponen horizontal dari lingkaran kecil.",
      },
      {
        id: "D",
        distractorRationale:
          "Opsi D (\\(4\\sqrt3\\)) muncul bila siswa menggunakan Pythagoras dengan \\(AP=3, PQ=\\sqrt3\\) (salah — seharusnya \\(PQ=1\\)), menghasilkan \\(OQ=\\sqrt{9-3}=\\sqrt6\\) kemudian mengalikan dengan suatu faktor. Atau siswa keliru menggunakan rumus \\(\\sqrt{R^2-r^2}\\) dengan \\(R=2R_{kecil}=4, r=2\\).",
      },
      {
        id: "E",
        distractorRationale:
          "Opsi E (\\(6\\sqrt2\\)) terjadi bila siswa menghitung \\(OQ=2\\sqrt2\\) dengan benar tetapi mengambil \\(AB = 2\\cdot OQ + 2 = 4\\sqrt2+2\\) kemudian membulatkan ke \\(6\\sqrt2\\), atau menggunakan \\(r_\\text{kecil}=2\\) (bukan 1, karena mengira jari-jari kecil setengah dari besar tetapi besar \\(R=4\\)).",
      },
    ],
  },

  // ── Q6: Sudut siku-siku ABC & ECD, garis bagi AD, cari BE ────────────────
  // correct: B = 3√7
  {
    questionId: "01a11644-d9f6-737a-818a-26255d84f667",
    bundle: "Bangun Datar Geometri",
    options: [
      {
        id: "A",
        distractorRationale:
          "Opsi A (\\(\\sqrt7\\)) adalah nilai \\(x\\) yang ditemukan dalam perhitungan (\\(x^2=7 \\Rightarrow x=\\sqrt7\\)), bukan \\(BE=3x=3\\sqrt7\\). Kesalahan: siswa berhenti pada tahap menentukan \\(x\\) dan lupa bahwa yang ditanya adalah \\(BE=3x\\).",
      },
      { id: "B", distractorRationale: null },
      {
        id: "C",
        distractorRationale:
          "Opsi C (\\(7\\)) muncul bila siswa menghitung \\(x^2=7 \\Rightarrow x=\\sqrt7\\) tetapi kemudian mengalikan dengan \\(\\sqrt7\\) alih-alih 3: \\(BE=x\\cdot\\sqrt7=\\sqrt7\\cdot\\sqrt7=7\\). Atau siswa menggunakan \\(BE/EC=3/4\\) dan \\(BC=7x\\) dengan \\(x=1\\), menghasilkan \\(BE=3\\)—kemudian langsung menulis 7 dari \\(x^2=7\\).",
      },
      {
        id: "D",
        distractorRationale:
          "Opsi D (\\(15\\)) terjadi bila siswa tidak menggunakan kesebangunan segitiga ABE ~ DCE dengan benar: misalkan rasio \\(AB:CD=21:28=3:4\\) tetapi kemudian mengambil \\(BE=AB-\\frac{1}{4}\\cdot AB=21-\\frac{21}{4}\\approx15\\) dengan pendekatan subjektif.",
      },
      {
        id: "E",
        distractorRationale:
          "Opsi E (\\(21\\)) dipilih bila siswa mengira \\(BE=AB=21\\) karena menyimpulkan bahwa segitiga ABE kongruen dengan segitiga DCE (bukan hanya sebangun), atau menggunakan \\(BE/AB=AB/CD\\) (perbandingan terbalik) yang memberikan \\(BE=AB=21\\).",
      },
    ],
  },

  // ── Q7: XY diameter lingkaran kecil, S titik pusat lingkaran besar ────────
  // correct: A = 2
  {
    questionId: "01a11644-d7e1-75af-9c2c-f9f58e2178fe",
    bundle: "Bangun Datar Geometri",
    options: [
      { id: "A", distractorRationale: null },
      {
        id: "B",
        distractorRationale:
          "Opsi B (\\(4\\)) muncul bila siswa mengira bahwa luas daerah yang diarsir = \\(\\pi r^2 - \\pi r^2 = 0\\) tidak mungkin, lalu menebak bahwa luasnya sama dengan \\(R^2=4\\). Atau siswa menghitung luas setengah lingkaran kecil: \\(\\frac12 \\pi r^2 = \\frac12 \\pi (2) = \\pi \\approx 3\\), kemudian membulatkan ke 4.",
      },
      {
        id: "C",
        distractorRationale:
          "Opsi C (\\(6\\)) timbul bila siswa menjumlahkan \\(L_{\\text{tembereng}} + L_{\\frac12 \\text{kecil}} = (\\pi-2)+\\pi = 2\\pi-2 \\approx 4{,}3\\) tetapi kemudian mengalikan dengan \\(\\frac32\\) karena salah memaknai 'daerah yang diarsir'. Atau siswa menggunakan \\(R^2 - \\pi = 4 - \\pi\\) kemudian mengkonversi secara keliru.",
      },
      {
        id: "D",
        distractorRationale:
          "Opsi D (\\(8\\)) terjadi bila siswa menghitung luas lingkaran besar dikurangi lingkaran kecil: \\(\\pi R^2 - \\pi r^2 = \\pi(4)- \\pi(2) = 2\\pi \\approx 6{,}28\\) kemudian membulatkan ke 8. Atau menggunakan diameter \\(2R=4\\) sebagai alas dan memperkirakan luas dari gambar.",
      },
      {
        id: "E",
        distractorRationale:
          "Opsi E (\\(10\\)) muncul dari pendekatan yang sangat kasar: siswa menggunakan setengah keliling lingkaran besar (\\(\\pi R = 2\\pi \\approx 6\\)) dan menambahkan diameter (\\(4\\)) mendapat \\(10\\). Atau mengalikan \\(R \\times (R+1) = 2 \\times 3 = 6\\) kemudian membuat kesalahan pembulatan kasar.",
      },
    ],
  },

  // ── Q8: PD eksak, jumlah semua k yang mungkin ────────────────────────────
  // correct: B = 0
  {
    questionId: "01a11645-105e-7dab-a502-a6f7396879b0",
    bundle: "Persamaan Diferensial Eksak",
    options: [
      {
        id: "A",
        distractorRationale:
          "Opsi A (\\(-1\\)) dipilih bila siswa menghitung \\(\\frac{\\partial M}{\\partial y}\\) dan \\(\\frac{\\partial N}{\\partial x}\\) dengan benar tetapi kemudian menetapkan kondisi \\(\\frac{\\partial M}{\\partial y} = \\frac{\\partial N}{\\partial x}\\) menghasilkan persamaan \\(-\\frac{k}{(x+ky)^2} = -\\frac{k}{(x+ky)^2}\\) dan salah membaca bahwa \\(k\\) harus bernilai \\(-1\\) (mencari nilai integer tertentu alih-alih memahami bahwa persamaan terpenuhi untuk semua \\(k\\in\\mathbb{R}\\)).",
      },
      { id: "B", distractorRationale: null },
      {
        id: "C",
        distractorRationale:
          "Opsi C (\\(1\\)) timbul dari logika yang sama dengan A: siswa mencari nilai \\(k\\) tunggal yang memenuhi dan menebak \\(k=1\\) dari pola koefisien, tanpa menyadari bahwa syarat eksak \\(\\frac{\\partial M}{\\partial y}=\\frac{\\partial N}{\\partial x}\\) adalah identitas yang berlaku untuk semua \\(k \\in \\mathbb{R}\\).",
      },
      {
        id: "D",
        distractorRationale:
          "Opsi D (\\(7\\)) terjadi bila siswa salah menghitung \\(\\frac{\\partial M}{\\partial y}\\): mengambil turunan parsial terhadap \\(y\\) dari pembilang saja (menghasilkan \\(k\\)) dan penyebut saja (menghasilkan \\(k\\)), kemudian menyelesaikan persamaan yang keliru dan mendapat \\(k=7\\). Ini adalah kesalahan dalam Aturan Hasil Bagi turunan parsial.",
      },
      {
        id: "E",
        distractorRationale:
          "Opsi E (\\(10\\)) muncul bila siswa mengevaluasi kasus-kasus \\(k \\in \\{-4,-3,-2,-1,0,1,2,3,4\\}\\) (nilai-nilai bilangan bulat kecil) dengan perhitungan numerik yang salah dan menjumlahkan hanya nilai-nilai yang mereka kira memenuhi syarat, mendapat \\(10\\). Kesalahan mendasar: tidak menyadari bahwa \\(\\frac{\\partial M}{\\partial y}=\\frac{\\partial N}{\\partial x}\\) merupakan identitas aljabar yang bebas terhadap nilai \\(k\\).",
      },
    ],
  },
];

async function main() {
  let updated = 0;
  let errors = 0;

  for (const item of BATCH10) {
    try {
      // Fetch current options
      const rows = await sql`
        SELECT data_payload FROM questions WHERE id = ${item.questionId}
      `;
      if (!rows.length) {
        console.warn(`  [SKIP] ${item.questionId} — not found`);
        continue;
      }
      const payload = rows[0].data_payload as { options?: QuestionOption[] };
      const opts: QuestionOption[] = payload?.options ?? [];

      // Merge rationale in
      let changed = false;
      for (const ratEntry of item.options) {
        if (ratEntry.distractorRationale === null) continue; // correct key
        const opt = opts.find((o) => o.id === ratEntry.id);
        if (!opt) {
          console.warn(`  [WARN] ${item.questionId} opt ${ratEntry.id} not found`);
          continue;
        }
        const prev = opt.distractorRationale ?? "";
        if (!prev || prev.length < 10) {
          opt.distractorRationale = ratEntry.distractorRationale;
          changed = true;
        }
      }

      if (!changed) {
        console.log(`  [SKIP] ${item.questionId} — already has rationale`);
        continue;
      }

      // Write back
      await sql`
        UPDATE questions
        SET data_payload = data_payload || jsonb_build_object('options', ${JSON.stringify(opts)}::jsonb),
            updated_at = NOW()
        WHERE id = ${item.questionId}
      `;
      console.log(
        `  [OK] ${item.questionId} (${item.bundle}) — wrote ${
          item.options.filter((o) => o.distractorRationale !== null).length
        } rationale entries`
      );
      updated++;
    } catch (e: unknown) {
      console.error(`  [ERR] ${item.questionId}: ${e instanceof Error ? e.message : String(e)}`);
      errors++;
    }
  }

  console.log(`\nBatch 10 R4: updated=${updated} errors=${errors}`);

  // Verify
  const cov = await sql`
    SELECT COUNT(DISTINCT q.id) as cnt
    FROM questions q
    WHERE q.question_type = 'single_choice'
    AND q.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(q.data_payload->'options','[]'::jsonb)) opt
      WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
    )
  `;
  const drTotal = await sql`
    SELECT COUNT(*) as cnt
    FROM questions q,
    jsonb_array_elements(q.data_payload->'options') opt
    WHERE q.question_type = 'single_choice'
    AND q.deleted_at IS NULL
    AND opt->>'distractorRationale' IS NOT NULL
    AND length(opt->>'distractorRationale') > 10
  `;
  console.log(`\nVerifikasi pasca-batch: SC ber-DR = ${cov[0].cnt} | total DR entries = ${drTotal[0].cnt}`);

  await sql.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
