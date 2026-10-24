import { z } from "zod";

/**
 * Zod Schema untuk validasi struktur data_payload dan answer_key
 * pada tabel questions di MathBank.
 *
 * Mengikuti Single Table + Hybrid JSONB — tidak ada tabel question_options.
 * Seluruh komponen soal (opsi, premis, pernyataan, rubrik) disimpan di
 * kolom data_payload dan answer_key pada tabel questions.
 *
 * Mendukung 5 tipe soal dinamis:
 *   1. multiple_choice           — Pilihan Ganda Biasa (1 kunci benar)
 *   2. complex_multiple_choice   — Pilihan Ganda Kompleks / Banyak Jawaban Benar
 *   3. matching                  — Menjodohkan / Tarik Garis
 *   4. matrix                   — Matriks Pilihan / Benar-Salah per Pernyataan
 *   5. short_answer / essay      — Isian Singkat / Esai
 *
 * Standar pedagogis yang diperkuat (MAT-145):
 *   - Haladyna Rule 2: minimal 2 opsi (biasanya 5 untuk A–E)
 *   - Haladyna Rule 5: tanpa "semua di atas" / "tidak ada di atas"
 *   - Distractor Rationale Mandate: wajib untuk soal siap rilis
 *   - Matching: premis dan respons tidak boleh kosong
 *   - Matrix: minimal 2 kolom + minimal 1 pernyataan
 *   - Essay: scoringRubric wajib (poin per langkah matematis)
 */

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Frasa terlarang pada opsi — Haladyna Rule 5.
 * "Semua jawaban di atas benar" / "Tidak ada jawaban yang benar" dilarang
 * karena melemahkan daya diagnostik soal.
 */
const FORBIDDEN_OPTION_PHRASES = [
  /semua\s+(di\s+atas|jawaban).*(benar|salah)/i,
  /tidak\s+ada.*(di\s+atas|jawaban).*(benar|benar)/i,
  /all\s+of\s+the\s+above/i,
  /none\s+of\s+the\s+above/i,
];

function containsForbiddenPhrase(text: string): boolean {
  return FORBIDDEN_OPTION_PHRASES.some((re) => re.test(text));
}

// ── 1. Item Opsi Pilihan Ganda ─────────────────────────────────────────────────

/**
 * Satu opsi jawaban untuk tipe multiple_choice / complex_multiple_choice.
 *
 * @field id               — Label unik opsi ("A"–"E" atau identifier lain)
 * @field contentMarkdown  — Teks opsi, mendukung KaTeX (\( … \) / \[ … \])
 * @field distractorRationale
 *   Penjelasan miskonsepsi spesifik yang mengarahkan siswa ke opsi ini
 *   (wajib untuk opsi salah pada soal berstatus "released").
 *   Format: "(a) nama kesalahan — (b) langkah salah — (c) nilai hasil keliru"
 *   Contoh: "Siswa lupa faktor ½ pada rumus S_n sehingga menghitung
 *            S₅ = 5(2a+4b) → mendapat 30 bukan 20."
 *   Boleh null/undefined selama status soal masih "draft".
 */
export const optionItemSchema = z
  .object({
    id: z.string().min(1, "ID opsi tidak boleh kosong"),
    contentMarkdown: z
      .string()
      .min(1, "Konten opsi tidak boleh kosong")
      .refine(
        (val) => !containsForbiddenPhrase(val),
        "Opsi tidak boleh menggunakan frasa 'semua di atas' atau 'tidak ada di atas' (Haladyna Rule 5)"
      ),
    distractorRationale: z
      .string()
      .min(
        40,
        "Distractor rationale terlalu pendek — sebutkan nama kesalahan, langkah salah, dan nilai hasil"
      )
      .nullable()
      .optional(),
  })
  .strict();

export type OptionItem = z.infer<typeof optionItemSchema>;

