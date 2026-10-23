/**
 * MAT-35 Batch 12 — R5 Rubrik Esai (Batch 7)
 * 8 esai: Trigonometri (rasio), Relasi rekurens, Refleksi geometri,
 *         Pertidaksamaan irasional, Bilangan rasional floor/ceiling
 *
 * Target: answer_key.scoringRubric (JSONB canonical per MAT-144/MAT-145)
 */

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env" });

const DRY_RUN = process.env.DRY_RUN !== "0";
const sql = postgres(process.env.DATABASE_URL!, { max: 2 });

/**
 * postgres.js `sql.json()` hanya menerima tipe JSON murni (`JSONValue`),
 * sedangkan payload di skrip ini dibangun dinamis. Sempitkan sekali di sini —
 * bukan `any` di titik pemakaian (MAT-159).
 */
const toJsonb = (value: unknown): Parameters<typeof sql.json>[0] =>
  value as Parameters<typeof sql.json>[0];

interface RubrikStep {
  step: string;
  points: number;
  description: string;
}

interface Rubrik {
  totalPoints: number;
  steps: RubrikStep[];
  gradingNotes?: string;
}

interface EssayRubrik {
  id: string;
  label: string;
  rubrik: Rubrik;
}

const rubrics: EssayRubrik[] = [
  {
    // Trigonometri: sin/cos/tan/sec/csc/cot dari segitiga 9-12-15
    id: "01a11642-cd33-753c-9847-86582d93c80e",
    label: "Rasio trigonometri segitiga siku-siku (sa=12, mi=15)",
    rubrik: {
      totalPoints: 12,
      steps: [
        {
          step: "1",
          points: 2,
          description:
            "Menentukan sisi depan menggunakan Teorema Pythagoras: \\(\\text{de} = \\sqrt{15^2 - 12^2} = \\sqrt{81} = 9\\).",
        },
        {
          step: "2",
          points: 2,
          description:
            "Menghitung \\(\\sin\\alpha = \\frac{\\text{de}}{\\text{mi}} = \\frac{9}{15} = \\frac{3}{5}\\) dan \\(\\cos\\alpha = \\frac{\\text{sa}}{\\text{mi}} = \\frac{12}{15} = \\frac{4}{5}\\).",
        },
        {
          step: "3",
          points: 2,
          description:
            "Menghitung \\(\\tan\\alpha = \\frac{\\text{de}}{\\text{sa}} = \\frac{9}{12} = \\frac{3}{4}\\).",
        },
        {
          step: "4",
          points: 2,
          description:
            "Menghitung \\(\\sec\\alpha = \\frac{1}{\\cos\\alpha} = \\frac{5}{4}\\) dan \\(\\csc\\alpha = \\frac{1}{\\sin\\alpha} = \\frac{5}{3}\\).",
        },
        {
          step: "5",
          points: 2,
          description:
            "Menghitung \\(\\cot\\alpha = \\frac{1}{\\tan\\alpha} = \\frac{4}{3}\\).",
        },
        {
          step: "6",
          points: 2,
          description:
            "Semua nilai dinyatakan dalam bentuk pecahan sederhana (sudah disederhanakan) dan identitas \\(\\sin^2\\alpha + \\cos^2\\alpha = 1\\) dapat diverifikasi.",
        },
      ],
      gradingNotes:
        "Berikan poin penuh pada setiap langkah jika formula yang digunakan benar dan nilai numerik tepat. Kurangi 1 poin jika hasil tidak disederhanakan. Jika Pythagoras salah di langkah 1, semua langkah berikutnya yang menggunakan de=9 kehilangan poinnya, tetapi dapat memperoleh poin prosedur jika langkah-langkah selanjutnya konsisten.",
    },
  },
  {
    // Trigonometri (Inggris): sin/cos/tan/sec/csc/cot dari segitiga 9-12-15
    id: "01a1163a-de88-7647-9c78-63426c46e6eb",
    label: "Trigonometric ratios from right triangle (adjacent=12, hypotenuse=15)",
    rubrik: {
      totalPoints: 12,
      steps: [
        {
          step: "1",
          points: 2,
          description:
            "Find opposite side using Pythagorean theorem: \\(\\text{opp} = \\sqrt{15^2 - 12^2} = \\sqrt{81} = 9\\).",
        },
        {
          step: "2",
          points: 2,
          description:
            "Compute \\(\\sin\\alpha = \\frac{9}{15} = \\frac{3}{5}\\) and \\(\\cos\\alpha = \\frac{12}{15} = \\frac{4}{5}\\).",
        },
        {
          step: "3",
          points: 2,
          description:
            "Compute \\(\\tan\\alpha = \\frac{9}{12} = \\frac{3}{4}\\).",
        },
        {
          step: "4",
          points: 2,
          description:
            "Compute \\(\\sec\\alpha = \\frac{5}{4}\\) and \\(\\csc\\alpha = \\frac{5}{3}\\).",
        },
        {
          step: "5",
          points: 2,
          description: "Compute \\(\\cot\\alpha = \\frac{4}{3}\\).",
        },
        {
          step: "6",
          points: 2,
          description:
            "All six ratios expressed as simplified fractions; verification \\(\\sin^2\\alpha + \\cos^2\\alpha = 1\\) holds.",
        },
      ],
      gradingNotes:
        "Award full step points for correct formula and numeric value. Deduct 1 point if fraction not simplified. If Pythagorean theorem yields wrong opposite, subsequent steps using that value lose content points but may retain procedure points for consistent application.",
    },
  },
  {
    // Relasi rekurens: a_n = a_{n-1}+6a_{n-2}, a0=3, a1=6 → persamaan karakteristik
    id: "01a1163f-d289-7c5e-bc90-8120d2f0f7f6",
    label: "Solusi relasi rekurens (dua persamaan)",
    rubrik: {
      totalPoints: 16,
      steps: [
        {
          step: "1a",
          points: 2,
          description:
            "Soal (a): Tulis persamaan karakteristik \\(r^2 = r + 6\\), yaitu \\(r^2 - r - 6 = 0\\), dan faktorkan: \\((r-3)(r+2)=0\\). Akar: \\(r_1=3, r_2=-2\\).",
        },
        {
          step: "2a",
          points: 2,
          description:
            "Tulis solusi umum: \\(a_n = A\\cdot 3^n + B\\cdot(-2)^n\\).",
        },
        {
          step: "3a",
          points: 2,
          description:
            "Substitusi kondisi awal \\(a_0=3\\) dan \\(a_1=6\\): \\(A+B=3\\) dan \\(3A-2B=6\\). Selesaikan: \\(A=\\tfrac{12}{5},\\ B=\\tfrac{3}{5}\\).",
        },
        {
          step: "4a",
          points: 2,
          description:
            "Nyatakan solusi lengkap: \\(a_n = \\tfrac{12}{5}\\cdot 3^n + \\tfrac{3}{5}\\cdot(-2)^n\\).",
        },
        {
          step: "1b",
          points: 2,
          description:
            "Soal (b): Persamaan karakteristik \\(r^2-7r+10=0\\) → \\((r-2)(r-5)=0\\). Akar: \\(r_1=2, r_2=5\\).",
        },
        {
          step: "2b",
          points: 2,
          description:
            "Solusi umum: \\(a_n = A\\cdot 2^n + B\\cdot 5^n\\).",
        },
        {
          step: "3b",
          points: 2,
          description:
            "Kondisi awal: \\(A+B=2\\) dan \\(2A+5B=1\\). Selesaikan: \\(A=3,\\ B=-1\\).",
        },
        {
          step: "4b",
          points: 2,
          description:
            "Solusi lengkap: \\(a_n = 3\\cdot 2^n - 5^n\\). Verifikasi: \\(a_0=3-1=2\\checkmark\\), \\(a_1=6-5=1\\checkmark\\).",
        },
      ],
      gradingNotes:
        "Penilaian per sub-soal independen (maks 8 poin masing-masing). Jika akar karakteristik ditemukan dengan benar, berikan poin langkah 1. Jika solusi umum ditulis benar, berikan langkah 2. Jika sistem SPL diselesaikan dengan benar, berikan langkah 3. Jika solusi akhir tepat, berikan langkah 4. Verifikasi numerik di langkah 4b diwajibkan untuk poin penuh.",
    },
  },
  {
    // Refleksi geometri terhadap garis x+y=0 dan y=x
    id: "01a11643-4957-7cd0-8e8a-c502737acf0b",
    label: "Pencerminan terhadap garis h: x+y=0 (3 sub-soal)",
    rubrik: {
      totalPoints: 12,
      steps: [
        {
          step: "1",
          points: 3,
          description:
            "Sub-a: Temukan bayangan \\(M_h(A)\\) dengan \\(A=(2,-3)\\). Garis tegak lurus ke \\(h\\) (gradien \\(=1\\)) melalui \\(A\\): \\(y=x-5\\). Titik potong dengan \\(y=-x\\): \\(x=\\tfrac{5}{2}\\). Refleksi: \\(A'=(5+2\\cdot(\\tfrac{5}{2}-2), \\ldots)=(-3,2)\\).",
        },
        {
          step: "2",
          points: 3,
          description:
            "Sub-b: Prapeta \\(B'=(-3,5)\\) artinya \\(M_h(B)=B'\\). Karena refleksi adalah invers diri sendiri, \\(B=M_h(B')=(-5,3)\\).",
        },
        {
          step: "3",
          points: 3,
          description:
            "Sub-c: Rumus umum \\(M_h(P(x,y)) = (-y,-x)\\) — diturunkan dari prosedur langkah 1 secara general dengan titik \\(P(x,y)\\) sembarang.",
        },
        {
          step: "4",
          points: 3,
          description:
            "Verifikasi konsistensi: \\(M_h((-3,2))=(2,-3)=A\\checkmark\\) dan \\(M_h((-5,3))=(-3,5)=B'\\checkmark\\).",
        },
      ],
      gradingNotes:
        "Poin langkah 3 (rumus umum) membutuhkan penurunan, bukan sekadar menyatakan rumus. Jika siswa menyatakan rumus tanpa penurunan, berikan maksimum 1 dari 3 poin. Langkah 4 hanya wajib jika siswa mengklaim verifikasi; jika tidak dilakukan, tetap berikan poin jika langkah 1-3 benar.",
    },
  },
  {
    // Refleksi terhadap garis y=x
    id: "01a11643-4920-7a82-aa92-21b354b3e8a3",
    label: "Pencerminan terhadap garis h: y=x (3 sub-soal)",
    rubrik: {
      totalPoints: 12,
      steps: [
        {
          step: "1",
          points: 3,
          description:
            "Sub-a: \\(A=(2,-3)\\). Garis tegak lurus ke \\(y=x\\) (gradien \\(-1\\)) melalui \\(A\\): \\(y=-x-1\\). Titik potong dengan \\(y=x\\): \\(x=-\\tfrac{1}{2}\\). Bayangan: \\(A'=(-3,2)\\).",
        },
        {
          step: "2",
          points: 3,
          description:
            "Sub-b: \\(B'=(-3,5)\\) → prapeta \\(B=M_h(B')=(5,-3)\\) karena refleksi terhadap \\(y=x\\) adalah \\((x,y)\\mapsto(y,x)\\).",
        },
        {
          step: "3",
          points: 3,
          description:
            "Sub-c: Rumus umum \\(M_h(P(x,y)) = (y,x)\\) — diturunkan secara general. Koordinat dipertukarkan.",
        },
        {
          step: "4",
          points: 3,
          description:
            "Verifikasi: \\(M_h((-3,2))=(2,-3)=A\\checkmark\\) dan \\(M_h((5,-3))=(-3,5)=B'\\checkmark\\).",
        },
      ],
      gradingNotes:
        "Rumus umum \\((y,x)\\) harus diturunkan, bukan diingat. Berikan 1/3 poin jika hanya menyatakan rumus tanpa prosedur. Kesalahan tanda pada gradien tegak lurus (menggunakan +1 alih-alih -1) menyebabkan kehilangan poin di langkah 1 dan 2, tetapi sub-soal (c) dapat dinilai secara terpisah.",
    },
  },
  {
    // Pertidaksamaan irasional sqrt(frac{x+2}{x-1}) >= 1 dan sqrt(frac{x-3}{x+5}) <= 2
    id: "01a11643-0803-7b68-8486-d6df2858e80c",
    label: "Pertidaksamaan irasional — dua soal dengan pengkuadratan",
    rubrik: {
      totalPoints: 16,
      steps: [
        {
          step: "1a",
          points: 2,
          description:
            "Soal (a): Syarat definisi — penyebut \\(x-1>0\\) (karena akar bertanda ≥0) dan ekspresi dalam akar ≥0 → domain \\(x>1\\).",
        },
        {
          step: "2a",
          points: 2,
          description:
            "Kuadratkan: \\(\\frac{x+2}{x-1}\\geq 1\\) → \\(\\frac{x+2}{x-1}-1\\geq 0\\) → \\(\\frac{3}{x-1}\\geq 0\\).",
        },
        {
          step: "3a",
          points: 2,
          description:
            "Penyelesaian: \\(x-1>0\\) → \\(x>1\\). Gabungkan dengan domain: himpunan penyelesaian \\(x>1\\).",
        },
        {
          step: "4a",
          points: 2,
          description:
            "Nyatakan jawaban dalam notasi interval: \\((1,\\infty)\\). Verifikasi titik uji, misal \\(x=2\\): \\(\\sqrt{4}=2\\geq1\\checkmark\\).",
        },
        {
          step: "1b",
          points: 2,
          description:
            "Soal (b): Domain — \\(\\frac{x-3}{x+5}\\geq 0\\) dan \\(x\\neq-5\\). Daerah valid: \\(x\\leq-5\\) atau \\(x\\geq 3\\) (eksklusif \\(x=-5\\)).",
        },
        {
          step: "2b",
          points: 2,
          description:
            "Kuadratkan: \\(\\frac{x-3}{x+5}\\leq 4\\) → \\(\\frac{x-3-4(x+5)}{x+5}\\leq 0\\) → \\(\\frac{-3x-23}{x+5}\\leq 0\\).",
        },
        {
          step: "3b",
          points: 2,
          description:
            "Titik kritis: \\(x=-\\frac{23}{3}\\) dan \\(x=-5\\). Analisis tanda: \\(x\\leq-\\frac{23}{3}\\) atau \\(-5<x\\).",
        },
        {
          step: "4b",
          points: 2,
          description:
            "Gabungkan dengan domain: \\(x\\leq-\\frac{23}{3}\\) atau \\(x\\geq 3\\). Nyatakan dalam interval: \\(\\left(-\\infty,-\\frac{23}{3}\\right]\\cup[3,\\infty)\\).",
        },
      ],
      gradingNotes:
        "Penilaian per sub-soal independen. Jika siswa melupakan syarat domain, kurangi 2 poin dari sub-soal tersebut tetapi tetap berikan poin untuk langkah aljabar yang benar. Mengkuadratkan kedua ruas valid hanya ketika kedua ruas non-negatif; jika siswa tidak memverifikasi syarat ini, kurangi 1 poin dari langkah pengkuadratan.",
    },
  },
  {
    // Bilangan rasional floor — x^2 + floor(x) = floor(x^2) + x + 31/100
    id: "01a11589-7f68-7c7e-8b65-bd6c90d0ae5c",
    label: "Bilangan rasional dengan floor function — a+b",
    rubrik: {
      totalPoints: 14,
      steps: [
        {
          step: "1",
          points: 2,
          description:
            "Ubah persamaan: \\(x^2-\\lfloor x^2\\rfloor = x-\\lfloor x\\rfloor + \\frac{31}{100}\\), yaitu \\(\\{x^2\\}=\\{x\\}+\\frac{31}{100}\\) di mana \\(\\{\\cdot\\}\\) adalah bagian pecahan.",
        },
        {
          step: "2",
          points: 2,
          description:
            "Misalkan \\(x=n+t\\) dengan \\(n=\\lfloor x\\rfloor\\) bilangan bulat dan \\(0\\leq t<1\\). Maka \\(x^2=n^2+2nt+t^2\\).",
        },
        {
          step: "3",
          points: 3,
          description:
            "Bagian pecahan \\(\\{x^2\\}=\\{2nt+t^2\\}\\). Persamaan menjadi: \\(\\{2nt+t^2\\}=t+\\frac{31}{100}\\). Oleh karena \\(t+\\frac{31}{100}<1\\) diperlukan \\(t<\\frac{69}{100}\\) dan \\(2nt+t^2<1\\) atau \\(2nt+t^2\\in[1,2)\\).",
        },
        {
          step: "4",
          points: 3,
          description:
            "Analisis kasus \\(2nt+t^2<1\\): \\(2nt+t^2=t+\\frac{31}{100}\\). Substitusi dan selesaikan untuk \\(t\\) dalam bentuk rasional dengan \\(n\\) tertentu. Untuk \\(n\\) terbesar yang masih valid dan \\(x<100\\).",
        },
        {
          step: "5",
          points: 2,
          description:
            "Tentukan nilai \\(x=\\frac{a}{b}\\) dalam bentuk pecahan tersederhana (GCD(a,b)=1), pastikan \\(x < 100\\) dan rasional terbesar.",
        },
        {
          step: "6",
          points: 2,
          description:
            "Hitung \\(a+b\\) dan verifikasi bahwa \\(x\\) memenuhi persamaan asal.",
        },
      ],
      gradingNotes:
        "Soal olimpiade tingkat lanjut (DOK 4). Poin penuh hanya jika nilai \\(a+b\\) benar dan semua langkah logis. Berikan 50% poin jika transformasi ke bagian pecahan benar (langkah 1-2) meskipun nilai akhir salah. Jangan berikan poin untuk tebakan tanpa bukti.",
    },
  },
  {
    // Himpunan kabur (fuzzy set) — support, core, α-cut
    id: "01a1163f-97a4-703b-9dde-8fd4a61d43d2",
    label: "Himpunan kabur — support, core, dan α-cut variabel UMUR",
    rubrik: {
      totalPoints: 12,
      steps: [
        {
          step: "1",
          points: 3,
          description:
            "Tentukan support (pendukung) dari masing-masing himpunan kabur Muda, Dewasa, Tua: himpunan tegas semua elemen dengan derajat keanggotaan > 0. Baca dari grafik fungsi keanggotaan.",
        },
        {
          step: "2",
          points: 3,
          description:
            "Tentukan core (inti) dari masing-masing himpunan kabur: himpunan elemen dengan derajat keanggotaan = 1. Identifikasi plateau dari grafik.",
        },
        {
          step: "3",
          points: 3,
          description:
            "Tentukan \\(\\alpha\\)-cut (potongan alfa) untuk \\(\\alpha\\) yang ditentukan: \\(\\widetilde{A}_\\alpha = \\{x \\in U \\mid \\mu_{\\widetilde{A}}(x) \\geq \\alpha\\}\\). Nyatakan sebagai interval.",
        },
        {
          step: "4",
          points: 3,
          description:
            "Verifikasi properti: support \\(\\supseteq\\) core, dan \\(\\alpha\\)-cut semakin kecil seiring \\(\\alpha\\) meningkat. Tunjukkan relasi inkluisi tersebut secara eksplisit.",
        },
      ],
      gradingNotes:
        "Penilaian berbasis ketepatan pembacaan grafik. Jika grafik tidak dapat dibaca (gambar tidak tersedia), berikan kredit penuh untuk prosedu yang benar dengan nilai sembarang yang konsisten. Properti matematika di langkah 4 diwajibkan untuk soal tingkat mahir.",
    },
  },
];

