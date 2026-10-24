"use client";

import type { RefObject } from "react";
import { Plus, Trash2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MathContent } from "@/components/math/math-content";
import type { SolutionDraft } from "./types";

interface QuestionEditorSolutionsProps {
  solutions: SolutionDraft[];
  activeSolutionIdx: number;
  setActiveSolutionIdx: (idx: number) => void;
  addSolution: () => void;
  removeSolution: (idx: number) => void;
  patchCurrentSolution: (patch: Partial<SolutionDraft>) => void;
  solutionRef: RefObject<HTMLTextAreaElement | null>;
  onOpenImagePicker: () => void;
}

export function QuestionEditorSolutions({
  solutions,
  activeSolutionIdx,
  setActiveSolutionIdx,
  addSolution,
  removeSolution,
  patchCurrentSolution,
  solutionRef,
  onOpenImagePicker,
}: QuestionEditorSolutionsProps) {
  const currentSol = solutions[activeSolutionIdx] || solutions[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Pembahasan (Multi-Solution)</CardTitle>
            <CardDescription>
              Dukung multi-solusi (konseptual, trik cepat, alternatif) untuk pengayaan.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSolution}
          >
            <Plus className="size-4" />
            Tambah Cara Lain
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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

        {currentSol && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-1 block">
                  Judul Pembahasan
                </span>
                <Input
                  value={currentSol.title}
                  onChange={(e) => patchCurrentSolution({ title: e.target.value })}
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
                  <SelectTrigger className="w-full pointer-coarse:min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conceptual">Konseptual (Utuh)</SelectItem>
                    <SelectItem value="quick_tip">Trik / Cara Cepat</SelectItem>
                    <SelectItem value="alternative">Metode Alternatif</SelectItem>
                    <SelectItem value="video">Video / Interaktif</SelectItem>
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
                onClick={onOpenImagePicker}
              >
                <ImagePlus className="size-4" />
                Sisip Gambar
              </Button>
            </div>

            <Textarea
              ref={solutionRef}
              value={currentSol.contentMarkdown}
              onChange={(e) => patchCurrentSolution({ contentMarkdown: e.target.value })}
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
        )}
      </CardContent>
    </Card>
  );
}