// ── 2. Payload Pilihan Ganda (Single / Kompleks) ───────────────────────────────

/**
 * data_payload untuk multiple_choice dan complex_multiple_choice.
 *
 * Validasi ketat:
 * - Minimal 2 opsi (Haladyna Rule 2); lazimnya 5 (A–E) untuk UTBK.
 * - shuffleOptions: default true (acak posisi opsi antar-siswa).
 */
export const multipleChoicePayloadSchema = z
  .object({
    type: z.enum(["multiple_choice", "complex_multiple_choice"]),
    options: z
      .array(optionItemSchema)
      .min(2, "Minimal 2 opsi diperlukan (Haladyna Rule 2)")
      .max(8, "Maksimal 8 opsi"),
    shuffleOptions: z.boolean().default(true).optional(),
  })
  .strict();

export type MultipleChoicePayload = z.infer<typeof multipleChoicePayloadSchema>;

// ── 3. Payload Menjodohkan (Matching) ─────────────────────────────────────────

const matchingItemSchema = z
  .object({
    id: z.string().min(1, "ID item tidak boleh kosong"),
    contentMarkdown: z.string().min(1, "Konten item tidak boleh kosong"),
  })
  .strict();

/**
 * data_payload untuk matching (Menjodohkan / Tarik Garis).
 *
 * Validasi ketat:
 * - premises: daftar pernyataan/pertanyaan — tidak boleh kosong (min 1).
 * - responses: daftar pilihan jawaban — tidak boleh kosong (min 1).
 * - Validasi bijeksi premis→respons ada di answer_key.matchingPairs.
 */
export const matchingPayloadSchema = z
  .object({
    type: z.literal("matching"),
    premises: z
      .array(matchingItemSchema)
      .min(1, "Minimal 1 premis diperlukan"),
    responses: z
      .array(matchingItemSchema)
      .min(1, "Minimal 1 respons diperlukan"),
  })
  .strict();

export type MatchingPayload = z.infer<typeof matchingPayloadSchema>;

// ── 4. Payload Matriks (Matrix / Benar-Salah) ─────────────────────────────────

/**
 * Satu baris soal matriks — pernyataan + kunci jawaban per-baris.
 *
 * @field text   — pernyataan/kalimat yang dinilai (mendukung KaTeX).
 * @field answer — kunci kolom yang dipilih (misal "Benar" / "Salah").
 *                 Boleh kosong selama status soal masih "draft";
 *                 wajib tidak kosong saat soal → "ready" (dikontrol release guard).
 */
const matrixRowSchema = z
  .object({
    text: z.string().min(1, "Teks pernyataan matriks tidak boleh kosong"),
    answer: z.string(),
  })
  .strict();

/**
 * data_payload untuk matrix_grid (Matriks Benar/Salah per Pernyataan).
 *
 * Bentuk resmi (MAT-156, Option A) — mengikuti data produksi & pipeline ingest:
 *   { labels: ["Benar","Salah"], rows: [{ text, answer }] }
 *
 * - labels : minimal 2 label kolom (misal ["Benar","Salah"] / ["Ya","Tidak"]).
 * - rows   : minimal 1 baris pernyataan.
 * - type   : opsional; bila ada harus bernilai "matrix" (kompatibilitas lama).
 *
 * Kunci jawaban disimpan inline di `rows[].answer`, bukan di `answer_key.matrixAnswers`.
 * Pipeline ingest Defantri (`defantri-tf.ts`) dan renderer (`matrix-grid-view.tsx`)
 * menggunakan bentuk ini secara langsung — tidak ada migrasi data yang diperlukan.
 */
