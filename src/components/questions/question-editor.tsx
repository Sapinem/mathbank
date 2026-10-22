"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Send,
  Loader2,
  ImagePlus,
  Lightbulb,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MathContent } from "@/components/math/math-content";
import { Field, FieldGroup } from "@/components/ui/field-group";
import { TopicPicker } from "./topic-picker";
import { useCreateQuestion, useUpdateQuestion } from "@/lib/hooks/use-questions";
import { useGrades, useStimulusParents } from "@/lib/hooks/use-reference";
import { useEditorAutosave } from "@/lib/hooks/use-editor-autosave";
import { AssetPickerModal } from "@/components/media/asset-picker-modal";
import { lintKatex } from "@/lib/math/katex-lint";
import {
  MatrixGridFields,
  MatchingFields,
  StringListField,
  readMatrixPayload,
  readMatchingPayload,
  type MatrixPayload,
  type MatchingPayload,
} from "@/components/questions/type-specific-fields";
import { RubricHint } from "@/components/questions/rubric-badge";
import { cognitiveRubric, difficultyRubric } from "@/lib/display/rubrics";
import {
  TYPE_LABELS,
  DIFFICULTY_LABELS,
  COGNITIVE_LABELS,
} from "@/lib/display/labels";
import {
  isOptionBased,
  type CreateQuestionInput,
} from "@/lib/contracts/question";
import type { PublicQuestion } from "@/lib/services/question-service";

/**
 * Editor soal (M4c) — form + pratinjau KaTeX.
 *
 * Menangani seluruh 11 tipe: tipe opsi (A–E dengan radio/checkbox kunci) dan
 * tipe teks (`short_answer`/`essay` via `answer_key.text`). Menyimpan sebagai
 * draf (`draft`) atau mengirim ke telaah (`review`).
 *
 * SENGAJA satu komponen (bukan 11) — perbedaan antar-tipe kecil (kunci opsi vs
 * teks) dan berbagi 90% field. Lihat kontrak `contracts/question.ts`.
 */

const OPTION_TYPES = [
  "single_choice",
  "assertion_reason",
  "combination_1234",
  "quantitative_pq",
  "data_sufficiency",
  "multiple_choice_checkbox",
  "matrix_grid",
  "matching",
] as const;

const TEXT_TYPES = ["short_answer", "essay"] as const;

interface OptionDraft {
  label: string;
  contentMarkdown: string;
  isCorrect: boolean;
  distractorRationale: string;
}

const LETTERS = ["A", "B", "C", "D", "E"];

function emptyOptions(): OptionDraft[] {
  return LETTERS.map((label) => ({
    label,
    contentMarkdown: "",
    isCorrect: false,
    distractorRationale: "",
  }));
}

/** Label kunci dari `answer_key` (kanonik `correctOptionIds` → mirror `correct`). */
function correctLabelsOf(answerKey: unknown): string[] {
  const key = (answerKey ?? {}) as Record<string, unknown>;
  const raw = key.correctOptionIds ?? key.correct;
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return list
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
}

/** Item opsi mentah di `data_payload.options` (bentuk kanonik MAT-145). */
interface CanonicalOptionItem {
  id?: unknown;
  label?: unknown;
  contentMarkdown?: unknown;
  distractorRationale?: unknown;
}

/**
 * Susun state opsi editor dari soal yang ada.
 *
 * Sumber utama: `data_payload.options` (single table + hybrid JSONB, zero join).
 * Cadangan: `question.options` — proyeksi baca untuk soal yang payload-nya
 * masih kosong. Keduanya aman bila `undefined`/bukan array.
 */
