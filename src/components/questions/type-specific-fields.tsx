"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field-group";

/**
 * Field khusus per tipe soal yang butuh `data_payload` terstruktur (G2.1).
 *
 * Dua tipe memakai payload terstruktur:
 *  - `matrix_grid` → { labels: ["Benar","Salah"], rows: [{text, answer}] }
 *  - `matching`    → { type:"matching", premises:[{id,contentMarkdown}],
 *                      responses:[{id,contentMarkdown}] }  (+ answer_key.matchingPairs)
 * Tipe lain cukup `content_markdown` (+ opsi A–E di `data_payload.options`).
 *
 * ⚠️ `matrix_grid` sengaja memakai bentuk pipeline ingest (`defantri-tf.ts`),
 * BUKAN bentuk kanonik MAT-145 (`columns` + `statements`): 330 soal tersimpan
 * memakai `{labels, rows}`, dan `MatrixGridView` (halaman detail) membaca bentuk
 * itu. Menulis bentuk kanonik akan membuat soal matriks tampil kosong. Karena
 * payload matriks tidak menyertakan kunci `type`, gerbang tulis lapis 2
 * (validasi struktural) dilewati — kunci per baris tetap tersimpan di `rows`.
 */

/** Satu baris pernyataan matriks + kuncinya. */
export interface MatrixRow {
  text: string;
  answer: string | null;
}

export interface MatrixPayload {
  /** Label kolom, mis. ["Benar","Salah"]. */
  labels: string[];
  /** Baris pernyataan + kuncinya. */
  rows: MatrixRow[];
}

/** Satu premis/respons menjodohkan — id stabil untuk `answer_key.matchingPairs`. */
export interface MatchingItem {
  id: string;
  contentMarkdown: string;
}

export interface MatchingPayload {
  premises: MatchingItem[];
  responses: MatchingItem[];
  /** Pemetaan `premiseId → responseId` (sumber: `answer_key.matchingPairs`). */
  pairs: Record<string, string>;
}

/** Label kolom baku untuk matriks benar-salah. */
const DEFAULT_LABELS = ["Benar", "Salah"];

// ── Matriks Benar/Salah ───────────────────────────────────────────────────────

