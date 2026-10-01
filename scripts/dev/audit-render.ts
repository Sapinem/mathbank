/**
 * Audit render SELURUH soal: cari yang rumusnya tidak akan ter-render.
 *
 * Yang dianggap MASALAH (akan tampil sebagai kode mentah di browser):
 *   1. `$...$` dollar tunggal (bukan `\( \)` / `\[ \]`) — tokenizer MathBank
 *      hanya mengenali gaya backslash & `$$`.
 *   2. `$...$` multi-baris — pola inline menolak newline, jadi tak ter-render.
 *   3. Jumlah delimiter ganjil — rumus tak tertutup.
 *   4. `\\(` / `\\)` atau `$` yang ter-escape ganda dari pembersihan HTML.
 *   5. Teks mengandung markup HTML mentah yang lolos.
 */
import { config } from "dotenv";

config({ path: ".env" });

interface Masalah {
  id: string;
  sumber: string;
  jenis: string;
  cuplik: string;
}

async function main() {
  const { db } = await import("../../src/lib/db");
  const { questions } = await import("../../src/lib/db/schema/question");
  const { sources } = await import("../../src/lib/db/schema/source");
  const { bundles, bundleItems } = await import("../../src/lib/db/schema/bundle");
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select({
      id: questions.id,
      content: questions.contentMarkdown,
      answerKey: questions.answerKey,
      sumber: sources.label,
    })
    .from(questions)
    .leftJoin(bundleItems, eq(bundleItems.questionId, questions.id))
    .leftJoin(bundles, eq(bundles.id, bundleItems.bundleId))
    .leftJoin(sources, eq(sources.id, bundles.sourceId));

  const masalah: Masalah[] = [];

  for (const r of rows) {
    const teks = [
      r.content,
      ...(r.answerKey && typeof r.answerKey === "object" && "explanation" in r.answerKey
        ? [String((r.answerKey as { explanation?: string }).explanation ?? "")]
        : []),
    ];

    for (const [label, t] of [["soal", r.content], ["pembahasan", teks[1] ?? ""]] as const) {
      if (!t) continue;
      const cuplik = (i: number) => t.slice(Math.max(0, i - 40), i + 50).replace(/\n/g, "\\n");

      // 1. Dollar tunggal di luar `$$`
      const tanpaDollarGanda = t.replace(/\$\$/g, "");
      let m: RegExpExecArray | null;
      const reDollar = /(^|[^$\\])\$([^$]+?)\$/g;
      while ((m = reDollar.exec(tanpaDollarGanda)) !== null) {
        masalah.push({ id: r.id, sumber: r.sumber ?? "-", jenis: `${label}: dollar tunggal`, cuplik: cuplik(m.index) });
        break;
      }

      // 2. `$...$` multi-baris
      if (/\$[^$]*\n[^$]*\$/.test(t)) {
        const i = t.search(/\$[^$]*\n[^$]*\$/);
        masalah.push({ id: r.id, sumber: r.sumber ?? "-", jenis: `${label}: dollar multi-baris`, cuplik: cuplik(i) });
      }

      // 3. Escape ganda `\\(` (dua backslash sebelum kurung)
      const reGanda = /\\\\[()[\]]/g;
      if (reGanda.test(t)) {
        const i = t.search(reGanda);
        masalah.push({ id: r.id, sumber: r.sumber ?? "-", jenis: `${label}: escape ganda`, cuplik: cuplik(i) });
      }

      // 4. Delimiter ganjil
      const dDollar = (t.match(/\$/g) ?? []).length;
      if (dDollar % 2 === 1) {
        masalah.push({ id: r.id, sumber: r.sumber ?? "-", jenis: `${label}: $ ganjil (${dDollar})`, cuplik: cuplik(0) });
      }
      const dOpen = (t.match(/\\\(|\\\[/g) ?? []).length;
      const dClose = (t.match(/\\\)|\\\]/g) ?? []).length;
      if (dOpen !== dClose) {
        masalah.push({
          id: r.id,
          sumber: r.sumber ?? "-",
          jenis: `${label}: pasangan \\( \\) tak seimbang (${dOpen} buka / ${dClose} tutup)`,
          cuplik: cuplik(0),
        });
      }

      // 5. Tag HTML mentah lolos
      const reHtml = /<(?:br|p|div|span|strong|em|ul|li)\b[^>]*>/i;
      if (reHtml.test(t)) {
        const i = t.search(reHtml);
        masalah.push({ id: r.id, sumber: r.sumber ?? "-", jenis: `${label}: HTML mentah`, cuplik: cuplik(i) });
      }
    }
  }

  console.log(`Diperiksa        : ${rows.length} soal\n`);

  if (masalah.length === 0) {
    console.log("✓ Tidak ada masalah render.");
  } else {
    // Kelompokkan per jenis
    const perJenis = new Map<string, Masalah[]>();
    for (const m of masalah) {
      const k = m.jenis;
      if (!perJenis.has(k)) perJenis.set(k, []);
      perJenis.get(k)!.push(m);
    }
    console.log(`Ditemukan ${masalah.length} masalah:\n`);
    for (const [jenis, list] of [...perJenis].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${list.length}× ${jenis}`);
      for (const m of list.slice(0, 3)) {
        console.log(`      ${m.id}  «${m.cuplik.slice(0, 70)}»`);
      }
      if (list.length > 3) console.log(`      … dan ${list.length - 3} lagi`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
