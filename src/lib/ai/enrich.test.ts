import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildUserPrompt,
  normalizeProposal,
  ALL_FIELDS,
  PEDAGOGY_FIELDS,
  ALL_ENRICH_FIELDS,
  HALADYNA_RULE_COUNT,
  MIN_RATIONALE_LENGTH,
  extractMathSegments,
  findForbiddenMacros,
  hasUnmatchedDelimiters,
  validateKatexContract,
  isKatexContractValid,
  validateDistractorRationales,
  isDistractorRationaleComplete,
  validateRubric,
  requiresRubric,
  evaluatePedagogyContract,
  type RationaleOptionInput,
} from "./enrich";

describe("ai/enrich — prompt", () => {
  it("system prompt menegaskan keluaran JSON & bukan penentu jawaban", () => {
    const s = buildSystemPrompt();
    expect(s).toMatch(/JSON/);
    expect(s).toMatch(/TIDAK menentukan jawaban/i);
  });

  it("system prompt memuat mandat distractor rationale & KaTeX murni", () => {
    const s = buildSystemPrompt();
    expect(s).toMatch(/distractor rationale/i);
    expect(s).toMatch(/Haladyna/i);
    expect(s).toMatch(/KaTeX/i);
  });

  it("user prompt memuat soal + kunci yang diminta", () => {
    const p = buildUserPrompt({
      content: "Hitung $1+1$",
      ctx: { topics: ["Aljabar", "Bilangan"] },
      fields: ALL_FIELDS,
    });
    expect(p).toContain("Hitung $1+1$");
    expect(p).toContain("topics");
    expect(p).toContain("difficulty");
    expect(p).toContain("cognitiveLevel");
    expect(p).toContain("tags");
    expect(p).toContain("Aljabar");
  });

  it("meminta rationale per opsi salah bila field diaktifkan", () => {
    const p = buildUserPrompt({
      content: "Soal",
      ctx: { topics: [] },
      fields: ["distractorRationale"],
      options: [
        { label: "A", contentMarkdown: "1", isCorrect: false },
        { label: "B", contentMarkdown: "2", isCorrect: true },
        { label: "C", contentMarkdown: "3", isCorrect: false },
      ],
    });
    expect(p).toContain("OPSI SALAH");
    expect(p).toContain("A:");
    expect(p).toContain("C:");
    expect(p).not.toMatch(/^- B:/m); // opsi benar tak diminta
    expect(p).toContain("distractorRationale");
  });

  it("meminta rubrik bila field rubric diaktifkan", () => {
    const p = buildUserPrompt({ content: "Soal esai", ctx: { topics: [] }, fields: ["rubric"] });
    expect(p).toContain("rubric");
    expect(p).toContain("totalPoints");
  });

  it("memotong soal sangat panjang", () => {
    const p = buildUserPrompt({ content: "x".repeat(10000), ctx: { topics: [] }, fields: ["difficulty"] });
    expect(p.length).toBeLessThan(8000);
  });

  it("konstanta kontrak: 31 kaidah Haladyna & field lengkap", () => {
    expect(HALADYNA_RULE_COUNT).toBe(31);
    expect(ALL_ENRICH_FIELDS).toEqual([...ALL_FIELDS, ...PEDAGOGY_FIELDS]);
    expect(ALL_ENRICH_FIELDS).toContain("distractorRationale");
    expect(ALL_ENRICH_FIELDS).toContain("rubric");
  });
});