/** Editor matriks B/S (baris pernyataan + kunci per baris). */
export function MatrixGridFields({
  value,
  onChange,
}: {
  value: MatrixPayload;
  onChange: (v: MatrixPayload) => void;
}) {
  const rows = value.rows ?? [];
  const labels = value.labels?.length ? value.labels : DEFAULT_LABELS;

  function patchRow(i: number, patch: Partial<MatrixRow>) {
    const next = [...rows];
    next[i] = { ...(next[i] ?? { text: "", answer: null }), ...patch };
    onChange({ ...value, labels, rows: next });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Setiap baris = satu pernyataan. Pilih kunci tiap pernyataan (
        {labels.join(" / ")}).
      </p>
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-md border border-border/70 p-2 sm:flex-row sm:items-center sm:border-0 sm:p-0"
        >
          <Input
            value={r.text}
            onChange={(e) => patchRow(i, { text: e.target.value })}
            placeholder={`Pernyataan ${i + 1}…`}
            aria-label={`Pernyataan ${i + 1}`}
            className="min-w-0 flex-1"
          />
          <div className="flex items-center gap-1">
            <div className="flex shrink-0 items-center gap-1">
              {labels.map((l) => (
                <Button
                  key={l}
                  type="button"
                  size="sm"
                  variant={r.answer === l ? "default" : "outline"}
                  aria-label={`Kunci pernyataan ${i + 1}: ${l}`}
                  aria-pressed={r.answer === l}
                  onClick={() =>
                    patchRow(i, { answer: r.answer === l ? null : l })
                  }
                >
                  {l}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Hapus pernyataan ${i + 1}`}
              onClick={() =>
                onChange({
                  ...value,
                  labels,
                  rows: rows.filter((_, j) => j !== i),
                })
              }
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          onChange({
            ...value,
            labels,
            rows: [...rows, { text: "", answer: null }],
          })
        }
      >
        <Plus data-icon="inline-start" /> Tambah pernyataan
      </Button>
    </div>
  );
}

// ── Menjodohkan ──────────────────────────────────────────────────────────────

/** Editor menjodohkan: daftar premis, daftar respons, dan pemetaan pasangan. */
export function MatchingFields({
  value,
  onChange,
}: {
  value: MatchingPayload;
  onChange: (v: MatchingPayload) => void;
}) {
  const premises = value.premises ?? [];
  const responses = value.responses ?? [];
  const pairs = value.pairs ?? {};

  function setPremise(i: number, text: string) {
    const next = [...premises];
    const current = next[i] ?? { id: `p${i + 1}`, contentMarkdown: "" };
    next[i] = { ...current, contentMarkdown: text };
    onChange({ ...value, premises: next });
  }

  function setResponse(i: number, text: string) {
    const next = [...responses];
    const current = next[i] ?? { id: `r${i + 1}`, contentMarkdown: "" };
    next[i] = { ...current, contentMarkdown: text };
    onChange({ ...value, responses: next });
  }

  function removePremise(i: number) {
    const next = premises.filter((_, j) => j !== i);
    const nextPairs: Record<string, string> = {};
    for (const [k, v] of Object.entries(pairs)) {
      const idx = Number(k.replace(/^p/, ""));
      if (idx === i + 1) continue;
      nextPairs[k] = v;
    }
    onChange({ ...value, premises: next, pairs: nextPairs });
  }

  function removeResponse(i: number) {
    const removedId = responses[i]?.id;
    const next = responses.filter((_, j) => j !== i);
    const nextPairs: Record<string, string> = {};
    for (const [k, v] of Object.entries(pairs)) {
      if (v === removedId) continue;
      nextPairs[k] = v;
    }
    onChange({ ...value, responses: next, pairs: nextPairs });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kolom Kiri (premis)">
          <div className="flex flex-col gap-2">
            {premises.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <Input
                  value={p.contentMarkdown}
                  onChange={(e) => setPremise(i, e.target.value)}
                  placeholder={`Premis ${i + 1}…`}
                  aria-label={`Kolom Kiri (premis) item ${i + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Hapus premis ${i + 1}`}
                  onClick={() => removePremise(i)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...value,
                  premises: [
                    ...premises,
                    { id: `p${premises.length + 1}`, contentMarkdown: "" },
                  ],
                })
              }
            >
              <Plus data-icon="inline-start" /> Tambah premis
            </Button>
          </div>
        </Field>

        <Field label="Kolom Kanan (respons)">
          <div className="flex flex-col gap-2">
            {responses.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <Input
                  value={r.contentMarkdown}
                  onChange={(e) => setResponse(i, e.target.value)}
                  placeholder={`Respons ${i + 1}…`}
                  aria-label={`Kolom Kanan (respons) item ${i + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Hapus respons ${i + 1}`}
                  onClick={() => removeResponse(i)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...value,
                  responses: [
                    ...responses,
                    { id: `r${responses.length + 1}`, contentMarkdown: "" },
                  ],
                })
              }
            >
              <Plus data-icon="inline-start" /> Tambah respons
            </Button>
          </div>
        </Field>
      </div>

      {premises.length > 0 && responses.length > 0 && (
        <Field label="Kunci pasangan (premis → respons)">
          <div className="flex flex-col gap-2">
            {premises.map((p, i) => (
              <div
                key={p.id}
                className="flex flex-col gap-1.5 rounded-md border border-border/70 p-2 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p.contentMarkdown.trim() || `Premis ${i + 1}`}
                </span>
                <select
                  className="min-h-[44px] w-full rounded-md border border-border bg-background px-3 text-sm sm:w-56"
                  aria-label={`Pasangan premis ${i + 1}`}
                  value={pairs[p.id] ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      pairs: { ...pairs, [p.id]: e.target.value },
                    })
                  }
                >
                  <option value="">— belum dipasangkan —</option>
                  {responses.map((r, j) => (
                    <option key={r.id} value={r.id}>
                      {r.contentMarkdown.trim() || `Respons ${j + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Field>
      )}
    </div>
  );
}

// ── Daftar teks generik (jawaban diterima / variasi) ─────────────────────────

/** Editor daftar string sederhana (≥1 baris) — mis. `answer_key.acceptedAnswers`. */
export function StringListField({
  label,
  items,
  onChange,
  placeholder = "Item",
  addLabel = "Tambah",
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  const list = items.length ? items : [""];
  return (
    <Field label={label}>
      <div className="flex flex-col gap-2">
        {list.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={it}
              onChange={(e) => {
                const next = [...list];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={`${placeholder} ${i + 1}…`}
              aria-label={`${label} ${i + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Hapus ${label} ${i + 1}`}
              disabled={list.length <= 1}
              onClick={() => onChange(list.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...list, ""])}
        >
          <Plus data-icon="inline-start" /> {addLabel}
        </Button>
      </div>
    </Field>
  );
}

// ── Pembacaan payload (selalu aman terhadap data aneh) ───────────────────────

/** Normalisasi `data_payload` mentah → bentuk terketik (aman). */
export function readMatrixPayload(
  dp: Record<string, unknown> | null | undefined,
): MatrixPayload {
  const o = (dp ?? {}) as Record<string, unknown>;
  const labels = Array.isArray(o.labels)
    ? (o.labels as unknown[]).map(String)
    : DEFAULT_LABELS;
  const rows = Array.isArray(o.rows)
    ? (o.rows as unknown[]).map((r) => {
        const row = (r ?? {}) as Record<string, unknown>;
        // Terima `text` (bentuk resmi ingest) maupun `label` (bentuk lama).
        return {
          text: String(row.text ?? row.label ?? ""),
          answer: row.answer != null ? String(row.answer) : null,
        };
      })
    : [];
  // Selalu sediakan satu baris kosong agar editor punya titik mulai.
  return { labels, rows: rows.length ? rows : [{ text: "", answer: null }] };
}

/**
 * Normalisasi `data_payload` + `answer_key` mentah → bentuk editor menjodohkan.
 *
 * Menerima bentuk kanonik (`premises`/`responses` + `matchingPairs`) maupun
 * bentuk lama (`left`/`right` string[]) supaya soal lama tetap terbuka.
 */
export function readMatchingPayload(
  dp: Record<string, unknown> | null | undefined,
  answerKey?: Record<string, unknown> | null,
): MatchingPayload {
  const o = (dp ?? {}) as Record<string, unknown>;

  const toItems = (v: unknown, prefix: string): MatchingItem[] =>
    Array.isArray(v)
      ? v.map((raw, i) => {
          const item = (raw ?? {}) as Record<string, unknown>;
          const text =
            typeof raw === "string"
              ? raw
              : String(item.contentMarkdown ?? item.text ?? item.label ?? "");
          return { id: String(item.id ?? `${prefix}${i + 1}`), contentMarkdown: text };
        })
      : [];

  let premises = toItems(o.premises, "p");
  let responses = toItems(o.responses, "r");

  // Bentuk lama: { left: string[], right: string[] }
  if (premises.length === 0 && Array.isArray(o.left)) {
    premises = toItems(o.left, "p");
  }
  if (responses.length === 0 && Array.isArray(o.right)) {
    responses = toItems(o.right, "r");
  }

  const rawPairs = (answerKey ?? {}).matchingPairs;
  const pairs: Record<string, string> = {};
  if (rawPairs && typeof rawPairs === "object" && !Array.isArray(rawPairs)) {
    for (const [k, v] of Object.entries(rawPairs as Record<string, unknown>)) {
      if (typeof v === "string") pairs[k] = v;
    }
  }

  return {
    premises: premises.length ? premises : [{ id: "p1", contentMarkdown: "" }],
    responses: responses.length ? responses : [{ id: "r1", contentMarkdown: "" }],
    pairs,
  };
}
