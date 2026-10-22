/**
 * R3/R4-JSONB: Kurasi manual distractor_rationale ke data_payload.options[].distractorRationale
 * MAT-35 — Pedagogy enrichment aligned ke MAT-144 architecture
 *
 * Arsitektur: Single Table + Hybrid JSONB (MAT-144)
 * Target field: questions.data_payload.options[].distractorRationale
 *
 * DEPENDENCY: Requires MAT-144 migration populating data_payload.options[] from question_options.
 *
 * Script ini menyimpan rationale yang dikurasi secara manual, siap diterapkan
 * setelah migrasi MAT-144 selesai.
 *
 * Jalankan (dry):  DRY_RUN=1 pnpm exec tsx scripts/r3r4-curate-rationale-jsonb.ts
 * Jalankan (live): DRY_RUN=0 pnpm exec tsx scripts/r3r4-curate-rationale-jsonb.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL!;
const DRY_RUN = process.env.DRY_RUN !== "0";
const sql = postgres(DB_URL, { max: 1, connect_timeout: 30, idle_timeout: 30 });

/**
 * Distractor rationale dikurasi manual (R3: Distribusi Peluang, R4: Barisan & Deret).
 *
 * Format setiap entry mengikuti optionItemSchema.distractorRationale:
 *   "(a) nama kesalahan — (b) langkah salah — (c) nilai hasil keliru"
 *   Minimal 40 karakter.
 *
 * Setiap QuestionRationale berisi:
 *   - questionId: UUID soal di tabel questions
 *   - options: map label -> distractorRationale (hanya opsi SALAH)
 */
interface QuestionRationale {
  questionId: string;
  bundle: string;
  options: Record<string, string>; // label -> rationale for WRONG options only
}

// ── R3: Bundle Distribusi Peluang (Batch Baru JSONB) ──────────────────────────
// Soal-soal ini dipilih dari bundle Peluang & Distribusi karena pengecohannya
// mewakili miskonsepsi konseptual yang kaya.
const r3Rationales: QuestionRationale[] = [
  {
    // Soal: Peluang dua bola merah berurutan tanpa pengembalian
    questionId: "01a1155d-935a-7cca-83e1-116db16f3ce2",
    bundle: "Distribusi Peluang",
    options: {
      A: "Siswa keliru menghitung P(merah 1) = 5/10 (bukan 6/10) karena salah membaca jumlah bola merah; menghasilkan P = 5/10 × 4/9 = 20/90 ≠ 7/15.",
      B: "Siswa menggunakan peluang dengan pengembalian: (6/10)² = 36/100 = 9/25, mengabaikan fakta bahwa bola tidak dikembalikan sehingga penyebut berubah menjadi 9.",
      C: "Siswa mencampur peluang bola sama (merah+merah, putih+putih) tetapi menjumlahkan penyebutnya secara tidak benar: 6/(10+9) + 4/(10+9) = 10/19, bukan mengalikan per kejadian.",
      D: "Siswa salah mengidentifikasi kejadian 'sama warna' hanya pada bola merah, sehingga menghitung P = 6/10 × 5/9 = 30/90 = 1/3 dan melupakan kontribusi bola putih.",
    },
  },
  {
    // Soal: Peluang kejadian majemuk (A∪B)
    questionId: "01a1163b-eaaa-78d2-b488-38be0375d928",
    bundle: "Kejadian Majemuk Peluang",
    options: {
      A: "Siswa langsung menjumlahkan P(A) + P(B) tanpa mengurangi P(A∩B), melanggar hukum penjumlahan untuk kejadian tidak saling lepas; menghasilkan nilai yang lebih besar dari benar.",
      B: "Siswa menggunakan P(A∪B) = P(A) × P(B) — kesalahan konseptual mengacaukan aturan perkalian (kejadian independen) dengan aturan penjumlahan (kejadian gabungan).",
      D: "Siswa menghitung P(A∩B) saja tanpa menambahkan kontribusi kejadian A dan B yang tidak beririsan; memperoleh nilai lebih kecil dari jawaban benar.",
      E: "Siswa menggunakan komplemen: P(A∪B) = 1 - P(A' ∩ B'), tetapi salah menghitung P(A' ∩ B') karena mengasumsikan A dan B independen padahal tidak disebutkan.",
    },
  },
  {
    // Soal: Distribusi Binomial — P(X = k)
    questionId: "01a1163b-528f-7b64-838d-285cc9ca1a39",
    bundle: "Distribusi Geometrik Binomial Negatif",
    options: {
      A: "Siswa lupa koefisien binomial C(n,k): menghitung p^k × q^(n-k) tanpa mengalikan C(n,k), menghasilkan nilai yang jauh lebih kecil dari probabilitas sesungguhnya.",
      B: "Siswa membalik peran p dan q: menggunakan q^k × p^(n-k) alih-alih p^k × q^(n-k), mewakili miskonsepsi tentang 'sukses' vs 'gagal' dalam distribusi binomial.",
      D: "Siswa menghitung P(X ≤ k) alih-alih P(X = k): menjumlahkan semua probabilitas dari X=0 hingga X=k, mengabaikan bahwa soal menanyakan probabilitas tepat k sukses.",
      E: "Siswa menggunakan nilai n sebagai penyebut alih-alih menghitung C(n,k): memperoleh C = n/k = n·p^k·q^(n-k)/k yang tidak bermakna secara probabilistik.",
    },
  },
];