async function applyRubrik(essay: EssayRubrik): Promise<boolean> {
  // Check current answer_key
  const rows = await sql`
    SELECT id, answer_key, jsonb_typeof(answer_key) as ak_type
    FROM questions
    WHERE id = ${essay.id}::uuid
    AND deleted_at IS NULL
  `;

  if (rows.length === 0) {
    console.error(`  SKIP — ID not found: ${essay.id}`);
    return false;
  }

  const row = rows[0];
  let currentAk: Record<string, unknown> = {};

  // Handle double-encoded JSON string in JSONB
  if (row.ak_type === "string") {
    try {
      currentAk = JSON.parse(row.answer_key as string) as Record<
        string,
        unknown
      >;
    } catch {
      currentAk = {};
    }
  } else {
    currentAk = (row.answer_key as Record<string, unknown>) || {};
  }

  if (currentAk.scoringRubric) {
    console.log(`  SKIP — already has scoringRubric: ${essay.id}`);
    return false;
  }

  const updatedAk = {
    ...currentAk,
    scoringRubric: essay.rubrik,
  };

  if (DRY_RUN) {
    console.log(`  [DRY_RUN] Would add rubrik to ${essay.id} (${essay.label})`);
    console.log(`    Total points: ${essay.rubrik.totalPoints}`);
    console.log(`    Steps: ${essay.rubrik.steps.length}`);
    return true;
  }

  // Write back: if original was string-encoded, keep as JSONB object
  await sql`
    UPDATE questions
    SET answer_key = ${sql.json(toJsonb(updatedAk))}::jsonb
    WHERE id = ${essay.id}::uuid
    AND deleted_at IS NULL
  `;

  console.log(`  UPDATED: ${essay.id} (${essay.label})`);
  return true;
}

