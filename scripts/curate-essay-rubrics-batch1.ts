/**
 * curate-essay-rubrics-batch1.ts
 * MAT-35 R5: Kurasi rubrik penilaian esai — Batch 1
 * Bundle: Tabel Distribusi Frekuensi (3 esai)
 *
 * Mengisi answer_key.text dengan rubrik penilaian objektif (poin per langkah).
 * Jalankan: DRY_RUN=1 npx tsx scripts/dev/curate-essay-rubrics-batch1.ts
 *           DRY_RUN=0 npx tsx scripts/dev/curate-essay-rubrics-batch1.ts
 */

import { config } from "dotenv";
config({ path: ".env" });

import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN !== "0";
const sql = postgres(DB_URL, { max: 2 });

interface EssayRubric {
  question_id: string;
  rubric_text: string;
}

/**
 * Rubrik penilaian berformat: total poin + poin per langkah.
 * Setiap langkah mencantumkan kondisi penilaian yang jelas dan objektif.
 * Delimiter KaTeX: \( \) inline, \[ \] display.
 */
const ESSAY_RUBRICS: EssayRubric[] = [
  {
    // Esai 1 (order_index 1): Buat tabel distribusi frekuensi dari 12 data nilai
    // Data: 7,8,7,9,8,10,7,8,9,8,10,7  →  7:4, 8:4, 9:2, 10:2  (n=12)
    question_id: "01a115ed-dc12-7262-b924-ecbd105a56d1",
    rubric_text: `Rubrik Penilaian — Tabel Distribusi Frekuensi (Total: 10 poin)

**Langkah 1 — Identifikasi nilai unik** (2 poin)
- 2 poin: menyebut semua nilai berbeda yang muncul (7, 8, 9, 10) dengan benar.
- 1 poin: menyebut 3 dari 4 nilai.
- 0 poin: kurang dari 3 nilai benar atau tidak ada langkah identifikasi.

**Langkah 2 — Menghitung frekuensi setiap nilai** (4 poin, 1 poin per nilai)
- \\(f(7) = 4\\): 1 poin
- \\(f(8) = 4\\): 1 poin
- \\(f(9) = 2\\): 1 poin
- \\(f(10) = 2\\): 1 poin
Dikurangi 0,5 poin per kesalahan hitung (minimal 0).

**Langkah 3 — Menyajikan tabel** (3 poin)
- 3 poin: tabel memuat kolom Nilai dan Frekuensi, semua baris benar, jumlah frekuensi = 12.
- 2 poin: tabel lengkap tetapi 1 sel salah, atau jumlah frekuensi tidak dituliskan.
- 1 poin: struktur tabel ada tetapi lebih dari 1 sel salah.
- 0 poin: tidak ada tabel.

**Langkah 4 — Memeriksa total** (1 poin)
- 1 poin: menuliskan \\(\\sum f = 12\\) (atau setara) sebagai pengecekan.
- 0 poin: tidak ada pengecekan total.`,
  },

  {
    // Esai 2 (order_index 2): Tentukan batas bawah, batas atas, tepi bawah, tepi atas, titik tengah kelas 70–79
    question_id: "01a115ed-dc3f-7fa8-98c9-3afc84a168f1",
    rubric_text: `Rubrik Penilaian — Batas, Tepi, dan Titik Tengah Kelas 70–79 (Total: 10 poin)

**Langkah 1 — Batas bawah dan batas atas** (2 poin)
- 2 poin: batas bawah = 70 DAN batas atas = 79.
- 1 poin: salah satu benar.
- 0 poin: keduanya salah.

**Langkah 2 — Tepi bawah** (2 poin)
Rumus: tepi bawah = batas bawah \\(-\\) 0,5
- 2 poin: \\(\\text{tepi bawah} = 70 - 0{,}5 = 69{,}5\\)
- 1 poin: rumus benar tetapi hasil hitung salah, atau hasil benar tanpa rumus.
- 0 poin: salah.

**Langkah 3 — Tepi atas** (2 poin)
Rumus: tepi atas = batas atas \\(+\\) 0,5
- 2 poin: \\(\\text{tepi atas} = 79 + 0{,}5 = 79{,}5\\)
- 1 poin: rumus benar tetapi hasil hitung salah.
- 0 poin: salah.

**Langkah 4 — Titik tengah** (4 poin)
Rumus: titik tengah \\(= \\dfrac{\\text{batas bawah} + \\text{batas atas}}{2}\\)
- 4 poin: \\(x_i = \\dfrac{70+79}{2} = \\dfrac{149}{2} = 74{,}5\\)
- 2 poin: rumus benar tetapi hasil hitung salah, atau menggunakan tepi bawah + tepi atas (menghasilkan nilai yang sama = tetap benar).
- 1 poin: setup benar, kesalahan aritmetika minor.
- 0 poin: salah atau tidak dikerjakan.`,
  },

  {
    // Esai 3 (order_index 3): Dari tabel (50-59:4, 60-69:6, 70-79:?, 80-89:8, 90-99:2, total=30)
    // Cari frekuensi 70-79 = 10, frekuensi kumulatif, dan frekuensi relatif 70-79
    question_id: "01a115ed-dc6d-71d6-8b8b-be1645862614",
    rubric_text: `Rubrik Penilaian — Frekuensi Kumulatif dan Frekuensi Relatif (Total: 15 poin)

**Langkah 1 — Menentukan frekuensi kelas 70–79** (3 poin)
\\[ f_{70-79} = n - (f_{50-59} + f_{60-69} + f_{80-89} + f_{90-99}) = 30 - (4+6+8+2) = 10 \\]
- 3 poin: langkah benar dan hasil \\(f_{70-79} = 10\\).
- 2 poin: metode benar, kesalahan aritmetika kecil.
- 1 poin: setup benar (mengurangi dari total) tanpa penyelesaian.
- 0 poin: tidak ada langkah.

**Langkah 2 — Menghitung frekuensi kumulatif setiap kelas** (6 poin, 1 poin per kelas)
| Kelas | \\(f\\) | \\(F\\) (kumulatif) | Poin |
|-------|----|--------------------|------|
| 50–59 | 4 | 4 | 1 |
| 60–69 | 6 | 10 | 1 |
| 70–79 | 10 | 20 | 1 |
| 80–89 | 8 | 28 | 1 |
| 90–99 | 2 | 30 | 1 |
| Jumlah | 30 | — | 1 (total benar) |

**Langkah 3 — Frekuensi relatif kelas 70–79** (4 poin)
\\[ \\text{fr}_{70-79} = \\frac{f_{70-79}}{n} \\times 100\\% = \\frac{10}{30} \\times 100\\% = 33{,}\\overline{3}\\% \\approx 33{,}33\\% \\]
- 4 poin: rumus dan hasil benar (diterima 33,3% atau 1/3 × 100%).
- 2 poin: rumus benar, kesalahan hitung atau tidak dikali 100%.
- 1 poin: formula diketahui tetapi langkah tidak lengkap.
- 0 poin: salah.

**Langkah 4 — Interpretasi** (2 poin) *(opsional, memberikan nilai tambah)*
- 2 poin: siswa menuliskan kalimat interpretasi bermakna, mis. "Sebanyak 10 siswa atau 33,33% berada pada rentang nilai 70–79."
- 1 poin: interpretasi ada tetapi tidak lengkap.
- 0 poin: tidak ada interpretasi.`,
  },
];

