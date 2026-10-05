/**
 * Enrichment soal (M10-d) — prompt + parse usulan AI.
 *
 * **Prinsip (terkunci):** AI hanya **mengusulkan**. Hasil TIDAK ditulis langsung
 * ke soal; disimpan sebagai usulan dan status soal → `review`. `answer_key.correct`
 * TIDAK PERNAH disentuh (rubrik penilaian boleh ditambahkan, lihat MAT-41).
 *
 * Cakupan yang diusulkan (keputusan D3): **topik · kesulitan · kognitif · tags**.
 * Sejak MAT-41 ditambah **kontrak pedagogi**: *distractor rationale* (A–E) dan
 * *rubrik penilaian esai*, plus **validator KaTeX murni** (Haladyna 31 kaidah).
 *
 * Semua validator di sini **murni** (tanpa DB/jaringan) dan menjadi satu sumber
 * kebenaran untuk pipeline enrichment + gate mutu. Standar hidup: `docs/PEDAGOGY.md`.
 */
import katex from "katex";
import type { EnrichmentProposal } from "@/lib/contracts/ai";

/** Topik yang tersedia (dikirim ke prompt agar AI memilih dari daftar). */
export interface EnrichContext {
  /** Daftar topik yang ADA di sistem (nama). */
  topics: string[];
  /** Daftar tag yang ADA (nama) — opsional. */
  tags?: string[];
}

/**
 * Field yang diminta.
 * - Metadata (D3): `topics · difficulty · cognitiveLevel · tags`.
 * - Pedagogi (MAT-41): `distractorRationale · rubric`.
 */
export type EnrichField =
  | "topics"
  | "difficulty"
  | "cognitiveLevel"
  | "tags"
  | "distractorRationale"
  | "rubric";

/** Field metadata klasik (default lama — tak berubah agar kompatibel). */
export const ALL_FIELDS: EnrichField[] = ["topics", "difficulty", "cognitiveLevel", "tags"];

/** Field pedagogi (opt-in eksplisit — bukan default). */
export const PEDAGOGY_FIELDS: EnrichField[] = ["distractorRationale", "rubric"];

/** Seluruh field yang didukung. */
export const ALL_ENRICH_FIELDS: EnrichField[] = [...ALL_FIELDS, ...PEDAGOGY_FIELDS];

const DIFFICULTY = [1, 2, 3, 4, 5] as const;
const COGNITIVE = ["remember", "understand", "apply", "analyze", "evaluate", "create"] as const;

// ════════════════════════════════════════════════════════════════════════
// 1. Kontrak Pedagogi — konstanta (Haladyna 31 kaidah)
// ════════════════════════════════════════════════════════════════════════

/** Jumlah kaidah Haladyna yang ditegakkan kontrak (lihat `docs/PEDAGOGY.md`). */
export const HALADYNA_RULE_COUNT = 31;

/** Panjang minimum rationale agar dianggap analisis, bukan tempelan. */
export const MIN_RATIONALE_LENGTH = 40;

/**
 * Frasa placeholder generik yang DILARANG — tidak menyebut miskonsepsi konkret.
 * (Padanan deteksi di `docs/pedagogy/AUDIT-DISTRACTOR-RATIONALE.md` §1.3.)
 */
export const PLACEHOLDER_RATIONALE_PHRASES: readonly string[] = [
  "salah karena",
  "jawaban salah",
  "jawaban ini salah",
  "jawaban tidak tepat",
  "tidak tepat",
  "kesalahan perhitungan",
  "kurang teliti",
  "distractor",
  "opsi salah",
  "pengecoh",
  "tidak sesuai",
];

/**
 * Kata penanda penalaran: rationale wajib menjelaskan **mengapa** opsi itu
 * menggoda dan kesalahan langkah apa yang menghasilkannya (nama kesalahan +
 * langkah salah + hasil). Bukan daftar kaku — penanda semantik, bukan tata bahasa.
 */
