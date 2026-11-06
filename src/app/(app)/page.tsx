"use client";

import Link from "next/link";
import {
  BookOpen,
  ClipboardCheck,
  Flag,
  Package,
  Database,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { MathContent } from "@/components/math/math-content";
import { STATUS_LABELS, statusClass } from "@/lib/display/labels";
import { StatusIcon } from "@/components/questions/question-status-badge";
import { cn } from "@/lib/utils";
import { useStats } from "@/lib/hooks/use-stats";

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useStats();

  return (
    <>
      <PageHeader
        title="Dasbor"
        description="Ringkasan bank soal, kurasi, dan aktivitas terbaru."
      />
      <div className="flex flex-col gap-6 p-6">
        {isLoading ? (
          <LoadingState label="Memuat ringkasan…" />
        ) : isError ? (
          <ErrorState
            title="Gagal memuat ringkasan"
            description={error?.message}
            action={
              <button
                onClick={() => refetch()}
                className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Coba lagi
              </button>
            }
          />
        ) : data ? (
          <>
            {/* Statistik */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Total Soal", value: data.stats.total, icon: BookOpen },
                { label: "Siap", value: data.stats.ready, icon: ClipboardCheck },
                { label: "Perlu Telaah", value: data.stats.review, icon: ClipboardCheck },
                { label: "Ditandai", value: data.stats.flagged, icon: Flag },
                { label: "Paket Soal", value: data.stats.bundles, icon: Package },
                { label: "Sumber", value: data.stats.sources, icon: Database },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <Card key={s.label} className="gap-2 py-4">
                    <CardContent className="flex items-center gap-3 px-4">
                      <Icon className="size-5 text-muted-foreground" />
                      <div>
                        <div className="text-2xl font-semibold tracking-tight tabular-nums">
                          {s.value}
                        </div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Aktivitas terbaru */}
              <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Aktivitas Terbaru</CardTitle>
                  <Link
                    href="/questions"
                    className="flex items-center gap-1 text-sm text-brand hover:underline"
                  >
                    Bank Soal <ArrowRight className="size-3.5" />
                  </Link>
                </CardHeader>
                <CardContent>
                  {data.recent.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Belum ada soal. Mulai dengan{" "}
                      <Link href="/questions/new" className="text-brand hover:underline">
                        membuat soal
                      </Link>
                      .
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.recent.map((q) => (
                        <li key={q.id}>
                          <Link
                            href={`/questions/${q.id}`}
                            className="flex items-start justify-between gap-4 py-3 hover:bg-muted/40"
                          >
                            <span className="line-clamp-2 min-w-0 text-sm">
                              <MathContent content={q.content} />
                            </span>
                            <Badge
                              variant="outline"
                              className={cn("shrink-0 text-xs", statusClass(q.status))}
                            >
                              <StatusIcon status={q.status} data-icon="inline-start" aria-hidden="true" />
                              {STATUS_LABELS[q.status] ?? q.status}
                            </Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Antrean kurasi */}
              <Card>
                <CardHeader>
                  <CardTitle>Antrean Kurasi</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <QueueRow label="Perlu telaah" href="/review?status=review" value={data.stats.review} />
                  <QueueRow label="Ditandai" href="/review?flagged=1" value={data.stats.flagged} />
                  <div className="pt-2">
                    {data.stats.review === 0 && data.stats.flagged === 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        Semua bersih ✓
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-gold/30 bg-gold/15 text-xs text-gold-fg"
                      >
                        {data.stats.review + data.stats.flagged} menunggu tindakan
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribusi */}
            <div className="grid gap-6 lg:grid-cols-3">
              <DistCard
                title="Topik Teratas"
                rows={data.topTopics.map((t) => ({ label: t.name, n: t.n }))}
              />
              <DistCard
                title="Sebaran Kesulitan"
                rows={data.byDifficulty
                  .sort((a, b) => a.key - b.key)
                  .map((d) => ({ label: `Level ${d.key}`, n: d.n }))}
              />
              <DistCard
                title="Sebaran Jenjang"
                rows={data.byGrade.map((g) => ({
                  label: g.key ? `Kelas ${g.key}` : "Tanpa Jenjang",
                  n: g.n,
                }))}
              />
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

function QueueRow({ label, href, value }: { label: string; href: string; value: number }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted"
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </Link>
  );
}

function DistCard({ title, rows }: { title: string; rows: { label: string; n: number }[] }) {
  const total = rows.reduce((s, r) => s + r.n, 0);
  const shown = rows.filter((r) => r.n > 0).slice(0, 6);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada data.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((r) => (
              <li key={r.label} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 break-words leading-snug text-muted-foreground line-clamp-2">{r.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${total ? (r.n / total) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right tabular-nums">{r.n}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