export const matrixPayloadSchema = z
  .object({
    type: z.literal("matrix").optional(),
    labels: z
      .array(z.string().min(1, "Label kolom tidak boleh kosong"))
      .min(2, "Minimal 2 label kolom diperlukan (misal: Benar, Salah)")
      .max(6, "Maksimal 6 label kolom"),
    rows: z
      .array(matrixRowSchema)
      .min(1, "Minimal 1 baris pernyataan diperlukan"),
    columns: z.array(z.string()).optional(),
    statements: z.array(z.object({
      id: z.string(),
      contentMarkdown: z.string(),
    })).optional(),
  })
  .strict();

export type MatrixPayload = z.infer<typeof matrixPayloadSchema>;

// ── 5. Payload Isian Singkat / Esai ───────────────────────────────────────────

/**
 * data_payload untuk short_answer dan essay.
 *
 * Validasi ketat (MAT-145):
 * - rubricGuidelines: panduan penilaian langkah matematis — wajib diisi
 *   agar guru/AI dapat memberikan skor objektif per langkah.
 *   Format rubrik: "Langkah 1 (2 poin): … Langkah 2 (3 poin): …"
 * - expectedLength: petunjuk panjang jawaban untuk siswa (opsional).
 *
 * scoringRubric terstruktur (poin per langkah) ada di answer_key.scoringRubric.
 */
export const textInputPayloadSchema = z
  .object({
    type: z.enum(["short_answer", "essay"]),
    expectedLength: z.string().optional(),
    rubricGuidelines: z
      .string()
      .min(
        20,
        "Panduan rubrik penilaian wajib diisi — tulis langkah-langkah penilaian matematis"
      ),
  })
  .strict();

export type TextInputPayload = z.infer<typeof textInputPayloadSchema>;

// ── Union data_payload ─────────────────────────────────────────────────────────

/**
 * Union payload kanonik yang membedakan tipe via field `type`.
 *
 * `matrixPayloadSchema` TIDAK termasuk di sini karena field `type`-nya opsional
 * (bentuk produksi tidak menyertakan `type`). Validasi matriks dilakukan
 * terpisah via `matrixPayloadSchema.safeParse()` dan `isMatrixPayload()`.
 */
export const questionDataPayloadSchema = z.discriminatedUnion("type", [
  multipleChoicePayloadSchema,
  matchingPayloadSchema,
  matrixPayloadSchema,
  textInputPayloadSchema,
]);

export type QuestionDataPayload = z.infer<typeof questionDataPayloadSchema>;

/**
 * Deteksi heuristik — apakah `dataPayload` adalah bentuk matriks produksi?
 * Dipakai oleh gerbang tulis & release guard sebagai pengganti `type === "matrix"`.
 */
export function isMatrixPayload(dataPayload: Record<string, unknown>): boolean {
  return (
    Array.isArray(dataPayload.rows) &&
    Array.isArray(dataPayload.labels) &&
    dataPayload.type !== "multiple_choice" &&
    dataPayload.type !== "complex_multiple_choice" &&
    dataPayload.type !== "matching" &&
    dataPayload.type !== "short_answer" &&
    dataPayload.type !== "essay"
  );
}

// ── Kunci Jawaban (answer_key) ─────────────────────────────────────────────────

/**
 * Kontrak answer_key yang tersimpan di kolom answer_key pada tabel questions.
 *
 * Setiap tipe soal menggunakan subset field yang relevan:
 *
 * multiple_choice         → correctOptionIds: string  (satu label, misal "C")
 * complex_multiple_choice → correctOptionIds: string[] (satu atau lebih)
 * matching                → matchingPairs: Record<premiseId, responseId>
 * matrix                  → matrixAnswers: Record<statementId, columnLabel>
 * short_answer            → acceptedAnswers: string[]
 * essay                   → scoringRubric wajib diisi
 *
 * Semua tipe wajib memiliki explanationMarkdown (pembahasan ber-KaTeX).
 */