export const REASONING_MARKERS: readonly string[] = [
  "karena",
  "sehingga",
  "akibatnya",
  "menganggap",
  "mengira",
  "keliru",
  "lupa",
  "salah",
  "menghitung",
  "mengabaikan",
  "tertukar",
  "menukar",
  "menjumlah",
  "mengalikan",
  "membagi",
  "mengurang",
  "tanda",
  "rumus",
  "langkah",
  "seharusnya",
  "padahal",
  "menyamakan",
  "membalik",
];

/**
 * Macro LaTeX **terlarang** dalam bank soal (keamanan + portabilitas render).
 * Menggantikan peran `trust:false` KaTeX yang hanya *menonaktifkan* tetapi
 * tetap menyimpan teks berbahaya.
 */
export const FORBIDDEN_MACROS: readonly string[] = [
  // I/O & file
  "input",
  "include",
  "write",
  "openout",
  "read",
  "openin",
  "catcode",
  "csname",
  "endcsname",
  // Definisi makro (bisa jadi vektor ekspansi/DoS)
  "newcommand",
  "renewcommand",
  "providecommand",
  "def",
  "gdef",
  "edef",
  "xdef",
  "let",
  "futurelet",
  "usepackage",
  "RequirePackage",
  "documentclass",
  // Hyperlink / URL / gambar eksternal (XSS & SSRF)
  "href",
  "url",
  "includegraphics",
  // Ekstensi HTML KaTeX (inject atribut/kelas)
  "htmlClass",
  "htmlId",
  "htmlStyle",
  "htmlData",
  "class",
  "style",
  "id",
];

// ════════════════════════════════════════════════════════════════════════
// 2. Validator KaTeX murni (unbalanced braces · empty frac · macro terlarang)
// ════════════════════════════════════════════════════════════════════════

export type KatexIssueKind = "syntax" | "unbalanced_braces" | "empty_frac" | "forbidden_macro";

export interface KatexIssue {
  kind: KatexIssueKind;
  /** Potongan rumus (atau macro) yang bermasalah. */
  expression: string;
  /** Pesan ringkas (HTML sudah dibersihkan). */
  message: string;
  /** Nomor baris 1-indeks (bila diketahui). */
  line: number;
}

export interface KatexContractResult {
  ok: boolean;
  issues: KatexIssue[];
}

/** Satu potongan rumus hasil ekstraksi dari markdown. */
export interface MathSegment {
  value: string;
  display: boolean;
  line: number;
}

/**
 * Regex segmen matematika: `\[...\]` (display), `\(...\)` (inline),
 * lalu `$$...$$` dan `$...$` (data lama). Urutan alternasi penting.
 */
const MATH_RE = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g;

/** Nomor baris 1-indeks dari offset karakter. */
function lineAt(text: string, offset: number): number {
  return text.slice(0, Math.max(0, offset)).split("\n").length;
}

/** Ekstrak seluruh segmen matematika (delimiter murni `\(\)` / `\[\]` + legacy `$`). */
export function extractMathSegments(markdown: string): MathSegment[] {
  const out: MathSegment[] = [];
  if (!markdown) return out;
  MATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MATH_RE.exec(markdown)) !== null) {
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    const display = m[1] !== undefined || m[3] !== undefined;
    out.push({ value: raw.trim(), display, line: lineAt(markdown, m.index) });
  }
  return out;
}

/**
 * Kedalaman kurung kurawal (mengabaikan `\{` `\}` yang di-escape).
 *
 * CORR-04: begitu kedalaman **negatif** (kurung penutup muncul tanpa pembuka,
 * mis. pola terbalik `}{`), langsung kembalikan `-1`. Versi lama menyeimbangkan
 * kembali `}{` menjadi 0 sehingga rumus cacat lolos validasi.
 */
function braceDepth(expr: string): number {
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth < 0) return -1;
    }
  }
  return depth;
}

/**
 * Offset karakter kurung kurawal bermasalah pertama — kurung terbalik
 * (kedalaman negatif) atau kurung pembuka yang tak pernah ditutup.
 * `-1` = seluruh kurung seimbang. Dipakai hanya untuk **lokasi galat**
 * (nomor baris + cuplikan); keputusan lolos/tidak tetap dari `braceDepth`.
 */
