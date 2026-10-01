"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MathContent } from "@/components/math/math-content";
import { Field, FieldGroup } from "@/components/ui/field-group";
import { useCreateQuestion, useUpdateQuestion } from "@/lib/hooks/use-questions";
import { useGrades, useStimulusParents } from "@/lib/hooks/use-reference";
import { useEditorAutosave } from "@/lib/hooks/use-editor-autosave";
import { AssetPickerModal } from "@/components/media/asset-picker-modal";
import { lintKatex } from "@/lib/math/katex-lint";
import {
  MatrixGridFields,
  MatchingFields,
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
  const [content, setContent] = useState(existing?.contentMarkdown ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

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

  const [options, setOptions] = useState<OptionDraft[]>(() => {
    if (existing?.options?.length) {
      return existing.options.map((o) => ({
        label: o.label,
        contentMarkdown: o.contentMarkdown,
        isCorrect: Boolean(o.isCorrect),
        distractorRationale: o.distractorRationale ?? "",
      }));
    }
    return emptyOptions();
  });

  const [answerText, setAnswerText] = useState(
    existing?.answerKey?.text ?? "",
  );
  const [explanation, setExplanation] = useState(
    existing?.answerKey?.explanation ?? "",
  );
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
  const usesOptions = isOptionBased(questionType as never);
  const multiCorrect = questionType === "multiple_choice_checkbox";
  const isMatrix = questionType === "matrix_grid";
  const isMatching = questionType === "matching";
  const isChildCandidate = !isText && !isMatrix && !isMatching &&
    questionType !== "stimulus";

  /** Susun `data_payload` sesuai tipe (G2.1). Tipe lain → {}. */
  function buildDataPayload(): Record<string, unknown> {
    if (isMatrix) {
      return {
        columns: matrix.columns,
        rows: matrix.rows.filter((r) => r.label.trim()),
      };
    }
    if (isMatching) {
      return {
        left: matching.left.filter((s) => s.trim()),
        right: matching.right.filter((s) => s.trim()),
      };
    }
    return {};
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
    const correct = options.filter((o) => o.isCorrect).map((o) => o.label);
    const payload: CreateQuestionInput = {
      questionType: questionType as CreateQuestionInput["questionType"],
      difficulty,
      cognitiveLevel: cognitiveLevel as CreateQuestionInput["cognitiveLevel"],
      grade,
      contentMarkdown: content.trim(),
      dataPayload: buildDataPayload(),
      parentId: parentId || null,
      childOrder: 0,
      topicIds: [],
      tagIds: [],
      status,
      answerKey: isText
        ? { text: answerText.trim(), explanation: explanation.trim() || undefined }
        : { correct, explanation: explanation.trim() || undefined },
      options: usesOptions
        ? options
            .filter((o) => o.contentMarkdown.trim())
            .map((o, i) => ({
              label: o.label,
              contentMarkdown: o.contentMarkdown.trim(),
              isCorrect: o.isCorrect,
              distractorRationale: o.distractorRationale.trim() || null,
              orderIndex: i,
            }))
        : [],
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

  const correctCount = options.filter((o) => o.isCorrect).length;
  const readyToSubmit = content.trim().length > 0 &&
    (isText ? answerText.trim().length > 0 : correctCount > 0);

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
                  onClick={() => setPickerOpen(true)}
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
                      <button
                        type="button"
                        onClick={() => toggleCorrect(o.label)}
                        aria-pressed={o.isCorrect}
                        aria-label={`Tandai opsi ${o.label} sebagai kunci`}
                        className={
                          o.isCorrect
                            ? "mt-1.5 grid size-5 shrink-0 place-items-center rounded-full border border-brand bg-brand text-[10px] font-bold text-brand-fg"
                            : "mt-1.5 grid size-5 shrink-0 place-items-center rounded-full border border-border text-[10px] font-medium text-muted-foreground hover:border-muted-foreground"
                        }
                      >
                        {o.label}
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
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {isText && (
            <Card>
              <CardHeader>
                <CardTitle>Kunci & Pembahasan</CardTitle>
                <CardDescription>
                  {questionType === "essay"
                    ? "Rambu-rambu penilaian / kunci esai."
                    : "Jawaban singkat yang diharapkan."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Jawaban benar…"
                  rows={3}
                  aria-label="Jawaban teks"
                />
              </CardContent>
            </Card>
          )}

          {isMatrix && (
            <Card>
              <CardHeader>
                <CardTitle>Pernyataan Matriks</CardTitle>
                <CardDescription>
                  Tabel penilaian (kolom tetap: {matrix.columns.join(" / ")}).
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

              <Separator />

              <p className="text-xs text-muted-foreground">
                Pembahasan (opsional, tampil setelah dijawab).
              </p>
              <Textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Pembahasan singkat…"
                rows={3}
                aria-label="Pembahasan"
              />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 pt-4">
              <div className="mb-1 flex items-center gap-2">
                {isText ? (
                  <Badge variant={answerText.trim() ? "secondary" : "outline"}>
                    {answerText.trim() ? "Kunci terisi" : "Kunci kosong"}
                  </Badge>
                ) : (
                  <Badge variant={correctCount > 0 ? "secondary" : "outline"}>
                    {correctCount > 0
                      ? `${correctCount} kunci`
                      : "Kunci belum dipilih"}
                  </Badge>
                )}
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
                title={
                  readyToSubmit
                    ? undefined
                    : "Isi pertanyaan & kunci sebelum kirim telaah"
                }
              >
                {pending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                Kirim ke Telaah
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
        onPick={(shortcode) => insertAtCursor(shortcode)}
      />
    </div>
  );
}