describe("ai/enrich — normalizeProposal", () => {
  const topics = ["Aljabar", "Bilangan", "Geometri"];

  it("memetakan topik ke huruf besar-besar daftar resmi", () => {
    const r = normalizeProposal({ topics: ["aljabar"] }, ALL_FIELDS, topics);
    expect(r.topics).toEqual(["Aljabar"]);
  });

  it("topik di luar daftar tetap dibawa (huruf asli)", () => {
    const r = normalizeProposal({ topics: ["Trigonometri"] }, ALL_FIELDS, topics);
    expect(r.topics).toEqual(["Trigonometri"]);
  });

  it("difficulty (1-5) & cognitiveLevel (enum Bloom) divalidasi", () => {
    expect(normalizeProposal({ difficulty: 4, cognitiveLevel: "analyze" }, ALL_FIELDS, topics)).toMatchObject({
      difficulty: 4,
      cognitiveLevel: "analyze",
    });
    expect(normalizeProposal({ difficulty: "2" }, ALL_FIELDS, topics).difficulty).toBe(2);
    expect(normalizeProposal({ difficulty: 9, cognitiveLevel: "C9" }, ALL_FIELDS, topics)).toMatchObject({
      difficulty: null,
      cognitiveLevel: null,
    });
    expect(normalizeProposal({ difficulty: "susah" }, ALL_FIELDS, topics).difficulty).toBeNull();
  });

  it("tags dinormalkan huruf kecil & dipotong", () => {
    const r = normalizeProposal({ tags: ["KALKULUS", "Turunan"] }, ALL_FIELDS, topics);
    expect(r.tags).toEqual(["kalkulus", "turunan"]);
  });

  it("field yang TIDAK diminta diabaikan", () => {
    const r = normalizeProposal({ topics: ["Aljabar"], difficulty: 1 }, ["difficulty"], topics);
    expect(r.topics).toEqual([]);
    expect(r.difficulty).toBe(1);
  });

  it("masukan rusak tidak melempar", () => {
    expect(normalizeProposal(null, ALL_FIELDS, topics)).toMatchObject({ topics: [], difficulty: null });
    expect(normalizeProposal({ topics: "bukan array" }, ALL_FIELDS, topics).topics).toEqual([]);
    expect(normalizeProposal({ topics: [1, "Aljabar", null] }, ALL_FIELDS, topics).topics).toEqual(["Aljabar"]);
  });

  it("notes dipotong 500 char", () => {
    const r = normalizeProposal({ notes: "a".repeat(1000) }, ALL_FIELDS, topics);
    expect(r.notes?.length).toBe(500);
  });

  it("default: distractorRationale kosong & rubric null (bila tak diminta)", () => {
    const r = normalizeProposal({ distractorRationale: { A: "x" }, rubric: { criteria: [] } }, ALL_FIELDS, topics);
    expect(r.distractorRationale).toEqual({});
    expect(r.rubric).toBeNull();
  });

  it("menormalkan peta rationale (label A-E, huruf besar, buang tak sah)", () => {
    const r = normalizeProposal(
      { distractorRationale: { a: "  Langkah salah  ", F: "x", B: "  " } },
      ["distractorRationale"],
      topics,
    );
    expect(r.distractorRationale).toEqual({ A: "Langkah salah" });
  });

  it("menormalkan rubrik: buang kriteria tak sah & hitung total", () => {
    const r = normalizeProposal(
      {
        rubric: {
          criteria: [
            { description: "Menuliskan model persamaan", points: 3 },
            { description: "", points: 5 },
            { description: "Valid", points: 0 },
          ],
        },
      },
      ["rubric"],
      topics,
    );
    expect(r.rubric?.criteria).toHaveLength(1);
    expect(r.rubric?.totalPoints).toBe(3);
  });
});

