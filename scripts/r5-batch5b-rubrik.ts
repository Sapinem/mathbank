/**
 * MAT-35 R5 Batch 5b — Essay Scoring Rubrics (Advanced)
 * 6 esai tingkat lanjut: aljabar abstrak, ruang vektor, pertidaksamaan irasional, peluang
 * Author: Faruq (Pedagogy Curator)
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { max: 2 });

interface EssayRubric {
  questionId: string;
  title: string;
  totalPoints: number;
  scoringRubric: string;
}

const BATCH5B_RUBRICS: EssayRubric[] = [

  // ── E1: (D,+) Grup Abel — Matriks Diagonal ────────────────────────────────
  {
    questionId: "01a1163d-68c3-78ef-ad25-d4edf01203cf",
    title: "Buktikan (D,+) Grup Abel",
    totalPoints: 10,
    scoringRubric: `Rubrik Penilaian (Total: 10 poin)\n\n**Kriteria & Skor:**\n\n| Langkah | Indikator | Skor |\n|---------|-----------|------|\n| 1. Ketutupan (Closure) | Ambil sembarang \\\\(A, B \\\\in \\\\mathbb{D}\\\\) berbentuk diagonal; tunjukkan \\\\(A+B\\\\) juga diagonal dengan entri \\\\(a_i+b_i \\\\in \\\\mathbb{R}\\\\) | 2 |\n| 2. Asosiatif | Tunjukkan \\\\((A+B)+C = A+(B+C)\\\\) melalui sifat asosiatif penjumlahan real pada entri diagonal | 2 |\n| 3. Identitas | Tunjukkan matriks nol \\\\(e = 0_{n \\\\times n} \\\\in \\\\mathbb{D}\\\\) adalah elemen identitas: \\\\(A + e = e + A = A\\\\) | 2 |\n| 4. Invers | Untuk setiap \\\\(A \\\\in \\\\mathbb{D}\\\\), tunjukkan \\\\(A^{-1}\\\\) (diagonal dengan entri \\\\(-a_i\\\\)) \\\\(\\\\in \\\\mathbb{D}\\\\) dan \\\\(A + A^{-1} = e\\\\) | 2 |\n| 5. Komutatif | Tunjukkan \\\\(A + B = B + A\\\\) melalui sifat komutatif penjumlahan real pada entri diagonal | 1 |\n| 6. Kesimpulan | Menyatakan bahwa karena kelima sifat terpenuhi, \\\\((\\\\mathbb{D}, +)\\\\) merupakan grup Abel | 1 |\n\n**Catatan:** Pengurangan 0,5 poin per langkah bila notasi matriks tidak konsisten; entri luar diagonal tidak diverifikasi nol; atau tidak disebutkan \\\\(a_i + b_i \\\\in \\\\mathbb{R}\\\\).`,
  },

  // ── E2: Ruang Vektor V={(a,b)} dengan operasi non-standar ─────────────────
  {
    questionId: "01a1163c-ed91-7c98-acfb-978b73e00a25",
    title: "Apakah V={(a,b)} dengan operasi non-standar merupakan ruang vektor?",
    totalPoints: 10,
    scoringRubric: `Rubrik Penilaian (Total: 10 poin)\n\n**Jawaban:** \\\\(V\\\\) bukan ruang vektor (gagal di Aksioma 7 dan Aksioma 8).\n\n**Kriteria & Skor:**\n\n| Langkah | Indikator | Skor |\n|---------|-----------|------|\n| 1. Aksioma 1–6 terpenuhi | Periksa ketutupan (+), komutatif, asosiatif, identitas \\\\((0,0)\\\\), invers \\\\((-\\\\frac{a}{1+a},-\\\\frac{b}{1+b})\\\\), ketutupan perkalian skalar — semua terpenuhi | 4 |\n| 2. Aksioma 7 gagal | Tunjukkan \\\\(k(\\\\overline{u}+\\\\overline{v}) = (a+c+ac, k(b+d+bd)) \\\\neq k\\\\overline{u}+k\\\\overline{v}\\\\) dengan perhitungan algebraik atau kontracontoh | 2 |\n| 3. Aksioma 8 gagal | Tunjukkan \\\\((k+m)\\\\overline{u} = (a,(k+m)b) \\\\neq (a+a+a^2,kb+mb+k^2b^2) = k\\\\overline{u}+m\\\\overline{u}\\\\) | 2 |\n| 4. Aksioma 9 & 10 | Periksa \\\\(k(m\\\\overline{u})=(km)\\\\overline{u}\\\\) (terpenuhi) dan \\\\(1\\\\cdot\\\\overline{u}=\\\\overline{u}\\\\) (terpenuhi) | 1 |\n| 5. Kesimpulan | Menyatakan \\\\(V\\\\) bukan ruang vektor karena Aksioma 7 dan/atau 8 tidak terpenuhi | 1 |\n\n**Catatan:** Skor penuh Langkah 2 dan 3 memerlukan perhitungan algebraik eksplisit.`,
  },

  // ── E3: Ruang Vektor A={(x,y,z)} dengan perkalian skalar non-standar ───────
  {
    questionId: "01a1163c-ed5a-7d98-9893-a43d3a77c3b6",
    title: "Apakah A={(x,y,z)} dengan k(x,y,z)=(kx,y,z) merupakan ruang vektor?",
    totalPoints: 10,
    scoringRubric: `Rubrik Penilaian (Total: 10 poin)\n\n**Jawaban:** \\\\(A\\\\) bukan ruang vektor (gagal di Aksioma 8).\n\n**Kriteria & Skor:**\n\n| Langkah | Indikator | Skor |\n|---------|-----------|------|\n| 1. Aksioma 1–7 terpenuhi | Periksa ketutupan (+), komutatif, asosiatif, identitas \\\\((0,0,0)\\\\), invers \\\\((-a,-b,-c)\\\\), ketutupan perkalian skalar, dan Aksioma 7 | 5 |\n| 2. Aksioma 8 gagal | \\\\((k+m)(a,b,c)=((k+m)a,b,c)\\\\) tetapi \\\\(k(a,b,c)+m(a,b,c)=(ka+ma,2b,2c)\\\\); keduanya tak sama bila \\\\(b \\\\neq 0\\\\) | 3 |\n| 3. Aksioma 9 & 10 | Periksa \\\\(k(m(a,b,c))=(kma,b,c)=(km)(a,b,c)\\\\) (terpenuhi) dan \\\\(1(a,b,c)=(a,b,c)\\\\) (terpenuhi) | 1 |\n| 4. Kesimpulan | Menyatakan \\\\(A\\\\) bukan ruang vektor karena Aksioma 8 tidak terpenuhi | 1 |\n\n**Catatan:** Poin penuh Langkah 2 memerlukan perhitungan algebraik eksplisit atau kontracontoh numerik.`,
  },

  // ── E4: Hasil Kali Dalam yang dibangkitkan matriks 2×2 ────────────────────
  {
    questionId: "01a11641-14fc-7331-9ba7-8d6df4bcd488",
    title: "Hasil kali dalam pada R² (a–f)",
    totalPoints: 12,
    scoringRubric: `Rubrik Penilaian (Total: 12 poin, 2 poin per sub-soal)\n\n**Rumus:** \\\\(\\\\langle \\\\mathbf{u}, \\\\mathbf{v} \\\\rangle = (A\\\\mathbf{u}) \\\\cdot (A\\\\mathbf{v})\\\\) dengan \\\\(A = \\\\begin{pmatrix}2&1\\\\\\\\1&1\\\\end{pmatrix}\\\\).\n\n| Sub-soal | Langkah kunci | Jawaban benar | Skor |\n|----------|---------------|---------------|------|\n| a. \\\\(\\\\langle\\\\mathbf{u},\\\\mathbf{v}\\\\rangle\\\\) | \\\\(A\\\\mathbf{u}=(5,3)^T\\\\), \\\\(A\\\\mathbf{v}=(-1,0)^T\\\\), titik =\\\\(-5\\\\) | \\\\(-5\\\\) | 2 |\n| b. \\\\(\\\\langle\\\\mathbf{v},\\\\mathbf{w}\\\\rangle\\\\) | \\\\(A\\\\mathbf{v}=(-1,0)^T\\\\), \\\\(A\\\\mathbf{w}=(-1,-1)^T\\\\), titik =\\\\(1\\\\) | \\\\(1\\\\) | 2 |\n| c. \\\\(\\\\langle\\\\mathbf{u}+\\\\mathbf{v},\\\\mathbf{w}\\\\rangle\\\\) | \\\\(\\\\mathbf{u}+\\\\mathbf{v}=(1,2)^T\\\\); \\\\(A(1,2)^T=(4,3)^T\\\\); titik\\\\(\\\\cdot(-1,-1)^T=-7\\\\) | \\\\(-7\\\\) | 2 |\n| d. \\\\(\\\\lVert\\\\mathbf{v}\\\\rVert\\\\) | \\\\(\\\\langle\\\\mathbf{v},\\\\mathbf{v}\\\\rangle=(-1)(- 1)+0=1\\\\); \\\\(\\\\lVert\\\\mathbf{v}\\\\rVert=1\\\\) | \\\\(1\\\\) | 2 |\n| e. \\\\(\\\\text{d}(\\\\mathbf{v},\\\\mathbf{w})\\\\) | \\\\(\\\\mathbf{v}-\\\\mathbf{w}=(-1,2)^T\\\\); \\\\(A(-1,2)^T=(0,1)^T\\\\); \\\\(\\\\lVert\\\\cdot\\\\rVert=1\\\\) | \\\\(1\\\\) | 2 |\n| f. \\\\(\\\\lVert\\\\mathbf{v}-\\\\mathbf{w}\\\\rVert^2\\\\) | \\\\(=(\\\\text{d}(\\\\mathbf{v},\\\\mathbf{w}))^2=1^2=1\\\\) | \\\\(1\\\\) | 2 |\n\n**Catatan:** 2 = proses + jawaban benar; 1 = proses benar, salah hitung; 0 = metode salah.`,
  },

  // ── E5: Peluang lampu menyala 9 < t < 10 jam ─────────────────────────────
  {
    questionId: "01a11642-8fbd-7693-933a-01a818ef9676",
    title: "Peluang lampu menyala 9 < t < 10 jam (OSN SMP 2019)",
    totalPoints: 10,
    scoringRubric: `Rubrik Penilaian (Total: 10 poin)\n\n**Jawaban:** \\\\(P = \\\\dfrac{7}{20}\\\\)\n\n| Langkah | Indikator | Skor |\n|---------|-----------|------|\n| 1. Identifikasi masalah | Menyatakan bahwa ini adalah peluang total dengan 5 kasus berdasarkan waktu mulai | 1 |\n| 2. Kasus mulai 19.00 | \\\\(P_1 = \\\\frac{1}{5} \\\\times \\\\frac{1}{2} = \\\\frac{1}{10}\\\\) (padam 04.00–05.00) | 2 |\n| 3. Kasus mulai 19.30 | \\\\(P_2 = \\\\frac{1}{5} \\\\times \\\\frac{1}{2} = \\\\frac{1}{10}\\\\) (padam 04.30–05.30) | 2 |\n| 4. Kasus mulai 20.00 | \\\\(P_3 = \\\\frac{1}{5} \\\\times \\\\frac{1}{2} = \\\\frac{1}{10}\\\\) (padam 05.00–06.00) | 2 |\n| 5. Kasus mulai 20.30 | \\\\(P_4 = \\\\frac{1}{5} \\\\times \\\\frac{0{,}5}{2} = \\\\frac{1}{20}\\\\) (padam 05.30–06.00) | 2 |\n| 6. Kasus 21.00 & total | \\\\(P_5 = 0\\\\); total \\\\(= \\\\frac{1}{10}+\\\\frac{1}{10}+\\\\frac{1}{10}+\\\\frac{1}{20} = \\\\frac{7}{20}\\\\) | 1 |\n\n**Alternatif:** Metode grafis (diagram waktu mulai vs padam) diterima penuh bila pembacaan segmen benar.`,
  },

  // ── E6: Pertidaksamaan Irasional (4 sub-soal) ─────────────────────────────
  {
    questionId: "01a11643-0795-7c84-bd40-351836e0abe6",
    title: "Pertidaksamaan irasional (a–d)",
    totalPoints: 12,
    scoringRubric: `Rubrik Penilaian (Total: 12 poin, 3 poin per sub-soal)\n\n**Kriteria umum per sub-soal:**\n- 3 = syarat akar + pembagian kasus ruas kanan + irisan + jawaban akhir benar\n- 2 = proses benar, satu kesalahan kecil\n- 1 = metode pembagian kasus dilakukan tetapi penyelesaian salah\n- 0 = langsung dikuadratkan tanpa pembagian kasus\n\n| Sub-soal | Kunci langkah | Penyelesaian |\n|----------|---------------|--------------|\n| a. \\\\(\\\\sqrt{x^2-x}>x\\\\) | Kasus \\\\(x<0\\\\): terpenuhi; Kasus \\\\(x\\\\geq0\\\\): kuadratkan → \\\\(x<0\\\\) (kontradiksi) | \\\\(x < 0\\\\) |\n| b. \\\\(\\\\sqrt{2x+8}<x\\\\) | Kasus \\\\(x<0\\\\): tidak terpenuhi; Kasus \\\\(x\\\\geq0\\\\): kuadratkan → \\\\(x>4\\\\) | \\\\(x > 4\\\\) |\n| c. \\\\(\\\\sqrt{x}+2>x\\\\) | Ekuivalen \\\\(\\\\sqrt{x}>x-2\\\\); Kasus \\\\(x<2\\\\): \\\\(0\\\\leq x<2\\\\); Kasus \\\\(x\\\\geq2\\\\): \\\\(2\\\\leq x<4\\\\) | \\\\(0 \\\\leq x < 4\\\\) |\n| d. \\\\(4+\\\\sqrt{2x}<x\\\\) | Ekuivalen \\\\(\\\\sqrt{2x}<x-4\\\\); Kasus \\\\(x<4\\\\): tidak terpenuhi; Kasus \\\\(x\\\\geq4\\\\): \\\\(x>8\\\\) | \\\\(x > 8\\\\) |\n\n**Catatan:** Penalaran tentang tanda ruas kanan wajib disebutkan untuk poin penuh.`,
  },
];

async function main() {
  let updated = 0;
  let errors = 0;

  for (const item of BATCH5B_RUBRICS) {
    try {
      const rows = await sql`
        SELECT id, answer_key FROM questions WHERE id = ${item.questionId}
      `;
      if (!rows.length) {
        console.warn(`  [SKIP] ${item.questionId} — not found`);
        continue;
      }
      // answer_key may be stored as a jsonb-wrapped string or a real jsonb object
      let ak: Record<string, any>;
      const raw = rows[0].answer_key;
      if (typeof raw === 'string') {
        try { ak = JSON.parse(raw); } catch { ak = {}; }
      } else {
        ak = (raw as Record<string, any>) || {};
      }
      if (ak.scoringRubric && String(ak.scoringRubric).length > 20) {
        console.log(`  [SKIP] ${item.questionId} — rubric already present (${String(ak.scoringRubric).length} chars)`);
        continue;
      }

      ak.scoringRubric = item.scoringRubric;
      ak.totalPoints = item.totalPoints;

      // Use sql.json() to properly serialize JSONB (not JSON.stringify + cast)
      await sql`
        UPDATE questions
        SET answer_key = ${sql.json(ak)},
            updated_at = NOW()
        WHERE id = ${item.questionId}
      `;
      console.log(`  [OK] ${item.questionId} "${item.title}" — rubric written (${item.totalPoints} pts)`);
      updated++;
    } catch (e: any) {
      console.error(`  [ERR] ${item.questionId}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nBatch 5b R5: updated=${updated} errors=${errors}`);

  const r = await sql`
    SELECT COUNT(*) as cnt FROM questions
    WHERE question_type = 'essay' AND deleted_at IS NULL
    AND answer_key ? 'scoringRubric'
    AND answer_key->>'scoringRubric' IS NOT NULL
    AND length(answer_key->>'scoringRubric') > 0
  `;
  const tot = await sql`SELECT COUNT(*) as cnt FROM questions WHERE question_type='essay' AND deleted_at IS NULL`;
  console.log(`Esai ber-rubrik: ${r[0].cnt} / ${tot[0].cnt}`);

  await sql.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
