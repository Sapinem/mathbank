/**
 * distribute-difficulty.ts — ACT-11 (Sprint 1).
 *
 * Menetapkan `questions.difficulty` 1–5 dengan heuristik rule-based sesuai
 * `docs/sprint0/FARUQ-DIFFICULTY-PLAN.md`, lalu mengkalibrasi sebarannya ke
 * target distribusi nasional (10% / 25% / 35% / 20% / 10%).
 *
 * Kenapa dua tahap (skor + kalibrasi)?
 *   - Skor heuristik memberi URUTAN kesulitan yang bermakna (monoton).
 *   - Kalibrasi kuantil mencegah degenerasi (mis. 90% masuk D3) tanpa
 *     mengubah urutan itu — soal paling "mudah" tetap dapat level terendah.
 *
 * Kontrak aman:
 *   - Hanya menyentuh baris `difficulty = 3` (nilai default) dan
 *     `deleted_at IS NULL`. Soal yang sudah punya difficulty lain TIDAK diubah.
 *   - Idempotent: jalankan ulang → tidak ada perubahan (tidak ada baris 3 lagi
 *     yang tersisa dari run pertama; sisa default tetap diproses ulang).
 *   - `--apply` wajib untuk menulis. Tanpa itu hanya laporan (dry-run).
 *
 * Jalankan:
 *   pnpm tsx scripts/distribute-difficulty.ts            # dry-run + laporan
 *   pnpm tsx scripts/distribute-difficulty.ts --apply    # tulis ke DB
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL wajib (jalankan lewat pnpm tsx)");

const APPLY = process.argv.includes("--apply");
const sql = postgres(url, { max: 4 });

/** Target distribusi nasional (Faruq): D1..D5. */
const TARGET: Record<number, number> = { 1: 0.1, 2: 0.25, 3: 0.35, 4: 0.2, 5: 0.1 };

interface Row {
  id: string;
  content_markdown: string;
  question_type: string;
  event_subtest: string | null;
  option_count: number;
  explanation_len: number;
}

const RE = {
  /** Perintah LaTeX lanjut (kalkulus / kombinatorika / struktur). */
  advanced: /\\(int|lim|sum|prod|partial|binom|oint|iint|begin\s*\{?(matrix|pmatrix|bmatrix|align|cases))/g,
  /** Perintah LaTeX dasar (pecahan, akar, pangkat). */
  basic: /\\(frac|sqrt|times|div|cdot|overline|angle|triangle|pi)/g,
  /** Variabel aljabar (x, y, n, a, b) — penanda soal non-aritmetika murni. */
  variable: /(^|[^a-z])([xyznab])([^a-z]|$)/g,
  /** Kata kunci olimpiade / universitas. */
  olympiad: /(olimpiade|osn|osp|osk|buktikan|terbukti|kongruensi|modulo|grup|ring|lapangan|deret konvergen|epsilon|bijektif|injektif|surjektif)/i,
  /** Kata kunci SMA lanjut / UTBK. */
  advancedWord: /(integral|turunan|diferensial|limit|matriks|determinan|vektor|logaritma|trigonometri|barisan|deret|program linear|peluang|permutasi|kombinasi|parabola|kuadrat|polinomial|lingkaran|dimensi tiga|statistika)/i,
  /** Kata kunci prosedural dasar (SD/SMP). */
  basicWord: /(hitunglah|tentukan hasil|hasil dari|jumlah|selisih|kurangkan|jumlahkan|keliling|luas|fpb|kpk|bilangan prima|sederhanakan|urutkan|nama bangun|banyak anggota)/i,
  /** Penanda soal cerita kontekstual (aplikasi). */
  story: /(jika|apabila|sebuah|seorang|setiap|dalam sebuah|perbandingan|harga|modal|untung|diskon|kecepatan|waktu tempuh)/i,
};

const stripImg = (s: string) => s.replace(/\{\{img:[^}]+\}\}/g, " ");

/**
 * Skor kesulitan kontinu (≈0–100). Semakin tinggi = semakin sulit.
 * Setiap komponen sengaja berbobot kecil & kontinu agar urutan tidak
 * didominasi satu fitur dan ties antar soal menjadi jarang.
 */
