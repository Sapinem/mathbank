"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil, Printer, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { MathContent } from "@/components/math/math-content";
import { useBundle, useBundleValidation } from "@/lib/hooks/use-bundles";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draf",
  review: "Telaah",
  ready: "Siap",
  archived: "Arsip",
};

/** Detail paket: pratinjau naskah + peringatan validasi. */
export function BundleDetailView() {
  const params = useParams<{ id: string }>();
  const bundleId = params.id;
  const { data: bundle, isPending, isError, error } = useBundle(bundleId);
  const { data: validation } = useBundleValidation(bundleId);

  if (isPending) return <LoadingState label="Memuat paket…" />;
  if (isError)
    return <ErrorState title="Gagal memuat paket" description={(error as Error).message} />;
  if (!bundle) return null;

  return (
    <>
      <PageHeader
        title={bundle.title}
        description={`${bundle.items.length} soal · ${bundle.durationMinutes ?? 0} menit`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/bundles" />} nativeButton={false}>
              ← Daftar
            </Button>
            <Button render={<Link href={`/bundles/${bundleId}/edit`} />} nativeButton={false}>
              <Pencil data-icon="inline-start" /> Sunting
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/bundles/${bundleId}/print`} />}
              nativeButton={false}
            >
              <Printer data-icon="inline-start" /> Cetak
            </Button>
          </div>
        }
      />

      {validation && validation.withoutAnswerKey.length > 0 && (
        <Card className="mb-4 border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="mt-0.5 size-5 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium">
                {validation.withoutAnswerKey.length} soal belum punya kunci jawaban.
              </p>
              <p className="text-muted-foreground">
                Boleh tetap dipakai, tapi ditandai untuk ditinjau.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pratinjau Naskah</CardTitle>
          <CardDescription>
            Status: <Badge variant="outline">{STATUS_LABELS[bundle.status] ?? bundle.status}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {bundle.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Paket masih kosong.</p>
          ) : (
            bundle.items.map((it, idx) => (
              <div key={it.item.id} className="flex gap-3">
                <span className="w-6 shrink-0 text-right font-medium tabular-nums text-muted-foreground">
                  {idx + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <MathContent content={it.question.contentMarkdown} />
                  {it.item.role === "stimulus" && (
                    <Badge variant="secondary" className="mt-2 text-[10px]">
                      Stimulus
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
