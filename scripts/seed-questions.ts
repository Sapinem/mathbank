/**
 * Seeder soal contoh — untuk pengembangan & pengujian UI.
 * Jalankan: pnpm tsx scripts/seed-questions.ts
 *
 * Membuat: taksonomi topik → sumber → soal (beragam tipe & status).
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL belum diatur");
const sql = postgres(url, { max: 1 });

// ── Topik ─────────────────────────────────────────────────────
const TOPICS = [
  { key: "bilangan", name: "Bilangan", parent: null },
  { key: "aljabar", name: "Aljabar", parent: null },
  { key: "geometri", name: "Geometri", parent: null },
  { key: "statistika", name: "Statistika & Peluang", parent: null },
  { key: "persamaan-kuadrat", name: "Persamaan Kuadrat", parent: "aljabar" },
  { key: "fungsi-kuadrat", name: "Fungsi Kuadrat", parent: "aljabar" },
  { key: "segitiga", name: "Segitiga", parent: "geometri" },
  { key: "lingkaran", name: "Lingkaran", parent: "geometri" },
];

// ── Sumber ────────────────────────────────────────────────────
const SOURCES = [
  { kind: "book", label: "Matematika Wajib Kelas X" },
  { kind: "book", label: "Buku Paket Matematika Kelas XI" },
  { kind: "website", label: "Kumpulan Soal UTBK Online" },
  { kind: "competition", label: "OSN Matematika SMA" },
  { kind: "school", label: "Ujian Sekolah SMAN 1" },
];

// ── Soal contoh ───────────────────────────────────────────────
type Seed = {
  type: string;
  difficulty: number;
  cognitive: string;
  grade: string;
  content: string;
  answer: Record<string, unknown>;
  payload?: Record<string, unknown>;
  status: string;
  options?: { label: string; content: string; correct?: boolean }[];
};

/** Helper: JSON aman untuk postgres.js. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = (v: unknown): any => sql.json(v as never);

const QUESTIONS: Seed[] = [
  {
    type: "single_choice", difficulty: 1, cognitive: "remember", grade: "10",
    content: "Hasil dari $2^3 + 3^2$ adalah …",
    answer: { correct: ["C"] }, status: "ready", options: [
      { label: "A", content: "$12$" }, { label: "B", content: "$15$" },
      { label: "C", content: "$17$", correct: true }, { label: "D", content: "$19$" },
    ],
  },
  {
    type: "single_choice", difficulty: 2, cognitive: "apply", grade: "10",
    content: "Jika $x + 3 = 10$, maka nilai $2x$ adalah …",
    answer: { correct: ["B"] }, status: "ready", options: [
      { label: "A", content: "$12$" }, { label: "B", content: "$14$", correct: true },
      { label: "C", content: "$16$" }, { label: "D", content: "$18$" },
    ],
  },
  {
    type: "single_choice", difficulty: 3, cognitive: "apply", grade: "11",
    content: "Akar-akar persamaan $x^2 - 5x + 6 = 0$ adalah …",
    answer: { correct: ["A"] }, status: "review", options: [
      { label: "A", content: "$x=2$ atau $x=3$", correct: true },
      { label: "B", content: "$x=-2$ atau $x=-3$" },
      { label: "C", content: "$x=1$ atau $x=6$" },
      { label: "D", content: "$x=-1$ atau $x=-6$" },
    ],
  },
  {
    type: "multiple_choice_checkbox", difficulty: 3, cognitive: "analyze", grade: "11",
    content: "Manakah pernyataan yang **benar** tentang fungsi $f(x)=x^2-4$? (Pilih semua)",
    answer: { correct: ["A", "C"] }, status: "draft", options: [
      { label: "A", content: "Memotong sumbu-$x$ di $x=2$ dan $x=-2$", correct: true },
      { label: "B", content: "Nilai minimumnya $4$" },
      { label: "C", content: "Sumbu simetri $x=0$", correct: true },
      { label: "D", content: "Terbuka ke bawah" },
    ],
  },
  {
    type: "assertion_reason", difficulty: 4, cognitive: "evaluate", grade: "12",
    content:
      "**Pernyataan:** $\\sqrt{16}=4$.\n**Alasan:** $4^2=16$.\n\nPilih:",
    answer: { correct: ["A"] }, status: "ready", options: [
      { label: "A", content: "Pernyataan benar, alasan benar, keduanya berhubungan", correct: true },
      { label: "B", content: "Pernyataan benar, alasan benar, tak berhubungan" },
      { label: "C", content: "Pernyataan benar, alasan salah" },
      { label: "D", content: "Pernyataan salah, alasan benar" },
    ],
  },
  {
    type: "combination_1234", difficulty: 3, cognitive: "analyze", grade: "10",
    content:
      "Perhatikan pernyataan berikut.\n(1) $2+3=5$\n(2) $\\sqrt{4}=3$\n(3) $5>2$\n(4) $\\frac{1}{2}<\\frac{1}{3}$\n\nPernyataan yang benar adalah …",
    answer: { correct: ["B"] }, status: "draft", options: [
      { label: "A", content: "(1) dan (2)" }, { label: "B", content: "(1) dan (3)", correct: true },
      { label: "C", content: "(2) dan (4)" }, { label: "D", content: "(3) dan (4)" },
    ],
  },
  {
    type: "quantitative_pq", difficulty: 4, cognitive: "analyze", grade: "11",
    content: "Diketahui $P=3^4+4^3$ dan $Q=5^3$. Manakah yang benar?",
    answer: { correct: ["A"] }, status: "review", options: [
      { label: "A", content: "$P>Q$", correct: true }, { label: "B", content: "$P<Q$" },
      { label: "C", content: "$P=Q$" }, { label: "D", content: "Tak dapat ditentukan" },
    ],
  },
  {
    type: "data_sufficiency", difficulty: 4, cognitive: "evaluate", grade: "12",
    content: "Berapakah nilai $x$?\n(1) $x+y=10$\n(2) $y=4$",
    answer: { correct: ["C"] }, status: "draft", options: [
      { label: "A", content: "Pernyataan (1) saja cukup" },
      { label: "B", content: "Pernyataan (2) saja cukup" },
      { label: "C", content: "Keduanya diperlukan", correct: true },
      { label: "D", content: "Keduanya tidak cukup" },
    ],
  },
  {
    type: "short_answer", difficulty: 2, cognitive: "apply", grade: "10",
    content: "Tentukan nilai $x$ dari $3x - 6 = 9$.",
    answer: { text: "5", explanation: "$3x=15 \\Rightarrow x=5$" }, status: "ready",
  },
  {
    type: "essay", difficulty: 5, cognitive: "create", grade: "12",
    content:
      "Buktikan bahwa jumlah dua bilangan ganjil selalu bilangan genap. Sertakan langkah-langkahnya.",
    answer: { explanation: "M isal $2k+1$ dan $2m+1$; jumlahnya $2(k+m+1)$ → genap." },
    status: "draft",
  },
  {
    type: "matrix_grid", difficulty: 4, cognitive: "analyze", grade: "11",
    content: "Tentukan benar/salah setiap pernyataan tentang barisan aritmetika $2,5,8,\\dots$",
    payload: { statements: ["Beda $=3$", "$U_{10}=29$", "$S_5=40$"] },
    answer: { correct: ["A", "B", "D"] }, status: "draft", options: [
      { label: "A", content: "Benar" }, { label: "B", content: "Salah" },
    ],
  },
  {
    type: "matching", difficulty: 5, cognitive: "evaluate", grade: "12",
    content: "Jodohkan setiap fungsi dengan turunannya.",
    payload: { left: ["$x^2$", "$2x$", "$\\sin x$"], right: ["$2x$", "$2$", "$\\cos x$"] },
    answer: { correct: ["A", "B", "C"] }, status: "draft", options: [
      { label: "A", content: "$x^2 \\to 2x$" }, { label: "B", content: "$2x \\to 2$" },
      { label: "C", content: "$\\sin x \\to \\cos x$" },
    ],
  },
  {
    type: "stimulus", difficulty: 3, cognitive: "understand", grade: "11",
    content:
      "**Bacaan:** Sebuah toko menjual dua jenis kue. Kue A seharga Rp5.000, kue B Rp7.000. Seorang pembeli membeli 10 kue dengan total Rp62.000.",
    answer: {}, status: "ready",
  },
  {
    type: "single_choice", difficulty: 3, cognitive: "apply", grade: "11",
    content: "Berdasarkan bacaan, berapa banyak kue A yang dibeli?",
    answer: { correct: ["B"] }, status: "ready", options: [
      { label: "A", content: "3" }, { label: "B", content: "4", correct: true },
      { label: "C", content: "5" }, { label: "D", content: "6" },
    ],
  },
];

async function main() {
  // Bersihkan (idempoten)
  // MAT-146: `question_options` sudah di-drop — opsi hidup di
  // `questions.data_payload.options`, jadi ikut terhapus bersama `questions`.
  await sql`DELETE FROM question_topics`;
  await sql`DELETE FROM question_tags`;
  await sql`DELETE FROM questions`;
  await sql`DELETE FROM books`;
  await sql`DELETE FROM institutions`;
  await sql`DELETE FROM sources`;
  await sql`DELETE FROM topics`;

  // Topik — akar dulu, lalu anak
  const topicId = new Map<string, string>();
  for (const t of TOPICS.filter((t) => t.parent === null)) {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO topics (name, level, sort_order) VALUES (${t.name}, 1, 0)
      RETURNING id`;
    topicId.set(t.key, rows[0].id);
  }
  for (const t of TOPICS.filter((t) => t.parent !== null)) {
    const parentId = topicId.get(t.parent as string);
    const rows = await sql<{ id: string }[]>`
      INSERT INTO topics (name, level, parent_id, sort_order)
      VALUES (${t.name}, 2, ${parentId ?? null}, 0) RETURNING id`;
    topicId.set(t.key, rows[0].id);
  }

  // Sumber
  const sourceIds: string[] = [];
  for (const s of SOURCES) {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO sources (kind, label)
      VALUES (${s.kind}, ${s.label}) RETURNING id`;
    sourceIds.push(rows[0].id);
  }

  // Soal
  const topicKeys = [...topicId.keys()];
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    // MAT-146: opsi ditulis ke `data_payload.options` (JSONB), bukan tabel anak.
    // Bentuk item mengikuti kontrak MAT-145: `{ id, contentMarkdown, distractorRationale? }`;
    // `label` dipertahankan sebagai mirror agar proyeksi lama tetap cocok.
    const payload: Record<string, unknown> = { type: q.type, ...(q.payload ?? {}) };
    if (q.options) {
      payload.options = q.options.map((o) => ({
        id: o.label,
        label: o.label,
        contentMarkdown: o.content,
      }));
    }
    const rows = await sql<{ id: string }[]>`
      INSERT INTO questions (
        question_type, difficulty, cognitive_level, grade, content_markdown,
        data_payload, answer_key, status, source_id, is_flagged, flag_notes, author_id
      ) VALUES (
        ${q.type}, ${q.difficulty}, ${q.cognitive}, ${q.grade}, ${q.content},
        ${j(payload)}, ${j(q.answer)}, ${q.status},
        ${sourceIds[i % sourceIds.length]}, ${i === 10}, ${i === 10 ? "Perlu cek kunci" : null},
        'seed'
      ) RETURNING id`;
    const questionId = rows[0].id;

    // Hubungkan 1 topik
    const t = topicId.get(topicKeys[i % topicKeys.length]) as string;
    await sql`INSERT INTO question_topics (question_id, topic_id) VALUES (${questionId}, ${t})`;
  }

  const [{ n }] = await sql<[{ n: number }]>`SELECT count(*)::int AS n FROM questions`;
  const [{ t }] = await sql<[{ t: number }]>`SELECT count(*)::int AS t FROM topics`;
  const [{ s }] = await sql<[{ s: number }]>`SELECT count(*)::int AS s FROM sources`;
  console.log(`Selesai: questions=${n}, topics=${t}, sources=${s}`);
  await sql.end();
}

main().catch((e) => {
  console.error("Seed gagal:", e);
  process.exit(1);
});