// ── R4: Bundle Barisan & Deret (Batch Lanjutan JSONB) ─────────────────────────
const r4Rationales: QuestionRationale[] = [
  {
    // Soal: Suku ke-n barisan geometri
    questionId: "01a1155f-7578-70ce-97af-3f4d76fcb298",
    bundle: "Barisan Geometri",
    options: {
      A: "Siswa salah menentukan rasio: menghitung r = U₂ - U₁ (perbedaan) alih-alih r = U₂/U₁ (rasio); menerapkan logika barisan aritmetika ke barisan geometri.",
      B: "Siswa menggunakan rumus U_n = a + (n-1)b (aritmetika) dengan b = rasio: mengganti perkalian dengan penjumlahan sehingga deret tumbuh secara linear, bukan eksponensial.",
      C: "Siswa memulai indeks n dari 0: menghitung U_n = a · r^n (bukan r^(n-1)), menghasilkan nilai lebih besar dari benar sebesar faktor r.",
      D: "Siswa salah mengidentifikasi suku pertama (a): mengambil U₂ sebagai a dan menghitung U_{n-1} = a · r^(n-2), menggeser seluruh barisan satu posisi.",
    },
  },
  {
    // Soal: Jumlah n suku deret aritmetika S_n
    questionId: "01a11590-3245-75f8-b48b-b41275934433",
    bundle: "Deret Aritmetika",
    options: {
      A: "Siswa lupa faktor ½ pada rumus S_n = n/2(2a+(n-1)b): menghitung S_n = n(2a+(n-1)b), menghasilkan nilai dua kali lebih besar dari benar.",
      B: "Siswa menggunakan rumus Gauss S = n(n+1)/2 yang hanya berlaku untuk a=1, b=1; tidak menyesuaikan untuk suku pertama dan beda yang berbeda.",
      D: "Siswa mencampurkan S_n dengan U_n: menghitung suku ke-n (bukan jumlah n suku), karena merespons pertanyaan 'jumlah' dengan rumus 'suku'.",
      E: "Siswa mensubstitusi n yang salah: menggunakan n-1 alih-alih n pada rumus S_n = n/2(a + U_n), menghasilkan nilai jumlah n-1 suku bukan n suku.",
    },
  },
  {
    // Soal: Deret geometri tak hingga — konvergensi
    questionId: "01a1155f-7578-70ce-97af-3f4d76fcb299", // contoh ID — sesuaikan
    bundle: "Deret Geometri Tak Hingga",
    options: {
      A: "Siswa menggunakan rumus S_n (jumlah terbatas) alih-alih S∞ = a/(1-r): tidak memahami konsep limit barisan geometri saat n→∞.",
      B: "Siswa salah menghitung r: mengambil r = U₁/U₂ (terbalik) sehingga mendapat |r| > 1 dan menyimpulkan deret divergen, padahal deret konvergen.",
      C: "Siswa menggunakan S∞ = a/(1+r) (tanda salah dalam penyebut): miskonsepsi tentang asal rumus S∞ = a/(1-r) dengan membalik tanda minus menjadi plus.",
      E: "Siswa menjumlahkan hanya beberapa suku awal (S₅ atau S₁₀) tanpa menggunakan rumus limit, mengira jumlah tak hingga dapat didekati dengan jumlah terbatas saja.",
    },
  },
];

