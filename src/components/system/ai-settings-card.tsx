"use client";

import { useState } from "react";
import { Save, Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAiSettings, useSaveAiSettings, useAiModels, useAiHealth } from "@/lib/hooks/use-ai";

/**
 * Kartu Pengaturan AI (M10) — konfigurasi LLM (9router, OpenAI-compatible) + cek layanan.
 * Kunci API **tak pernah** ditampilkan; nilai ada ditandai "tersimpan".
 * Model dapat dipilih dari **daftar yang tersedia** (ambil dari provider).
 */
export function AiSettingsCard() {
  const { data, isLoading } = useAiSettings();
  const models = useAiModels();
  const health = useAiHealth();
  const save = useSaveAiSettings();

  const items = data?.items ?? [];
  const get = (k: string) => items.find((i) => i.key === k);
  const keyItem = get("ai.api_key");

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const enabledValue = enabled ?? Boolean(get("ai.enabled")?.value ?? false);
  const baseUrlValue = baseUrl ?? (get("ai.base_url")?.value as string) ?? "";
  const modelValue = model ?? (get("ai.model")?.value as string) ?? "";
  const apiKeyValue = apiKey ?? "";
  const keyIsSet = keyItem?.isSet === true;

  const availableModels = models.data?.models ?? [];
  const modelOptions = modelValue && !availableModels.includes(modelValue)
    ? [modelValue, ...availableModels]
    : availableModels;

  function doSave() {
    setSaved(false);
    save.mutate(
      {
        enabled: enabledValue,
        baseUrl: baseUrlValue,
        model: modelValue,
        // Kirim kunci hanya bila diubah (kosong = biarkan).
        ...(apiKey ? { apiKey } : {}),
      },
      {
        onSuccess: () => {
          setSaved(true);
          setApiKey(null);
        },
      },
    );
  }

  const llm = health.data?.llm;
  const emb = health.data?.embedding;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI / Enrichment
          {llm && (
            <Badge variant={llm.ok ? "secondary" : "outline"} className="font-normal">
              {llm.ok ? (
                <>
                  <CheckCircle2 className="size-3" /> LLM aktif
                </>
              ) : (
                <>
                  <XCircle className="size-3" /> LLM mati
                </>
              )}
            </Badge>
          )}
          {emb && (
            <Badge variant={emb.ok ? "secondary" : "outline"} className="font-normal">
              {emb.ok ? "Embedding aktif" : "Embedding mati"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Konfigurasi provider LLM (9router/OpenAI-compatible). Kunci disimpan
          terenkripsi; embedding memakai BGE-M3 (Ollama) dari ENV.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4"
            checked={enabledValue}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={isLoading}
          />
          <span className="text-sm font-medium">Aktifkan AI</span>
        </label>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ai-base-url"
            className="text-xs font-medium text-muted-foreground"
          >
            Base URL
          </label>
          <Input
            id="ai-base-url"
            value={baseUrlValue}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://9router.contoh/v1"
            disabled={isLoading}
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Kunci API {keyIsSet && <span className="text-[10px]">(tersimpan — isi untuk mengganti)</span>}
          </span>
          <Input
            type="password"
            value={apiKeyValue}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keyIsSet ? "•••••••• (tidak diubah)" : "sk-…"}
            autoComplete="off"
            disabled={isLoading}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Model</span>
          <div className="flex items-center gap-2">
            <Select value={modelValue} onValueChange={setModel}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Pilih model…" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Tak ada model (cek Base URL)
                  </SelectItem>
                ) : (
                  modelOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => models.refetch()}
              disabled={models.isFetching}
              title="Muat ulang daftar model"
            >
              <RefreshCw className={models.isFetching ? "animate-spin" : undefined} />
            </Button>
          </div>
          {models.data?.error && (
            <span className="text-xs text-muted-foreground">{models.data.error}</span>
          )}
        </label>

        <div className="flex items-center gap-3">
          <Button onClick={doSave} disabled={save.isPending || isLoading}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Simpan
          </Button>
          {saved && <span className="text-sm text-muted-foreground">Tersimpan.</span>}
          {save.isError && (
            <span className="text-sm text-destructive">
              {(save.error as Error)?.message}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => health.refetch()}
            disabled={health.isFetching}
          >
            <RefreshCw className={health.isFetching ? "animate-spin" : undefined} />
            Cek layanan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