async function runR5EssayRubrics() {
  console.log(
    `\nMAT-35 R5 — Rubrik Esai Batch 1\n` +
      `Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`,
  );

  let written = 0;

  for (const er of ESSAY_RUBRICS) {
    // Pastikan soal ada dan bertipe esai
    const rows = await sql<{ id: string; answer_key: string }[]>`
      SELECT id, answer_key::text as answer_key
      FROM   questions
      WHERE  id = ${er.question_id}::uuid
        AND  deleted_at IS NULL
        AND  question_type = 'essay'
    `;
    if (!rows.length) {
      console.log(`  WARN: esai ${er.question_id} tidak ditemukan`);
      continue;
    }

    const existing = JSON.parse(rows[0].answer_key) as {
      text?: string;
      explanation?: string;
    };
    if (existing.text) {
      console.log(
        `  SKIP: esai ${er.question_id.slice(-8)} sudah punya rubrik`,
      );
      continue;
    }

    console.log(
      `  + esai ${er.question_id.slice(-8)}: menulis rubrik ${er.rubric_text.length} karakter`,
    );

    if (!DRY_RUN) {
      // Patch answer_key JSON: tambah field "text" ke objek yang sudah ada
      await sql`
        UPDATE questions
           SET answer_key = answer_key || jsonb_build_object('text', ${er.rubric_text}::text),
               updated_at = now()
         WHERE id = ${er.question_id}::uuid
      `;
      written++;
    }
  }

  console.log(
    `\nSelesai. Rubrik ditulis: ${DRY_RUN ? "(DRY RUN)" : written}`,
  );
  await sql.end();
}

runR5EssayRubrics().catch((e) => {
  console.error(e);
  process.exit(1);
});