describe("ai/enrich — KaTeX contract (validator murni)", () => {
  it("lolos untuk teks tanpa rumus", () => {
    expect(validateKatexContract("Tentukan hasilnya.").ok).toBe(true);
    expect(isKatexContractValid("")).toBe(true);
  });

  it("lolos untuk rumus valid inline & display (delimiter murni)", () => {
    expect(isKatexContractValid("Nilai \\(x = \\frac{1}{2}\\) benar.")).toBe(true);
    expect(isKatexContractValid("\\[\\int_0^1 x^2\\,dx\\]")).toBe(true);
  });

  it("mendeteksi galat sintaks \\frac tanpa argumen kedua", () => {
    const r = validateKatexContract("Rumus salah: $\\frac{1}$");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.kind === "syntax")).toBe(true);
  });

  it("mendeteksi kurung kurawal tak seimbang", () => {
    const r = validateKatexContract("\\(\\frac{1}{2\\)");
    expect(r.issues.some((i) => i.kind === "unbalanced_braces")).toBe(true);
  });

  it("mendeteksi \\frac kosong (pembilang/penyebut)", () => {
    expect(validateKatexContract("\\(\\frac{}{2}\\)").issues.some((i) => i.kind === "empty_frac")).toBe(true);
    expect(validateKatexContract("\\(\\frac{3}{}\\)").issues.some((i) => i.kind === "empty_frac")).toBe(true);
  });

  it("menolak macro terlarang (input/href/def)", () => {
    const r = validateKatexContract("$\\input{secret}$ dan $\\href{javascript:x}{y}$");
    const macros = r.issues.filter((i) => i.kind === "forbidden_macro").map((i) => i.expression);
    expect(macros).toContain("\\input");
    expect(macros).toContain("\\href");
  });

  it("findForbiddenMacros mendeteksi \\def & \\htmlClass", () => {
    const found = findForbiddenMacros("\\def\\a{1} \\htmlClass{x}{y}");
    expect(found.map((f) => f.expression)).toEqual(expect.arrayContaining(["\\def", "\\htmlClass"]));
  });

  it("macro aman (\\( \\sqrt \\log) tidak ditandai", () => {
    expect(findForbiddenMacros("\\(\\sqrt{2}\\) \\[\\log 5\\]")).toEqual([]);
  });

  it("melaporkan nomor baris yang benar", () => {
    const r = validateKatexContract("Baris valid $x$\nBaris kedua\n$\\frac{1}$ di sini");
    expect(r.issues[0].line).toBe(3);
  });

  it("extractMathSegments mengenali empat gaya delimiter", () => {
    const segs = extractMathSegments("a \\(x\\) b \\[y\\] c $z$ d $$w$$");
    expect(segs.map((s) => s.value)).toEqual(["x", "y", "z", "w"]);
    expect(segs.map((s) => s.display)).toEqual([false, true, false, true]);
  });

  // ── CORR-01: delimiter terbuka tanpa penutup (CONSTRAINT #29) ──────────
  describe("CORR-01 — hasUnmatchedDelimiters", () => {
    it("menandai delimiter inline/display/dollar yang tak berpasangan", () => {
      expect(hasUnmatchedDelimiters("\\(x^2+1")).toBe(true);
      expect(hasUnmatchedDelimiters("\\[\\int_0^1 x^2")).toBe(true);
      expect(hasUnmatchedDelimiters("Hitung $x^2$ lalu $y")).toBe(true);
      expect(hasUnmatchedDelimiters("Nilai \\(x\\) saja.")).toBe(false);
      expect(hasUnmatchedDelimiters("\\[x\\] dan \\(y\\) dan $z$")).toBe(false);
      expect(hasUnmatchedDelimiters("tanpa rumus sama sekali")).toBe(false);
    });

    it("tidak menghitung escape \\\\( sebagai delimiter", () => {
      expect(hasUnmatchedDelimiters("Teks memuat \\\\( literal.")).toBe(false);
      expect(hasUnmatchedDelimiters("Harga \\$100 tanpa rumus.")).toBe(false);
    });

    it("validateKatexContract MENOLAK rumus dengan delimiter terbuka", () => {
      const r = validateKatexContract("Diketahui \\(x^2 + 5x = 0");
      expect(r.ok).toBe(false);
      expect(r.issues.some((i) => i.kind === "syntax")).toBe(true);
      expect(isKatexContractValid("Diketahui \\(x^2 + 5x = 0")).toBe(false);
      expect(isKatexContractValid("\\[x^2 + 1")).toBe(false);
      expect(isKatexContractValid("Hitung $1+1")).toBe(false);
    });

    it("tidak menghasilkan positif palsu pada konten berdelimiter sah", () => {
      expect(isKatexContractValid("Nilai \\(x = 2\\) dan \\[\\frac{1}{2}\\] benar.")).toBe(true);
    });
  });

  // ── CORR-04: kurung terbalik / kedalaman negatif ──────────────────────
  describe("CORR-04 — braceDepth underflow", () => {
    it("menolak pola kurung terbalik \\(}{ di dalam delimiter", () => {
      const r = validateKatexContract("\\(x}{y\\)");
      expect(r.ok).toBe(false);
      expect(r.issues.some((i) => i.kind === "unbalanced_braces")).toBe(true);
    });

    it("menolak kurung terbalik walau jumlah buka = jumlah tutup", () => {
      // Dua pasang seimbang secara cacah, tetapi urutannya terbalik.
      expect(isKatexContractValid("\\(}{}\\)")).toBe(false);
      expect(isKatexContractValid("\\(x^{2}{y\\)")).toBe(false);
    });

    it("melaporkan nomor baris lokasi kurung terbalik", () => {
      const r = validateKatexContract("Baris satu valid\n\\(x}{y\\)");
      expect(r.issues.find((i) => i.kind === "unbalanced_braces")?.line).toBe(2);
    });

    it("tetap meloloskan kurung bersarang yang sah", () => {
      expect(isKatexContractValid("\\(x^{2^{3}}\\)")).toBe(true);
      expect(isKatexContractValid("\\(\\frac{\\sqrt{2}}{2}\\)")).toBe(true);
    });
  });

  // ── CORR-05: fraksi bersarang dengan argumen kosong ───────────────────
  describe("CORR-05 — hasEmptyFrac pada kurung bersarang", () => {
    it("menolak \\frac{\\sqrt{2}}{} (penyebut kosong, pembilang bersarang)", () => {
      const r = validateKatexContract("\\(\\frac{\\sqrt{2}}{}\\)");
      expect(r.ok).toBe(false);
      expect(r.issues.some((i) => i.kind === "empty_frac")).toBe(true);
    });

    it("menolak pembilang bersarang yang kosong", () => {
      expect(isKatexContractValid("\\(\\frac{}{\\sqrt{2}}\\)")).toBe(false);
      expect(isKatexContractValid("\\(\\dfrac{\\frac{1}{2}}{}\\)")).toBe(false);
      expect(isKatexContractValid("\\(\\tfrac{}{3}\\)")).toBe(false);
    });

    it("tetap meloloskan fraksi bersarang yang lengkap", () => {
      expect(isKatexContractValid("\\(\\frac{\\sqrt{2}}{2}\\)")).toBe(true);
      expect(isKatexContractValid("\\(\\frac{\\frac{1}{2}}{3}\\)")).toBe(true);
    });
  });

  // ── CORR-06: rumus TELANJANG (tanpa delimiter) ikut divalidasi ────────
  describe("CORR-06 — rumus telanjang tanpa delimiter", () => {
    it("menolak kurung terbalik tanpa delimiter", () => {
      const r = validateKatexContract("Nilai dari }{ tidak sah.");
      expect(r.ok).toBe(false);
      expect(r.issues.some((i) => i.kind === "unbalanced_braces")).toBe(true);
    });

    it("menolak \\frac kosong tanpa delimiter", () => {
      const r = validateKatexContract("Rumus: \\frac{\\sqrt{2}}{}");
      expect(r.ok).toBe(false);
      expect(r.issues.some((i) => i.kind === "empty_frac")).toBe(true);
    });

    it("tidak menandai kurung di luar rumus pada teks biasa", () => {
      expect(isKatexContractValid("Gunakan himpunan {1, 2, 3} sebagai contoh.")).toBe(true);
    });
  });
});

