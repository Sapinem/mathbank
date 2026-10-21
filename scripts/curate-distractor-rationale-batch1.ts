/**
 * curate-distractor-rationale-batch1.ts
 * MAT-35: Batch 1 — Kurasi distractor_rationale
 *
 * Strategi:
 * 1. R2: Ekstraksi otomatis dari explanation bergaya "Cek opsi X: …" (per-opsi penuh)
 * 2. R3 manual: Kurasi rationale untuk bundle "Tabel Distribusi Frekuensi" (13 PG)
 *    dan bundle terkait Statistik (konseptual mudah → cepat).
 *
 * Jalankan: DRY_RUN=1 npx tsx scripts/dev/curate-distractor-rationale-batch1.ts
 *           DRY_RUN=0 npx tsx scripts/dev/curate-distractor-rationale-batch1.ts
 *
 * Domain MAT-35: UPDATE question_options SET distractor_rationale diizinkan
 * (pedagogical enrichment, bukan perubahan skema).
 */

import { config } from "dotenv";
config({ path: ".env" });

import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN !== "0";

const sql = postgres(DB_URL, { max: 2 });

// ─── Tipe ─────────────────────────────────────────────────────────────────────

interface OptionRationale {
  question_id: string;
  label: string; // "A"|"B"|"C"|"D"|"E"
  rationale: string;
}

// ─── Helper: commit ke DB ──────────────────────────────────────────────────────

async function commitRationales(rationales: OptionRationale[]): Promise<number> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Akan menulis ${rationales.length} rationale.`);
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
         AND distractor_rationale IS NULL   -- idempoten: jangan timpa yang sudah ada
    `;
    updated++;
  }
  return updated;
}

// ─── R2: Ekstraksi otomatis dari "Cek opsi X: …" ─────────────────────────────

/**
 * Ekstrak blok per-opsi dari explanation bergaya:
 *   "Cek opsi A:\n…\nCek opsi B:\n…\n…"
 * Hanya soal di mana SEMUA opsi (A–E) punya blok sendiri yang diekstraksi
 * (supaya rationale yang tersimpan terbukti dari sumber asli).
 */
async function runR2ExtractCekOpsi(): Promise<OptionRationale[]> {
  console.log("\n=== R2: Ekstraksi otomatis 'Cek opsi X' ===");

  const rows = await sql<
    { id: string; explanation: string }[]
  >`
    SELECT q.id, q.answer_key->>'explanation' AS explanation
    FROM   questions q
    WHERE  q.deleted_at IS NULL
      AND  q.question_type = 'single_choice'
      AND  (q.answer_key->>'explanation') ILIKE '%cek opsi%'
      AND  NOT EXISTS (
        SELECT 1 FROM question_options o2
         WHERE o2.question_id = q.id
           AND o2.distractor_rationale IS NOT NULL
      )
  `;

  console.log(`Kandidat: ${rows.length} soal`);

  const result: OptionRationale[] = [];

  for (const row of rows) {
    const expl = row.explanation ?? "";
    // Cari blok "Cek opsi A:", "Cek opsi B:", dst. — case-insensitive
    const labels = ["A", "B", "C", "D", "E"];
    const blocks: Partial<Record<string, string>> = {};

    for (let i = 0; i < labels.length; i++) {
      const lbl = labels[i];
      // Match "Cek opsi A:" atau "Cek Opsi A:" — tangkap konten hingga "Cek opsi X:" berikutnya
      const nextLabels = labels.slice(i + 1);
      const lookahead = nextLabels.length
        ? `(?=Cek [Oo]psi [${nextLabels.join("")}]:)`
        : "$";
      const re = new RegExp(
        `Cek [Oo]psi ${lbl}:\\s*([\\s\\S]*?)(?:${lookahead})`,
        "i",
      );
      const m = expl.match(re);
      if (m) {
        blocks[lbl] = m[1].trim();
      }
    }

    // Hanya proses jika ada ≥ 4 blok opsi ditemukan (soal mungkin A–D atau A–E)
    const foundLabels = Object.keys(blocks);
    if (foundLabels.length < 4) {
      console.log(`  skip ${row.id.slice(-8)}: hanya ${foundLabels.length} blok opsi (butuh ≥4)`);
      continue;
    }

    // Ambil opsi yang salah (distractor) dari DB
    const opts = await sql<
      { label: string; is_correct: boolean }[]
    >`
      SELECT label, is_correct
      FROM   question_options
      WHERE  question_id = ${row.id}::uuid
      ORDER  BY label
    `;

    for (const opt of opts) {
      if (opt.is_correct) continue; // skip kunci jawaban
      const blk = blocks[opt.label];
      if (!blk) continue;

      const rationale = `[Diekstrak dari pembahasan] ${blk}`;
      result.push({
        question_id: row.id,
        label: opt.label,
        rationale,
      });
      console.log(
        `  + ${row.id.slice(-8)} opsi ${opt.label}: "${rationale.slice(0, 60)}…"`,
      );
    }
  }

  console.log(`R2 total rationale: ${result.length}`);
  return result;
}