function firstBraceFault(expr: string): number {
  const open: number[] = [];
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "{") open.push(i);
    else if (c === "}") {
      if (open.length === 0) return i;
      open.pop();
    }
  }
  return open.length ? open[0] : -1;
}

/**
 * Baca `count` grup `{ ... }` berturut-turut mulai `from`, dengan
 * penghitungan kedalaman sehingga **kurung bersarang** ikut terbaca utuh
 * (mis. `\frac{\sqrt{2}}{}` → `["\sqrt{2}", ""]`).
 * `null` = argumen tak lengkap / bukan grup (biar validator sintaks KaTeX
 * yang melaporkannya, bukan pemeriksa pecahan kosong).
 */
function readBraceGroups(expr: string, from: number, count: number): string[] | null {
  const groups: string[] = [];
  let i = from;
  for (let k = 0; k < count; k++) {
    while (i < expr.length && /\s/.test(expr[i])) i++;
    if (expr[i] !== "{") return null;
    let depth = 0;
    const start = i + 1;
    let closed = false;
    for (; i < expr.length; i++) {
      const c = expr[i];
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          groups.push(expr.slice(start, i));
          i++;
          closed = true;
          break;
        }
      }
    }
    if (!closed) return null;
  }
  return groups;
}

/**
 * Deteksi `\frac` / `\dfrac` / `\tfrac` dengan pembilang atau penyebut kosong.
 *
 * CORR-05: versi lama memakai regex yang menuntut pembilang tanpa kurung
 * (`\{[^{}]*\}`), sehingga `\frac{\sqrt{2}}{}` lolos. Kini argumen dibaca
 * dengan pencocokan kurung berkedalaman → fraksi bersarang pun tertangkap.
 */
function hasEmptyFrac(expr: string): boolean {
  const re = /\\(?:d|t)?frac\b/g;
  while (re.exec(expr) !== null) {
    const args = readBraceGroups(expr, re.lastIndex, 2);
    if (!args) continue; // argumen tak lengkap → ditangani galat sintaks KaTeX
    if (args.some((a) => a.trim() === "")) return true;
  }
  return false;
}

/**
 * CORR-01 — delimiter KaTeX terbuka tanpa penutup.
 *
 * `MATH_RE` hanya mencocokkan delimiter **berpasangan**, jadi rumus cacat
 * seperti `\(x^2+1` (tanpa `\)`) tidak pernah masuk `extractMathSegments` dan
 * lolos validasi (pelanggaran CONSTRAINT #29). Fungsi ini memindai seluruh
 * teks dengan tumpukan: tiap `\(` `\[` `$` harus punya penutup `\)` `\]` `$`.
 *
 * `\\` (escape) dilewati sehingga `\\(` / `\$` tidak dihitung sebagai delimiter.
 */
export function hasUnmatchedDelimiters(text: string): boolean {
  return firstUnmatchedDelimiterOffset(text) >= 0;
}

/** Offset delimiter pembuka pertama yang tak berpenutup (`-1` = semua berpasangan). */
function firstUnmatchedDelimiterOffset(text: string): number {
  let inline = -1;
  let display = -1;
  let dollar = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") {
      const n = text[i + 1];
      if (n === "(") {
        if (inline < 0) inline = i;
        i++;
      } else if (n === ")") {
        inline = -1;
        i++;
      } else if (n === "[") {
        if (display < 0) display = i;
        i++;
      } else if (n === "]") {
        display = -1;
        i++;
      } else {
        i++; // escape lain (\{ \} \frac …) — lewati satu karakter
      }
      continue;
    }
    if (c === "$") dollar = dollar < 0 ? i : -1;
  }
  const pending = [inline, display, dollar].filter((x) => x >= 0);
  return pending.length ? Math.min(...pending) : -1;
}

/**
 * Ganti tiap segmen matematika berdelimiter dengan spasi (baris baru
 * dipertahankan) sehingga panjang & offset teks tak berubah. Dipakai untuk
 * memeriksa **rumus telanjang** di luar delimiter (mis. `\frac{\sqrt{2}}{}`
 * atau `}{`) tanpa menandai kurung sah di dalam `\(...\)`.
 */
