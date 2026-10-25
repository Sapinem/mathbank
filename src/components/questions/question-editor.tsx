"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCreateQuestion, useUpdateQuestion } from "@/lib/hooks/use-questions";
import { useGrades, useStimulusParents } from "@/lib/hooks/use-reference";
import { useEditorAutosave } from "@/lib/hooks/use-editor-autosave";
import { AssetPickerModal } from "@/components/media/asset-picker-modal";
import { lintKatex } from "@/lib/math/katex-lint";
import {
  readMatrixPayload,
  readMatchingPayload,
  type MatrixPayload,
  type MatchingPayload,
} from "@/components/questions/type-specific-fields";
import {
  isOptionBased,
  OPTION_BASED_TYPES,
  type CreateQuestionInput,
} from "@/lib/contracts/question";
import type { PublicQuestion } from "@/lib/services/question-service";

import {
  type OptionDraft,
  type SolutionDraft,
  readOptionDrafts,
} from "./editor/types";
import { QuestionEditorStem } from "./editor/question-editor-stem";
import { QuestionEditorOptions } from "./editor/question-editor-options";
import { QuestionEditorRubrics } from "./editor/question-editor-rubrics";
import { QuestionEditorSolutions } from "./editor/question-editor-solutions";
import { QuestionEditorMetadata } from "./editor/question-editor-metadata";

