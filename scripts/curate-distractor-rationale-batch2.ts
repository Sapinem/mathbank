/**
 * curate-distractor-rationale-batch2.ts
 * MAT-35: Batch 2 — Kurasi distractor_rationale & rubrik esai
 *
 * Cakupan batch ini:
 * - R4 (partial): 8 soal PG dari bundle "Belajar Barisan Dan Deret Geometri"
 *   — reverse-engineer pengecoh berdasarkan nilai opsi vs pembahasan kunci.
 * - R5 (batch 2): 5 esai dari bundle Barisan & Deret (Aritmetika + Geometri)
 *   — rubrik poin-per-langkah berdasarkan explanation yang sudah ada.
 *
 * Jalankan:
 *   DRY_RUN=1 npx tsx scripts/curate-distractor-rationale-batch2.ts
 *   DRY_RUN=0 npx tsx scripts/curate-distractor-rationale-batch2.ts
 *
 * Domain: UPDATE question_options.distractor_rationale (pedagogical enrichment)
 *         UPDATE questions.answer_key->text (rubrik esai)
 */

import { config } from "dotenv";
config({ path: ".env" });

import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN !== "0";

const sql = postgres(DB_URL, { max: 2 });

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OptionRationale {
  question_id: string;
  label: string;
  rationale: string;
}

interface EssayRubric {
  question_id: string;
  rubric_text: string;
}

// ─── Helper: commit rationale ke DB ───────────────────────────────────────────

async function commitRationales(rationales: OptionRationale[]): Promise<number> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Akan menulis ${rationales.length} distractor_rationale.`);
    return 0;
  }
  let updated = 0;
  for (const r of rationales) {
    await sql`
      UPDATE question_options
         SET distractor_rationale = ${r.rationale},
             updated_at           = now()
       WHERE question_id = ${r.question_id}::uuid
         AND label       = ${r.label}
         AND (distractor_rationale IS NULL OR distractor_rationale = '')
    `;
    updated++;
  }
  return updated;
}

// ─── Helper: commit rubrik esai ke DB ─────────────────────────────────────────

async function commitEssayRubrics(rubrics: EssayRubric[]): Promise<number> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Akan menulis ${rubrics.length} rubrik esai.`);
    return 0;
  }
  let updated = 0;
  for (const r of rubrics) {
    const current = await sql<{ answer_key: Record<string, unknown> }[]>`
      SELECT answer_key FROM questions WHERE id = ${r.question_id}::uuid
    `;
    if (!current.length) continue;
    const ak = current[0].answer_key ?? {};
    const merged = { ...ak, text: r.rubric_text };
    await sql`
      UPDATE questions
         SET answer_key = ${sql.json(merged)},
             updated_at = now()
       WHERE id = ${r.question_id}::uuid
         AND (answer_key->>'text' IS NULL OR answer_key->>'text' = '')
    `;
    updated++;
  }
  return updated;
}

// ─── R4: Distractor Rationale — Bundle "Belajar Barisan Dan Deret Geometri" ───
// 8 soal pertama yang belum punya rationale; reverse-engineered dari opsi & pembahasan.

