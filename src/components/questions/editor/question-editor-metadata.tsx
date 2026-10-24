"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup } from "@/components/ui/field-group";
import { TopicPicker } from "../topic-picker";
import { RubricHint } from "@/components/questions/rubric-badge";
import { cognitiveRubric, difficultyRubric } from "@/lib/display/rubrics";
import {
  TYPE_LABELS,
  DIFFICULTY_LABELS,
  COGNITIVE_LABELS,
} from "@/lib/display/labels";

interface QuestionEditorMetadataProps {
  questionType: string;
  setQuestionType: (t: string) => void;
  grade: string;
  setGrade: (g: string) => void;
  grades: Array<{ id: string; label: string }> | undefined;
  topicIds: string[];
  setTopicIds: (ids: string[]) => void;
  difficulty: number;
  setDifficulty: (d: number) => void;
  cognitiveLevel: string;
  setCognitiveLevel: (c: string) => void;
  isChildCandidate: boolean;
  parentId: string;
  setParentId: (p: string) => void;
  stimulusParents: Array<{ id: string; contentMarkdown: string }> | undefined;
  optionTypes: readonly string[];
  textTypes: readonly string[];
}

export function QuestionEditorMetadata({
  questionType,
  setQuestionType,
  grade,
  setGrade,
  grades,
  topicIds,
  setTopicIds,
  difficulty,
  setDifficulty,
  cognitiveLevel,
  setCognitiveLevel,
  isChildCandidate,
  parentId,
  setParentId,
  stimulusParents,
  optionTypes,
  textTypes,
}: QuestionEditorMetadataProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup>
          <Field label="Tipe Soal">
            <Select value={questionType} onValueChange={(v) => v && setQuestionType(v)}>
              <SelectTrigger className="w-full pointer-coarse:min-h-[44px]" aria-label="Tipe soal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {optionTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t] ?? t}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  {textTypes.map((t) => (
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
              <SelectTrigger className="w-full pointer-coarse:min-h-[44px]" aria-label="Jenjang">
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
              <SelectTrigger className="w-full pointer-coarse:min-h-[44px]" aria-label="Kesulitan">
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
              <SelectTrigger className="w-full pointer-coarse:min-h-[44px]" aria-label="Level kognitif">
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
                <SelectTrigger className="w-full pointer-coarse:min-h-[44px]" aria-label="Wacana stimulus induk">
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
  );
}