async function main() {
  console.log(`=== MAT-35 Batch 12 R5 Rubrik Esai (Batch 7) ===`);
  console.log(`DRY_RUN=${DRY_RUN} | ${rubrics.length} esai`);
  console.log("");

  let success = 0;
  for (const essay of rubrics) {
    console.log(`Processing: ${essay.label}`);
    const ok = await applyRubrik(essay);
    if (ok) success++;
  }

  console.log("");
  console.log(`=== Done: ${success}/${rubrics.length} rubrik berhasil ===`);

  // Verify metrics
  const metrics = await sql`
    SELECT 
      COUNT(*) FILTER (WHERE question_type = 'essay' AND 
        (
          (answer_key->>'scoringRubric') IS NOT NULL
          OR (jsonb_typeof(answer_key) = 'string' AND (answer_key#>>'{}')::jsonb ? 'scoringRubric')
        )) AS essays_with_rubric,
      COUNT(*) FILTER (WHERE question_type = 'essay') AS total_essays
    FROM questions
    WHERE deleted_at IS NULL
  `;

  const m = metrics[0] as {
    essays_with_rubric: string;
    total_essays: string;
  };
  console.log(
    `\nMetrik DB: ${m.essays_with_rubric} esai ber-rubrik dari ${m.total_essays} total esai`
  );

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