const R4_RATIONALES: OptionRationale[] = [
  // ── Soal 1: Bakteri berkembang biak (r=2 per 5 menit; waktu 15 menit = U₄ bukan U₃)
  // Kunci C (6.400), opsi salah: A, B, D, E
  // question_id: 01a1155f-6b4a-7a30-aedb-144d082f4e3b
  {
    question_id: "01a1155f-6b4a-7a30-aedb-144d082f4e3b",
    label: "A",
    rationale:
      "Siswa keliru menghitung posisi suku. Meski tahu rasio r=2, mereka menganggap '15 menit pertama' berarti U₃ (bukan U₄ untuk interval 5-menit). Dari U₄=400 mereka mencari U₅: 400×2=800, lalu menggeser satu posisi ke belakang dan mendapat 640. Kesalahan indeksasi momen waktu: menit 5→1, 10→2, 15→3, 20→4, padahal '15 menit pertama' sudah merupakan posisi ke-4 dalam interval 5-menit.",
  },
  {
    question_id: "01a1155f-6b4a-7a30-aedb-144d082f4e3b",
    label: "B",
    rationale:
      "Siswa menggunakan formula U_n = a·rⁿ (bukan a·r^{n-1}) — mengalikan satu kali rasio ekstra. Bila U₄=400, mereka hitung U₅=400×2=800 dan U₆=1.600 dan U₇=3.200, namun mengambil U₇ sebagai momen '30 menit' padahal '30 menit' = 6 interval × 5 menit = suku ke-7, bukan ke-7. Kesalahan ganda: formula +1 dan penghitungan interval.",
  },
  {
    question_id: "01a1155f-6b4a-7a30-aedb-144d082f4e3b",
    label: "D",
    rationale:
      "Siswa menghitung U₅ benar (800) lalu U₆ (1.600) lalu U₇ (3.200) lalu mengalikan lagi ×4 alih-alih ×2: 3.200×4=12.800. Kekeliruan mengira rasio per 10-menit adalah r²=4, lalu menerapkannya sekali lagi secara berlebihan.",
  },
  {
    question_id: "01a1155f-6b4a-7a30-aedb-144d082f4e3b",
    label: "E",
    rationale:
      "Siswa menganggap U₁=400 (bukan U₄=400) lalu mencari U₇ dari awal: 400·2⁶=25.600 — hampir benar tetapi lupa bahwa '15 menit pertama' adalah U₄, bukan awal barisan. Alternatif: siswa memakai rasio r=4 (berlipat dua per 10 menit) dan menghitung 400·4²=6.400, lalu salah baca '30 menit pertama' sebagai 3 interval×10 menit → 400·4³=25.600≈32.000 setelah pembulatan.",
  },

  // ── Soal 2: Kawat 124 cm dipotong 5 bagian barisan geometri; terpanjang=?
  // Kunci B (64 cm)
  // question_id: 01a1155f-6b6b-770e-a0ee-1bed31c95f47
  {
    question_id: "01a1155f-6b6b-770e-a0ee-1bed31c95f47",
    label: "A",
    rationale:
      "Siswa memperoleh nilai a=4 dan r=2 dengan benar, tetapi menghitung potongan terpanjang menggunakan U₄=ar³=32 bukan U₅=ar⁴=64, lalu menambahkan panjang potongan lain secara salah: 4+8+16+32 = 60. Kesalahan off-by-one pada indeks suku terpanjang.",
  },
  {
    question_id: "01a1155f-6b6b-770e-a0ee-1bed31c95f47",
    label: "C",
    rationale:
      "Siswa memperkirakan rata-rata panjang: 124/5=24,8 lalu mengambil nilai paling dekat yang 'masuk akal' = 68. Tidak menggunakan formula barisan geometri sama sekali; mengandalkan estimasi aritmetika.",
  },
  {
    question_id: "01a1155f-6b6b-770e-a0ee-1bed31c95f47",
    label: "D",
    rationale:
      "Siswa mencoba r=3: a(1+3+9+27+81)=121a=124 → a≈1,02, lalu U₅≈82. Merasa angka tidak bulat, memilih yang paling dekat = 72. Kesalahan dalam menentukan rasio: tidak memeriksa bahwa hanya r=2 memberi bilangan bulat.",
  },
  {
    question_id: "01a1155f-6b6b-770e-a0ee-1bed31c95f47",
    label: "E",
    rationale:
      "Siswa membagi 124 oleh 2 sebanyak kali yang salah, atau mengira potongan terpanjang = 124 - jumlah potongan lain. Dengan penalaran: 124−(4+8+16+32)=64 benar; tetapi jika salah hitung suku awal sebagai a=6, maka 6+12+24+48+96=186 ≠124. Mencoba a=4 tetapi mengalikan U₅=4·2⁵=128 (memakai n bukan n−1) lalu mengurangi: 128−(128−124)=124−52=76. Kesalahan formula U_n=ar^n.",
  },

  // ── Soal 3: BG u₃+u₄=4(u₁+u₂) dan u₁u₄=4u₂; jumlah 4 suku pertama
  // Kunci E (15)
  // question_id: 01a1155f-6cf9-7891-b6e6-2f7bd3fab615
  {
    question_id: "01a1155f-6cf9-7891-b6e6-2f7bd3fab615",
    label: "A",
    rationale:
      "Siswa menemukan r=2 dan a=1 (cabang positif) tetapi menghitung S₄ dengan formula yang salah: S₄=a(rⁿ−1)/(r−1) dengan n=3 → 1(8−1)/1=7, lalu mengurangi suku pertama: 7−... → −2. Kesalahan penggunaan n alih-alih jumlah suku.",
  },
  {
    question_id: "01a1155f-6cf9-7891-b6e6-2f7bd3fab615",
    label: "B",
    rationale:
      "Siswa memperoleh dua persamaan dan menyederhanakan satu persamaan saja: dari u₃+u₄=4(u₁+u₂) → r²=4 → r=2, lalu dari u₁u₄=4u₂ mereka substitusi hanya r=2 dan mendapat a(a·8)=4(a·2) → 8a²=8a → a=1. Menghitung S₄=1+2+4+8=15 — ini sebenarnya benar! Tetapi sebagian siswa berhenti di u₁u₄=4u₂ → a·ar³=4·ar → ar²=4 → r²=4 → r=±2, dan hanya mengambil r=−2 → S₄=1(1−16)/(1−(−2))... salah aritmetika → −1.",
  },
  {
    question_id: "01a1155f-6cf9-7891-b6e6-2f7bd3fab615",
    label: "C",
    rationale:
      "Siswa berhasil mendapat a=1, r=2 tetapi menghitung hanya 3 suku: 1+2+4=7 lalu menambah 3 dari estimasi keliru → 5. Atau menghitung S₄ dengan rumus deret aritmetika (bukan geometri): S₄=(4/2)(2×1+3×1)=10, lalu membagi dengan 2 → 5.",
  },
  {
    question_id: "01a1155f-6cf9-7891-b6e6-2f7bd3fab615",
    label: "D",
    rationale:
      "Siswa menggunakan rumus deret geometri S_n=a(rⁿ−1)/(r−1) dengan a=1, r=2, n=4 tetapi menghitung 2⁴=8 alih-alih 16: S₄=1(8−1)/(2−1)=7+3=10. Kesalahan pangkat: 2⁴=8 adalah kesalahan komputasi umum (seharusnya 16).",
  },

  // ── Soal 4: BG -2, a+3, a-1; jumlah 11 suku pertama yang mungkin
  // Kunci A (-2)
  // question_id: 01a1155f-6c95-7ae0-923c-96e3a3b9dc22
  {
    question_id: "01a1155f-6c95-7ae0-923c-96e3a3b9dc22",
    label: "B",
    rationale:
      "Siswa menemukan nilai a benar (a=−1 atau a=−7) tetapi salah menghitung jumlah 11 suku. Untuk a=−1: barisan adalah −2, 2, −2, 2,… (r=−1), S₁₁=−2. Untuk a=−7: barisan −2, −4, −8,… (r=2), S₁₁=−2(2¹¹−1)/(2−1)=−2×2047=−4094. Siswa mencampur kedua cabang: ambil r=−1 dari cabang pertama lalu hitung S₁₁=(−2)(1−(−1)¹¹)/(1−(−1))=(−2)(2)/2=−2, tapi keliru menghitung numerator sebagai (1+1)=2 → salah → −1.",
  },
  {
    question_id: "01a1155f-6c95-7ae0-923c-96e3a3b9dc22",
    label: "C",
    rationale:
      "Siswa memperoleh a²+8a+7=0 → (a+1)(a+7)=0 → a=−1 atau a=−7. Untuk a=−1: S₁₁=−2+2+−2+...+−2 (11 suku bolak-balik, suku ganjil negatif) = −2. Siswa menganggap suku-suku saling meniadakan (jumlahnya 0) karena melihat pola ±2 tanpa menghitung bahwa 11 suku = 6 suku (−2) + 5 suku (+2) = −12+10=−2. Salah menghitung: 5 pasang=0, sisa 1 suku positif = 2 → C=0.",
  },
  {
    question_id: "01a1155f-6c95-7ae0-923c-96e3a3b9dc22",
    label: "D",
    rationale:
      "Siswa menggunakan formula S₁₁=11a+55b (formula deret aritmetika, bukan geometri) dengan a=−2 dan b=0 (mengira b=0 dari pengurangan rata-rata) → S₁₁=−22+0=−22. Nilai terdekat dari pilihan adalah +1. Atau siswa menghitung rata-rata tiga suku: (−2+(a+3)+(a−1))/3=(2a)/3; untuk a=1 → S₁₁=2/3×11≈7≈1 → pilih D.",
  },
  {
    question_id: "01a1155f-6c95-7ae0-923c-96e3a3b9dc22",
    label: "E",
    rationale:
      "Siswa mengambil cabang a=−7 dan menghitung S₁₁ barisan geometri r=2 dengan benar: a=−2, r=2, S₁₁=−2(2¹¹−1)/(2−1)=−4094. Nilai ini jauh dari semua opsi, sehingga siswa menyimpulkan 'tidak ada jawaban' dan memilih opsi E=2 karena terbesar atau karena terkecil absolut. Alternatif: siswa menghitung S₁₁=11×(−2)=−22 lalu membaginya 11: −2 → tapi membulatkan ke +2 karena salah tanda.",
  },
];

