"use client";

import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field-group";
import {
  MatrixGridFields,
  MatchingFields,
  StringListField,
  type MatrixPayload,
  type MatchingPayload,
} from "@/components/questions/type-specific-fields";

interface QuestionEditorRubricsProps {
  questionType: string;
  isText: boolean;
  isMatrix: boolean;
  isMatching: boolean;
  scoringRubric: string;
  setScoringRubric: (v: string) => void;
  acceptedAnswers: string[];
  setAcceptedAnswers: (v: string[]) => void;
  rubricGuidelines: string;
  setRubricGuidelines: (v: string) => void;
  matrix: MatrixPayload;
  setMatrix: (v: MatrixPayload) => void;
  matching: MatchingPayload;
  setMatching: (v: MatchingPayload) => void;
}

export function QuestionEditorRubrics({
  questionType,
  isText,
  isMatrix,
  isMatching,
  scoringRubric,
  setScoringRubric,
  acceptedAnswers,
  setAcceptedAnswers,
  rubricGuidelines,
  setRubricGuidelines,
  matrix,
  setMatrix,
  matching,
  setMatching,
}: QuestionEditorRubricsProps) {
  return (
    <>
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
    </>
  );
}
