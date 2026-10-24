"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MathContent } from "@/components/math/math-content";
import { LETTERS, type OptionDraft } from "./types";

interface QuestionEditorOptionsProps {
  options: OptionDraft[];
  usesOptions: boolean;
  multiCorrect: boolean;
  toggleCorrect: (label: string) => void;
  patchOption: (label: string, patch: Partial<OptionDraft>) => void;
  setOptionLabel: (oldLabel: string, newLabel: string) => void;
}

export function QuestionEditorOptions({
  options,
  usesOptions,
  multiCorrect,
  toggleCorrect,
  patchOption,
  setOptionLabel,
}: QuestionEditorOptionsProps) {
  if (!usesOptions) return null;

  return (
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
                className="relative flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center cursor-pointer"
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
                  const next = LETTERS[(idx + 1) % LETTERS.length] ?? "A";
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
  );
}