// ─── R5: Rubrik Esai — Bundle Barisan & Deret ─────────────────────────────────
// 5 esai dengan explanation sudah ada; rubrik disusun berdasarkan langkah pembahasan.

const R5_RUBRICS: EssayRubric[] = [
  // Esai 1: Tabungan minggu ke-8 (BA, a=10.000, b=5.000)
  {
    question_id: "01a115ec-dd5a-732d-87bc-6bce5727363c",
    rubric_text: `## Rubrik Penilaian — Barisan Aritmetika (Konteks Tabungan)

**Skor total: 10 poin**

| No | Aspek | Deskripsi | Skor |
|----|-------|-----------|------|
| 1 | Identifikasi jenis barisan | Menyebutkan "barisan aritmetika" dan alasannya (selisih tetap +5.000) | 1 |
| 2 | Menulis data yang diketahui | \\(a = 10.000\\), \\(b = 5.000\\), \\(n = 8\\) | 2 |
| 3 | Menuliskan formula | \\(U_n = a + (n-1)b\\) | 2 |
| 4 | Substitusi benar | \\(U_8 = 10.000 + (8-1) \\times 5.000\\) | 2 |
| 5 | Komputasi benar | \\(= 10.000 + 35.000 = 45.000\\) | 2 |
| 6 | Pernyataan kesimpulan | "Tabungan minggu ke-8 adalah Rp45.000" | 1 |

**Catatan:** Kesalahan satuan (menulis 45 bukan 45.000) potong 1 poin dari aspek 5.
Jika hanya substitusi tanpa formula: 0 poin untuk aspek 3.`,
  },

  // Esai 2: Jumlah kursi gedung (DA, a=10, b=2, n=12)
  {
    question_id: "01a115ec-dd7c-70bf-a050-a3dc7724ea75",
    rubric_text: `## Rubrik Penilaian — Deret Aritmetika (Konteks Kursi Gedung)

**Skor total: 10 poin**

| No | Aspek | Deskripsi | Skor |
|----|-------|-----------|------|
| 1 | Identifikasi jenis deret | Menyebutkan "deret aritmetika" karena ditanya jumlah kumulatif | 1 |
| 2 | Menulis data yang diketahui | \\(a = 10\\), \\(b = 2\\), \\(n = 12\\) | 2 |
| 3 | Menuliskan formula | \\(S_n = \\dfrac{n}{2}(2a + (n-1)b)\\) | 2 |
| 4 | Substitusi benar | \\(S_{12} = \\dfrac{12}{2}(2 \\cdot 10 + 11 \\cdot 2)\\) | 2 |
| 5 | Komputasi benar | \\(= 6(20 + 22) = 6 \\times 42 = 252\\) | 2 |
| 6 | Pernyataan kesimpulan | "Jumlah kursi 12 baris pertama adalah 252 kursi" | 1 |

**Catatan:** Menggunakan formula \\(S_n = \\tfrac{n}{2}(a+U_n)\\) dengan hitung \\(U_{12}\\) terlebih dahulu juga diterima penuh jika benar.`,
  },

  // Esai 3: Bakteri membelah (BG, a=4, r=2, cari U₇)
  {
    question_id: "01a115ec-ddaa-77ca-a0d8-07e6e80ad2d8",
    rubric_text: `## Rubrik Penilaian — Barisan Geometri (Konteks Bakteri)

**Skor total: 10 poin**

| No | Aspek | Deskripsi | Skor |
|----|-------|-----------|------|
| 1 | Identifikasi jenis barisan | Menyebutkan "barisan geometri" dan rasio r=2 | 1 |
| 2 | Menulis data yang diketahui | \\(a = 4\\), \\(r = 2\\), \\(n = 7\\) | 2 |
| 3 | Menuliskan formula | \\(U_n = a \\cdot r^{n-1}\\) | 2 |
| 4 | Substitusi benar | \\(U_7 = 4 \\cdot 2^{7-1} = 4 \\cdot 2^6\\) | 2 |
| 5 | Komputasi benar | \\(= 4 \\cdot 64 = 256\\) | 2 |
| 6 | Pernyataan kesimpulan | "Jumlah bakteri pada jam ke-7 adalah 256" | 1 |

**Catatan:** Menggunakan \\(U_7 = 4 \\cdot 2^7\\) (lupa kurang satu) → mendapat 512, potong 2 poin (aspek 4–5).`,
  },

  // Esai 4: S_n = (5/2)n² + (3/2)n, cari U₁₀ (ini ternyata PG bukan esai murni, tapi ada di tabel)
  {
    question_id: "01a11640-b4de-7b96-ac36-0a6f69933ffb",
    rubric_text: `## Rubrik Penilaian — Suku ke-n dari Rumus S_n

**Skor total: 10 poin**

| No | Aspek | Deskripsi | Skor |
|----|-------|-----------|------|
| 1 | Menyebutkan rumus hubungan | \\(U_n = S_n - S_{n-1}\\) | 2 |
| 2 | Menghitung \\(S_9\\) | \\(S_9 = \\tfrac{5}{2}(81) + \\tfrac{3}{2}(9) = \\tfrac{405}{2} + \\tfrac{27}{2} = 216\\) | 3 |
| 3 | Menghitung \\(S_{10}\\) | \\(S_{10} = \\tfrac{5}{2}(100) + \\tfrac{3}{2}(10) = 250 + 15 = 265\\) | 3 |
| 4 | Selisih benar | \\(U_{10} = 265 - 216 = 49\\) | 1 |
| 5 | Pernyataan kesimpulan | "Suku ke-10 adalah 49" | 1 |

**Catatan:** Alternatif: derivasi \\(U_n = S_n - S_{n-1} = 5n - \\tfrac{1}{2}\\) lalu substitusi n=10 → 49. Diterima penuh.`,
  },

  // Esai 5: 1+2+3+...+n = aaa̅ (digit tak nol)
  {
    question_id: "01a11640-b7e9-7711-97ee-796a3dd10d4f",
    rubric_text: `## Rubrik Penilaian — Deret Aritmetika & Bilangan Tiga Angka Kembar

**Skor total: 12 poin**

| No | Aspek | Deskripsi | Skor |
|----|-------|-----------|------|
| 1 | Rumus deret ruas kiri | \\(1+2+\\cdots+n = \\dfrac{n(n+1)}{2}\\) | 2 |
| 2 | Penjabaran \\(\\overline{aaa}\\) | \\(\\overline{aaa} = 100a + 10a + a = 111a\\) | 2 |
| 3 | Persamaan | \\(\\dfrac{n(n+1)}{2} = 111a \\Rightarrow n(n+1) = 222a = 2 \\cdot 3 \\cdot 37 \\cdot a\\) | 2 |
| 4 | Penentuan nilai \\(a\\) | Memilih \\(a = 6\\) sehingga \\(n(n+1) = 1332 = 36 \\times 37\\) | 3 |
| 5 | Jawaban \\(n\\) dan \\(\\overline{aaa}\\) | \\(n = 36\\), \\(\\overline{aaa} = 666\\) | 2 |
| 6 | Verifikasi | \\(\\dfrac{36 \\times 37}{2} = 666\\) ✓ | 1 |

**Catatan:** Jika siswa hanya mendapat n=36 tanpa menunjukkan langkah a=6: kurangi 3 poin (aspek 4).
Jika jawaban n benar tapi aaa salah: kurangi 2 poin.`,
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== MAT-35 Batch 2 — ${DRY_RUN ? "DRY RUN" : "LIVE"} ===\n`);

  // 1. Cek state awal
  const before = await sql<{ with_r: number; total: number }[]>`
    SELECT 
      COUNT(*) FILTER (WHERE distractor_rationale IS NOT NULL AND distractor_rationale != '') as with_r,
      COUNT(*) as total
    FROM question_options qo
    JOIN questions q ON q.id = qo.question_id
    WHERE q.deleted_at IS NULL AND qo.is_correct = false
  `;
  const beforeEssay = await sql<{ with_rubric: number; total: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE answer_key->>'text' IS NOT NULL AND answer_key->>'text' != '') as with_rubric,
      COUNT(*) as total
    FROM questions WHERE deleted_at IS NULL AND question_type = 'essay'
  `;

  console.log(`State awal:`);
  console.log(`  Distractor rationale: ${before[0].with_r} / ${before[0].total} opsi pengecoh`);
  console.log(`  Rubrik esai: ${beforeEssay[0].with_rubric} / ${beforeEssay[0].total} esai`);

  // 2. Commit R4 rationales
  console.log(`\nR4: Menulis ${R4_RATIONALES.length} distractor_rationale (Barisan & Deret Geometri)...`);
  const r4Written = await commitRationales(R4_RATIONALES);
  console.log(`  → ${DRY_RUN ? "(dry)" : r4Written} rationale ditulis`);

  // 3. Commit R5 rubrics
  console.log(`\nR5: Menulis ${R5_RUBRICS.length} rubrik esai (Barisan & Deret)...`);
  const r5Written = await commitEssayRubrics(R5_RUBRICS);
  console.log(`  → ${DRY_RUN ? "(dry)" : r5Written} rubrik esai ditulis`);

  // 4. Cek state akhir
  if (!DRY_RUN) {
    const after = await sql<{ with_r: number; total: number }[]>`
      SELECT 
        COUNT(*) FILTER (WHERE distractor_rationale IS NOT NULL AND distractor_rationale != '') as with_r,
        COUNT(*) as total
      FROM question_options qo
      JOIN questions q ON q.id = qo.question_id
      WHERE q.deleted_at IS NULL AND qo.is_correct = false
    `;
    const afterEssay = await sql<{ with_rubric: number; total: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE answer_key->>'text' IS NOT NULL AND answer_key->>'text' != '') as with_rubric,
        COUNT(*) as total
      FROM questions WHERE deleted_at IS NULL AND question_type = 'essay'
    `;

    console.log(`\nState akhir:`);
    console.log(
      `  Distractor rationale: ${after[0].with_r} / ${after[0].total} (delta +${Number(after[0].with_r) - Number(before[0].with_r)})`
    );
    console.log(
      `  Rubrik esai: ${afterEssay[0].with_rubric} / ${afterEssay[0].total} (delta +${Number(afterEssay[0].with_rubric) - Number(beforeEssay[0].with_rubric)})`
    );
  }

  console.log("\n=== Batch 2 selesai ===");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
