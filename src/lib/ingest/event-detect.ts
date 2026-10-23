/**
 * Deteksi EVENT & SUBTEST dari judul paket — SATU sumber kebenaran.
 *
 * Dipakai oleh:
 *  - `scripts/dev/backfill-event.ts` (CLI, baca langsung dari DB)
 *  - `src/lib/ingest/event-resolve.ts` (otomatis setelah commit)
 *
 * ⚠️ Event diambil dari JUDUL ARTIKEL/HEADING, bukan dari stem soal.
 * (Temuan korpus: hanya 6 soal punya penanda event di stem — tidak layak.)
 */

/** Pola nama event yang umum di sumber. URUTAN PENTING (yang lebih spesifik dulu). */
export const EVENT_PATTERNS: { key: string; label: string; re: RegExp }[] = [
  { key: "utbk", label: "UTBK-SNBT", re: /\b(utbk|snbt)\b/i },
  { key: "sbmptn", label: "SBMPTN", re: /\bsbmptn\b/i },
  { key: "simak", label: "SIMAK UI", re: /\bsimak\s*ui\b/i },
  {
    key: "umptn",
    label: "Ujian Mandiri PTN",
    re: /\b(um|ujian mandiri)\b[\s-]*(undip|ugm|unpad|its|unair|ptn)/i,
  },
  // UNBK/UN = Ujian Nasional (UNBK = UN Berbasis Komputer).
  { key: "un", label: "Ujian Nasional", re: /\b(unbk|unas|un|ujian nasional)\b/i },
  { key: "osn", label: "OSN Matematika", re: /\b(osn|ksn|osk|osp)\b/i },
  { key: "anbk", label: "ANBK-AKM", re: /\b(anbk|akm|asesmen nasional)\b/i },
  { key: "tka", label: "TKA", re: /\btka\b/i },
  { key: "to", label: "Try Out", re: /\b(try\s*out|to[\s-]tka|simulasi)\b/i },
  { key: "pas", label: "PAS-SAS", re: /\b(pas|sas|penilaian akhir|sumatif akhir)\b/i },
  { key: "us", label: "Ujian Sekolah", re: /\b(usp|asaj|us|ujian sekolah)\b/i },
  // "Penalaran Matematika" = SUBTEST UTBK-SNBT, tetapi artikelnya sendiri
  // sering jadi paket latihan → tetap tandai UTBK-SNBT.
  { key: "penalaran", label: "UTBK-SNBT", re: /penalaran matematika/i },
];

/** Subtest yang umum. */
export const SUBTEST_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "Penalaran Matematika", re: /penalaran matematika|\bpm\b/i },
  { label: "Pengetahuan Kuantitatif", re: /pengetahuan kuantitatif|\bpk\b/i },
  { label: "Matematika Dasar", re: /matematika dasar/i },
  { label: "Matematika IPA", re: /matematika ipa|saintek/i },
  { label: "Matematika Wajib", re: /matematika wajib/i },
  { label: "Matematika Lanjut", re: /matematika (pilihan|lanjut|peminatan)/i },
];

export interface DetectedEvent {
  /** Label event yang terdeteksi (belum tentu ada di tabel `events`). */
  events: string[];
  /** Subtest yang terdeteksi. */
  subtests: string[];
  /** Tahun ujian (2019…) bila ada di judul. */
  year: number | null;
  /** Kode naskah, mis. "kode 431". */
  code: string | null;
}

/**
 * Deteksi event/subtest/tahun dari sebuah teks (biasanya judul paket).
 * ⚠️ SENGAJA memeriksa `EVENT_PATTERNS` berurutan; label pertama yang cocok
 * dipakai sebagai event UTAMA oleh pemanggil.
 */
export function detectEvent(text: string): DetectedEvent {
  const events = EVENT_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
  const subtests = SUBTEST_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
  const ym = text.match(/\b(19[89]\d|20[0-4]\d)\b/);
  const year = ym ? Number(ym[1]) : null;
  const code = text.match(/\bkode\s*(\d{2,4})\b/i)?.[1] ?? null;
  return { events: [...new Set(events)], subtests: [...new Set(subtests)], year, code };
}
