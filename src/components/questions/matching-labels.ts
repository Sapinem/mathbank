/**
 * Label kanonik soal menjodohkan (Fase 4) — SATU sumber kebenaran untuk
 * tampilan detail dan tampilan cetak.
 *
 * Konvensi (sama di kedua tempat): premis memakai huruf (A, B, …),
 * respons memakai angka (1, 2, …). Sebelum Fase 4, cetak memakai konvensi
 * terbalik (premis angka, respons huruf) dan kunci cetak menampilkan ID
 * respons mentah (mis. `r1`) — keduanya kini diperbaiki lewat helper ini.
 *
 * Helper ini murni (tanpa React) supaya bisa dites unit dan dipakai baik
 * oleh komponen detail maupun cetak tanpa menduplikasi logika penomoran.
 */

import type { MatchingItem } from "./matching-view";

/** Label premis ke-`index` (0-based): 0 → "A", 1 → "B", … */
export function premiseLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Label respons ke-`index` (0-based): 0 → "1", 1 → "2", … */
export function responseLabel(index: number): string {
  return String(index + 1);
}

/**
 * Label respons yang dipasangkan dengan satu premis, dari
 * `answerKey.matchingPairs` (`premiseId → responseId`).
 *
 * Mengembalikan label (mis. "2"), BUKAN id respons mentah — id tidak pernah
 * ditampilkan ke pengguna sebagai kunci. Bila pasangan tidak ditemukan
 * (id respons tidak ada di daftar respons), mengembalikan `null` daripada
 * menebak: kunci yang tidak bisa dipetakan lebih baik tidak ditampilkan
 * daripada menampilkan id mentah yang menyesatkan.
 */
export function matchingResponseLabel(
  matchingPairs: Record<string, string> | null | undefined,
  premiseId: string,
  responses: MatchingItem[],
): string | null {
  if (!matchingPairs) return null;
  const responseId = matchingPairs[premiseId];
  if (!responseId) return null;
  const index = responses.findIndex((r) => r.id === responseId);
  if (index < 0) return null;
  return responseLabel(index);
}

/**
 * Ringkasan kunci menjodohkan untuk lembar kunci terpisah, dalam bentuk
 * label-ke-label (mis. "A→2, B→1"). Premis tanpa pasangan yang bisa
 * dipetakan dilewati — sama seperti aturan `matchingResponseLabel`.
 */
export function matchingKeySummary(
  matchingPairs: Record<string, string> | null | undefined,
  premises: MatchingItem[],
  responses: MatchingItem[],
): string {
  return premises
    .map((p, i) => {
      const label = matchingResponseLabel(matchingPairs, p.id, responses);
      return label ? `${premiseLabel(i)}→${label}` : null;
    })
    .filter((v): v is string => v !== null)
    .join(", ");
}