function readOptionDrafts(q?: PublicQuestion): OptionDraft[] {
  const dp = (q?.dataPayload ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(dp.options)
    ? (dp.options as CanonicalOptionItem[])
    : [];
  const correct = new Set(correctLabelsOf(q?.answerKey));

  if (raw.length) {
    return raw.map((item, i) => {
      const label =
        String(item?.id ?? item?.label ?? LETTERS[i] ?? "")
          .trim()
          .toUpperCase() || String(i + 1);
      return {
        label,
        contentMarkdown: String(item?.contentMarkdown ?? ""),
        isCorrect: correct.has(label),
        distractorRationale:
          typeof item?.distractorRationale === "string"
            ? item.distractorRationale
            : "",
      };
    });
  }

  if (q?.options?.length) {
    return q.options.map((o) => ({
      label: o.label,
      contentMarkdown: o.contentMarkdown,
      isCorrect: Boolean(o.isCorrect),
      distractorRationale: o.distractorRationale ?? "",
    }));
  }

  return emptyOptions();
}

export function QuestionEditor({
  existing,
}: {
  existing?: PublicQuestion;
}) {
  const router = useRouter();
  const create = useCreateQuestion();
  const update = useUpdateQuestion(existing?.id ?? "");
  const { data: grades } = useGrades();
  const { data: stimulusParents } = useStimulusParents();

  const [questionType, setQuestionType] = useState<string>(
    existing?.questionType ?? "single_choice",
  );
  const [grade, setGrade] = useState<string>(existing?.grade ?? "11");
  const [difficulty, setDifficulty] = useState<number>(
    existing?.difficulty ?? 3,
  );
  const [cognitiveLevel, setCognitiveLevel] = useState<string>(
    existing?.cognitiveLevel ?? "apply",
  );
  const [topicIds, setTopicIds] = useState<string[]>(existing?.topicIds ?? []);
  const [content, setContent] = useState(existing?.contentMarkdown ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"content" | "solution">("content");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const solutionRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Sisipkan shortcode gambar di POSISI KURSOR guru, bukan selalu di akhir.
   * Fokus dikembalikan ke textarea agar guru bisa langsung lanjut menulis.
   */
  function insertAtCursor(snippet: string) {
    const el = contentRef.current;
    if (!el) {
      setContent((prev) => prev + snippet);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + snippet + content.slice(end);
    setContent(next);
    // Kembalikan kursor setelah shortcode yang disisipkan.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }

  /**
   * Opsi dibaca dari `data_payload.options` (bentuk kanonik MAT-145/146) —
   * BUKAN dari tabel `question_options` yang sudah dihapus. Proyeksi baca
   * (`projectOptions`) menyediakan bentuk kompatibel sebagai cadangan untuk
   * soal lama, jadi urutannya: JSONB dulu, proyeksi kemudian.
   */
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    readOptionDrafts(existing),
  );

  /** `answer_key.acceptedAnswers` (isian singkat) — minimal satu baris. */
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>(() => {
    const key = existing?.answerKey;
    const list = Array.isArray(key?.acceptedAnswers)
      ? key.acceptedAnswers.filter((a): a is string => typeof a === "string")
      : [];
    if (list.length) return list;
    if (typeof key?.text === "string" && key.text.trim()) return [key.text];
    return [""];
  });

  /** `answer_key.scoringRubric` (esai) — rubrik poin per langkah. */
  const [scoringRubric, setScoringRubric] = useState<string>(
    existing?.answerKey?.scoringRubric ?? "",
  );

  /** `data_payload.rubricGuidelines` (isian/esai) — panduan penilaian. */
  const [rubricGuidelines, setRubricGuidelines] = useState<string>(() => {
    const dp = (existing?.dataPayload ?? {}) as Record<string, unknown>;
    return typeof dp.rubricGuidelines === "string" ? dp.rubricGuidelines : "";
  });

  interface SolutionDraft {
    id?: string;
    title: string;
    solutionType: "conceptual" | "quick_tip" | "alternative" | "video";
    contentMarkdown: string;
    isPrimary: boolean;
  }

  const [solutions, setSolutions] = useState<SolutionDraft[]>(() => {
    if (existing?.solutions?.length) {
      return existing.solutions.map((s) => ({
        id: s.id.startsWith("virtual-") ? undefined : s.id,
        title: s.title || "Pembahasan Konseptual",
        solutionType: s.solutionType ?? "conceptual",
        contentMarkdown: s.contentMarkdown,
        isPrimary: s.isPrimary,
      }));
    }
    if (existing?.answerKey?.explanation) {
      return [
        {
          title: "Pembahasan Konseptual",
          solutionType: "conceptual",
          contentMarkdown: existing.answerKey.explanation,
          isPrimary: true,
        },
      ];
    }
    return [
      {
        title: "Pembahasan Konseptual",
        solutionType: "conceptual",
        contentMarkdown: "",
        isPrimary: true,
      },
    ];
  });

  const [activeSolutionIdx, setActiveSolutionIdx] = useState(0);

  function addSolution() {
    const nextNum = solutions.length + 1;
    setSolutions((prev) => [
      ...prev,
      {
        title: `Pembahasan Alternatif ${nextNum}`,
        solutionType: "alternative",
        contentMarkdown: "",
        isPrimary: false,
      },
    ]);
    setActiveSolutionIdx(solutions.length);
  }

  function removeSolution(idx: number) {
    if (solutions.length <= 1) return;
    setSolutions((prev) => prev.filter((_, i) => i !== idx));
    setActiveSolutionIdx((prev) => (prev >= idx ? Math.max(0, prev - 1) : prev));
  }

  function patchCurrentSolution(patch: Partial<SolutionDraft>) {
    setSolutions((prev) =>
      prev.map((s, i) => (i === activeSolutionIdx ? { ...s, ...patch } : s)),
    );
  }

  function insertAtSolutionCursor(snippet: string) {
    const el = solutionRef.current;
    const current = solutions[activeSolutionIdx]?.contentMarkdown ?? "";
    if (!el) {
      patchCurrentSolution({ contentMarkdown: current + snippet });
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + snippet + current.slice(end);
    patchCurrentSolution({ contentMarkdown: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const [parentId, setParentId] = useState<string>(
    existing?.parentId ?? "",
  );
  const [matrix, setMatrix] = useState<MatrixPayload>(() =>
    readMatrixPayload(
      (existing?.dataPayload as Record<string, unknown> | undefined) ?? {},
    ),
  );
  const [matching, setMatching] = useState<MatchingPayload>(() =>
    readMatchingPayload(
      (existing?.dataPayload as Record<string, unknown> | undefined) ?? {},
      (existing?.answerKey as Record<string, unknown> | undefined) ?? {},
    ),
  );

  // Autosave draf (G2.3) — kunci unik per soal.
  const draftKey = `mathbank:qeditor:${existing?.id ?? "new"}`;
  const { pendingDraft, restore, discard, clear } = useEditorAutosave(
    draftKey,
    content,
    existing?.contentMarkdown ?? "",
  );
  // Peringatan KaTeX (G2.4) — dihitung ulang saat `content` berubah.
  const katexDiags = lintKatex(content);

  const isText = (TEXT_TYPES as readonly string[]).includes(questionType);
  const isMatrix = questionType === "matrix_grid";
  const isMatching = questionType === "matching";
  // Matriks & menjodohkan menyimpan strukturnya di `data_payload`, bukan opsi A–E.
  const usesOptions =
    isOptionBased(questionType as never) && !isMatrix && !isMatching;
  const multiCorrect = questionType === "multiple_choice_checkbox";
  const isChildCandidate = !isText && !isMatrix && !isMatching &&
    questionType !== "stimulus";

  /** Opsi terisi (teks tidak kosong) — urut sesuai label A–E. */
  const filledOptions = options.filter((o) => o.contentMarkdown.trim());
  const correctLabels = options.filter((o) => o.isCorrect).map((o) => o.label);

  /**
   * Susun `data_payload` sesuai tipe (G2.1) — bentuk kanonik MAT-145.
   *
   * Kunci `type` HANYA disertakan bila struktur payload sudah memenuhi syarat
   * minimum skema kanonik. Alasannya: gerbang tulis lapis 2 memvalidasi struktur
   * secara ketat pada SETIAP simpan (termasuk draf). Tanpa aturan ini, guru yang
   * baru mengisi 1 opsi / rubrik 12 karakter akan tertolak 422 saat menyimpan
   * draf. Payload tanpa `type` tetap tersimpan utuh, lalu otomatis ikut
   * tervalidasi begitu strukturnya lengkap.
   */
  function buildDataPayload(): Record<string, unknown> {
    if (isMatrix) {
      // Bentuk resmi pipeline ingest: { labels, rows:[{text, answer}] }.
      return {
        labels: matrix.labels,
        rows: matrix.rows
          .filter((r) => r.text.trim())
          .map((r) => ({ text: r.text.trim(), answer: r.answer })),
      };
    }

    if (isMatching) {
      const premises = matching.premises
        .filter((p) => p.contentMarkdown.trim())
        .map((p) => ({ id: p.id, contentMarkdown: p.contentMarkdown.trim() }));
      const responses = matching.responses
        .filter((r) => r.contentMarkdown.trim())
        .map((r) => ({ id: r.id, contentMarkdown: r.contentMarkdown.trim() }));
      const base = { premises, responses };
      const complete = premises.length >= 1 && responses.length >= 1;
      return complete ? { type: "matching", ...base } : base;
    }

    if (isText) {
      const base: Record<string, unknown> = {};
      const rubric = rubricGuidelines.trim();
      if (rubric) base.rubricGuidelines = rubric;
      // Skema kanonik menuntut rubricGuidelines ≥ 20 karakter.
      return rubric.length >= 20 ? { type: questionType, ...base } : base;
    }

    if (!usesOptions) return {};

    const payloadOptions = filledOptions.map((o) => {
      const item: Record<string, unknown> = {
        id: o.label,
        contentMarkdown: o.contentMarkdown.trim(),
      };
      // `distractorRationale` kanonik minimal 40 karakter; nilai lebih pendek
      // tetap disimpan apa adanya (tanpa `type`) agar draf tidak tertolak.
      const rationale = o.distractorRationale.trim();
      if (rationale) item.distractorRationale = rationale;
      return item;
    });
    const base = { options: payloadOptions, shuffleOptions: true };
    // Skema kanonik: 2–8 opsi, rationale ≥ 40 karakter bila ada.
    const rationaleOk = payloadOptions.every(
      (o) =>
        o.distractorRationale === undefined ||
        String(o.distractorRationale).trim().length >= 40,
    );
    const complete =
      payloadOptions.length >= 2 && payloadOptions.length <= 8 && rationaleOk;
    return complete
      ? {
          type: multiCorrect ? "complex_multiple_choice" : "multiple_choice",
          ...base,
        }
      : base;
  }

  /**
   * Susun `answer_key` kanonik (MAT-145/146).
   *
   * - PG / PG kompleks → `correctOptionIds` (label A–E)
   * - menjodohkan      → `matchingPairs` (premisId → responsId)
   * - isian singkat    → `acceptedAnswers`
   * - esai             → `scoringRubric`
   * `explanationMarkdown` diisi service dari pembahasan utama (bukan di sini).
   */
  function buildAnswerKey(): Record<string, unknown> {
    if (isMatrix) {
      // Kunci matriks hidup per baris di `data_payload.rows[].answer`.
      return {};
    }
    if (isMatching) {
      const validPremiseIds = new Set(
        matching.premises
          .filter((p) => p.contentMarkdown.trim())
          .map((p) => p.id),
      );
      const validResponseIds = new Set(
        matching.responses
          .filter((r) => r.contentMarkdown.trim())
          .map((r) => r.id),
      );
      const pairs: Record<string, string> = {};
      for (const [premiseId, responseId] of Object.entries(matching.pairs)) {
        if (validPremiseIds.has(premiseId) && validResponseIds.has(responseId)) {
          pairs[premiseId] = responseId;
        }
      }
      return Object.keys(pairs).length ? { matchingPairs: pairs } : {};
    }
    if (isText) {
      if (questionType === "essay") {
        const rubric = scoringRubric.trim();
        return rubric ? { scoringRubric: rubric } : {};
      }
      const answers = acceptedAnswers.map((a) => a.trim()).filter(Boolean);
      return answers.length ? { acceptedAnswers: answers } : {};
    }
    if (!usesOptions) return {};
    return correctLabels.length ? { correctOptionIds: correctLabels } : {};
  }

  const pending = create.isPending || update.isPending;
  const errorMessage = create.error?.message ?? update.error?.message ?? null;

  function setOptionLabel(oldLabel: string, newLabel: string) {
    setOptions((prev) =>
      prev.map((o) => (o.label === oldLabel ? { ...o, label: newLabel } : o)),
    );
  }

  function patchOption(label: string, patch: Partial<OptionDraft>) {
    setOptions((prev) =>
      prev.map((o) => (o.label === label ? { ...o, ...patch } : o)),
    );
  }

  function toggleCorrect(label: string) {
    setOptions((prev) =>
      prev.map((o) => {
        if (multiCorrect) {
          return o.label === label ? { ...o, isCorrect: !o.isCorrect } : o;
        }
        return { ...o, isCorrect: o.label === label };
      }),
    );
  }

  function submit(status: "draft" | "review") {
    const validSolutions = solutions.filter((s) => s.contentMarkdown.trim());

    const payload: CreateQuestionInput = {
      questionType: questionType as CreateQuestionInput["questionType"],
      difficulty,
      cognitiveLevel: cognitiveLevel as CreateQuestionInput["cognitiveLevel"],
      grade,
      contentMarkdown: content.trim(),
      // Single table + hybrid JSONB: opsi/premis/pernyataan & kunci SELALU
      // ditulis ke `data_payload` + `answer_key` (zero join, tanpa
      // `question_options`).
      dataPayload: buildDataPayload(),
      parentId: parentId || null,
      childOrder: 0,
      topicIds,
      tagIds: [],
      status,
      answerKey: buildAnswerKey(),
      // Jalur relasional lama tidak lagi dipakai; gerbang tulis menormalkan
      // `options` bila ada, jadi kita kirim kosong secara eksplisit.
      options: [],
      solutions: validSolutions.map((s) => ({
        id: s.id,
        title: s.title.trim() || "Pembahasan",
        solutionType: s.solutionType,
        contentMarkdown: s.contentMarkdown.trim(),
        isPrimary: s.isPrimary,
      })),
    };

    const onDone = (q: PublicQuestion) => {
      clear(); // draf tersimpan sudah jadi — buang agar tak ditawarkan lagi.
      router.push(`/questions/${q.id}`);
    };

    if (existing) {
      // `updateQuestionSchema` = partial; kirim field yang relevan.
      update.mutate(payload, {
        onSuccess: (q) => (q ? onDone(q) : router.refresh()),
      });
    } else {
      create.mutate(payload, { onSuccess: onDone });
    }
  }

  const correctCount = correctLabels.length;

  /** Semua pernyataan terisi punya kunci? */
  const matrixRowsFilled = matrix.rows.filter((r) => r.text.trim());
  const matrixReady =
    matrixRowsFilled.length > 0 &&
    matrixRowsFilled.every((r) => r.answer != null && r.answer !== "");

  const matchingPremisesFilled = matching.premises.filter((p) =>
    p.contentMarkdown.trim(),
  );
  const matchingResponsesFilled = matching.responses.filter((r) =>
    r.contentMarkdown.trim(),
  );
  const matchingReady =
    matchingPremisesFilled.length > 0 &&
    matchingResponsesFilled.length > 0 &&
    matchingPremisesFilled.every((p) => {
      const target = matching.pairs[p.id];
      return Boolean(
        target && matchingResponsesFilled.some((r) => r.id === target),
      );
    });

  const textReady =
    questionType === "essay"
      ? scoringRubric.trim().length > 0
      : acceptedAnswers.some((a) => a.trim().length > 0);

  const optionsReady = correctCount > 0 && filledOptions.length >= 2;

  const readyToSubmit =
    content.trim().length > 0 &&
    (isText
      ? textReady
      : isMatrix
        ? matrixReady
        : isMatching
          ? matchingReady
          : optionsReady);

  const submitHint = isText
    ? "Isi pertanyaan & rubrik/kunci sebelum minta telaah"
    : isMatrix
      ? "Lengkapi pernyataan & kuncinya sebelum minta telaah"
      : isMatching
        ? "Lengkapi premis, respons & pasangannya sebelum minta telaah"
        : "Isi pertanyaan, minimal 2 opsi & kunci sebelum minta telaah";

  const answerComplete = isText
    ? textReady
    : isMatrix
      ? matrixReady
      : isMatching
        ? matchingReady
        : correctCount > 0;

  const answerSummary = isText
    ? textReady
      ? "Kunci/rubrik terisi"
      : "Kunci belum lengkap"
    : isMatrix
      ? matrixReady
        ? `${matrixRowsFilled.length} pernyataan + kunci`
        : "Kunci matriks belum lengkap"
      : isMatching
        ? matchingReady
          ? `${matchingPremisesFilled.length} pasangan terkunci`
          : "Pasangan belum lengkap"
        : correctCount > 0
          ? `${correctCount} kunci`
          : "Kunci belum dipilih";

  return (
    <div className="flex flex-col gap-6 p-6">
      {pendingDraft !== null && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm"
        >
          <span>
            Ditemukan draf tersimpan untuk soal ini. Pulihkan naskah?
          </span>
          <span className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const v = restore();
                if (v !== null) setContent(v);
              }}
            >
              Pulihkan
            </Button>
            <Button variant="ghost" size="sm" onClick={discard}>
              Buang
            </Button>
          </span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {/* BAR AKSI ATAS (SIMPAN DRAF & MINTA TELAAH) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2">
          {existing && (
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              Batal
            </Button>
          )}
          <span className="text-xs text-muted-foreground font-mono">
            {pendingDraft !== null ? "Autosave siap pulih" : "Autosave aktif"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => submit("draft")}
            disabled={pending || content.trim().length === 0}
            variant="outline"
            size="sm"
          >
            {pending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Simpan Draf
          </Button>

          <Button
            onClick={() => submit("review")}
            disabled={pending || !readyToSubmit}
            size="sm"
            title={readyToSubmit ? undefined : submitHint}
          >
            {pending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            Minta Telaah
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Kolom kiri: isi soal + opsi */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Isi Soal</CardTitle>
              <CardDescription>
                Markdown + KaTeX ($…$ inline, $$…$$ blok).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Sisipkan gambar lewat tombol, atau tulis shortcode manual.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPickerTarget("content");
                    setPickerOpen(true);
                  }}
                >
                  <ImagePlus className="size-4" />
                  Sisip Gambar
                </Button>
              </div>
              <Textarea
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tulis pertanyaan… mis. Tentukan nilai $x$ dari $2x+3=11$."
                rows={5}
                aria-label="Isi soal"
              />
              {content.trim() && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Pratinjau
                  </p>
                  <MathContent content={content} />
                </div>
              )}

              {katexDiags.length > 0 && (
                <div
                  role="alert"
                  className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
                >
                  <p className="mb-1 font-medium">
                    {katexDiags.length} rumus tampaknya bermasalah (tetap bisa
                    disimpan):
                  </p>
                  <ul className="flex list-inside list-disc flex-col gap-0.5">
                    {katexDiags.map((d, i) => (
                      <li key={i}>
                        baris {d.line}: <code>{d.expression}</code> —{" "}
                        {d.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {usesOptions && (
            <Card>
              <CardHeader>
                <CardTitle>Opsi Jawaban</CardTitle>
                <CardDescription>
                  Tandai kunci jawaban{" "}
                  {multiCorrect ? "(boleh lebih dari satu)" : "(satu saja)"}.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {options.map((o) => (
                  <div
                    key={o.label}
                    className="flex flex-col gap-2 rounded-md border border-border p-3"
                  >
                    <div className="flex items-start gap-2">
                      {/* CRIT-03: radio kunci A–E dengan area sentuh ≥ 44px */}
                      <button
                        type="button"
                        onClick={() => toggleCorrect(o.label)}
                        aria-pressed={o.isCorrect}
                        aria-label={`Tandai opsi ${o.label} sebagai kunci`}
                        className="relative flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center"
                      >
                        <span
                          className={cn(
                            "grid size-5 place-items-center rounded-full border text-[10px]",
                            o.isCorrect
                              ? "border-brand bg-brand font-bold text-brand-fg"
                              : "border-border font-medium text-muted-foreground hover:border-muted-foreground",
                          )}
                        >
                          {o.label}
                        </span>
                      </button>
                      <Textarea
                        value={o.contentMarkdown}
                        onChange={(e) =>
                          patchOption(o.label, {
                            contentMarkdown: e.target.value,
                          })
                        }
                        placeholder={`Isi opsi ${o.label}…`}
                        rows={2}
                        aria-label={`Isi opsi ${o.label}`}
                        className="min-w-0 flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Ubah label opsi ${o.label}`}
                        onClick={() => {
                          const idx = LETTERS.indexOf(o.label);
                          const next = LETTERS[(idx + 1) % LETTERS.length];
                          setOptionLabel(o.label, next);
                        }}
                      >
                        ↻
                      </Button>
                    </div>
                    {o.contentMarkdown.trim() && (
                      <div className="pl-7 text-sm text-muted-foreground">
                        <MathContent content={o.contentMarkdown} />
                      </div>
                    )}
                    <Input
                      value={o.distractorRationale}
                      onChange={(e) =>
                        patchOption(o.label, {
                          distractorRationale: e.target.value,
                        })
                      }
                      placeholder="Alasan pengecoh (opsional) — kenapa salah"
                      aria-label={`Alasan pengecoh opsi ${o.label}`}
                      aria-describedby={`rationale-hint-${o.label}`}
                    />
                    {o.distractorRationale.trim().length > 0 &&
                      o.distractorRationale.trim().length < 40 && (
                        <p
                          id={`rationale-hint-${o.label}`}
                          className="pl-7 text-xs text-amber-600 dark:text-amber-400"
                        >
                          {o.distractorRationale.trim().length}/40 karakter —
                          sebutkan nama kesalahan, langkah salah, dan nilai
                          keliru agar soal bisa dirilis.
                        </p>
                      )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {isText && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {questionType === "essay"
                    ? "Kunci & Rubrik Penilaian"
                    : "Kunci Jawaban & Rubrik"}
                </CardTitle>
                <CardDescription>
                  {questionType === "essay"
                    ? "Rubrik poin per langkah matematis (answer_key.scoringRubric) + panduan penilaian."
                    : "Jawaban yang diterima (answer_key.acceptedAnswers) + panduan penilaian."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {questionType === "essay" ? (
                  <Field label="Rubrik penilaian (poin per langkah)">
                    <Textarea
                      value={scoringRubric}
                      onChange={(e) => setScoringRubric(e.target.value)}
                      placeholder={
                        "Langkah 1 — Memodelkan persamaan (2 poin): …\nLangkah 2 — Menyelesaikan (3 poin): …\nLangkah 3 — Jawaban akhir + satuan (2 poin): …"
                      }
                      rows={5}
                      aria-label="Rubrik penilaian esai"
                    />
                  </Field>
                ) : (
                  <StringListField
                    label="Jawaban diterima"
                    items={acceptedAnswers}
                    onChange={setAcceptedAnswers}
                    placeholder="Jawaban"
                    addLabel="Tambah variasi jawaban"
                  />
                )}

                <Field label="Panduan rubrik (untuk penilai)">
                  <Textarea
                    value={rubricGuidelines}
                    onChange={(e) => setRubricGuidelines(e.target.value)}
                    placeholder="Panduan langkah penilaian — mis. wajib menuliskan rumus, substitusi, dan satuan."
                    rows={3}
                    aria-label="Panduan rubrik penilaian"
                  />
                  <p className="text-xs text-muted-foreground">
                    {rubricGuidelines.trim().length}/20 karakter minimum untuk
                    validasi penuh.
                  </p>
                </Field>
              </CardContent>
            </Card>
          )}

          {isMatrix && (
            <Card>
              <CardHeader>
                <CardTitle>Pernyataan Matriks</CardTitle>
                <CardDescription>
                  Tabel penilaian (kolom: {matrix.labels.join(" / ")}).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MatrixGridFields value={matrix} onChange={setMatrix} />
              </CardContent>
            </Card>
          )}

          {isMatching && (
            <Card>
              <CardHeader>
                <CardTitle>Pasangan Menjodohkan</CardTitle>
                <CardDescription>
                  Dua kolom: kiri (premis) & kanan (respons).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MatchingFields value={matching} onChange={setMatching} />
              </CardContent>
            </Card>
          )}

          {/* Card Pembahasan & Solusi (Mendukung Multi-Pembahasan) */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="size-5 text-amber-500" />
                  Kunci & Pembahasan
                </CardTitle>
                <CardDescription>
                  Langkah-langkah penyelesaian rinci. Anda dapat menambahkan beberapa alternatif solusi (misal cara cepat, alternatif).
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSolution}
                className="shrink-0"
              >
                <Plus className="size-4" />
                Tambah Pembahasan
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Tabs jika > 1 solusi */}
              {solutions.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                  {solutions.map((sol, idx) => {
                    const isActive = idx === activeSolutionIdx;
                    return (
                      <div
                        key={idx}
                        className={`group flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          isActive
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/80 bg-background text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveSolutionIdx(idx)}
                          className="text-left font-medium cursor-pointer"
                        >
                          {sol.title.trim() || `Solusi ${idx + 1}`}
                          {sol.isPrimary && " (Utama)"}
                        </button>
                        {solutions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSolution(idx)}
                            className="ml-1 rounded p-0.5 opacity-60 hover:opacity-100 hover:text-destructive cursor-pointer"
                            title="Hapus solusi ini"
                            aria-label={`Hapus ${sol.title}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Form Solusi Aktif */}
              {(() => {
                const currentSol = solutions[activeSolutionIdx] || solutions[0];
                if (!currentSol) return null;

                return (
                  <div className="flex flex-col gap-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                      <div>
                        <span className="text-xs font-medium text-muted-foreground mb-1 block">
                          Judul Pembahasan
                        </span>
                        <Input
                          value={currentSol.title}
                          onChange={(e) =>
                            patchCurrentSolution({ title: e.target.value })
                          }
                          placeholder="mis. Pembahasan Konseptual, Cara Cepat, dsb."
                        />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-muted-foreground mb-1 block">
                          Jenis Pembahasan
                        </span>
                        <Select
                          value={currentSol.solutionType}
                          onValueChange={(v) =>
                            patchCurrentSolution({
                              solutionType: v as SolutionDraft["solutionType"],
                            })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conceptual">
                              Konseptual (Utuh)
                            </SelectItem>
                            <SelectItem value="quick_tip">
                              Trik / Cara Cepat
                            </SelectItem>
                            <SelectItem value="alternative">
                              Metode Alternatif
                            </SelectItem>
                            <SelectItem value="video">
                              Video / Interaktif
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Isi Pembahasan (Mendukung KaTeX $...$ dan Markdown)
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPickerTarget("solution");
                          setPickerOpen(true);
                        }}
                      >
                        <ImagePlus className="size-4" />
                        Sisip Gambar
                      </Button>
                    </div>

                    <Textarea
                      ref={solutionRef}
                      value={currentSol.contentMarkdown}
                      onChange={(e) =>
                        patchCurrentSolution({ contentMarkdown: e.target.value })
                      }
                      placeholder="Tulis langkah-langkah penyelesaian atau rumus $x = \frac{-b \pm \sqrt{D}}{2a}$ di sini…"
                      rows={6}
                      aria-label="Isi Pembahasan"
                    />

                    {currentSol.contentMarkdown.trim() && (
                      <div className="rounded-md border border-border bg-muted/30 p-3">
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                          Pratinjau Pembahasan ({currentSol.title})
                        </p>
                        <div className="text-base leading-relaxed">
                          <MathContent content={currentSol.contentMarkdown} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Kolom kanan: metadata + aksi */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FieldGroup>
              <Field label="Tipe Soal">
                <Select value={questionType} onValueChange={(v) => v && setQuestionType(v)}>
                  <SelectTrigger className="w-full" aria-label="Tipe soal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {OPTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABELS[t] ?? t}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      {TEXT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABELS[t] ?? t}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Jenjang">
                <Select value={grade} onValueChange={(v) => v && setGrade(v)}>
                  <SelectTrigger className="w-full" aria-label="Jenjang">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(grades ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Topik Materi">
                <TopicPicker value={topicIds} onChange={setTopicIds} />
              </Field>

              <Field label="Kesulitan">
                <Select
                  value={String(difficulty)}
                  onValueChange={(v) => v && setDifficulty(Number(v))}
                >
                  <SelectTrigger className="w-full" aria-label="Kesulitan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {[1, 2, 3, 4, 5].map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {DIFFICULTY_LABELS[d] ?? `Level ${d}`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <RubricHint
                  code={difficultyRubric(difficulty).code}
                  description={difficultyRubric(difficulty).description}
                />
              </Field>

              <Field label="Level Kognitif">
                <Select
                  value={cognitiveLevel}
                  onValueChange={(v) => v && setCognitiveLevel(v)}
                >
                  <SelectTrigger className="w-full" aria-label="Level kognitif">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(COGNITIVE_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <RubricHint
                  code={`${cognitiveRubric(cognitiveLevel).code}`}
                  description={cognitiveRubric(cognitiveLevel).description}
                />
              </Field>

              {isChildCandidate && (
                <Field label="Wacana Stimulus Induk (opsional)">
                  <Select
                    value={parentId || "__none__"}
                    onValueChange={(v) => v && setParentId(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="w-full" aria-label="Wacana stimulus induk">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Tanpa induk —</SelectItem>
                      {(stimulusParents ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.contentMarkdown.replace(/[#*$`]/g, "").slice(0, 60) || s.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Kaitkan soal ini ke wacana bertipe stimulus (audit §3.9).
                  </p>
                </Field>
              )}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 pt-4">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant={answerComplete ? "secondary" : "outline"}>
                  {answerSummary}
                </Badge>
              </div>

              <Button
                onClick={() => submit("draft")}
                disabled={pending || content.trim().length === 0}
                variant="outline"
              >
                {pending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Simpan Draf
              </Button>

              <Button
                onClick={() => submit("review")}
                disabled={pending || !readyToSubmit}
                title={readyToSubmit ? undefined : submitHint}
              >
                {pending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                Minta Telaah
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {existing ? "Menyunting soal yang ada" : "Soal baru"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <AssetPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(shortcode) =>
          pickerTarget === "solution"
            ? insertAtSolutionCursor(shortcode)
            : insertAtCursor(shortcode)
        }
      />
    </div>
  );
}