function maskMathSegments(markdown: string): string {
  let out = "";
  let last = 0;
  MATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MATH_RE.exec(markdown)) !== null) {
    out += markdown.slice(last, m.index);
    out += m[0].replace(/[^\n]/g, " ");
    last = m.index + m[0].length;
  }
  return out + markdown.slice(last);
}

/** Cuplikan satu baris mulai `offset` (untuk pesan galat). */
function snippetAt(text: string, offset: number, len = 60): string {
  const from = Math.max(0, offset);
  return text.slice(from, from + len).split("\n")[0].trim();
}

/** Bersihkan pesan galat KaTeX dari tag HTML. */
function cleanMessage(msg: string): string {
  return msg
    .replace(/<[^>]*>/g, "")
    .replace(/KaTeX parse error:\s*/i, "")
    .trim();
}

/** Cari macro terlarang di seluruh markdown (teks + rumus). */
export function findForbiddenMacros(markdown: string): KatexIssue[] {
  const issues: KatexIssue[] = [];
  if (!markdown) return issues;
  const re = /\\([a-zA-Z@]+)/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const name = m[1];
    if (!FORBIDDEN_MACROS.includes(name)) continue;
    const key = `${name}@${m.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({
      kind: "forbidden_macro",
      expression: `\\${name}`,
      message: `Macro \\${name} dilarang pada bank soal (keamanan/portabilitas).`,
      line: lineAt(markdown, m.index),
    });
  }
  return issues;
}

/**
 * Validator KaTeX murni: deteksi galat sintaks, kurung tak seimbang,
 * `\frac` kosong, delimiter tak berpasangan, dan macro terlarang —
 * SEBELUM soal disimpan.
 *
 * Empat celah audit ditutup di sini:
 *  - **CORR-01** `\(x+1` (delimiter terbuka) → isu `syntax` lewat
 *    `hasUnmatchedDelimiters` (CONSTRAINT #29).
 *  - **CORR-04** `}{` (kurung terbalik) → isu `unbalanced_braces`.
 *  - **CORR-05** `\frac{\sqrt{2}}{}` (penyebut kosong bersarang) → isu `empty_frac`.
 *  - **CORR-06** rumus **telanjang** tanpa delimiter (`\frac{\sqrt{2}}{}`, `}{`)
 *    ikut diperiksa lewat `maskMathSegments` — bukan hanya isi `\(...\)`.
 */
export function validateKatexContract(markdown: string): KatexContractResult {
  const issues: KatexIssue[] = [];
  const src = markdown ?? "";

  // CORR-01 — delimiter terbuka tanpa penutup (rumus telanjang dari delimiternya).
  const unmatchedAt = firstUnmatchedDelimiterOffset(src);
  if (unmatchedAt >= 0) {
    issues.push({
      kind: "syntax",
      expression: snippetAt(src, unmatchedAt),
      message:
        "Delimiter KaTeX terbuka tanpa penutup (CONSTRAINT #29): setiap `\\(`/`\\[`/`$` " +
        "wajib berpasangan dengan `\\)`/`\\]`/`$`.",
      line: lineAt(src, unmatchedAt),
    });
  }

  for (const seg of extractMathSegments(src)) {
    if (braceDepth(seg.value) !== 0) {
      const fault = firstBraceFault(seg.value);
      issues.push({
        kind: "unbalanced_braces",
        expression: fault >= 0 ? snippetAt(seg.value, fault) : seg.value,
        message: "Kurung kurawal tidak seimbang pada rumus.",
        line: seg.line,
      });
    }
    if (hasEmptyFrac(seg.value)) {
      issues.push({
        kind: "empty_frac",
        expression: seg.value,
        message: "\\frac memiliki pembilang/penyebut kosong.",
        line: seg.line,
      });
    }
    try {
      katex.renderToString(seg.value, {
        displayMode: seg.display,
        throwOnError: true,
        strict: false,
        trust: false,
        output: "html",
        maxExpand: 1000,
      });
    } catch (err) {
      issues.push({
        kind: "syntax",
        expression: seg.value,
        message: err instanceof Error ? cleanMessage(err.message) : "Rumus tidak valid.",
        line: seg.line,
      });
    }
  }

  // CORR-06 — rumus TELANJANG di luar delimiter tetap harus bersih.
  const bare = maskMathSegments(src);
  const bareFault = firstBraceFault(bare);
  if (bareFault >= 0) {
    issues.push({
      kind: "unbalanced_braces",
      expression: snippetAt(bare, bareFault),
      message: "Kurung kurawal tidak seimbang pada rumus (tanpa delimiter KaTeX).",
      line: lineAt(src, bareFault),
    });
  }
  if (hasEmptyFrac(bare)) {
    issues.push({
      kind: "empty_frac",
      expression: snippetAt(bare, Math.max(0, bare.indexOf("\\frac"))),
      message: "\\frac memiliki pembilang/penyebut kosong.",
      line: lineAt(src, Math.max(0, bare.indexOf("\\frac"))),
    });
  }

  issues.push(...findForbiddenMacros(src));
  return { ok: issues.length === 0, issues };
}

/** True bila seluruh rumus & macro memenuhi kontrak KaTeX. */
export function isKatexContractValid(markdown: string): boolean {
  return validateKatexContract(markdown).ok;
}

// ════════════════════════════════════════════════════════════════════════
// 3. Distractor rationale (miskonsepsi A–E)
// ════════════════════════════════════════════════════════════════════════

export interface RationaleOptionInput {
  label: string;
  isCorrect?: boolean;
  distractorRationale?: string | null;
}

export type RationaleIssueCode =
  | "missing"
  | "too_short"
  | "placeholder"
  | "no_reasoning"
  | "duplicate";

export interface RationaleIssue {
  label: string;
  code: RationaleIssueCode;
  message: string;
}

/**
 * Validasi rationale SETIAP opsi salah (A–E). Opsi benar tidak wajib.
 * Mengembalikan daftar pelanggaran (kosong = lolos kontrak).
 */
export function validateDistractorRationales(
  options: readonly RationaleOptionInput[],
): RationaleIssue[] {
  const issues: RationaleIssue[] = [];
  const seen = new Map<string, string>(); // teks normal → label pertama

  for (const o of options) {
    if (o.isCorrect) continue; // rationale hanya untuk pengecoh
    const text = (o.distractorRationale ?? "").trim();
    if (!text) {
      issues.push({
        label: o.label,
        code: "missing",
        message: `Opsi ${o.label} belum punya distractor rationale.`,
      });
      continue;
    }
    if (text.length < MIN_RATIONALE_LENGTH) {
      issues.push({
        label: o.label,
        code: "too_short",
        message: `Rationale opsi ${o.label} terlalu pendek (< ${MIN_RATIONALE_LENGTH} karakter).`,
      });
      continue;
    }
    const lower = text.toLowerCase();
    const bad = PLACEHOLDER_RATIONALE_PHRASES.find((p) => lower.includes(p));
    if (bad) {
      issues.push({
        label: o.label,
        code: "placeholder",
        message: `Rationale opsi ${o.label} memakai frasa generik "${bad}" — sebutkan miskonsepsi konkret.`,
      });
      continue;
    }
    if (!REASONING_MARKERS.some((k) => lower.includes(k))) {
      issues.push({
        label: o.label,
        code: "no_reasoning",
        message: `Rationale opsi ${o.label} tidak menjelaskan kesalahan langkah (tanpa penanda penalaran).`,
      });
      continue;
    }
    const norm = lower.replace(/\s+/g, " ");
    const prev = seen.get(norm);
    if (prev) {
      issues.push({
        label: o.label,
        code: "duplicate",
        message: `Rationale opsi ${o.label} identik dengan opsi ${prev} — tiap pengecoh butuh analisis sendiri.`,
      });
      continue;
    }
    seen.set(norm, o.label);
  }

  return issues;
}

/** True bila seluruh pengecoh punya rationale yang lolos kontrak. */
export function isDistractorRationaleComplete(options: readonly RationaleOptionInput[]): boolean {
  return validateDistractorRationales(options).length === 0;
}

// ════════════════════════════════════════════════════════════════════════
// 4. Rubrik penilaian esai (skor berjenjang)
// ════════════════════════════════════════════════════════════════════════

export interface RubricCriterionInput {
  id?: string;
  description: string;
  points: number;
}

export interface RubricInput {
  totalPoints?: number;
  criteria: RubricCriterionInput[];
}

export type RubricIssueCode = "empty" | "criterion_description" | "criterion_points" | "total_mismatch";

export interface RubricIssue {
  code: RubricIssueCode;
  message: string;
  /** Indeks kriteria (bila relevan). */
  index?: number;
}

/** Tipe soal yang WAJIB menyertakan rubrik penilaian. */
export const RUBRIC_REQUIRED_TYPES: readonly string[] = ["essay", "short_answer"];

/** True bila tipe soal mewajibkan rubrik. */
export function requiresRubric(questionType: string): boolean {
  return RUBRIC_REQUIRED_TYPES.includes(questionType);
}

/** Validasi rubrik: minimal 1 kriteria, deskripsi & poin sah, total konsisten. */
export function validateRubric(rubric: RubricInput | null | undefined): RubricIssue[] {
  if (!rubric || !Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
    return [{ code: "empty", message: "Rubrik wajib memuat minimal satu kriteria penilaian." }];
  }
  const issues: RubricIssue[] = [];
  let sum = 0;
  rubric.criteria.forEach((c, i) => {
    const desc = (c.description ?? "").trim();
    if (desc.length < 10) {
      issues.push({
        code: "criterion_description",
        index: i,
        message: `Kriteria #${i + 1} perlu deskripsi langkah matematis (min. 10 karakter).`,
      });
    }
    const pts = Number(c.points);
    if (!Number.isFinite(pts) || pts <= 0) {
      issues.push({
        code: "criterion_points",
        index: i,
        message: `Kriteria #${i + 1} perlu poin > 0.`,
      });
    } else {
      sum += pts;
    }
  });
  if (rubric.totalPoints !== undefined) {
    const total = Number(rubric.totalPoints);
    if (!Number.isFinite(total) || total <= 0 || total !== sum) {
      issues.push({
        code: "total_mismatch",
        message: `totalPoints (${rubric.totalPoints}) harus sama dengan jumlah poin kriteria (${sum}).`,
      });
    }
  }
  return issues;
}

