/**
 * R4 Batch 3: Kurasi distractor_rationale — Eksponensial & SPLDV-Eksponen
 * MAT-35 — Pedagogy enrichment, target JSONB data_payload.options[].distractorRationale
 *
 * 5 soal dipilih dari kandidat yang memiliki explanation lengkap:
 *  1. 4^{x+1} = 128 → x = 2,5   (Jawaban C)
 *  2. 8^x = 2^{y+1} ≡ 3x-y-1=0  (Jawaban A)
 *  3. 3^{2-x} = 27 → x = -1     (Jawaban D)
 *  4. 5^3 = (x+2)^3 → x = 3     (Jawaban B)
 *  5. Sistem eksponen SPLDV ab=? (Jawaban C=60)
 *
 * Standar: Haladyna Aturan 21 — rationale jelaskan kesalahan konseptual/prosedural spesifik.
 * Format: min 40 chars, KaTeX inline \( ... \), KaTeX display \[ ... \].
 *
 * Jalankan (dry):  DRY_RUN=1 pnpm exec tsx scripts/r4-batch3-rationale.ts
 * Jalankan (live): DRY_RUN=0 pnpm exec tsx scripts/r4-batch3-rationale.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN !== "0";
const sql = postgres(DB_URL, { max: 1, connect_timeout: 30, idle_timeout: 30 });

interface QuestionRationale {
  questionId: string;
  note: string;
  correctLabel: string;
  options: Record<string, string>;
}

// ── R4 Batch 3: Eksponensial (berbagai bentuk) + SPLDV Eksponen ────────────
const rationales: QuestionRationale[] = [
  {
    // 4^{x+1} = 128 → konversi basis: (2^2)^{x+1} = 2^7 → 2x+2=7 → x=2,5
    questionId: "01a11645-44a9-78bd-80a5-0d5727d08c63",
    note: "4^{x+1} = 128 → x = 2,5, Jawaban C",
    correctLabel: "C",
    options: {
      A: "Siswa menulis \\(4=2^2\\) dan \\(128=2^7\\) dengan benar, memperoleh \\(2x+2=7\\), lalu salah menghitung \\(x=\\frac{7-2}{2}=\\frac{5}{2}\\) sebagai \\(x=1{,}5\\) (mengira \\(\\frac{5}{2}=1{,}5\\)). Miskonsepsi: \\(\\frac{5}{2}=2{,}5\\) bukan \\(1{,}5\\); keliru membagi \\(5\\div 2\\) secara mental.",
      B: "Siswa tidak mengonversi \\(4^{x+1}=(2^2)^{x+1}=2^{2x+2}\\) dan langsung menyamakan eksponen: \\(x+1=7\\Rightarrow x=6\\), tidak valid, lalu memilih \\(x=2{,}0\\) karena mengira \\(4^{x+1}=4^3=64\\) ≠ 128 dan mencoba-coba \\(x=2\\): \\(4^3=64\\neq 128\\). Kesalahan: tidak mengubah basis ke bilangan pokok sama.",
      D: "Siswa mengonversi \\(128=4^{3{,}5}\\) (tidak tepat) dan salah memperoleh \\(x+1=3{,}5\\Rightarrow x=2{,}5\\) tapi memilih \\(x=3{,}0\\). Atau: siswa menyederhanakan \\(4^{x+1}=128\\) menjadi \\(x+1=\\log_4 128=3{,}5\\) lalu lupa mengurangi 1: \\(x=3{,}5-1=2{,}5\\) dibulatkan ke 3. Kesalahan subtraksi akhir.",
      E: "Siswa tidak mengurangi 1 di akhir: dari \\(2x+2=7\\Rightarrow 2x=5\\Rightarrow x=2{,}5\\), tetapi salah langkah jika sebelumnya memperoleh \\(x+1=3{,}5\\Rightarrow x=3{,}5\\) (lupa mengurangi 1). Miskonsepsi: menukar \\(x+1=3{,}5\\) dengan \\(x=3{,}5\\) tanpa isolasi variabel.",
    },
  },
  {
    // 8^x = 2^{y+1} → 2^{3x} = 2^{y+1} → 3x = y+1 → 3x-y-1=0
    questionId: "01a11645-455a-7fa2-9504-851505da6a1d",
    note: "8^x = 2^{y+1} ekuivalen dengan 3x-y-1=0, Jawaban A",
    correctLabel: "A",
    options: {
      B: "Siswa benar mengonversi \\(8^x=2^{3x}\\) dan menyamakan eksponen \\(3x=y+1\\), tetapi kemudian memindahkan \\(y\\) ke kiri dengan tanda yang salah: \\(3x-y+1=0\\) (seolah \\(-y+1=y+1\\)). Miskonsepsi transposisi: saat memindahkan \\(+1\\) ke kiri, tanda harus dibalik menjadi \\(-1\\), bukan tetap \\(+1\\).",
      C: "Siswa mengonversi \\(8=2^3\\) dengan benar, tetapi saat menyamakan eksponen salah arah: \\(3x=y+1\\Rightarrow 3x+y-1=0\\) (menambah \\(y\\) bukan mengurangi). Miskonsepsi: memindahkan \\(y\\) ke sisi kiri tanpa mengganti tanda — seharusnya \\(-y\\), bukan \\(+y\\).",
      D: "Siswa membalik basis: mengira \\(8^x=(2^x)^3\\) tetap \\(2^x\\) dan mengambil \\(x=y+1\\Rightarrow x-y-1=0\\). Siswa tidak menerapkan aturan pangkat \\((a^m)^n=a^{mn}\\) secara benar — \\(8^x=(2^3)^x=2^{3x}\\), bukan \\(2^x\\). Kesalahan komputasi perpangkatan ganda.",
      E: "Siswa mengira eksponen di kedua sisi harus dijumlahkan: \\(x+(y+1)=\\text{konstan}\\Rightarrow x+y-1=0\\) (memilih E). Alternatif: siswa menukar basis 8 dan 2 — mengira \\(2^x=8^{y+1}\\Rightarrow x=3(y+1)\\Rightarrow x-3y-3=0\\) mendekati D/E. Kesalahan fundamental: tidak menyamakan basis sebelum menyamakan eksponen.",
    },
  },
  {
    // 3^{2-x} = 27 = 3^3 → 2-x=3 → x=-1
    questionId: "01a11645-443a-786a-9e9d-ae048a891da4",
    note: "3^{2-x} = 27 → x = -1, Jawaban D",
    correctLabel: "D",
    options: {
      A: "Siswa mengabaikan tanda negatif pada \\(-x\\): dari \\(2-x=3\\) menulis \\(x=3-2=2\\) (membuang tanda minus di depan \\(x\\)). Miskonsepsi umum: \\(2-x=3\\) dibaca sebagai \\(x=3-2\\) tanpa melihat bahwa \\(-x=1\\Rightarrow x=-1\\). Kesalahan isolasi variabel berlawanan tanda.",
      B: "Siswa mengonversi \\(27=3^3\\) dengan benar sehingga \\(2-x=3\\), lalu salah menghitung: \\(x=3-2=1\\) (mengira isolasi \\(x\\) adalah \\(x=3-2\\) tanpa negasi). Variasi: siswa memperoleh \\(-x=1\\) tapi memilih \\(x=1\\) (tanda negatif diabaikan). Ini variasi dari miskonsepsi yang sama dengan opsi A.",
      C: "Siswa mensubstitusi \\(x=0\\) ke persamaan: \\(3^{2-0}=3^2=9\\neq 27\\). Meski terbukti salah, siswa memilih C=0 karena \\(2-0=2\\) terlihat lebih sederhana, atau karena mengira \\(3^2\\) dan \\(3^3\\) cukup dekat. Alternatif: siswa mengira solusi harus positif dan memilih nilai terkecil.",
      E: "Siswa mengonversi \\(27=3^3\\) dan \\(3^{2-x}=3^3\\), tetapi menghitung \\(x=-(3-2)=-1\\) dengan langkah benar, lalu malah memilih \\(x=-2\\). Kemungkinan: siswa mengurangi \\(3-2=1\\) dengan benar tetapi kemudian menambahkan tanda negatif ke seluruh sisi kanan: \\(x=-(3-2+1)=-2\\). Kesalahan aritmetika akhir.",
    },
  },
  {
    // 5^3 = (x+2)^3 → pangkat sama, basis samakan → x+2=5 → x=3
    questionId: "01a11645-481f-7d41-99e0-5b251866b875",
    note: "5^3 = (x+2)^3 → x = 3, Jawaban B",
    correctLabel: "B",
    options: {
      A: "Siswa melihat \\(5^3=(x+2)^3\\) dan langsung membaca basis kiri sebagai jawaban: \\(x=5\\), melupakan \\(+2\\) di kanan. Miskonsepsi: \\(5=(x+2)\\) disederhanakan menjadi \\(x=5\\) bukan \\(x=5-2=3\\). Kesalahan lupa mengisolasi \\(x\\) dari ekspresi \\(x+2\\).",
      C: "Siswa menyelesaikan \\(x+2=5\\) dengan benar tetapi kemudian salah menghitung \\(x=5+2=7\\) (penjumlahan alih-alih pengurangan) lalu memilih opsi terdekat C=1. Alternatif: siswa mengira \\(5^3=(x+2)^3\\Rightarrow (x+2)=\\sqrt[3]{5^3}=5\\) benar tapi menghitung \\(x=5\\div 2-1{,}5=1\\). Kesalahan aritmetika terminal.",
      D: "Siswa membalik tanda: dari \\(x+2=5\\Rightarrow x=5-2=3\\) benar, tetapi menemukan D=\\(-3\\) karena mengira tanda \\(+2\\) di kiri harus dipindahkan dengan negasi ganda: \\(x=5-2\\cdot 2=1\\) tidak cocok; atau siswa memilih \\(-3\\) karena ada opsi simetris \\(3\\) dan \\(-3\\) dan bingung tanda. Miskonsepsi simetri akar pangkat tiga.",
      E: "Siswa mengira bahwa \\(5^3=(x+2)^3\\) berarti \\(5=x+2\\) dan \\(x=-5+2=-3\\) (mensubtitusikan negatif), lalu memilih E=\\(-5\\). Atau: siswa tidak melihat pangkat tiga dan langsung \\(5=(x+2)\\Rightarrow x=5-2=3\\) benar, tapi karena tanda minus (basis \\(5\\) di kiri dipandang berlawanan), memilih \\(-5\\). Miskonsepsi keseimbangan tanda pada operasi pangkat.",
    },
  },
  {
    // Sistem: 3^a=81^{b+2} dan 125^b=5^{a-3}
    // → a=4b+8 dan 3b=a-3 → a=12, b=5 → ab=60
    questionId: "01a11645-48c6-76e7-ba17-d10a1e7cd496",
    note: "Sistem eksponen: a=12, b=5, ab=60, Jawaban C",
    correctLabel: "C",
    options: {
      A: "Siswa benar menyederhanakan \\(3^a=3^{4b+8}\\) dan \\(5^{3b}=5^{a-3}\\) sehingga \\(a-4b=8\\) dan \\(a-3b=3\\). Saat eliminasi: \\((a-4b)-(a-3b)=8-3\\Rightarrow -b=5\\Rightarrow b=-5\\), lalu \\(a=4(-5)+8=-12\\) sehingga \\(ab=(-12)(-5)=60\\) — benar. Namun siswa salah tanda eliminasi dan memperoleh \\(b=5, a=-12+8=-4\\Rightarrow ab=-20\\approx 10\\) atau kesalahan subtitusi berbeda membuahkan \\(ab=10\\).",
      B: "Siswa menyederhanakan dua persamaan dengan tepat tetapi saat eliminasi \\(a\\): dari \\(a=4b+8\\) subtitusi ke \\(a-3b=3\\): \\((4b+8)-3b=3\\Rightarrow b=-5\\) benar, lalu \\(a=4(-5)+8=-12\\) — maka \\(ab=60\\). Namun siswa melakukan kesalahan aritmetika di substitusi: \\(a=3b+3=3(-5)+3=-12\\) (benar) tapi mengalikan \\(a\\cdot b=(-12)\\cdot(-5)=60\\) kadang dihitung \\(12+17=29\\) karena bingung operasi. Memilih 29 adalah kesalahan aritmetika kali/tambah.",
      D: "Siswa mengonversi \\(81=3^4\\) dengan benar: \\(a=4(b+2)=4b+8\\) (pers. 1). Namun untuk \\(125^b=5^{a-3}\\) mengira \\(125=5^2\\) alih-alih \\(5^3\\) sehingga \\(2b=a-3\\) (bukan \\(3b=a-3\\)). Sistem: \\(a-4b=8\\) dan \\(a-2b=3\\) → eliminasi \\(a\\): \\(-2b=5\\Rightarrow b=-2{,}5\\), tidak bulat. Membulatkan dan mencoba menghasilkan \\(ab\\approx 64\\). Miskonsepsi: \\(125=5^2\\) (mengira \\(5\\times 25=125\\) sehingga eksponen 2).",
      E: "Siswa mengira ini soal tentang \\(a^b\\) dan langsung mencoba nilai besar: \\(ab=2018\\) (angka ikonik tahun soal) tanpa perhitungan. Miskonsepsi: opsi E dimaksudkan menjebak siswa yang mengira jawaban berkaitan dengan tahun pelajaran atau angka unik. Secara matematis, sistem memberikan \\(a=12, b=5\\) secara pasti, sehingga \\(ab=60\\).",
    },
  },
];

// ── DB update function ─────────────────────────────────────────────────────
async function updateRationale(q: QuestionRationale): Promise<number> {
  const [row] = await sql<{ options: unknown[] }[]>`
    SELECT data_payload->'options' AS options
    FROM questions
    WHERE id = ${q.questionId} AND deleted_at IS NULL
  `;
  if (!row) {
    console.warn(`  SKIP — question not found: ${q.questionId}`);
    return 0;
  }

  const options = (row.options as any[]) || [];
  if (!Array.isArray(options) || options.length === 0) {
    console.warn(`  SKIP — no options array: ${q.questionId}`);
    return 0;
  }

  let count = 0;
  const updated = options.map((opt: any) => {
    const label = opt.id as string;
    if (label === q.correctLabel) return opt; // skip correct option
    const rationale = q.options[label];
    if (!rationale) return opt;
    count++;
    return { ...opt, distractorRationale: rationale };
  });

  if (DRY_RUN) {
    console.log(`  [DRY] Would update ${count} options for ${q.questionId} (${q.note})`);
    updated
      .filter((o: any) => o.distractorRationale)
      .forEach((o: any) =>
        console.log(`    opt ${o.id} (${o.distractorRationale.length} chars): ${o.distractorRationale.substring(0, 80)}...`)
      );
    return count;
  }

  await sql`
    UPDATE questions
    SET data_payload = jsonb_set(data_payload, '{options}', ${sql.json(updated)})
    WHERE id = ${q.questionId} AND deleted_at IS NULL
  `;
  console.log(`  LIVE updated ${count} options for ${q.questionId} (${q.note})`);
  return count;
}

async function main() {
  console.log(`\nMAT-35 R4 Batch 3 — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Questions: ${rationales.length}`);

  let totalEntries = 0;
  let totalQuestions = 0;
  for (const q of rationales) {
    console.log(`\nProcessing: ${q.questionId}`);
    const n = await updateRationale(q);
    if (n > 0) {
      totalEntries += n;
      totalQuestions++;
    }
  }

  // Verify
  const [stats] = await sql`
    SELECT
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(data_payload->'options','[]'::jsonb)) opt
          WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10
        )
      ) AS sc_with_rationale,
      SUM(
        (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(data_payload->'options','[]'::jsonb)) opt
         WHERE opt->>'distractorRationale' IS NOT NULL AND length(opt->>'distractorRationale') > 10)
      ) AS total_entries
    FROM questions
    WHERE question_type = 'single_choice' AND deleted_at IS NULL
  `;

  console.log(`\n── Summary ──`);
  console.log(`  Questions processed: ${totalQuestions}`);
  console.log(`  Option entries written: ${totalEntries}`);
  console.log(`\n── DB State (all SC) ──`);
  console.log(`  SC with ≥1 distractorRationale: ${(stats as any).sc_with_rationale}`);
  console.log(`  Total distractorRationale entries: ${(stats as any).total_entries}`);

  await sql.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
