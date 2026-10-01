"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { AiSettingsCard } from "@/components/system/ai-settings-card";
import { AgentKeysCard } from "@/components/system/agent-keys-card";
import { useSettings, useUpdateSettings } from "@/lib/hooks/use-settings";
import { useGrades } from "@/lib/hooks/use-reference";
import { DIFFICULTY_LABELS } from "@/lib/display/labels";

/**
 * Pengaturan (M4d) — bagian **Umum** dulu.
 *
 * Bagian **AI** menyusul M10 (9router: base_url, api_key terenkripsi, model) —
 * sesuai rencana. Endpoint `/api/settings` hanya menulis kunci umum yang dikenal;
 * kunci secret (AI) tak pernah dikembalikan mentah (lihat `settings-service`).
 */
export function SettingsView() {
  const { data, isLoading, isError, error } = useSettings();
  const update = useUpdateSettings();
  const { data: grades } = useGrades();

  const [orgName, setOrgName] = useState<string | null>(null);
  const [defGrade, setDefGrade] = useState<string | null>(null);
  const [defDifficulty, setDefDifficulty] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (isError)
    return (
      <div className="flex flex-col">
        <PageHeader title="Pengaturan" description="Umum, AI, pengguna, dan sistem." />
        <ErrorState title="Gagal memuat pengaturan" description={error?.message} />
      </div>
    );

  const items = data?.items ?? [];
  const get = (key: string) =>
    items.find((i) => i.key === key)?.value as string | number | null | undefined;

  const orgValue = orgName ?? (get("general.org_name") as string) ?? "";
  const gradeValue = defGrade ?? (get("general.default_grade") as string) ?? "11";
  const diffValue =
    defDifficulty ?? String(get("general.default_difficulty") ?? 3);


  function save() {
    setSaved(false);
    update.mutate(
      [
        { key: "general.org_name", value: orgValue },
        { key: "general.default_grade", value: gradeValue },
        { key: "general.default_difficulty", value: Number(diffValue) },
      ],
      { onSuccess: () => setSaved(true) },
    );
  }

  return (
    <div className="flex flex-col gap-0">
      <PageHeader
        title="Pengaturan"
        description="Umum, AI, pengguna, dan sistem."
      />
      <div className="flex flex-col gap-6 p-6">
        {isLoading ? (
          <LoadingState label="Memuat pengaturan…" />
        ) : (
        <>
        <Card>
          <CardHeader>
            <CardTitle>Umum</CardTitle>
            <CardDescription>
              Identitas organisasi & nilai bawaan untuk soal baru.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="org-name"
                className="text-xs font-medium text-muted-foreground"
              >
                Nama Organisasi
              </label>
              <Input
                id="org-name"
                value={orgValue}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="mis. SMA Negeri 1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Jenjang Bawaan
              </span>
              <Select
                value={gradeValue}
                onValueChange={(v) => v && setDefGrade(v)}
              >
                <SelectTrigger className="w-full max-w-xs" aria-label="Jenjang bawaan">
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
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Kesulitan Bawaan
              </span>
              <Select
                value={diffValue}
                onValueChange={(v) => v && setDefDifficulty(v)}
              >
                <SelectTrigger className="w-full max-w-xs" aria-label="Kesulitan bawaan">
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
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={update.isPending}>
                {update.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Simpan
              </Button>
              {saved && !update.isPending && (
                <Badge variant="secondary">Tersimpan</Badge>
              )}
              {update.error && (
                <span className="text-sm text-destructive">
                  {update.error.message}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <AiSettingsCard />
        <AgentKeysCard />
        </>
        )}
      </div>
    </div>
  );
}