// ════════════════════════════════════════════════════════════════════════
// 5. Gate kontrak pedagogi (gabungan)
// ════════════════════════════════════════════════════════════════════════

export interface PedagogyContractInput {
  contentMarkdown: string;
  questionType: string;
  options?: Array<RationaleOptionInput & { contentMarkdown?: string }>;
  answerKey?: {
    rubric?: RubricInput | null;
    explanation?: string | null;
    text?: string | null;
  };
}

export interface PedagogyContractReport {
  ok: boolean;
  katex: KatexIssue[];
  rationale: RationaleIssue[];
  rubric: RubricIssue[];
}

/**
 * Evaluasi kontrak pedagogi satu soal: KaTeX murni (stem + opsi + pembahasan),
 * rationale seluruh pengecoh, dan rubrik (bila tipe esai/isian).
 */
export function evaluatePedagogyContract(input: PedagogyContractInput): PedagogyContractReport {
  const options = input.options ?? [];
  const katex: KatexIssue[] = [];

  katex.push(...validateKatexContract(input.contentMarkdown).issues);
  for (const o of options) {
    if (o.contentMarkdown) katex.push(...validateKatexContract(o.contentMarkdown).issues);
    if (o.distractorRationale) katex.push(...validateKatexContract(o.distractorRationale).issues);
  }
  if (input.answerKey?.explanation) {
    katex.push(...validateKatexContract(input.answerKey.explanation).issues);
  }

  const rationale = options.length ? validateDistractorRationales(options) : [];
  const rubric = requiresRubric(input.questionType)
    ? validateRubric(input.answerKey?.rubric)
    : [];

  return { ok: katex.length === 0 && rationale.length === 0 && rubric.length === 0, katex, rationale, rubric };
}