// ─── R3: Rationale manual untuk "Tabel Distribusi Frekuensi" (13 PG) ─────────
//
// Soal-soal ini bersifat KONSEPTUAL — pengecoh dibangun dari
// terminologi statistik deskriptif yang sering dicampuraduk siswa.
// Setiap rationale menyebut: (a) nama kesalahan, (b) langkah salah, (c) hasil.

const MANUAL_RATIONALES: Record<
  string, // question_id (full UUID)
  Record<string, string> // label -> rationale
> = {
  // Q1 (order_index 4): "Banyak kemunculan suatu data disebut ...."
  // Kunci: A (frekuensi)
  "01a115ed-dca4-72cf-be0e-bebd01b87d69": {
    B: "Kesalahan konsep: siswa mengacaukan 'banyak kemunculan' dengan median. Median adalah nilai tengah data yang diurutkan — sama sekali tidak mencatat berapa kali suatu nilai muncul.",
    C: "Kesalahan konsep: siswa mengira modus (nilai yang paling sering muncul) sama dengan frekuensi. Modus adalah NILAI-nya, bukan HITUNGAN kemunculannya; frekuensi adalah hitungan itu sendiri.",
    D: "Kesalahan konsep: siswa memilih kuartil — ukuran letak (Q1, Q2, Q3) yang membagi data menjadi empat bagian. Kuartil tidak mengukur berapa kali suatu nilai muncul.",
    E: "Kesalahan konsep: siswa memilih simpangan baku — ukuran penyebaran data di sekitar rata-rata. Simpangan baku tidak ada hubungannya dengan hitungan kemunculan nilai.",
  },

  // Q2 (order_index 5): Frekuensi nilai 7 pada data: 6,7,7,8,6,9,7,8,6
  // Kunci: C (3)
  "01a115ed-dcdb-754b-834b-29623be33dfa": {
    A: "Kesalahan hitung: siswa hanya menghitung 1 kemunculan (misal hanya melihat 7 pertama). Dengan menelusuri urutan data: posisi 2, 3, dan 7 semuanya adalah 7 → frekuensi = 3.",
    B: "Kesalahan hitung (off-by-one): siswa menghitung 2 kemunculan, kemungkinan melewatkan salah satu 7 dalam urutan. Data lengkap: 6,7,7,8,6,9,7,8,6 — ada tiga angka 7.",
    D: "Kesalahan hitung: siswa menghitung 4, mungkin menghitung angka 6 (yang juga muncul 3 kali) namun dengan kesalahan urutan, atau mengira data memiliki 4 angka 7. Hitung ulang secara teliti: hanya ada tiga 7.",
    E: "Kesalahan hitung ekstrem: siswa mungkin menghitung total elemen = 9, atau mengira semua angka selain 7 tidak dihitung. Frekuensi 7 adalah 3, bukan 5.",
  },

  // Q3 (order_index 6): Frekuensi data 2 pada: 2,3,2,4,5,3,2,4,3,2
  // Kunci: C (4)
  "01a115ed-dd12-7c45-8689-22676a2f7dea": {
    A: "Kesalahan hitung: siswa menghitung hanya 2 kemunculan. Data posisi ke-1, 3, 7, 10 adalah angka 2 → frekuensi = 4, bukan 2.",
    B: "Kesalahan hitung: siswa menghitung 3 kemunculan. Mungkin melewatkan kemunculan terakhir (posisi ke-10). Penelusuran lengkap: 2(1), 3, 2(3), 4, 5, 3, 2(7), 4, 3, 2(10) → ada 4.",
    D: "Kesalahan hitung: siswa menghitung 5. Mungkin salah mengidentifikasi batas data atau menghitung nilai tetangga (angka 3 muncul 3 kali, angka 4 muncul 2 kali) secara keliru.",
    E: "Kesalahan hitung ekstrem: siswa mungkin menghitung banyaknya elemen di luar angka 2 (= 6), atau keliru menjumlahkan frekuensi nilai lain.",
  },

  // Q4 (order_index 7): "Jumlah seluruh frekuensi harus sama dengan ...."
  // Kunci: C (banyak seluruh data)
  "01a115ed-dd4a-7c60-897f-a9a6629eb973": {
    A: "Kesalahan konsep: siswa mengira jumlah frekuensi harus = nilai terbesar dalam data. Nilai terbesar adalah ukuran lokasi, sedangkan jumlah frekuensi = total banyak observasi (n).",
    B: "Kesalahan konsep: siswa mengira jumlah frekuensi harus = nilai terkecil. Ini mencampuradukan ukuran lokasi (nilai minimum) dengan ukuran banyaknya data.",
    D: "Kesalahan konsep: siswa memilih 'jangkauan data' (nilai terbesar − nilai terkecil). Jangkauan adalah ukuran penyebaran, bukan jumlah frekuensi.",
    E: "Kesalahan konsep: siswa memilih 'rata-rata data'. Rata-rata = Σfx/n, bukan Σf. Siswa mencampuradukan rata-rata dengan total frekuensi.",
  },

  // Q5 (order_index 8): "Tabel distribusi frekuensi berkelompok digunakan jika ...."
  // Kunci: B (data banyak dan variasi nilainya beragam)
  "01a115ed-dd81-7d51-a147-dd3918e3e670": {
    A: "Kesalahan konsep: siswa mengira tabel berkelompok digunakan jika data hanya satu nilai. Justru sebaliknya — data monoton (satu nilai) tidak perlu dikelompokkan karena sangat sederhana.",
    C: "Kesalahan konsep: 'data tidak memiliki frekuensi' — ini pernyataan yang tidak masuk akal secara statistik. Semua data memiliki frekuensi. Siswa mungkin asal memilih opsi yang berbunyi 'tidak'.",
    D: "Kesalahan fantasi: siswa memilih 'data selalu berupa warna' — ini bukan kondisi statistik yang valid. Kemungkinan siswa bingung antara data kualitatif dan tabel distribusi frekuensi.",
    E: "Kesalahan konsep: 'data tidak perlu disusun' — bertentangan dengan tujuan tabel distribusi frekuensi yang justru MENYUSUN data ke dalam kelas-kelas berurutan.",
  },

  // Q6 (order_index 9): "Titik tengah kelas 60–69 adalah ...."
  // Kunci: D (64,5)  — rumus: (batas bawah + batas atas) / 2
  "01a115ed-ddb9-779b-b088-3f27620d6a86": {
    A: "Kesalahan rumus (titik tengah = tepi bawah): siswa menghitung 60 + 0,5 = 60,5 menggunakan rumus tepi bawah kelas, bukan titik tengah. Titik tengah = (60+69)/2 = 64,5.",
    B: "Kesalahan rumus (rata-rata tepi atas dan bawah keliru): siswa mungkin menghitung (60+65)/2 = 62,5, mengira batas atas adalah 65 (panjang kelas 5, bukan 9).",
    C: "Kesalahan hitung: (60+67)/2 = 63,5 — siswa mengira batas atas kelas adalah 67 (bukan 69), kemungkinan karena bingung dengan penomoran kelas.",
    E: "Kesalahan konsep (titik tengah = tepi atas): siswa menghitung 69 + 0,5 = 69,5 menggunakan rumus tepi atas kelas. Titik tengah bukan tepi atas.",
  },

  // Q7 (order_index 10): "Tepi bawah kelas 70–79 adalah ...."
  // Kunci: B (69,5)  — rumus: batas bawah − 0,5
  "01a115ed-ddee-71b2-80c6-d4746634a3ee": {
    A: "Kesalahan hitung (off-by-two): siswa menghitung 70 − 1,5 = 68,5, menggunakan pengurangan 1,5 (mungkin mengira setengah panjang kelas yang dibagi dua lagi).",
    C: "Kesalahan konsep: siswa mengira tepi bawah = batas bawah nyata (70), tanpa mengurangi 0,5. Tepi kelas selalu bergeser 0,5 satuan dari batas kelas.",
    D: "Kesalahan konsep (tepi bawah = batas atas): siswa memilih 79 = batas atas kelas 70–79. Batas atas bukan tepi bawah.",
    E: "Kesalahan konsep (tepi bawah = tepi atas kelas ini): siswa menghitung 79 + 0,5 = 79,5 — rumus tepi atas, bukan tepi bawah.",
  },

  // Q8 (order_index 11): "Tepi atas kelas 80–89 adalah ...."
  // Kunci: E (89,5)  — rumus: batas atas + 0,5
  "01a115ed-de0f-7c1e-9f5b-4791cade2a56": {
    A: "Kesalahan konsep (tepi atas = tepi bawah kelas ini): siswa menghitung 80 − 0,5 = 79,5 — rumus tepi bawah kelas 80–89, bukan tepi atasnya.",
    B: "Kesalahan konsep: siswa mengira tepi atas = batas bawah (80) tanpa menambah 0,5. Tepi kelas harus bergeser 0,5 dari batas kelas.",
    C: "Kesalahan hitung: 89 − 0,5 = 88,5 — siswa mengurangi 0,5 dari batas atas (seharusnya menambah). Rumus tepi atas = batas atas + 0,5.",
    D: "Kesalahan konsep: siswa mengira tepi atas = batas atas nyata (89) tanpa menambah 0,5. Tepi atas selalu 0,5 di atas batas atas kelas.",
  },

  // Q9 (order_index 12): Frekuensi relatif = 8/40 × 100%
  // Kunci: B (20%)
  "01a115ed-de31-7282-8742-b158520defe6": {
    A: "Kesalahan rumus (frekuensi/jumlah data tanpa ×100): siswa menghitung 8/40 = 0,20 namun tidak mengalikan 100, sehingga mendapat 10% (kemungkinan mengalikan 50 bukan 100, atau salah langkah).",
    C: "Kesalahan pembagian (terbalik arah): siswa menghitung 40/8 × ½ = 25%, membalikkan pembilang dan penyebut lalu membagi hasilnya, atau salah membaca rumus frekuensi relatif.",
    D: "Kesalahan konsep (mengambil penyebut): siswa langsung menuliskan 40% dari angka jumlah data tanpa pembagian, atau menghitung 8/40 × 200 secara keliru.",
    E: "Kesalahan ekstrem (mengambil penyebut tanpa pembagian): siswa menuliskan 40/total × 100 = 80%, mengira frekuensi kelas yang digunakan adalah 40 (jumlah data) bukan 8 (frekuensi kelas).",
  },

  // Q10 (order_index 13): "Frekuensi kumulatif adalah ...."
  // Kunci: D (jumlah frekuensi secara bertahap)
  "01a115ed-de61-70c3-a70e-476dc1f531cd": {
    A: "Kesalahan terminologi: siswa mengira frekuensi kumulatif = nilai tengah suatu kelas (titik tengah = (tepi bawah + tepi atas)/2). Keduanya adalah konsep berbeda dalam tabel distribusi frekuensi.",
    B: "Kesalahan terminologi: siswa memilih 'batas bawah suatu kelas'. Batas bawah adalah ujung kiri interval kelas, bukan akumulasi frekuensi.",
    C: "Kesalahan terminologi: siswa memilih 'batas atas suatu kelas'. Batas atas adalah ujung kanan interval kelas, sama sekali tidak terkait dengan penjumlahan frekuensi.",
    E: "Kesalahan konsep (frekuensi kumulatif ≈ jangkauan): siswa memilih 'selisih nilai terbesar dan terkecil' — itu adalah jangkauan data (range), bukan frekuensi kumulatif.",
  },
};