async function applyRationalesJsonb(items: QuestionRationale[]): Promise<{
  updated: number;
  skipped: number;
  blockerCount: number;
}> {
  let updated = 0;
  let skipped = 0;
  let blockerCount = 0;

  for (const item of items) {
    // Check if question exists and has data_payload.options populated
    const rows = await sql`
      SELECT id,
        data_payload->'options' as options_jsonb,
        answer_key->>'correct' as correct,
        answer_key->'correctOptionIds' as correct_ids_jsonb
      FROM questions
      WHERE id = ${item.questionId}::uuid
        AND deleted_at IS NULL
    ` as Array<Record<string, unknown>>;

    if (!rows.length) {
      console.log(`  [SKIP] ${item.questionId.substring(0, 8)}: not found`);
      skipped++;
      continue;
    }

    const row = rows[0] as Record<string, unknown>;
    const optionsJsonb = row.options_jsonb as Array<{
      id: string;
      contentMarkdown: string;
      distractorRationale?: string | null;
    }> | null;

    if (!optionsJsonb || !Array.isArray(optionsJsonb) || optionsJsonb.length === 0) {
      console.log(
        `  [BLOCKER] ${item.questionId.substring(0, 8)}: data_payload.options not populated` +
        ` — MAT-144 migration required. Rationale stored in script, ready post-migration.`
      );
      blockerCount++;
      continue;
    }

    // Determine correct option IDs
    const correctRaw = row.correct as string | null;
    const correctIdsJsonb = row.correct_ids_jsonb as string | string[] | null;
    const correctIds: string[] = correctIdsJsonb
      ? Array.isArray(correctIdsJsonb) ? correctIdsJsonb : [correctIdsJsonb]
      : correctRaw ? [correctRaw] : [];

    let updatedOptions = [...optionsJsonb];
    let changed = false;

    for (let i = 0; i < updatedOptions.length; i++) {
      const opt = updatedOptions[i];
      const isCorrect = correctIds.includes(opt.id);
      if (isCorrect) continue; // Skip correct option

      const rationale = item.options[opt.id.toUpperCase()];
      if (!rationale) {
        // No rationale authored for this label in this batch
        continue;
      }

      if (opt.distractorRationale && opt.distractorRationale.trim().length >= 40) {
        console.log(`  [SKIP] Q ${item.questionId.substring(0, 8)} opt ${opt.id}: already has distractorRationale`);
        skipped++;
        continue;
      }

      // Validate min 40 chars per Zod schema
      if (rationale.length < 40) {
        console.warn(`  [WARN] Rationale for ${opt.id} too short (${rationale.length} chars) — skipping`);
        continue;
      }

      console.log(
        `  [UPDATE] Q ${item.questionId.substring(0, 8)} (${item.bundle}) opt ${opt.id}:` +
        ` "${rationale.substring(0, 80)}..."`
      );
      updatedOptions[i] = { ...opt, distractorRationale: rationale };
      changed = true;
      updated++;
    }

    if (changed && !DRY_RUN) {
      await sql`
        UPDATE questions
        SET data_payload = jsonb_set(data_payload, '{options}', ${sql.json(updatedOptions)})
        WHERE id = ${item.questionId}::uuid
      `;
    }
  }

  return { updated, skipped, blockerCount };
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE UPDATE"}`);
  console.log("Target: questions.data_payload.options[].distractorRationale (JSONB, MAT-144)");

  // Migration check (use CASE to avoid array_length on scalar-typed options)
  const migCheck = await sql`
    SELECT COUNT(*) as cnt FROM questions
    WHERE deleted_at IS NULL
      AND data_payload->'options' IS NOT NULL
      AND CASE WHEN jsonb_typeof(data_payload->'options') = 'array'
               THEN jsonb_array_length(data_payload->'options') > 0
               ELSE FALSE END
  `;
  const migratedCount = Number((migCheck[0] as Record<string, unknown>).cnt);
  console.log(`\nMigration check: ${migratedCount} questions have data_payload.options`);

  if (migratedCount === 0) {
    console.warn(
      "\nWARNING: MAT-144 migration not yet complete. All rationale entries are" +
      "\nstored in this script and ready to apply once data_payload.options is populated.\n"
    );
  }

  console.log(`\n── R3: Distribusi Peluang (${r3Rationales.length} soal) ──`);
  const r3Result = await applyRationalesJsonb(r3Rationales);

  console.log(`\n── R4: Barisan & Deret (${r4Rationales.length} soal) ──`);
  const r4Result = await applyRationalesJsonb(r4Rationales);

  const totalUpdated = r3Result.updated + r4Result.updated;
  const totalSkipped = r3Result.skipped + r4Result.skipped;
  const totalBlockers = r3Result.blockerCount + r4Result.blockerCount;

  console.log(`\n=== SUMMARY ===`);
  console.log(`R3 (Distribusi Peluang): ${r3Result.updated} distractorRationale updated, ${r3Result.blockerCount} blocked`);
  console.log(`R4 (Barisan & Deret):    ${r4Result.updated} distractorRationale updated, ${r4Result.blockerCount} blocked`);
  console.log(`Total updated: ${totalUpdated}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Total blocked (need MAT-144): ${totalBlockers}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN - no DB changes" : "LIVE - data_payload JSONB updated"}`);

  if (totalBlockers > 0) {
    console.log(
      `\nACTION REQUIRED: ${totalBlockers} entries blocked pending MAT-144 migration.` +
      `\nRe-run this script after MAT-144 data_payload migration is complete.`
    );
  }

  await sql.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
