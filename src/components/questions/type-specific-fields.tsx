"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field-group";

/**
 * Field khusus per tipe soal yang butuh `data_payload` terstruktur (G2.1).
 * Menurut skema (SKEMA-DB-DETAIL §Data Payload), hanya 2 tipe yang butuh:
 *  - `matrix_grid` → { columns: [B,S], rows: [{label}] }
 *  - `matching`    → { left: string[], right: string[] }
 * Tipe lain cukup `content_markdown` (+ opsi A–E bila relevan).
 */

export interface MatrixPayload {
  columns: string[];
  rows: { label: string }[];
}

export interface MatchingPayload {
  left: string[];
  right: string[];
}

/** Editor matriks B/S (baris pernyataan + kolom tetap). */
export function MatrixGridFields({
  value,
  onChange,
}: {
  value: MatrixPayload;
  onChange: (v: MatrixPayload) => void;
}) {
  const rows = value.rows ?? [];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Setiap baris = satu pernyataan; responden menilai tiap baris
        ({value.columns.join(" / ")}).
      </p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={r.label}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { label: e.target.value };
              onChange({ ...value, rows: next });
            }}
            placeholder={`Pernyataan ${i + 1}…`}
            aria-label={`Pernyataan ${i + 1}`}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Hapus pernyataan ${i + 1}`}
            onClick={() =>
              onChange({ ...value, rows: rows.filter((_, j) => j !== i) })
            }
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange({ ...value, rows: [...rows, { label: "" }] })}
      >
        <Plus data-icon="inline-start" /> Tambah pernyataan
      </Button>
    </div>
  );
}

/** Editor menjodohkan: dua daftar (kiri ↔ kanan). */
export function MatchingFields({
  value,
  onChange,
}: {
  value: MatchingPayload;
  onChange: (v: MatchingPayload) => void;
}) {
  const left = value.left ?? [];
  const right = value.right ?? [];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ListEditor
        label="Kolom Kiri (premis)"
        items={left}
        onChange={(next) => onChange({ ...value, left: next })}
      />
      <ListEditor
        label="Kolom Kanan (respons)"
        items={right}
        onChange={(next) => onChange({ ...value, right: next })}
      />
    </div>
  );
}

function ListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={it}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={`Item ${i + 1}…`}
              aria-label={`${label} item ${i + 1}`}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Hapus ${label} item ${i + 1}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, ""])}
        >
          <Plus data-icon="inline-start" /> Tambah
        </Button>
      </div>
    </Field>
  );
}

/** Normalisasi data_payload mentah → bentuk terketik (aman). */
export function readMatrixPayload(dp: Record<string, unknown>): MatrixPayload {
  const columns = Array.isArray(dp.columns)
    ? (dp.columns as unknown[]).map(String)
    : ["Benar", "Salah"];
  const rows = Array.isArray(dp.rows)
    ? (dp.rows as unknown[]).map((r) => ({
        label: String((r as { label?: unknown })?.label ?? ""),
      }))
    : [{ label: "" }];
  return { columns, rows };
}

export function readMatchingPayload(
  dp: Record<string, unknown>,
): MatchingPayload {
  const toArr = (v: unknown) =>
    Array.isArray(v) ? (v as unknown[]).map(String) : [""];
  return { left: toArr(dp.left), right: toArr(dp.right) };
}