describe("ai/enrich — distractor rationale", () => {
  const good = (label: string): RationaleOptionInput => ({
    label,
    isCorrect: false,
    distractorRationale: `Siswa lupa mendistribusikan tanda negatif sehingga hasilnya menjadi ${label}.`,
  });

  it("lolos bila semua pengecoh ber-rationale konkret", () => {
    const opts = [good("A"), good("B"), { label: "C", isCorrect: true, distractorRationale: null }];
    expect(isDistractorRationaleComplete(opts)).toBe(true);
    expect(validateDistractorRationales(opts)).toEqual([]);
  });

  it("menandai rationale yang belum diisi", () => {
    const issues = validateDistractorRationales([{ label: "A", isCorrect: false }]);
    expect(issues[0].code).toBe("missing");
  });

  it("menandai rationale terlalu pendek", () => {
    const issues = validateDistractorRationales([{ label: "A", distractorRationale: "salah hitung" }]);
    expect(issues[0].code).toBe("too_short");
  });

  it("menolak frasa placeholder generik", () => {
    const issues = validateDistractorRationales([
      { label: "A", distractorRationale: "Jawaban salah karena tidak tepat, ini hanya pengecoh." },
    ]);
    expect(issues.some((i) => i.code === "placeholder")).toBe(true);
  });

  it("menolak rationale tanpa penanda penalaran", () => {
    const long = "x".repeat(MIN_RATIONALE_LENGTH + 5);
    const issues = validateDistractorRationales([{ label: "A", distractorRationale: long }]);
    expect(issues[0].code).toBe("no_reasoning");
  });

  it("menolak rationale duplikat antar pengecoh", () => {
    const text = "Siswa keliru menjumlahkan sebelum mengalikan sehingga hasilnya salah total.";
    const issues = validateDistractorRationales([
      { label: "A", distractorRationale: text },
      { label: "B", distractorRationale: text },
    ]);
    expect(issues.some((i) => i.code === "duplicate")).toBe(true);
  });

  it("opsi benar tidak diperiksa", () => {
    expect(validateDistractorRationales([{ label: "A", isCorrect: true, distractorRationale: null }])).toEqual([]);
  });
});

