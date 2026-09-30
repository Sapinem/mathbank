/**
 * Penggabungan hasil pencarian — HIBRIDA RRF (Reciprocal Rank Fusion) + dedup.
 *
 * MURNI (tanpa DB) → aman diimpor komponen klien & mudah diuji.
 *
 * Kenapa RRF: menggabungkan peringkat dari beberapa sumber (teks/trigram +
 * semantik) tanpa perlu menormalkan skor yang berbeda skala. Rumus:
 *   skor(d) = Σ_sumber 1 / (k + peringkat(d))       (k=60, konstanta lazim)
 *
 * Dedup: dua kandidat dianggap duplikat bila:
 *   - id sama (selalu), ATAU
 *   - kemiripan teks ≥ ambang exact (0.98) — praktis identik, ATAU
 *   - kemiripan teks ≥ ambang near (0.85) DAN **penalaran kedua kandidat sama**
 *     (mis. `reasoning` sama/keduanya kosong). Bila penalaran BERBEDA, keduanya
 *     dipertahankan — dua soal mirip teksnya tapi berbeda penalaran itu SAH.
 * Ambang dapat dikonfigurasi.
 */

export interface Candidate {
  id: string;
  /** Teks ternormalisasi untuk perbandingan kemiripan (mis. konten). */
  text?: string;
  /**
   * Penanda penalaran (mis. jawaban benar / rationale ternormalisasi). Dipakai
   * pembeda saat kemiripan teks berada di zona "near": dua kandidat hanya
   * dianggap duplikat bila penalarannya SAMA. Kosong = "tanpa penalaran".
   */
  reasoning?: string;
  /** Peringkat 0-based dalam daftar sumber (semakin kecil semakin baik). */
  rank?: number;
}

export const RRF_K = 60;
export const DEDUP_EXACT = 0.98;
export const DEDUP_NEAR = 0.85;

/** Kemiripan berbasis token Jaccard (murah, tanpa dependensi). */
export function similarity(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/**
 * Gabungkan beberapa daftar hasil terurut menjadi satu daftar ber-RRF.
 * `lists` = daftar kandidat per sumber, masing-masing sudah terurut (terbaik dulu).
 */
export function rrfFuse(lists: Candidate[][], k = RRF_K): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((cand, idx) => {
      scores.set(cand.id, (scores.get(cand.id) ?? 0) + 1 / (k + (cand.rank ?? idx) + 1));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Buang duplikat dari daftar kandidat (sudah ber-RRF), dengan ambang kemiripan.
 * Menyimpan kandidat dengan skor lebih tinggi; yang duplikat dibuang.
 *
 * `lookup` memberi teks; `lookupReasoning` (opsional) memberi penanda penalaran
 * untuk zona "near" — bila penalaran BEDA, kandidat DIPERTAHANKAN.
 */
export function dedup(
  ordered: { id: string; score: number }[],
  lookup: (id: string) => string | undefined,
  opts: {
    exact?: number;
    near?: number;
    lookupReasoning?: (id: string) => string | undefined;
  } = {},
): { id: string; score: number }[] {
  const exact = opts.exact ?? DEDUP_EXACT;
  const near = opts.near ?? DEDUP_NEAR;
  const reasoningOf = opts.lookupReasoning ?? (() => undefined);
  const kept: { id: string; score: number; text?: string; reasoning?: string }[] = [];
  for (const cand of ordered) {
    const text = lookup(cand.id);
    const reasoning = reasoningOf(cand.id);
    const dup = kept.some((k) => {
      const s = similarity(text, k.text);
      if (s >= exact) return true; // praktis identik — apa pun penalarannya
      if (s < near) return false; // cukup beda — bukan duplikat
      // Zona "near": duplikat HANYA bila penalaran kedua kandidat sama
      // (termasuk sama-sama kosong/tanpa penalaran).
      return normReasoning(reasoning) === normReasoning(k.reasoning);
    });
    if (!dup) kept.push({ ...cand, text, reasoning });
  }
  return kept.map(({ id, score }) => ({ id, score }));
}

/** Normalisasi penanda penalaran: trim + lowercase; kosong/undefined → "" . */
function normReasoning(r: string | undefined): string {
  return (r ?? "").trim().toLowerCase();
}

/** Pipeline lengkap: gabung + dedup. */
export function hybridSearch(
  lists: Candidate[][],
  lookup: (id: string) => string | undefined,
  opts: {
    k?: number;
    exact?: number;
    near?: number;
    lookupReasoning?: (id: string) => string | undefined;
  } = {},
): { id: string; score: number }[] {
  const fused = rrfFuse(lists, opts.k ?? RRF_K);
  return dedup(fused, lookup, {
    exact: opts.exact,
    near: opts.near,
    lookupReasoning: opts.lookupReasoning,
  });
}
