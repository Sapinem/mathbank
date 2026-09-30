"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEnrichQuestion, type EnrichmentProposal } from "@/lib/hooks/use-ai";
import { DIFFICULTY_LABELS, COGNITIVE_LABELS } from "@/lib/display/labels";

/**
 * Tombol + dialog "Enrich dengan AI" (M10).
 *
 * AI **mengusulkan** topik/kesulitan/kognitif/tags; usulan **diterapkan** ke soal
 * dan statusnya naik ke `review` (manusia yang memutuskan akhirnya). Jawaban
 * (`answer_key`) TIDAK disentuh. Dialog menampilkan apa yang diusulkan.
 */
export function EnrichButton({ questionId }: { questionId: string }) {
  const enrich = useEnrichQuestion();
  const [open, setOpen] = useState(false);

  function run() {
    setOpen(true);
    enrich.mutate(questionId);
  }

  const res = enrich.data?.result;
  const proposal: EnrichmentProposal | undefined = res?.proposal;

  return (
    <>
      <Button variant="outline" size="sm" onClick={run} disabled={enrich.isPending}>
        {enrich.isPending ? (
          <Loader2 data-icon="inline-start" className="animate-spin" />
        ) : (
          <Sparkles data-icon="inline-start" />
        )}
        Enrich dengan AI
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4" /> Usulan AI
            </DialogTitle>
            <DialogDescription>
              Usulan metadata dari AI. Nilai sudah <strong>diterapkan</strong> ke
              soal dan statusnya naik ke <strong>Telaah</strong> — periksa & sesuaikan
              sebelum menandai Siap. Jawaban tidak diubah.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-24">
            {enrich.isPending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Meminta usulan dari AI…
              </p>
            )}

            {!enrich.isPending && enrich.isError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium">Enrichment gagal</p>
                  <p className="text-muted-foreground">{(enrich.error as Error)?.message}</p>
                </div>
              </div>
            )}

            {!enrich.isPending && res && !res.ok && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium">Enrichment gagal</p>
                  <p className="text-muted-foreground">{res.error}</p>
                </div>
              </div>
            )}

            {!enrich.isPending && res?.ok && proposal && (
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="size-4 text-brand" />
                  Usulan diterapkan {res.status && `· status → ${res.status === "review" ? "Telaah" : res.status}`}
                </div>
                <Separator />
                <Row label="Topik">
                  {proposal.topics.length ? (
                    <div className="flex flex-wrap gap-1">
                      {proposal.topics.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Row>
                <Row label="Kesulitan">
                  {proposal.difficulty ? (
                    <Badge variant="outline">
                      {DIFFICULTY_LABELS[proposal.difficulty] ?? `Level ${proposal.difficulty}`}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Row>
                <Row label="Kognitif">
                  {proposal.cognitiveLevel ? (
                    <Badge variant="outline">
                      {COGNITIVE_LABELS[proposal.cognitiveLevel] ?? proposal.cognitiveLevel}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Row>
                <Row label="Label">
                  {proposal.tags.length ? (
                    <div className="flex flex-wrap gap-1">
                      {proposal.tags.map((t) => (
                        <Badge key={t} variant="outline">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Row>
                {proposal.notes && (
                  <p className="text-xs text-muted-foreground">Catatan AI: {proposal.notes}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
