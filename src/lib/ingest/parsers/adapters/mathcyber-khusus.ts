/**
 * ADAPTER KHUSUS: perbaikan SPESIFIK mathcyber.
 *
 * Dipisah dari `katex-repair.ts` (perbaikan UMUM, adaptif) karena kasus-kasus di
 * sini BENAR-BENAR SPESIFIK: tiap satu hanya muncul di 1–2 artikel, tidak layak
 * jadi aturan umum, dan sebagian MUSTAHIL diperbaiki adaptif (karena jumlah galat
 * dihitung pada TEKS PENUH, bukan potongan — lihat catatan di tiap fungsi).
 *
 * Dipanggil SETELAH `cleanHtml` di adapter mathcyber (lihat `mathcyber.ts`).
 *
 * Daftar temuan: `docs/plans/perbaikan-manual-mathcyber.md`.
 */

// ⚠️ DIBATALKAN: `tutupBoxed` & `seimbangkanKurung` (menambah `}` di akhir).
// Terbukti MERUSAK: error 9 → 714 (\hline 625×) karena `{`/`}` di teks biasa
// (mis. `~\text{cm}}` atau array) ikut terhitung & ditambah `}` salah tempat.
// Pelajaran: JANGAN menyeimbangkan kurung global — terlalu berisiko.

/** Buang sisa `\` telanjang (token yang isinya hanya backslash). */
function buangBackslashTelanjang(t: string): string {
  if (/^\\+$/.test(t.trim())) return "";
  return t.replace(/(?<![\\\w{])[\\]{2,}(?![\\\w{])/g, " ");
}

/** `$` tunggal di TENGAH/RAMBU teks (bukan pasangan) → buang. */
function buangDolarNyasar(t: string): string {
  const n = (t.replace(/\$\$/g, "").match(/\$/g) ?? []).length;
  if (n % 2 === 0) return t;
  return t.replace(/(?<=[}\s])\$(?=[\s]|$)/g, "");
}

/** `\(…\)` sebagai PEMISAH di dalam rumus panjang → buang pembungkusnya. */
function buangInlinePemisah(t: string): string {
  return t.replace(/\\\(([A-Za-z][^()\\]{2,40})\\\)/g, "$1");
}

/** `<span …>`/`</span>` yang bocor ke dalam rumus → buang. */
function buangSpanBocor(t: string): string {
  return t.replace(/<\/?span\b[^>]*>/gi, " ");
}

/**
 * Terapkan SEMUA perbaikan khusus mathcyber. Idempoten & hanya mengubah bila
 * pola memang ada (teks normal dilewatkan apa adanya).
 */
export function perbaikanKhususMathcyber(text: string): string {
  let s = text;
  // Urutan penting: buang sampah berlapis (span → backslash → dolar → pemisah).
  // ⚠️ TIDAK ada penyeimbangan kurung di sini — sudah dibatalkan (lihat atas).
  s = buangSpanBocor(s);
  s = buangBackslashTelanjang(s);
  s = buangDolarNyasar(s);
  s = buangInlinePemisah(s);
  return s;
}
