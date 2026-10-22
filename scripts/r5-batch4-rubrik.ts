/**
 * MAT-35 Batch R5-4 — Rubrik Penilaian Esai (lanjutan)
 * 6 soal esai tingkat lanjut (diff=5, UTBK/Olimpiade).
 * Format: answer_key.scoringRubric (markdown, poin per langkah).
 * Target: questions.answer_key JSONB field 'scoringRubric'.
 */

import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2 });
const DRY_RUN = process.env.DRY_RUN !== "0";

const RUBRICS: Record<string, string> = {

  // Soal: Fungsi pembangkit kendaraan (s≥1, b≤10, 2≤t≤15), koefisien x^10
  "01a11645-2357-7758-bee5-8f83ae725151": `## Rubrik Penilaian — Fungsi Pembangkit Kendaraan

**Skor Maksimum: 10 poin**

| Langkah | Kriteria | Poin |
|---------|----------|------|
| 1 | Mendefinisikan variabel s, b, t dengan benar dan menyatakan syarat \`s≥1, b≤10, 2≤t≤15\` | 1 |
| 2 | Mengidentifikasi bahwa kendaraan sejenis dianggap sama → kombinasi (bukan permutasi) | 1 |
| 3 | Menuliskan fungsi pembangkit untuk sedan: \\(x + x^2 + \\cdots = \\dfrac{x}{1-x}\\) | 2 |
| 4 | Menuliskan fungsi pembangkit untuk bus: \\(1 + x + \\cdots + x^{10} = \\dfrac{1-x^{11}}{1-x}\\) | 2 |
| 5 | Menuliskan fungsi pembangkit untuk truk: \\(x^2 + x^3 + \\cdots + x^{15} = \\dfrac{x^2(1-x^{14})}{1-x}\\) | 2 |
| 6 | Mengalikan ketiga fungsi dan mengekstrak koefisien \\(x^{10}\\) dengan benar | 2 |

**Catatan**: Kesalahan pada langkah 3–5 (fungsi pembangkit tidak tepat) → potong 1 poin per fungsi. Jika metode alternatif (rekursif/DP) digunakan dengan benar, skor penuh tetap diberikan.`,

  // Soal: Gabungan dan irisan A_k = (0, 1/k) untuk k=1..10
  "01a11645-0d0e-78e8-b12e-2a2a0cbc6893": `## Rubrik Penilaian — Gabungan dan Irisan Himpunan A_k

**Skor Maksimum: 10 poin**

| Langkah | Kriteria | Poin |
|---------|----------|------|
| 1 | Menyatakan \\(A_k = \\left(0, \\dfrac{1}{k}\\right)\\) dengan benar dan memahami notasi interval terbuka | 1 |
| 2 | Menentukan \\(\\bigcup_{k=1}^{10} A_k = (0, 1)\\) dengan argumen bahwa \\(A_1 \\supseteq A_k\\) untuk semua \\(k\\) | 3 |
| 3 | Menentukan \\(\\bigcap_{k=1}^{10} A_k = \\left(0, \\dfrac{1}{10}\\right)\\) karena \\(A_{10}\\) adalah himpunan terkecil | 3 |
| 4 | Menghitung \\(\\left(\\bigcup A_k\\right) \\setminus \\left(\\bigcap A_k\\right) = \\left[\\dfrac{1}{10}, 1\\right)\\) atau pernyataan yang benar | 2 |
| 5 | Penulisan jawaban lengkap dan formal dengan notasi himpunan yang tepat | 1 |

**Catatan**: Kesalahan batas tertutup/terbuka (mis. menulis \\([0,1]\\) bukan \\((0,1)\\)) → potong 1 poin. Argumen inklusif harus eksplisit.`,

  // Soal: Matriks A,B ∈ R^{2017×2017}, A^{-1}=(A+B)^{-1}-B^{-1} → det(A+B)?
  "01a11645-33a4-72c2-85d0-814d302b184d": `## Rubrik Penilaian — Matriks A,B dengan Relasi Invers

**Skor Maksimum: 10 poin**

| Langkah | Kriteria | Poin |
|---------|----------|------|
| 1 | Menyatakan \\(A^{-1} + B^{-1} = A^{-1}(A+B)B^{-1}\\) dari manipulasi aljabar matriks | 2 |
| 2 | Substitusi \\(A^{-1} = (A+B)^{-1} - B^{-1}\\) ke dalam persamaan dan menyederhanakan | 2 |
| 3 | Memperoleh \\(A^{-1}(A+B)B^{-1} = (A+B)^{-1}\\) | 2 |
| 4 | Mengambil determinan kedua ruas dan menggunakan \\(\\det(XY) = \\det(X)\\det(Y)\\) | 2 |
| 5 | Menyimpulkan \\(\\det(A+B)\\) dengan benar dari persamaan determinan | 2 |

**Catatan**: Karena matriks tidak komutatif, urutan perkalian harus dipertahankan. Mengabaikan urutan → potong 2 poin. Jika siswa menggunakan contoh numerik tanpa bukti umum → maksimal 4 poin.`,

  // Soal: Buktikan Teorema Barisan Konvergen (X→x, Y→y ⟺ X±Y→x±y)
  "01a11645-2789-72f8-8603-a1737349265a": `## Rubrik Penilaian — Bukti Teorema Barisan Konvergen

**Skor Maksimum: 10 poin**

| Langkah | Kriteria | Poin |
|---------|----------|------|
| 1 | Ambil \\(\\varepsilon > 0\\) sembarang; eksplisit memilih \\(\\varepsilon/2\\) sebagai batas untuk masing-masing barisan | 1 |
| 2 | Karena \\(X \\to x\\): ∃ \\(k_0\\) sehingga \\(n \\geq k_0 \\Rightarrow |x_n - x| < \\varepsilon/2\\) | 2 |
| 3 | Karena \\(Y \\to y\\): ∃ \\(l_0\\) sehingga \\(n \\geq l_0 \\Rightarrow |y_n - y| < \\varepsilon/2\\) | 2 |
| 4 | Untuk \\(n \\geq \\max(k_0, l_0)\\): aplikasi ketidaksamaan segitiga \\(|(x_n \\pm y_n) - (x \\pm y)| \\leq |x_n-x| + |y_n-y| < \\varepsilon\\) | 3 |
| 5 | Menyimpulkan \\(X \\pm Y \\to x \\pm y\\) secara formal dengan pernyataan \\(\\forall\\varepsilon>0, \\exists N...\\) | 2 |

**Catatan**: Bukti harus arah dua-arah (⟺) atau setidaknya satu arah penuh. Hanya memberikan contoh numerik tanpa epsilon-delta → maks 3 poin.`,

  // Soal: K,L subruang V, dim(K)=dim(L)=4, K≠L → dim(V)≥?
  "01a11645-320c-7631-b4b2-fa49b799da69": `## Rubrik Penilaian — Dimensi Ruang Vektor V dengan Dua Subruang

**Skor Maksimum: 10 poin**

| Langkah | Kriteria | Poin |
|---------|----------|------|
| 1 | Menyatakan \\(\\dim(K), \\dim(L) \\leq \\dim(V)\\) dan implikasinya \\(\\dim(V) \\geq 4\\) | 1 |
| 2 | Bukti kontradiksi: andaikan \\(\\dim(V) = 4\\), maka \\(K = L = V\\) (kontradiksi \\(K \\neq L\\)) | 3 |
| 3 | Menyimpulkan \\(\\dim(V) \\geq 5\\) | 2 |
| 4 | Konstruksi contoh: \\(V = \\mathbb{R}^5\\), \\(K = \\ker(e_5^T)\\), \\(L = \\ker(e_4^T)\\) — atau contoh subruang konkret lain dengan dim=4 dan \\(K \\neq L\\) | 3 |
| 5 | Menyatakan jawaban akhir \\(\\dim(V) \\geq 5\\) secara eksplisit | 1 |

**Catatan**: Jika siswa hanya membuktikan \\(\\geq 4\\) tanpa memperketat ke \\(\\geq 5\\) → maks 5 poin. Contoh konkret (langkah 4) wajib untuk skor penuh.`,

  // Soal: a(dy/dx) + by = ke^{-λx}, cari solusi umum ODE linear orde satu
  "01a11645-2fa9-771b-be50-bfdd1204b081": `## Rubrik Penilaian — ODE Linear Orde Satu: a(dy/dx) + by = ke^{-λx}

**Skor Maksimum: 10 poin**

| Langkah | Kriteria | Poin |
|---------|----------|------|
| 1 | Membagi kedua ruas dengan \\(a\\): \\(\\dfrac{dy}{dx} + \\dfrac{b}{a}y = \\dfrac{k}{a}e^{-\\lambda x}\\) | 1 |
| 2 | Mengidentifikasi \\(p(x) = b/a\\) dan menghitung faktor integrasi \\(\\mu = e^{\\int p\\,dx} = e^{bx/a}\\) | 2 |
| 3 | Mengalikan kedua ruas dengan \\(\\mu\\) dan menyatakan sebagai \\(\\dfrac{d}{dx}(ye^{bx/a}) = \\dfrac{k}{a}e^{(b/a-\\lambda)x}\\) | 2 |
| 4 | Mengintegralkan kedua ruas dengan benar (membedakan kasus \\(b/a = \\lambda\\) dan \\(b/a \\neq \\lambda\\)) | 3 |
| 5 | Menuliskan solusi umum lengkap \\(y(x)\\) dengan konstanta integrasi \\(C\\) | 2 |

**Catatan**: Kasus \\(b = a\\lambda\\) harus ditangani terpisah (menghasilkan \\(kx/a \\cdot e^{-\\lambda x} + Ce^{-bx/a}\\)). Tidak membedakan kasus → potong 2 poin.`,
};

async function main() {
  if (DRY_RUN) {
    console.log("=== DRY RUN ===");
    Object.entries(RUBRICS).forEach(([id, rubric]) => {
      console.log(`\n${id}: ${rubric.length} chars`);
      console.log(rubric.substring(0, 100) + "...");
    });
    return;
  }

  console.log("=== LIVE RUN ===");
  let updated = 0;

  for (const [questionId, rubric] of Object.entries(RUBRICS)) {
    const rows = await sql`
      SELECT answer_key FROM questions WHERE id = ${questionId}::uuid
    `;
    if (!rows.length) {
      console.warn(`  [SKIP] ${questionId} tidak ditemukan`);
      continue;
    }

    const currentKey = rows[0].answer_key as Record<string, unknown>;
    const updatedKey = { ...currentKey, scoringRubric: rubric };

    await sql`
      UPDATE questions
      SET answer_key = ${sql.json(updatedKey)}::jsonb,
          updated_at = NOW()
      WHERE id = ${questionId}::uuid
    `;
    updated++;
    console.log(`  [OK] ${questionId} — rubrik ${rubric.length} chars`);
  }

  console.log(`\nSelesai: ${updated} esai diupdate.`);
  await sql.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