function scoreQuestion(r: Row): number {
  const content = stripImg(r.content_markdown);
  const lower = content.toLowerCase();
  const len = content.trim().length;
  let s = 0;

  // 1) Panjang konten — proksi jumlah informasi/langkah (0–20).
  if (len < 80) s += 0;
  else if (len < 150) s += 3;
  else if (len < 300) s += 7;
  else if (len < 600) s += 12;
  else if (len < 1200) s += 16;
  else s += 20;

  // 2) Kerapatan LaTeX (0–12): makin banyak ekspresi, makin teknis.
  const texCount = (content.match(/\\\(/g) ?? []).length;
  s += Math.min(12, texCount * 1.5);

  // 3) Perintah LaTeX lanjut vs dasar (0–18).
  const adv = (content.match(RE.advanced) ?? []).length;
  const bas = (content.match(RE.basic) ?? []).length;
  s += Math.min(14, adv * 4);
  s += Math.min(6, bas * 0.8);

  // 4) Kata kunci domain (0–16).
  if (RE.olympiad.test(lower)) s += 16;
  else if (RE.advancedWord.test(lower)) s += 8;
  if (RE.basicWord.test(lower)) s -= 5;
  if (RE.story.test(lower)) s += 3;

  // 5) Panjang pembahasan (0–14) — soal sulit butuh pembahasan panjang.
  const ex = r.explanation_len;
  if (ex > 800) s += 14;
  else if (ex > 500) s += 10;
  else if (ex > 250) s += 6;
  else if (ex > 100) s += 2;

  // 6) Tipe soal (0–6): essay & matrix grid menuntut konstruksi jawaban.
  if (r.question_type === "essay") s += 5;
  else if (r.question_type === "matrix_grid") s += 4;
  else if (r.question_type === "multiple_choice_checkbox") s += 3;

  // 7) Jumlah opsi (0–4): 5 opsi = lebih banyak jebakan.
  s += Math.min(4, Math.max(0, (r.option_count - 2) * 1));

  // 8) Variabel aljabar & besaran angka.
  const vars = (content.match(RE.variable) ?? []).length;
  s += Math.min(4, vars * 0.6);
  const nums = [...content.matchAll(/\d+/g)].map((m) => Number(m[0]));
  const maxNum = nums.length ? Math.max(...nums) : 0;
  if (maxNum >= 1000) s += 2;
  if (maxNum >= 100000) s += 2;

  // 9) Provenance: subtes UTBK/TKA cenderung penalaran tingkat tinggi.
  const st = (r.event_subtest ?? "").toLowerCase();
  if (/osn|olimpiade/.test(st)) s += 14;
  else if (/utbk|tka|penalaran|kuantitatif|lanjut/.test(st)) s += 6;
  else if (/sd/.test(st)) s -= 6;

  return s;
}

/** Ambil data fitur untuk semua baris yang masih default (difficulty = 3). */
async function loadRows(): Promise<Row[]> {
  return sql<Row[]>`
    SELECT
      q.id::text AS id,
      q.content_markdown,
      q.question_type::text AS question_type,
      q.event_subtest,
      COALESCE(o.cnt, 0)::int AS option_count,
      COALESCE(length(q.answer_key->>'explanation'), 0)::int AS explanation_len
    FROM questions q
    LEFT JOIN (
      SELECT question_id, count(*) AS cnt FROM question_options GROUP BY question_id
    ) o ON o.question_id = q.id
    WHERE q.difficulty = 3
      AND q.deleted_at IS NULL
    ORDER BY q.id
  `;
}

/**
 * Kalibrasi kuantil: urutkan berdasarkan skor, potong sesuai target %.
 * Tie-break deterministik (id) supaya hasil reproducible.
 */
function assignLevels(rows: Row[]): Map<string, number> {
  const scored = rows
    .map((r) => ({ id: r.id, score: scoreQuestion(r) }))
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));

  const out = new Map<string, number>();
  const n = scored.length;
  let cursor = 0;
  for (const level of [1, 2, 3, 4, 5]) {
    const take = level === 5 ? n - cursor : Math.round(n * TARGET[level]!);
    for (let i = 0; i < take && cursor < n; i++, cursor++) {
      out.set(scored[cursor]!.id, level);
    }
  }
  return out;
}

async function distribution(): Promise<{ difficulty: number; count: number; pct: number }[]> {
  const rows = await sql<{ difficulty: number; count: number; pct: number }[]>`
    SELECT q.difficulty,
           count(*)::int AS count,
           round(count(*)::numeric / (SELECT count(*) FROM questions WHERE deleted_at IS NULL) * 100, 1)::float AS pct
    FROM questions q
    WHERE q.deleted_at IS NULL
    GROUP BY q.difficulty
    ORDER BY q.difficulty
  `;
  return rows;
}