export const answerKeySchema = z
  .object({
    /**
     * Kunci benar untuk multiple_choice (string) atau
     * complex_multiple_choice (string[]).
     * Gunakan label "A"–"E" sesuai id opsi di data_payload.options.
     */
    correctOptionIds: z
      .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
      .optional(),

    /**
     * Pemetaan premis → respons untuk tipe matching.
     * Kunci: id premis; Nilai: id respons.
     * Contoh: { "p1": "r3", "p2": "r1", "p3": "r2" }
     */
    matchingPairs: z.record(z.string(), z.string()).optional(),

    /**
     * Pemetaan pernyataan → kolom untuk tipe matrix.
     * Kunci: id pernyataan; Nilai: label kolom (misal "Benar" / "Salah").
     * Contoh: { "s1": "Benar", "s2": "Salah", "s3": "Benar" }
     */
    matrixAnswers: z.record(z.string(), z.string()).optional(),

    /**
     * Jawaban yang diterima untuk short_answer.
     * Boleh menyertakan variasi ejaan, ekspresi setara, atau pola regex.
     * Contoh: ["12", "dua belas", "1,2 × 10^1"]
     */
    acceptedAnswers: z.array(z.string().min(1)).optional(),

    /**
     * Pembahasan lengkap soal dengan sintaks KaTeX.
     * Wajib untuk semua tipe soal.
     * Delimiter: \( … \) untuk inline, \[ … \] untuk display.
     */
    explanationMarkdown: z
      .string()
      .min(1, "Pembahasan (explanationMarkdown) wajib diisi"),

    /**
     * Rubrik penilaian terstruktur — WAJIB untuk essay, sangat dianjurkan
     * untuk short_answer multi-langkah.
     *
     * Format yang disarankan (poin per langkah):
     *   "Langkah 1 — Memisahkan variabel (2 poin): …
     *    Langkah 2 — Menerapkan aturan rantai (3 poin): …
     *    Langkah 3 — Jawaban akhir + satuan (2 poin): …
     *    Total: 7 poin"
     *
     * Rubrik ini memungkinkan penilaian parsial (partial credit) dan
     * diagnosis kesalahan per langkah.
     */
    scoringRubric: z.string().optional(),

    /**
     * MAT-41 — Objek rubrik terstruktur (kriteria bertingkat + poin).
     */
    rubric: z
      .object({
        totalPoints: z.number().positive().max(1000).optional(),
        criteria: z
          .array(
            z.object({
              id: z.string().max(50).optional(),
              description: z.string().min(10).max(500),
              points: z.number().positive().max(100),
            })
          )
          .min(1)
          .max(20),
      })
      .nullable()
      .optional(),
  })
  .strict();

export type AnswerKeyPayload = z.infer<typeof answerKeySchema>;

// ── Guard Pedagogis untuk Soal Siap Rilis ─────────────────────────────────────

/**
 * Validasi tambahan untuk soal berstatus "released" (siap dipublikasikan).
 *
 * Menggunakan superRefine agar pesan error spesifik per field.
 * Dipanggil dari service layer sebelum mengubah status soal ke "released".
 *
 * Aturan yang diperkuat:
 * 1. multiple_choice / complex_multiple_choice:
 *    - Semua opsi SALAH wajib memiliki distractorRationale (min 40 karakter).
 * 2. essay:
 *    - answer_key.scoringRubric wajib diisi.
 * 3. short_answer:
 *    - answer_key.acceptedAnswers tidak boleh kosong.
 * 4. matching:
 *    - matchingPairs harus mencakup semua premiseId dari data_payload.premises.
 * 5. matrix_grid (MAT-156):
 *    - Setiap baris di `data_payload.rows[]` WAJIB memiliki `answer` tidak kosong.
 *    - Kunci ada inline di rows, bukan di answer_key.matrixAnswers.
 */
