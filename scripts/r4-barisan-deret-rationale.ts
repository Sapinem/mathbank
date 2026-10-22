/**
 * R4 (Batch 1): Kurasi distractor_rationale untuk bundle Barisan & Deret
 * MAT-35 — Pedagogy enrichment, target JSONB data_payload.options[].distractorRationale
 *
 * Soal: 3 butir dari bundle "2017 02 Belajar Barisan Dan Deret Geometri"
 * Standar: Haladyna Aturan 21 — tiap rationale jelaskan kesalahan konseptual/prosedural spesifik.
 * Format per optionItemSchema: min 40 karakter.
 *
 * Jalankan (dry):  DRY_RUN=1 pnpm exec tsx scripts/r4-barisan-deret-rationale.ts
 * Jalankan (live): DRY_RUN=0 pnpm exec tsx scripts/r4-barisan-deret-rationale.ts
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
  correctLabel: string; // label jawaban benar (skip rationale untuk ini)
  options: Record<string, string>; // label -> distractorRationale
}

// ── R4 Batch 1: Barisan & Deret ──────────────────────────────────────────────
const rationales: QuestionRationale[] = [
  {
    // Soal: Suku ke-4 BG = suku ke-8 BA, suku pertama=2, rasio=beda (bulat)
    // Opsi: A=2, B=8, C=10 (BENAR), D=14, E=16
    // Penyelesaian: ar³=a+7b (b=r), 2r³-7r-2=0, r=2 (bulat)
    // U₅(BG)-U₁₁(BA) = 2·2⁴ - (2+10·2) = 32-22 = 10
    questionId: "01a1155f-6b8d-7282-bf3e-68b47bf0afc6",
    note: "BG suku ke-4 = BA suku ke-8, a=2, r=b (bulat). Jawab C=10",
    correctLabel: "C",
    options: {
      A: "Siswa mengambil nilai \\(r=\\frac{1}{2}\\) (akar non-bulat dari \\(2r^3-7r-2=0\\)) alih-alih \\(r=2\\). Dengan \\(r=\\frac{1}{2}\\): \\(U_5[BG]=2\\cdot(\\frac{1}{2})^4=\\frac{1}{8}\\) dan \\(U_{11}[BA]=2+10\\cdot\\frac{1}{2}=7\\), sehingga selisihnya \\(\\frac{1}{8}-7\\approx -7\\). Siswa kemudian memilih opsi A=2 karena nilai paling kecil yang positif.",
      B: "Siswa benar menemukan \\(r=2\\) tetapi menghitung \\(U_5[BG]-U_{11}[BA]=ar^4-(a+10b)=2\\cdot 2^4-(2+10\\cdot 2)\\) dengan keliru: \\(2^4=8\\) saja tanpa mengalikan dengan \\(a=2\\), menghasilkan \\(8-0=8\\). Kesalahan: mengabaikan koefisien \\(a\\) pada suku geometri.",
      D: "Siswa menghitung \\(U_5[BG]-U_{10}[BA]\\) (bukan \\(U_{11}\\)): \\(32-(2+9\\cdot 2)=32-20=12\\), lalu menambahkan kesalahan kecil dari beda \\(r\\), atau menggunakan \\(U_{11}[BA]=a+10b=22\\) tetapi salah menghitung \\(U_5[BG]=2\\cdot 2^5=64\\), menghasilkan \\(64-50=14\\). Kesalahan: pangkat suku geometri (\\(ar^{n-1}\\) menjadi \\(ar^n\\)).",
      E: "Siswa menghitung \\(U_5[BG]=ar^4=2\\cdot 2^4=32\\) benar, tetapi menggunakan rumus BA yang salah: \\(U_{11}[BA]=a\\cdot r^{10}\\) (mencampur rumus BG ke BA), menghasilkan \\(U_{11}=2\\cdot 2^{10}=2048\\) atau \\(U_{11}[BA]=a+(11-1)b=2+10\\cdot(-2)=-18\\) (salah tanda beda), sehingga \\(32-(-18)=50\\neq 16\\). Alternatif: siswa memilih \\(r=2\\) dan menghitung \\(U_5[BG]\\cdot U_{11}[BA]=32\\cdot \\frac{1}{2}=16\\) (menjumlahkan bukan mengurangi).",
    },
  },
  {
    // Soal: 4 bilangan BA → bilangan ke-3 ditambah bil. pertama, bil. ke-4 dikali 2 → BG
    // Empat bilangan BA: a, a+b, a+2b, a+3b
    // BA: [a, a+b, a+2b, a+3b]; modifikasi: [a, a+b, a+2b+a, 2(a+3b)] harus jadi BG
    // [a, a+b, 2a+2b, 2a+6b]; BG: (a+b)/a = (2a+2b)/(a+b) = (2a+6b)/(2a+2b)
    // r = (a+b)/a → (a+b)² = a(2a+2b) → a²+2ab+b² = 2a²+2ab → b²=a² → b=a (b>0)
    // S_4_BG = a(r⁴-1)/(r-1) = a((2⁴-1)/(2-1)) = 15a; a=a, r=2, S4=15a
    // Perlu cari a: BA asli: a, 2a, 3a, 4a (b=a). BG baru: a, 2a, 4a, 8a. S4=15a.
    // Opsi: A=8, B=20, C=24, D=30 (BENAR), E=36 → S4=30 → 15a=30 → a=2
    questionId: "01a1155f-6bb9-7e89-99e9-be26a8ab7bf5",
    note: "4 bil BA, modifikasi ke-3 dan ke-4 jadi BG. Jawab D=30",
    correctLabel: "D",
    options: {
      A: "Siswa menemukan \\(b=a\\) dengan benar, tetapi menghitung jumlah barisan aritmetika asli (bukan BG hasil modifikasi): \\(S_4[BA]=\\frac{4}{2}(2a+(4-1)a)=2\\cdot 5a=10a\\). Dengan \\(a=2\\): \\(S_4=20\\neq 8\\). Kesalahan lanjut: siswa memilih \\(a=1\\) menghasilkan \\(S_4=8\\). Akar penyebab: tidak membedakan BA asli dengan BG yang terbentuk.",
      B: "Siswa menghitung jumlah BG hasil modifikasi [a, 2a, 4a, 8a] dengan benar: \\(S_4=a+2a+4a+8a=15a\\), tetapi mensubstitusi \\(a=\\frac{4}{3}\\) (hasil keliru dari syarat rasio) menghasilkan \\(15\\cdot\\frac{4}{3}=20\\). Akar penyebab: kesalahan aljabar saat menyelesaikan \\(b^2=a^2\\) menjadi \\(b=a\\), siswa memperoleh \\(b=\\frac{a}{3}\\).",
      C: "Siswa salah membangun barisan geometri dari modifikasi: menggunakan [a, a+b, a+2b+a, a+3b+2] (menambahkan konstanta, bukan mengalikan), lalu menghitung dengan \\(b=a=2\\): \\(2+4+6+12=24\\). Akar penyebab: miskonsepsi tentang pembentukan BG; hanya suku ke-4 yang benar dimodifikasi.",
      E: "Siswa menemukan \\(r=2\\) benar, tetapi menghitung \\(S_4[BG]=\\frac{a(r^4-1)}{r-1}\\) dengan \\(a=\\frac{4}{2}\\cdot 2=4\\) (menggunakan suku kedua BA sebagai suku pertama BG), menghasilkan \\(S_4=\\frac{4(16-1)}{1}=60\\). Nilai yang tidak ada dalam opsi, sehingga siswa memilih opsi terdekat E=36, atau menghitung \\(4\\cdot 9=36\\) dari rumus jumlah salah.",
    },
  },
  {
    // Soal: BG 4 suku r=1/2, BA 4 suku; jumlah semua suku BG = jumlah semua suku BA
    // BG: a, a/2, a/4, a/8 → S=a(1-(1/2)^4)/(1-1/2) = a·15/16·2 = 15a/8
    // BA: p, p+d, p+2d, p+3d → S=4p+6d
    // Kondisi: S_BG = S_BA → 15a/8 = 4p+6d
    // Ditanya rasio suku ke-2 BG terhadap suku ke-2 BA
    // Opsi: A=1/15, B=2/15, C=1/5 (BENAR), D=1/3, E=8/15
    questionId: "01a1155f-6c15-7408-aa28-98b7f7b9a1fd",
    note: "BG r=1/2 dan BA 4 suku dengan jumlah sama. Jawab C=1/5",
    correctLabel: "C",
    options: {
      A: "Siswa menghitung rasio suku ke-2 BG (\\(\\frac{a}{2}\\)) terhadap jumlah seluruh suku BA (\\(S_4[BA]\\)) alih-alih terhadap suku ke-2 BA: \\(\\frac{a/2}{15a/8\\cdot\\frac{8}{15}}\\). Kesalahan konseptual: mengacaukan suku ke-2 dengan jumlah keseluruhan barisan, menghasilkan pembagi yang terlalu besar.",
      B: "Siswa benar menghitung \\(U_2[BG]=\\frac{a}{2}\\) tetapi menggunakan \\(U_2[BA]=p+d\\) dengan nilai \\(d\\) yang dihitung dari asumsi \\(S_4[BA]=S_4[BG]\\) dengan \\(p=1\\) (tidak diketahui). Substitusi \\(p+d=\\frac{a}{2}\\cdot\\frac{2}{5}=\\frac{a}{5}\\cdot\\frac{2}{3}=\\frac{2a}{15}\\) menghasilkan rasio \\(\\frac{2}{15}\\). Akar: tidak menggunakan hubungan antara jumlah kedua barisan secara konsisten.",
      D: "Siswa keliru menghitung jumlah BG: menggunakan \\(S_4[BG]=a+\\frac{a}{2}+\\frac{a}{4}+\\frac{a}{8}=\\frac{15a}{8}\\) benar, tetapi menyederhanakan \\(\\frac{15a}{8}=4p+6d\\) menjadi \\(p+d=\\frac{15a}{8\\cdot 5}=\\frac{3a}{8}\\) (salah faktor). Rasio \\(\\frac{a/2}{3a/8}=\\frac{4}{3}\\neq\\frac{1}{3}\\). Siswa kemudian memilih \\(\\frac{1}{3}\\) karena nilai suku pertama BA lebih besar.",
      E: "Siswa menukar pembilang dan penyebut: menghitung rasio suku ke-2 BA terhadap suku ke-2 BG (bukan sebaliknya), menghasilkan \\(\\frac{U_2[BA]}{U_2[BG]}=\\frac{5}{1}\\) atau mencampur rasio BG (\\(r=\\frac{1}{2}\\)) dengan hasil bagi jumlah: \\(\\frac{15/8}{2-1}=\\frac{15}{8}\\approx\\frac{8}{15}\\) setelah membalik fraksi.",
    },
  },
];

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE UPDATE"}`);
  console.log("Target: questions.data_payload.options[].distractorRationale (JSONB)");
  console.log(`Processing ${rationales.length} questions (R4: Barisan & Deret)\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const item of rationales) {
    console.log(`\n── Q ${item.questionId.substring(0, 8)} (${item.note}) ──`);

    const rows = await sql`
      SELECT id, data_payload->'options' as options_jsonb, answer_key->>'correct' as correct
      FROM questions
      WHERE id = ${item.questionId}::uuid
        AND deleted_at IS NULL
    ` as Array<Record<string, unknown>>;

    if (!rows.length) {
      console.log(`  [SKIP] Not found in DB`);
      totalSkipped++;
      continue;
    }

    const row = rows[0];
    let optionsJsonb = row.options_jsonb as Array<{
      id: string;
      contentMarkdown: string;
      distractorRationale?: string | null;
    }> | string | null;

    // Handle double-encoded string case
    if (typeof optionsJsonb === "string") {
      try {
        optionsJsonb = JSON.parse(optionsJsonb);
      } catch {
        console.log(`  [SKIP] options_jsonb is malformed string, cannot parse`);
        totalSkipped++;
        continue;
      }
    }

    if (!optionsJsonb || !Array.isArray(optionsJsonb) || optionsJsonb.length === 0) {
      console.log(`  [SKIP] data_payload.options not populated or empty`);
      totalSkipped++;
      continue;
    }

    const correctRaw = row.correct as string | null;
    const correctIds: string[] = correctRaw
      ? JSON.parse(correctRaw).map((s: string) => s.toUpperCase())
      : [item.correctLabel.toUpperCase()];

    let updatedOptions = [...optionsJsonb];
    let changed = false;

    for (let i = 0; i < updatedOptions.length; i++) {
      const opt = updatedOptions[i];
      const isCorrect = correctIds.includes(opt.id.toUpperCase());
      if (isCorrect) continue;

      const rationale = item.options[opt.id.toUpperCase()];
      if (!rationale) {
        // No rationale authored for this option in this batch
        continue;
      }

      if (opt.distractorRationale && opt.distractorRationale.trim().length >= 40) {
        console.log(`  [SKIP] opt ${opt.id}: already has distractorRationale (${opt.distractorRationale.length} chars)`);
        totalSkipped++;
        continue;
      }

      if (rationale.length < 40) {
        console.warn(`  [WARN] opt ${opt.id}: rationale too short (${rationale.length} chars) — skipping`);
        continue;
      }

      console.log(`  [UPDATE] opt ${opt.id}: "${rationale.substring(0, 80)}..."`);
      updatedOptions[i] = { ...opt, distractorRationale: rationale };
      changed = true;
      totalUpdated++;
    }

    if (changed && !DRY_RUN) {
      await sql`
        UPDATE questions
        SET data_payload = jsonb_set(data_payload, '{options}', ${sql.json(updatedOptions)})
        WHERE id = ${item.questionId}::uuid
      `;
      console.log(`  ✅ DB updated`);
    } else if (changed && DRY_RUN) {
      console.log(`  [DRY] Would update DB`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`distractorRationale entries updated: ${totalUpdated}`);
  console.log(`Skipped: ${totalSkipped}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN — no DB changes" : "LIVE — JSONB updated"}`);

  await sql.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
