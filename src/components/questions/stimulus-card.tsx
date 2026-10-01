"use client";

import { BookOpen } from "lucide-react";
import { MathContent } from "@/components/math/math-content";
import { cn } from "@/lib/utils";

/**
 * Blok wacana stimulus induk (AKM / PISA / soal konteks).
 * Menampilkan teks wacana soal induk di atas soal anak, dalam kotak berbingkai
 * aksen agar konteks utuh terbaca sebelum menjawab (audit §3.9).
 */
export function StimulusCard({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-brand/30 bg-brand/5 p-3",
        className,
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-brand">
        <BookOpen className="size-3.5" aria-hidden />
        Wacana Stimulus (Induk)
      </div>
      <MathContent content={content} className="text-sm leading-relaxed" />
    </div>
  );
}