async function runR3ManualRationale(): Promise<OptionRationale[]> {
  console.log("\n=== R3: Rationale manual bundle Tabel Distribusi Frekuensi ===");

  const result: OptionRationale[] = [];

  for (const [qid, labelMap] of Object.entries(MANUAL_RATIONALES)) {
    // Verifikasi soal ada di DB
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM questions
      WHERE id = ${qid}::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) {
      console.log(`  WARN: soal ${qid} tidak ditemukan`);
      continue;
    }

    for (const [label, rationale] of Object.entries(labelMap)) {
      // Verifikasi bahwa opsi ini memang salah (distractor)
      const opts = await sql<{ is_correct: boolean }[]>`
        SELECT is_correct FROM question_options
        WHERE question_id = ${qid}::uuid AND label = ${label}
      `;
      if (!opts.length) {
        console.log(`  WARN: opsi ${label} tidak ditemukan pada soal ${qid.slice(-8)}`);
        continue;
      }
      if (opts[0].is_correct) {
        console.log(`  SKIP: opsi ${label} pada soal ${qid.slice(-8)} adalah kunci jawaban`);
        continue;
      }

      result.push({ question_id: qid, label, rationale });
      console.log(`  + soal ${qid.slice(-8)} opsi ${label}: "${rationale.slice(0, 70)}…"`);
    }
  }

  console.log(`R3 total rationale: ${result.length}`);
  return result;
}

