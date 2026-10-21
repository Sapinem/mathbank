import Link from "next/link";
import { Hash, Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tag topik soal (Sprint 1 · MAT-127 / ACT-09).
 *
 * Setiap tag adalah TAUTAN ke Bank Soal terfilter (`/questions?topicId=<id>`)
 * — filter topik sudah ada di server (`buildQuestionFilter` menelusuri
 * keturunan topik), jadi UI cukup menautkan, tanpa state tambahan.
 *
 * Hirarki 3 level dipetakan ke bobot visual berbeda:
 *  - level 1 (Kategori) → paling tegas (border + teks kuat)
 *  - level 2 (Topik)    → sedang
 *  - level 3 (SubTopik) → paling ringan
 */

/**
 * MAT-131B (Tahap A): `slug` **dihapus** dari kontrak UI.
 * Identitas & navigasi tag sepenuhnya memakai `id` kanonik + `name` tampilan —
 * lihat `topicFilterHref`. Nilai `slug` legacy (bila masih terkirim API) sengaja
 * diabaikan; Tahap B akan membuangnya dari skema.
 */
export interface TopicTagItem {
  id: string;
  name: string;
  level?: number | null;
  isPrimary?: boolean | null;
}

/** URL Bank Soal terfilter untuk satu topik. */
export function topicFilterHref(topicId: string): string {
  return `/questions?topicId=${encodeURIComponent(topicId)}`;
}

const LEVEL_CLASS: Record<number, string> = {
  1: "border-border bg-muted/70 text-foreground font-medium",
  2: "border-border/80 bg-muted/40 text-foreground/90",
  3: "border-border/60 bg-transparent text-muted-foreground",
};

/** Satu tag topik — bisa diklik untuk memfilter Bank Soal. */
export function TopicTag({
  topic,
  className,
  clickable = true,
}: {
  topic: TopicTagItem;
  className?: string;
  clickable?: boolean;
}) {
  const level = topic.level ?? 2;
  const classes = cn(
    "inline-flex min-h-[28px] items-center gap-1 rounded-4xl border px-2.5 py-0.5 text-xs whitespace-nowrap pointer-coarse:min-h-[44px]",
    LEVEL_CLASS[level] ?? LEVEL_CLASS[2],
    topic.isPrimary && "ring-1 ring-brand/30",
    clickable &&
      "motion-safe:transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    className,
  );

  if (!clickable) {
    return (
      <span className={classes} title={topic.name}>
        <Hash aria-hidden className="size-3 opacity-60" />
        {topic.name}
      </span>
    );
  }

  return (
    <Link
      href={topicFilterHref(topic.id)}
      className={classes}
      title={`Saring Bank Soal: ${topic.name}`}
    >
      <Hash aria-hidden className="size-3 opacity-60" />
      {topic.name}
      {topic.isPrimary && (
        <span className="rounded bg-brand/15 px-1 text-[9px] font-bold uppercase tracking-wide text-brand">
          Utama
        </span>
      )}
    </Link>
  );
}

/** Daftar tag topik + keadaan kosong yang eksplisit. */
export function TopicTagList({
  topics,
  className,
  emptyLabel = "Belum ada topik.",
  showEmptyIcon = false,
}: {
  topics: TopicTagItem[];
  className?: string;
  emptyLabel?: string;
  showEmptyIcon?: boolean;
}) {
  if (topics.length === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs text-muted-foreground/80",
          className,
        )}
      >
        {showEmptyIcon && <TagIcon aria-hidden className="size-3" />}
        {emptyLabel}
      </span>
    );
  }

  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {topics.map((t) => (
        <li key={t.id}>
          <TopicTag topic={t} />
        </li>
      ))}
    </ul>
  );
}