function printDist(title: string, rows: { difficulty: number; count: number; pct: number }[]) {
  console.log(`\n=== ${title} ===`);
  for (const r of rows) console.log(`  D${r.difficulty}: ${r.count} soal (${r.pct}%)`);
  const total = rows.reduce((a, b) => a + b.count, 0);
  console.log(`  TOTAL: ${total}`);
}

async function main() {
  console.log("Distribusi SEBELUM:");
  printDist("difficulty (sebelum)", await distribution());

  // Pagar idempotensi: kalibrasi kuantil hanya boleh dijalankan sekali.
  // Tanpa pagar ini, run kedua hanya melihat sisa baris D3 dan akan
  // memecah-belahlah 35% itu ke seluruh level → distribusi rusak bertahap.
  const [nonDefault] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM questions
     WHERE difficulty <> 3 AND deleted_at IS NULL
  `;
  const FORCE = process.argv.includes("--force");
  if (nonDefault!.n > 0 && !FORCE) {
    console.log(
      `\nDitolak: sudah ada ${nonDefault!.n} soal dengan difficulty != 3.`,
    );
    console.log("Kalibrasi kuantil tidak idempotent — jalankan ulang akan merusak sebaran.");
    console.log("Pakai --force hanya bila Anda memang ingin mengulang kalibrasi dari nol.");
    await sql.end();
    return;
  }

  const rows = await loadRows();
  console.log(`\nKandidat (difficulty = 3, belum dihapus): ${rows.length}`);
  if (rows.length === 0) {
    console.log("Tidak ada kandidat — tidak ada yang perlu diubah.");
    await sql.end();
    return;
  }

  const levels = assignLevels(rows);
  const planned: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const lv of levels.values()) planned[lv] = (planned[lv] ?? 0) + 1;
  console.log("\nRencana distribusi (kalibrasi kuantil):");
  for (const lv of [1, 2, 3, 4, 5]) {
    console.log(
      `  D${lv}: ${planned[lv]} (${((planned[lv]! / rows.length) * 100).toFixed(1)}% dari kandidat)`,
    );
  }

  // Sampel untuk validasi kurator: 3 soal teratas & terbawah per level.
  const byLevel = new Map<number, { id: string; score: number; snippet: string }[]>();
  const rowById = new Map(rows.map((r) => [r.id, r]));
  for (const [id, lv] of levels) {
    const r = rowById.get(id)!;
    const arr = byLevel.get(lv) ?? [];
    arr.push({
      id,
      score: scoreQuestion(r),
      snippet: stripImg(r.content_markdown).replace(/\s+/g, " ").slice(0, 90),
    });
    byLevel.set(lv, arr);
  }
  console.log("\nSampel (2 soal per level, skor terendah→tertinggi di level itu):");
  for (const lv of [1, 2, 3, 4, 5]) {
    const arr = (byLevel.get(lv) ?? []).sort((a, b) => a.score - b.score);
    console.log(`  D${lv}:`);
    for (const s of [arr[0], arr[arr.length - 1]].filter(Boolean)) {
      console.log(`    [${s!.score.toFixed(1)}] ${s!.snippet}`);
    }
  }

  if (!APPLY) {
    console.log("\n(dry-run) Tidak ada perubahan. Jalankan dengan --apply untuk menulis.");
    await sql.end();
    return;
  }

  // UPDATE massal via unnest — satu round-trip, tetap WHERE difficulty = 3.
  const ids: string[] = [];
  const lvs: number[] = [];
  for (const [id, lv] of levels) {
    ids.push(id);
    lvs.push(lv);
  }
  const updated = await sql`
    UPDATE questions q
       SET difficulty = v.d,
           updated_at = now()
      FROM (
        SELECT unnest(${ids}::uuid[]) AS id, unnest(${lvs}::smallint[]) AS d
      ) v
     WHERE q.id = v.id
       AND q.difficulty = 3
       AND q.deleted_at IS NULL
    RETURNING q.id
  `;
  console.log(`\nTerupdate: ${updated.length} baris.`);

  printDist("difficulty (sesudah)", await distribution());
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end({ timeout: 5 });
  process.exit(1);
});