// ─── Verifikasi pasca-commit ───────────────────────────────────────────────────

async function verifyCommit() {
  const rows = await sql<{ q: string; filled: number; total: number }[]>`
    SELECT
      LEFT(o.question_id::text, 8) AS q,
      COUNT(CASE WHEN o.distractor_rationale IS NOT NULL AND NOT o.is_correct THEN 1 END)::int AS filled,
      COUNT(CASE WHEN NOT o.is_correct THEN 1 END)::int AS total
    FROM question_options o
    JOIN questions q ON q.id = o.question_id
    WHERE q.deleted_at IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM question_options o2
          WHERE o2.question_id = o.question_id
            AND o2.distractor_rationale IS NOT NULL
        )
      )
    GROUP BY o.question_id
    ORDER BY o.question_id
  `;

  console.log(`\n=== Verifikasi pasca-commit ===`);
  console.log(`Soal dengan ≥1 rationale terisi: ${rows.length}`);
  const complete = rows.filter((r) => r.filled === r.total);
  console.log(
    `Soal dengan rationale LENGKAP (semua pengecoh): ${complete.length}`,
  );
  for (const r of complete) {
    console.log(`  ✅ soal ${r.q}: ${r.filled}/${r.total} pengecoh`);
  }
  return { total: rows.length, complete: complete.length };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\nMAT-35 Batch 1 — Distractor Rationale Curation\n` +
    `Mode: ${DRY_RUN ? "DRY RUN (tidak ada tulis ke DB)" : "LIVE (tulis ke DB)"}\n`,
  );

  const r2 = await runR2ExtractCekOpsi();
  const r3 = await runR3ManualRationale();

  const all = [...r2, ...r3];
  console.log(`\nTotal rationale yang akan ditulis: ${all.length}`);

  if (all.length === 0) {
    console.log("Tidak ada rationale untuk ditulis.");
    await sql.end();
    return;
  }

  const written = await commitRationales(all);
  console.log(`\nDitulis ke DB: ${written} (atau 0 jika DRY RUN)`);

  if (!DRY_RUN) {
    await verifyCommit();
  }

  console.log("\nSelesai.");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
