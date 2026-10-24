"use client";

import type { RefObject } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MathContent } from "@/components/math/math-content";

interface QuestionEditorStemProps {
  content: string;
  setContent: (v: string) => void;
  contentRef: RefObject<HTMLTextAreaElement | null>;
  katexDiags: Array<{ line: number; expression: string; message: string }>;
  onOpenImagePicker: () => void;
}

export function QuestionEditorStem({
  content,
  setContent,
  contentRef,
  katexDiags,
  onOpenImagePicker,
}: QuestionEditorStemProps) {
  return (
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
            onClick={onOpenImagePicker}
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
                  baris {d.line}: <code>{d.expression}</code> — {d.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