const TEXT_TYPES = ["short_answer", "essay"] as const;

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
  const [content, setContent] = useState<string>(existing?.contentMarkdown ?? "");
  const [grade, setGrade] = useState<string>(existing?.grade ?? "10");
  const [difficulty, setDifficulty] = useState<number>(existing?.difficulty ?? 3);
  const [cognitiveLevel, setCognitiveLevel] = useState<string>(
    existing?.cognitiveLevel ?? "apply",
  );
  const [topicIds, setTopicIds] = useState<string[]>(
    existing?.topics?.map((t) => t.id) ?? [],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"content" | "solution">("content");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const solutionRef = useRef<HTMLTextAreaElement>(null);

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
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const [options, setOptions] = useState<OptionDraft[]>(() =>
    readOptionDrafts(existing),
  );

  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>(() => {
    const key = existing?.answerKey;
    const list = Array.isArray(key?.acceptedAnswers)
      ? key.acceptedAnswers.filter((a): a is string => typeof a === "string")
      : [];
    if (list.length) return list;
    if (typeof key?.text === "string" && key.text.trim()) return [key.text];
    return [""];
  });

  const [scoringRubric, setScoringRubric] = useState<string>(
    existing?.answerKey?.scoringRubric ?? "",
  );

  const [rubricGuidelines, setRubricGuidelines] = useState<string>(() => {
    const dp = (existing?.dataPayload ?? {}) as Record<string, unknown>;
    return typeof dp.rubricGuidelines === "string" ? dp.rubricGuidelines : "";
  });

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
    if (activeSolutionIdx >= idx && activeSolutionIdx > 0) {
      setActiveSolutionIdx(activeSolutionIdx - 1);
    }
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

  const [parentId, setParentId] = useState<string>(existing?.parentId ?? "");
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

  const draftKey = `mathbank:qeditor:${existing?.id ?? "new"}`;
  const { pendingDraft, restore, discard, clear } = useEditorAutosave(
    draftKey,
    content,
    existing?.contentMarkdown ?? "",
  );
  const katexDiags = lintKatex(content);

  const isText = (TEXT_TYPES as readonly string[]).includes(questionType);
  const isMatrix = questionType === "matrix_grid";
  const isMatching = questionType === "matching";
  const usesOptions =
    isOptionBased(questionType as never) && !isMatrix && !isMatching;
  const multiCorrect = questionType === "multiple_choice_checkbox";
  const isChildCandidate =
    !isText && !isMatrix && !isMatching && questionType !== "stimulus";

  const filledOptions = options.filter((o) => o.contentMarkdown.trim());
  const correctLabels = options.filter((o) => o.isCorrect).map((o) => o.label);

  function buildDataPayload(): Record<string, unknown> {
    if (isMatrix) {
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
      return rubric.length >= 20 ? { type: questionType, ...base } : base;
    }

    if (!usesOptions) return {};

    const payloadOptions = filledOptions.map((o) => {
      const item: Record<string, unknown> = {
        id: o.label,
        contentMarkdown: o.contentMarkdown.trim(),
      };
      const rationale = o.distractorRationale.trim();
      if (rationale) item.distractorRationale = rationale;
      return item;
    });
    const base = { options: payloadOptions, shuffleOptions: true };
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

  function buildAnswerKey(): Record<string, unknown> {
    if (isMatrix) return {};
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
      prev.map((o) => {
        if (o.label === oldLabel) return { ...o, label: newLabel };
        if (o.label === newLabel) return { ...o, label: oldLabel };
        return o;
      }),
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
        if (o.label === label) return { ...o, isCorrect: !o.isCorrect };
        if (!multiCorrect) return { ...o, isCorrect: false };
        return o;
      }),
    );
  }

  function submit(status: "draft" | "review") {
    const dataPayload = buildDataPayload();
    const answerKey = buildAnswerKey();

    const payload: CreateQuestionInput = {
      questionType: questionType as never,
      contentMarkdown: content.trim(),
      difficulty,
      cognitiveLevel: cognitiveLevel as never,
      grade,
      parentId: parentId || null,
      status,
      childOrder: existing?.childOrder ?? 0,
      topicIds,
      tagIds: [],
      options: [],
      dataPayload,
      answerKey,
      solutions: solutions
        .filter((s) => s.contentMarkdown.trim())
        .map((s, idx) => ({
          title: s.title.trim() || `Pembahasan ${idx + 1}`,
          solutionType: s.solutionType,
          contentMarkdown: s.contentMarkdown.trim(),
          isPrimary: idx === 0,
        })),
    };

    const onDone = (q: PublicQuestion) => {
      clear();
      router.push(`/questions/${q.id}`);
    };

    if (existing) {
      update.mutate(payload, {
        onSuccess: (q) => (q ? onDone(q) : router.refresh()),
      });
    } else {
      create.mutate(payload, { onSuccess: onDone });
    }
  }

  const correctCount = correctLabels.length;
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
          <span>Ditemukan draf tersimpan untuk soal ini. Pulihkan naskah?</span>
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
          <QuestionEditorStem
            content={content}
            setContent={setContent}
            contentRef={contentRef}
            katexDiags={katexDiags}
            onOpenImagePicker={() => {
              setPickerTarget("content");
              setPickerOpen(true);
            }}
          />

          <QuestionEditorOptions
            options={options}
            usesOptions={usesOptions}
            multiCorrect={multiCorrect}
            toggleCorrect={toggleCorrect}
            patchOption={patchOption}
            setOptionLabel={setOptionLabel}
          />

          <QuestionEditorRubrics
            questionType={questionType}
            isText={isText}
            isMatrix={isMatrix}
            isMatching={isMatching}
            scoringRubric={scoringRubric}
            setScoringRubric={setScoringRubric}
            acceptedAnswers={acceptedAnswers}
            setAcceptedAnswers={setAcceptedAnswers}
            rubricGuidelines={rubricGuidelines}
            setRubricGuidelines={setRubricGuidelines}
            matrix={matrix}
            setMatrix={setMatrix}
            matching={matching}
            setMatching={setMatching}
          />

          <QuestionEditorSolutions
            solutions={solutions}
            activeSolutionIdx={activeSolutionIdx}
            setActiveSolutionIdx={setActiveSolutionIdx}
            addSolution={addSolution}
            removeSolution={removeSolution}
            patchCurrentSolution={patchCurrentSolution}
            solutionRef={solutionRef}
            onOpenImagePicker={() => {
              setPickerTarget("solution");
              setPickerOpen(true);
            }}
          />
        </div>

        {/* Kolom kanan: metadata + aksi */}
        <div className="flex flex-col gap-6">
          <QuestionEditorMetadata
            questionType={questionType}
            setQuestionType={setQuestionType}
            grade={grade}
            setGrade={setGrade}
            grades={grades}
            topicIds={topicIds}
            setTopicIds={setTopicIds}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            cognitiveLevel={cognitiveLevel}
            setCognitiveLevel={setCognitiveLevel}
            isChildCandidate={isChildCandidate}
            parentId={parentId}
            setParentId={setParentId}
            stimulusParents={stimulusParents}
            optionTypes={OPTION_BASED_TYPES}
            textTypes={TEXT_TYPES}
          />

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
