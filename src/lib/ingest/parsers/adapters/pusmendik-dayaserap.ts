/**
 * Adapter pusmendik_dayaserap — **JSON terstruktur** (M9-2c).
 *
 * Bukan HTML: data sudah terurai. Bentuk (temuan langsung):
 *   { questions: [ { question_data: {
 *        pertanyaan, pembahasan, tipe_soal, pilihan[{key,text}],
 *        kunci_jawaban, pernyataan[{id,text,jawaban}], labels_query[] } } ] }
 *
 * Pemetaan tipe:
 *   - "Pilihan Ganda"                      → `single_choice`
 *   - "Pilihan Ganda Kompleks - MCMA"      → `multiple_choice_checkbox`
 *   - "Pilihan Ganda Kompleks - Kategori"  → `matrix_grid` (dataPayload)
 *
 * ⚠️ **Kunci SELALU kosong** di sumber (`kunci_jawaban` = null,
 * `pernyataan[].jawaban` = ""). Sesuai aturan: jangan menebak → kosong + catatan.
 */
import { cleanHtml } from "../clean";
import { finalizeItem } from "../items";
import type { JsonAdapter, ParsedItem, SegmentResult } from "../types";

interface Pilihan {
  key?: string;
  text?: string;
}
interface Pernyataan {
  id?: number;
  text?: string;
  jawaban?: string;
}
interface LabelQuery {
  order_soal?: number;
  description?: string;
}
interface QuestionData {
  nomor_soal?: number;
  kode_soal?: string;
  pertanyaan?: string;
  pembahasan?: string;
  tipe_soal?: string;
  pilihan?: Pilihan[];
  /** Bisa `null` atau array label (mis. `[]`); di korpus selalu kosong. */
  kunci_jawaban?: string[] | string | null;
  pernyataan?: Pernyataan[];
  labels_query?: LabelQuery[];
}
interface QuestionNode {
  question_data?: QuestionData;
}

/** Bersihkan HTML kecil (pertanyaan/opsi) → markdown + math ternormalisasi. */
function clean(html: string | undefined): string {
  return html ? cleanHtml(html).text.trim() : "";
}

/**
 * Ganti URL gambar REMOTE pusmendik → `corpus://` LOKAL.
 *
 * Alasan: host pusmendik sertifikat TLS-nya rusak & bisa lambat/down; gambar
 * sudah tersedia lokal di `<kode_mapel>/images/`. Konvensi nama lokal:
 * `<KODE>-<namaAsli>` (mis. `MATD-72392_abc.jpg`).
 *
 *   https://pusmendik…/tka/cbt_images/72392_abc.jpg
 *     → corpus://pusmendik_dayaserap/MATD-72392_abc.jpg
 */
function lokalkanGambar(teks: string, kode: string): string {
  if (!teks || !kode) return teks;
  return teks.replace(
    /https?:\/\/[^)"'\s]*\/cbt_images\/([A-Za-z0-9_.-]+?\.(?:png|jpg|jpeg))/gi,
    (_m, nama: string) => `corpus://pusmendik_dayaserap/${kode}-${nama}`,
  );
}

export const pusmendikDayaserapAdapter: JsonAdapter = (data): SegmentResult => {
  const items: ParsedItem[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  const root = data as { questions?: QuestionNode[]; kd_mapel?: string } | null;
  const questions = root?.questions;
  if (!Array.isArray(questions)) {
    return { items: [], skipped: 0, warnings: ["Bukan JSON dayaserap (tak ada `questions`)" ] };
  }
  // Kode mapel (mis. MATD/AMATP) → awalan nama berkas gambar lokal.
  const KODE = (root?.kd_mapel ?? "").trim();
  /** clean + lokalkan gambar remote → corpus:// lokal. */
  const bersih = (html: string | undefined): string => lokalkanGambar(clean(html), KODE);

  let idx = 0;
  for (const q of questions) {
    const qd = q?.question_data;
    if (!qd || !qd.pertanyaan) {
      skipped++;
      continue;
    }
    idx++;
    const ref = { index: idx, heading: qd.kode_soal };
    const stem = bersih(qd.pertanyaan);
    const explanation = bersih(qd.pembahasan) || undefined;
    const kind = (qd.tipe_soal ?? "").toLowerCase();

    // ── PG Kompleks - KATEGORI → matrix_grid (pernyataan ↔ label Benar/Salah)
    if (kind.includes("kategori")) {
      const labels = (qd.labels_query ?? [])
        .map((l) => l.description ?? "")
        .filter(Boolean);
      const rows = (qd.pernyataan ?? []).map((p) => ({
        text: bersih(p.text),
        answer: (p.jawaban ?? "").trim() || null,
      }));
      items.push(
        finalizeItem(stem, [], [], explanation, ref, [
          "Tipe matrix_grid (pernyataan ↔ label) — kunci kosong di sumber",
        ], {
          type: "matrix_grid",
          dataPayload: { labels, rows },
        }),
      );
      continue;
    }

    // ── PG / MCMA → opsi {key, text}
    const rawOptions = (qd.pilihan ?? []).map((p) => ({
      label: p.key,
      text: bersih(p.text),
    }));
    const kunciRaw = qd.kunci_jawaban;
    const correct = Array.isArray(kunciRaw)
      ? kunciRaw.map((k) => String(k).trim().toUpperCase()).filter(Boolean)
      : typeof kunciRaw === "string"
        ? kunciRaw.trim().toUpperCase().split(/[,\s]+/).filter(Boolean)
        : [];
    const isMcma = kind.includes("mcma") || kind.includes("kompleks");
    const forcedType = isMcma ? ("multiple_choice_checkbox" as const) : undefined;

    items.push(
      finalizeItem(stem, rawOptions, correct, explanation, ref, [], {
        ...(forcedType ? { type: forcedType } : {}),
      }),
    );
  }

  if (idx === 0 && questions.length > 0) {
    warnings.push("Semua soal dayaserap kosong (tak ada `question_data.pertanyaan`)");
  }
  return { items, skipped, warnings };
};