// ════════════════════════════════════════════════════════════════════════
// 6. Prompt (Haladyna-aware)
// ════════════════════════════════════════════════════════════════════════

/** Prompt sistem (Indonesia — tugas klasifikasi, keluaran JSON ketat). */
export function buildSystemPrompt(): string {
  return [
    "Kamu asisten kurasi bank soal matematika untuk sekolah Indonesia.",
    "Tugasmu MENGUSULKAN metadata untuk satu soal. Kamu TIDAK menentukan jawaban",
    "(kunci jawaban tidak boleh diubah).",
    "Patuhi kaidah penulisan soal Haladyna: batang soal mandiri, opsi A–E homogen,",
    "saling eksklusif, tanpa opsi 'semua benar'/'tidak ada jawaban benar'.",
    "Untuk SETIAP opsi salah, tulis distractor rationale yang menyebut nama kesalahan,",
    "langkah matematis yang salah, dan nilai hasil kesalahan itu (bukan alasan generik).",
    "Gunakan KaTeX murni: inline \\\\( ... \\\\), blok \\\\[ ... \\\\]; tanpa macro terlarang.",
    "Keluarkan JSON valid saja, tanpa penjelasan tambahan.",
  ].join(" ");
}

/** Prompt pengguna: soal + opsi + daftar pilihan. */
export function buildUserPrompt(params: {
  content: string;
  ctx: EnrichContext;
  fields: EnrichField[];
  options?: Array<{ label: string; contentMarkdown: string; isCorrect?: boolean }>;
}): string {
  const { content, ctx, fields, options = [] } = params;
  const lines: string[] = [];
  lines.push("SOAL (markdown, boleh memuat LaTeX $...$):");
  lines.push("```");
  lines.push(content.slice(0, 6000));
  lines.push("```");

  const incorrect = options.filter((o) => !o.isCorrect);
  if (fields.includes("distractorRationale") && incorrect.length) {
    lines.push("");
    lines.push("OPSI SALAH (tulis rationale untuk tiap label):");
    for (const o of incorrect) {
      lines.push(`- ${o.label}: ${o.contentMarkdown.slice(0, 300)}`);
    }
  }

  lines.push("");
  lines.push("Usulkan metadata berikut, keluarkan HANYA objek JSON dengan kunci:");
  const keys: string[] = [];
  if (fields.includes("topics")) {
    keys.push('"topics" (array nama topik, dipilih HANYA dari daftar di bawah)');
  }
  if (fields.includes("difficulty")) {
    keys.push('"difficulty" (angka 1–5: 1=sangat mudah … 5=sangat sulit)');
  }
  if (fields.includes("cognitiveLevel")) {
    keys.push('"cognitiveLevel" (satu dari: remember|understand|apply|analyze|evaluate|create)');
  }
  if (fields.includes("tags")) keys.push('"tags" (array kata kunci singkat, huruf kecil)');
  if (fields.includes("distractorRationale")) {
    keys.push(
      '"distractorRationale" (objek label→string; analisis miskonsepsi konkret tiap opsi salah, ' +
        "sebut nama kesalahan + langkah salah + hasil, dalam bahasa Indonesia ber-KaTeX)",
    );
  }
  if (fields.includes("rubric")) {
    keys.push(
      '"rubric" (objek { totalPoints, criteria: [{ description, points }] }; ' +
        "kriteria langkah matematis berjenjang dengan poin; totalPoints = jumlah poin)",
    );
  }
  keys.push('"notes" (alasan singkat, bahasa Indonesia)');
  for (const k of keys) lines.push(`- ${k}`);

  if (fields.includes("topics") && ctx.topics.length) {
    lines.push("");
    lines.push("DAFTAR TOPIK YANG TERSEDIA:");
    for (const t of ctx.topics.slice(0, 300)) lines.push(`- ${t}`);
  }
  if (fields.includes("tags") && ctx.tags?.length) {
    lines.push("");
    lines.push("TAG YANG SUDAH ADA (boleh dipakai ulang, boleh usul baru):");
    lines.push(ctx.tags.slice(0, 200).join(", "));
  }
  return lines.join("\n");
}

