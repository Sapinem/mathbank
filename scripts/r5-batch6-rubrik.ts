/**
 * MAT-35 Batch 11 — R5 Essay Scoring Rubrics (Batch 6)
 * 8 esai: Garis Singgung Elips, Kombinatorik Pewarnaan, Relasi Rekurens,
 *         Luas Segitiga (Geo), Nilai Mutlak (SPLA), Nilai Mutlak (Piecewise),
 *         Bilangan Stirling, Faktor Ganjil g(n)
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });

const DRY_RUN = process.env.DRY_RUN !== "0";

interface EssayRubric {
  questionId: string;
  scoringRubric: string;
}

const rubrics: EssayRubric[] = [
  // ── Essay 1: Garis singgung & normal pada elips ──
  {
    questionId: "01a11641-6092-7487-83e1-8f1afbebb861",
    scoringRubric: `**Rubrik Penilaian — Garis Singgung Elips (Total: 10 poin)**

**Langkah 1 — Bentuk kanonik elips** (2 poin)
Mengubah \\(24x^2+30y^2=720\\) menjadi \\(\\dfrac{x^2}{30}+\\dfrac{y^2}{24}=1\\), sehingga \\(a^2=30\\) dan \\(b^2=24\\). (2 poin penuh; 1 poin jika hanya membagi sebagian)

**Langkah 2 — Gradien garis singgung** (1 poin)
Menyatakan gradien garis singgung \\(m=3\\) karena sejajar \\(y=3x\\). (1 poin)

**Langkah 3 — Persamaan garis singgung** (3 poin)
Menggunakan rumus \\(y=mx\\pm\\sqrt{a^2m^2+b^2}\\):
- Menghitung \\(a^2m^2+b^2=30(9)+24=294\\) dengan benar (1 poin)
- Menyederhanakan \\(\\sqrt{294}=7\\sqrt{6}\\) (1 poin)
- Dua persamaan garis singgung: \\(y=3x+7\\sqrt{6}\\) dan \\(y=3x-7\\sqrt{6}\\) (1 poin)

**Langkah 4 — Titik singgung** (2 poin)
Mesubstitusi balik ke persamaan elips untuk menentukan titik singgung \\(\\left(-\\dfrac{7}{\\sqrt{6}},\\ \\dfrac{14}{\\sqrt{6}}\\right)\\) dan konjugatnya. (2 poin; 1 poin jika satu titik benar)

**Langkah 5 — Garis normal** (2 poin)
Menggunakan gradien normal \\(m_n=-\\dfrac{1}{3}\\) dan titik singgung untuk persamaan garis normal. (2 poin penuh; 1 poin jika persamaan ada tetapi belum disederhanakan)`,
  },

  // ── Essay 2: Kombinatorik pewarnaan 2×3 grid ──
  {
    questionId: "01a11589-7fa0-7fd1-9fc3-762bc42dcc1e",
    scoringRubric: `**Rubrik Penilaian — Kombinatorik Pewarnaan Grid 2×3 (Total: 10 poin)**

**Langkah 1 — Interpretasi syarat** (2 poin)
Mengidentifikasi secara eksplisit empat syarat: setiap kolom hitam, setiap baris campuran, setiap petak putih bernilai 3–8, dan jumlah setiap baris = 8. (2 poin; 1 poin jika hanya sebagian syarat disebutkan)

**Langkah 2 — Konfigurasi pola hitam-putih** (2 poin)
Menentukan dengan benar jumlah pola pewarnaan yang memenuhi syarat baris dan kolom. Karena ada 2 baris × 3 kolom, setiap kolom harus punya petak hitam → setiap kolom tepat satu hitam. Baris tiap kolom menentukan konfigurasi. (2 poin)

**Langkah 3 — Penentuan angka pada petak putih** (3 poin)
Untuk setiap konfigurasi hitam-putih, menghitung pasangan angka \\((a_1, a_2, a_3)\\) dan \\((b_1, b_2, b_3)\\) dari himpunan \\(\\{3,4,5,6,7,8\\}\\) dengan syarat jumlah baris = 8. Mencatat bahwa angka berbeda digunakan pada petak putih. (3 poin)

**Langkah 4 — Perhitungan total** (2 poin)
Mengalikan jumlah konfigurasi warna dengan jumlah penugasan angka dan menyatakan jawaban akhir. (2 poin)

**Kelengkapan jawaban** (1 poin)
Menyajikan jawaban akhir dengan jelas dan memeriksa kembali semua syarat terpenuhi. (1 poin)`,
  },

  // ── Essay 3: Relasi rekurens (akar kembar & kompleks) ──
  {
    questionId: "01a1163f-d2c1-7702-82ae-319b54b403b1",
    scoringRubric: `**Rubrik Penilaian — Solusi Relasi Rekurens (Total: 10 poin)**

**Bagian a) \\(a_n=4a_{n-1}-4a_{n-2}\\)** (5 poin)

- **Persamaan karakteristik** (1 poin): Menuliskan \\(r^2-4r+4=0\\) dengan benar.
- **Akar kembar** (1 poin): Mendapat \\(r=2\\) (akar kembar), sehingga solusi umum \\(a_n=(c_1+c_2 n)2^n\\).
- **Substitusi kondisi awal** (2 poin): \\(a_0=6\\Rightarrow c_1=6\\); \\(a_1=8\\Rightarrow (c_1+c_2)\\cdot2=8\\Rightarrow c_2=-2\\). (1 poin per kondisi)
- **Solusi akhir** (1 poin): \\(a_n=(6-2n)\\cdot2^n\\).

**Bagian b) \\(a_n=-4a_{n-1}-4a_{n-2}\\)** (5 poin)

- **Persamaan karakteristik** (1 poin): Menuliskan \\(r^2+4r+4=0\\).
- **Akar kembar** (1 poin): Mendapat \\(r=-2\\) (akar kembar), sehingga solusi umum \\(a_n=(c_1+c_2 n)(-2)^n\\).
- **Substitusi kondisi awal** (2 poin): \\(a_0=0\\Rightarrow c_1=0\\); \\(a_1=1\\Rightarrow c_2(-2)=1\\Rightarrow c_2=-\\dfrac{1}{2}\\). (1 poin per kondisi)
- **Solusi akhir** (1 poin): \\(a_n=-\\dfrac{n}{2}(-2)^n=n\\cdot(-1)^{n+1}\\cdot2^{n-1}\\).`,
  },

  // ── Essay 4: Luas segitiga PQR dalam ABC (Geo) ──
  {
    questionId: "01a11641-ae08-7e5e-b9bd-69b0000c5799",
    scoringRubric: `**Rubrik Penilaian — Luas Segitiga Ceva/Routh (Total: 10 poin)**

**Langkah 1 — Mendefinisikan variabel** (1 poin)
Memisalkan \\(x=\\dfrac{AQ}{AC}\\), \\(y=\\dfrac{BR}{BA}\\), \\(z=\\dfrac{CP}{CB}\\) dengan syarat \\(x+y+z=1\\). (1 poin)

**Langkah 2 — Rumus luas segitiga sub-bagian** (3 poin)
Menggunakan rumus luas segitiga berdasarkan rasio sisi:
- \\([AQR]=xy\\cdot[ABC]\\) (1 poin)
- \\([BPR]=yz\\cdot[ABC]\\) (1 poin)
- \\([CQP]=xz\\cdot[ABC]\\) (1 poin)

**Langkah 3 — Rumus Routh / luas PQR** (3 poin)
Menyatakan \\([PQR]=[ABC]-[AQR]-[BPR]-[CQP]\\):
\\[[PQR]=[ABC](1-xy-yz-xz)\\] (1 poin)
Menggunakan identitas \\((x+y+z)^2=x^2+y^2+z^2+2(xy+yz+xz)=1\\) untuk menyatakan \\(xy+yz+xz\\). (2 poin)

**Langkah 4 — Substitusi dan penyelesaian** (2 poin)
Dari \\([ABC]=20[PQR]\\): \\(20[PQR]=[ABC](1-xy-yz-xz)\\Rightarrow xy+yz+xz=\\dfrac{19}{20}\\).
Menghitung \\(x^2+y^2+z^2=1-2(xy+yz+xz)=1-\\dfrac{19}{10}=-\\dfrac{9}{10}\\)... (2 poin jika logika benar, 1 poin jika langkah sebagian)

**Langkah 5 — Kesimpulan nilai yang ditanya** (1 poin)
Menyatakan \\(\\dfrac{AQ}{QC}+\\dfrac{BR}{RA}+\\dfrac{CP}{PB}\\) dalam bentuk akhir. (1 poin)`,
  },

  // ── Essay 5: Nilai mutlak persamaan (SPLA) ──
  {
    questionId: "01a11642-fb35-782e-ad43-7c666d920758",
    scoringRubric: `**Rubrik Penilaian — Himpunan Penyelesaian Nilai Mutlak (Total: 10 poin)**

**Bagian a) \\(|8-2x|+x-5=0\\)** (4 poin)

- **Kasus 1** \\(x\\leq4\\): \\(|8-2x|=8-2x\\); menyelesaikan \\((8-2x)+x-5=0\\Rightarrow x=3\\). Memverifikasi \\(3\\leq4\\) ✓. (2 poin)
- **Kasus 2** \\(x>4\\): \\(|8-2x|=2x-8\\); menyelesaikan \\((2x-8)+x-5=0\\Rightarrow x=\\dfrac{13}{3}\\). Memverifikasi \\(\\dfrac{13}{3}>4\\) ✓. (2 poin)
- **HP = \\(\\{3,\\ \\dfrac{13}{3}\\}\\)**. (0 poin jika keduanya salah)

**Bagian b) \\(|3x-5|-|10x-2|+|2x-8|=0\\)** (6 poin)

- **Titik kritis yang benar**: \\(x=\\dfrac{5}{3}\\), \\(x=\\dfrac{1}{5}\\), \\(x=4\\). (1 poin)
- **Kasus per interval** (4 poin — 1 poin per kasus):
  - \\(x<\\dfrac{1}{5}\\): tanda semua tiga suku; menyelesaikan dan memeriksa.
  - \\(\\dfrac{1}{5}\\leq x<\\dfrac{5}{3}\\): menyesuaikan tanda.
  - \\(\\dfrac{5}{3}\\leq x<4\\): menyesuaikan tanda.
  - \\(x\\geq4\\): semua positif; menyelesaikan.
- **HP akhir** yang benar (1 poin).`,
  },

  // ── Essay 6: Nilai mutlak piecewise (4 kasus) ──
  {
    questionId: "01a11642-d606-7a6c-af54-8e35029578a7",
    scoringRubric: `**Rubrik Penilaian — Bentuk Sederhana Nilai Mutlak Piecewise (Total: 10 poin)**

Setiap kasus bernilai 2,5 poin (atau 2+3 poin jika terdapat bobot beda):

**Kasus a) \\(x<-2\\)** (2,5 poin)
- Menentukan tanda: \\(|x-1|=-(x-1)\\), \\(|x+2|=-(x+2)\\), \\(|9-3x|=9-3x\\). (1 poin)
- Menghitung: \\(-(x-1)-(x+2)-(9-3x)=x-10\\). (1,5 poin)

**Kasus b) \\(-2<x<1\\)** (2,5 poin)
- Menentukan tanda: \\(|x-1|=-(x-1)\\), \\(|x+2|=x+2\\), \\(|9-3x|=9-3x\\). (1 poin)
- Menghitung: \\(-(x-1)+(x+2)-(9-3x)=3x-6\\). (1,5 poin)

**Kasus c) \\(1<x<3\\)** (2,5 poin)
- Menentukan tanda: \\(|x-1|=x-1\\), \\(|x+2|=x+2\\), \\(|9-3x|=9-3x\\). (1 poin)
- Menghitung: \\((x-1)+(x+2)-(9-3x)=5x-8\\). (1,5 poin)

**Kasus d) \\(x>3\\)** (2,5 poin)
- Menentukan tanda: \\(|x-1|=x-1\\), \\(|x+2|=x+2\\), \\(|9-3x|=3x-9\\). (1 poin)
- Menghitung: \\((x-1)+(x+2)-(3x-9)=10-x\\). (1,5 poin)

*Pengurangan 0,5 poin per kasus jika tanda benar tetapi aritmetika salah.*`,
  },

  // ── Essay 7: Bilangan Stirling jenis kedua ──
  {
    questionId: "01a1163f-8b88-7295-8573-21c290c51a97",
    scoringRubric: `**Rubrik Penilaian — Bilangan Stirling Jenis Kedua (Total: 10 poin)**

**Bagian a) Membuktikan \\(S(n, n-1) = \\binom{n}{2}\\)** (4 poin)

- **Interpretasi kombinatorial** (2 poin): Mempartisi \\(n\\) elemen menjadi \\(n-1\\) subset nonempty berarti tepat satu subset berukuran 2, sisanya berukuran 1. (2 poin)
- **Menghitung cara memilih pasangan** (1 poin): Ada \\(\\binom{n}{2}\\) cara memilih dua elemen untuk subset berukuran 2. (1 poin)
- **Kesimpulan** (1 poin): \\(S(n,n-1)=\\binom{n}{2}\\). (1 poin)

**Bagian b) Rumus rekurens atau formula eksplisit** (3 poin)

- Menyatakan relasi rekurens \\(S(n,k)=k\\cdot S(n-1,k)+S(n-1,k-1)\\) dengan benar dan penjelasan mengapa (menambahkan elemen ke kelas lama vs kelas baru). (3 poin; 2 poin tanpa bukti, 1 poin jika rumus saja)

**Bagian c) Perhitungan contoh** (2 poin)
Menghitung \\(S(4,2)=7\\) atau nilai lain yang diminta dengan menggunakan tabel atau rekurens. (2 poin; 1 poin jika proses benar tetapi angka salah)

**Penulisan notasi** (1 poin)
Menggunakan notasi \\(\\left\\{\\begin{array}{c}n\\\\k\\end{array}\\right\\}\\) secara konsisten. (1 poin)`,
  },

  // ── Essay 8: Faktor ganjil terbesar g(n), g(2019)+...+g(4038) ──
  {
    questionId: "01a11642-902b-7a8c-abd6-acdf33adb109",
    scoringRubric: `**Rubrik Penilaian — Faktor Ganjil Terbesar \\(g(n)\\) (Total: 10 poin)**

**Langkah 1 — Kasus n ganjil** (2 poin)
Menyatakan \\(g(n)=n\\) untuk n ganjil. Menghitung jumlah \\(g(2019)+g(2021)+\\cdots+g(4037)=2019+2021+\\cdots+4037\\) menggunakan rumus deret aritmetika: \\(2019^2-1009^2\\). (2 poin)

**Langkah 2 — Kasus n genap: klasifikasi modulo 8** (3 poin)
Membagi n genap menjadi kasus berdasarkan sisa bagi 8:
- \\(n\\equiv 2\\pmod{8}\\) atau \\(n\\equiv 6\\pmod{8}\\): \\(g(n)=n/2\\) (ganjil). (1 poin)
- \\(n\\equiv 4\\pmod{8}\\): \\(g(n)=n/4\\) (perlu diperiksa). (1 poin)
- \\(n\\equiv 0\\pmod{8}\\): \\(g(n)=n/8\\) (atau lebih lanjut). (1 poin)

**Langkah 3 — Penjumlahan sub-kasus genap** (3 poin)
Menghitung secara terpisah kontribusi setiap kelas modulo 8 pada rentang [2020, 4038] dan menjumlahkannya. (3 poin; 1 poin per kelas yang benar)

**Langkah 4 — Total akhir** (2 poin)
Menjumlahkan semua bagian (ganjil + genap) dan menyatakan jawaban numerik akhir secara eksplisit. (2 poin; 1 poin jika proses benar tetapi kesalahan aritmetika kecil)`,
  },
];

async function main() {
  console.log(`MAT-35 Batch 11 — R5 Essay Rubrics Batch 6 (DRY_RUN=${DRY_RUN})`);
  console.log(`Rubrics to apply: ${rubrics.length}\n`);

  let applied = 0;
  for (const r of rubrics) {
    const rows = await sql`
      SELECT id, answer_key FROM questions WHERE id = ${r.questionId}
    `;
    if (!rows.length) {
      console.warn(`  SKIP: ${r.questionId} not found`);
      continue;
    }
    const ak = rows[0].answer_key as Record<string, unknown> ?? {};
    const updated = { ...ak, scoringRubric: r.scoringRubric };

    if (DRY_RUN) {
      console.log(`  DRY_RUN: ${r.questionId} — rubric length ${r.scoringRubric.length} chars`);
      continue;
    }

    await sql`
      UPDATE questions
      SET answer_key = ${sql.json(updated)}::jsonb,
          updated_at = NOW()
      WHERE id = ${r.questionId}
    `;
    console.log(`  LIVE: ${r.questionId} rubric applied (${r.scoringRubric.length} chars)`);
    applied++;
  }

  const after = await sql`
    SELECT COUNT(*) AS cnt FROM questions
    WHERE question_type='essay'
    AND jsonb_typeof(answer_key)='object'
    AND answer_key->>'scoringRubric' IS NOT NULL
    AND length(answer_key->>'scoringRubric') > 10
  `;
  console.log(`\nAfter: ${after[0].cnt} essays with scoringRubric`);
  if (!DRY_RUN) console.log(`Applied: ${applied} rubrics`);

  await sql.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