export const releasedQuestionGuardSchema = z
  .object({
    // dataPayload diterima sebagai record bebas agar matrix (tanpa `type`) lolos
    // lapis discriminatedUnion; aturan per-tipe diterapkan di superRefine.
    dataPayload: z.record(z.string(), z.unknown()),
    answerKey: answerKeySchema,
  })
  .superRefine((val, ctx) => {
    const { dataPayload, answerKey } = val;

    // Aturan 1: Distractor rationale wajib untuk soal PG siap rilis
    if (
      dataPayload.type === "multiple_choice" ||
      dataPayload.type === "complex_multiple_choice"
    ) {
      const opts = dataPayload.options as Array<{ id: string; distractorRationale?: string | null }> ?? [];
      const correctIds: string[] = Array.isArray(answerKey.correctOptionIds)
        ? answerKey.correctOptionIds
        : answerKey.correctOptionIds
          ? [answerKey.correctOptionIds]
          : [];

      for (const opt of opts) {
        const isCorrect = correctIds.includes(opt.id);
        if (!isCorrect) {
          if (
            !opt.distractorRationale ||
            opt.distractorRationale.trim().length < 40
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["dataPayload", "options"],
              message: `Opsi ${opt.id} adalah pengecoh (distractor) dan wajib memiliki distractorRationale (min 40 karakter) sebelum soal dirilis. Sebutkan: (a) nama kesalahan, (b) langkah salah, (c) nilai hasil keliru.`,
            });
          }
        }
      }
    }

    // Aturan 2: Rubrik esai wajib untuk soal essay siap rilis
    if (dataPayload.type === "essay") {
      const hasStringRubric =
        typeof answerKey.scoringRubric === "string" &&
        answerKey.scoringRubric.trim().length >= 20;
      const hasObjectRubric = Boolean(
        answerKey.rubric &&
          typeof answerKey.rubric === "object" &&
          Array.isArray((answerKey.rubric as { criteria?: unknown[] }).criteria) &&
          (answerKey.rubric as { criteria: unknown[] }).criteria.length >= 1,
      );

      if (!hasStringRubric && !hasObjectRubric) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["answerKey", "scoringRubric"],
          message:
            "Soal esai wajib memiliki scoringRubric (min 20 karakter) atau rubric terstruktur sebelum dirilis — tulis rubrik poin per langkah matematis.",
        });
      }
    }

    // Aturan 3: acceptedAnswers wajib untuk short_answer siap rilis
    if (dataPayload.type === "short_answer") {
      if (
        !answerKey.acceptedAnswers ||
        answerKey.acceptedAnswers.length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["answerKey", "acceptedAnswers"],
          message:
            "Soal isian singkat wajib memiliki minimal 1 acceptedAnswers sebelum dirilis.",
        });
      }
    }

    // Aturan 4: matchingPairs harus mencakup semua premis
    if (dataPayload.type === "matching") {
      const premises = dataPayload.premises as Array<{ id: string }> ?? [];
      const premiseIds = new Set(premises.map((p) => p.id));
      const pairedIds = new Set(Object.keys(answerKey.matchingPairs ?? {}));
      for (const pid of premiseIds) {
        if (!pairedIds.has(pid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["answerKey", "matchingPairs"],
            message: `Premis "${pid}" belum memiliki pasangan di matchingPairs.`,
          });
        }
      }
    }

    // Aturan 5 (MAT-156): setiap baris matriks WAJIB memiliki kunci `answer`
    // Deteksi via isMatrixPayload() — bukan `type === "matrix"` (type opsional).
    if (isMatrixPayload(dataPayload)) {
      const rows = dataPayload.rows as Array<{ text: string; answer: string }>;
      rows.forEach((row, idx) => {
        if (!row.answer || row.answer.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["dataPayload", "rows", idx, "answer"],
            message: `Baris ${idx + 1} ("${row.text.slice(0, 40)}") belum memiliki kunci jawaban (answer). Semua baris wajib memiliki answer sebelum soal matriks dirilis.`,
          });
        }
      });
    }
  });

export type ReleasedQuestionGuard = z.infer<typeof releasedQuestionGuardSchema>;