// ════════════════════════════════════════════════════════════════════════
// 7. Normalisasi usulan
// ════════════════════════════════════════════════════════════════════════

/** Usulan enrichment lengkap (metadata + pedagogi). */
export type EnrichProposal = EnrichmentProposal & {
  /** Peta label opsi salah → rationale (hanya untuk opsi salah). */
  distractorRationale: Record<string, string>;
  /** Rubrik penilaian (esai/isian) atau null. */
  rubric: RubricInput | null;
};

/** Normalisasi + validasi usulan mentah dari AI. */
export function normalizeProposal(
  raw: unknown,
  fields: EnrichField[],
  allowedTopics: string[],
): EnrichProposal {
  const o = (raw ?? {}) as Record<string, unknown>;
  const topicSet = new Map(allowedTopics.map((t) => [t.toLowerCase(), t]));

  const topics = fields.includes("topics")
    ? toStringArray(o.topics)
        .map((t) => topicSet.get(t.toLowerCase()) ?? t)
        .slice(0, 8)
    : [];

  const difficulty =
    fields.includes("difficulty") && isDifficulty(o.difficulty)
      ? (Number(o.difficulty) as 1 | 2 | 3 | 4 | 5)
      : null;

  const cognitiveLevel =
    fields.includes("cognitiveLevel") && isOneOf(o.cognitiveLevel, COGNITIVE)
      ? (o.cognitiveLevel as EnrichmentProposal["cognitiveLevel"])
      : null;

  const tags = fields.includes("tags") ? toStringArray(o.tags).map((s) => s.toLowerCase()).slice(0, 10) : [];

  const distractorRationale = fields.includes("distractorRationale")
    ? normalizeRationaleMap(o.distractorRationale)
    : {};

  const rubric = fields.includes("rubric") ? normalizeRubric(o.rubric) : null;

  const notes = typeof o.notes === "string" ? o.notes.slice(0, 500) : undefined;
  return { topics, difficulty, cognitiveLevel, tags, notes, distractorRationale, rubric };
}