describe("ai/enrich — rubrik esai", () => {
  it("requiresRubric hanya untuk essay/short_answer", () => {
    expect(requiresRubric("essay")).toBe(true);
    expect(requiresRubric("short_answer")).toBe(true);
    expect(requiresRubric("single_choice")).toBe(false);
  });

  it("menolak rubrik kosong", () => {
    expect(validateRubric(null)[0].code).toBe("empty");
    expect(validateRubric({ criteria: [] })[0].code).toBe("empty");
  });

  it("lolos untuk rubrik berjenjang yang sah", () => {
    expect(
      validateRubric({
        totalPoints: 5,
        criteria: [
          { description: "Menuliskan model persamaan yang benar", points: 3 },
          { description: "Menyelesaikan dan menafsirkan hasil", points: 2 },
        ],
      }),
    ).toEqual([]);
  });

  it("menandai poin ≤ 0 & deskripsi terlalu pendek", () => {
    const issues = validateRubric({ criteria: [{ description: "x", points: 0 }] });
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(["criterion_description", "criterion_points"]));
  });

  it("menandai totalPoints yang tidak konsisten", () => {
    const issues = validateRubric({
      totalPoints: 10,
      criteria: [{ description: "Menuliskan langkah penyelesaian", points: 4 }],
    });
    expect(issues.some((i) => i.code === "total_mismatch")).toBe(true);
  });
});

describe("ai/enrich — gate kontrak pedagogi gabungan", () => {
  it("lolos untuk PG lengkap (KaTeX murni + rationale penuh)", () => {
    const r = evaluatePedagogyContract({
      questionType: "single_choice",
      contentMarkdown: "Tentukan turunan dari \\(x^2\\).",
      options: [
        { label: "A", isCorrect: true, contentMarkdown: "\\(2x\\)" },
        {
          label: "B",
          isCorrect: false,
          contentMarkdown: "\\(x\\)",
          distractorRationale: "Siswa lupa menurunkan pangkat sehingga menulis \\(x\\) alih-alih \\(2x\\).",
        },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("gagal bila ada galat KaTeX di stem", () => {
    const r = evaluatePedagogyContract({
      questionType: "single_choice",
      contentMarkdown: "\\(\\frac{1}\\)",
      options: [],
    });
    expect(r.ok).toBe(false);
    expect(r.katex.length).toBeGreaterThan(0);
  });

  it("gagal bila pengecoh tanpa rationale", () => {
    const r = evaluatePedagogyContract({
      questionType: "single_choice",
      contentMarkdown: "Pilih.",
      options: [{ label: "A", isCorrect: false, contentMarkdown: "1" }],
    });
    expect(r.ok).toBe(false);
    expect(r.rationale).toHaveLength(1);
  });

  it("gagal bila esai tanpa rubrik", () => {
    const r = evaluatePedagogyContract({
      questionType: "essay",
      contentMarkdown: "Uraikan pembuktiannya.",
      options: [],
      answerKey: { rubric: null },
    });
    expect(r.ok).toBe(false);
    expect(r.rubric[0].code).toBe("empty");
  });

  it("lolos untuk esai dengan rubrik sah", () => {
    const r = evaluatePedagogyContract({
      questionType: "essay",
      contentMarkdown: "Uraikan pembuktiannya.",
      options: [],
      answerKey: {
        rubric: {
          totalPoints: 4,
          criteria: [{ description: "Menuliskan langkah pembuktian lengkap", points: 4 }],
        },
      },
    });
    expect(r.ok).toBe(true);
  });
});
