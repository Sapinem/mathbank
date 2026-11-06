/**
 * Helper hash konten soal untuk skrip perbaikan data.
 *
 * Skrip yang menulis ulang `content_markdown` WAJIB ikut memperbarui
 * `content_hash` (ADR-0012): hash adalah kunci dedup di balik index unik
 * parsial `uq_questions_content_hash`. Tanpa itu, soal hasil perbaikan tidak
 * lagi terdeteksi sebagai duplikat saat di-ingest ulang.
 */
import { contentHash } from "../../src/lib/ingest/hash";

/** Ambil teks opsi dari `data_payload` (bentuk `{ options: [{ contentMarkdown }] }`). */
export function optionTextsFromPayload(payload: unknown): string[] {
  const options = (payload as { options?: Array<{ contentMarkdown?: string }> } | null)?.options;
  if (!Array.isArray(options)) return [];
  return options.map((o) => o?.contentMarkdown ?? "");
}

/** Hash konten soal dari stem + payload yang akan disimpan. */
export function questionContentHash(stem: string, payload: unknown): string {
  return contentHash(stem, optionTextsFromPayload(payload));
}