/** Normalisasi peta label→rationale (label huruf besar A–E, teks dipotong). */
function normalizeRationaleMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val !== "string") continue;
    const label = k.trim().toUpperCase();
    if (!/^[A-E]$/.test(label)) continue;
    const text = val.trim().slice(0, 1200);
    if (text) out[label] = text;
  }
  return out;
}

/** Normalisasi rubrik dari keluaran AI (buang kriteria tak sah, hitung total). */
function normalizeRubric(v: unknown): RubricInput | null {
  if (!v || typeof v !== "object") return null;
  const raw = v as { totalPoints?: unknown; criteria?: unknown };
  if (!Array.isArray(raw.criteria)) return null;
  const criteria: RubricCriterionInput[] = [];
  for (const c of raw.criteria) {
    if (!c || typeof c !== "object") continue;
    const cc = c as { id?: unknown; description?: unknown; points?: unknown };
    const description = typeof cc.description === "string" ? cc.description.trim().slice(0, 500) : "";
    const points = Number(cc.points);
    if (!description || !Number.isFinite(points) || points <= 0) continue;
    criteria.push({
      ...(typeof cc.id === "string" && cc.id ? { id: cc.id.slice(0, 50) } : {}),
      description,
      points,
    });
  }
  if (!criteria.length) return null;
  const sum = criteria.reduce((a, c) => a + c.points, 0);
  const total = Number(raw.totalPoints);
  return { totalPoints: Number.isFinite(total) && total > 0 ? total : sum, criteria };
}

// ── Util ──────────────────────────────────────────────────────────────

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}

function isOneOf<T extends readonly string[]>(v: unknown, list: T): v is T[number] {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}

/** difficulty valid = 1..5 (terima juga string angka). */
function isDifficulty(v: unknown): v is 1 | 2 | 3 | 4 | 5 {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && (DIFFICULTY as readonly number[]).includes(n);
}
