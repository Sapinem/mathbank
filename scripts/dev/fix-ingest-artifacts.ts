/**
 * Perbaiki soal bermasalah hasil ingest — dengan cara yang AMAN & bisa diaudit.
 *
 * Masalah yang ditangani:
 *   1. Placeholder LaTeX `\text{jumlah_akar}` / `\text{hasil_kali akar}`
 *      (template penulis yang lolos; baris rumus benarnya ada di bawahnya).
 *   2. En-dash `–` (U+2013) di dalam rumus → diganti minus `-`
 *      (KaTeX memberi peringatan; secara matematis juga lebih benar).
 *
 * Mode kering secara default. Tambah `--apply` untuk menulis.
 * Mencetak ringkasan sebelum/sesudah tiap soal agar perubahannya bisa diperiksa.
 */
import { config } from "dotenv";

config({ path: ".env" });

const APPLY = process.argv.includes("--apply");

/** Pola placeholder penulis: `\text{..._...}` di dalam rumus. */
const PLACEHOLDER = /\\text\{[^}]*_[^}]*\}/;

async function main() {
  const { db } = await import("../../src/lib/db");
  const { questions } = await import("../../src/lib/db/schema/question");
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select({
      id: questions.id,
      content: questions.contentMarkdown,
      answerKey: questions.answerKey,
    })
    .from(questions);

  const rencana: {
    id: string;
    sebelum: string;
    sesudah: string;
    sebab: string[];
  }[] = [];

  for (const r of rows) {
    const eks = (r.answerKey as { explanation?: string } | null)?.explanation ?? "";
    let baru = eks;
    const sebab: string[] = [];

    // 1. Buang baris rumus yang memakai placeholder penulis.
    if (PLACEHOLDER.test(baru)) {
      const baris = baru.split("\n");
      const sisa: string[] = [];
      let dibuang = 0;
      for (const b of baris) {
        // Hanya buang baris yang placeholder-nya di dalam blok rumus DAN
        // rumus sebenarnya ada di baris lain yang mengandung `& = 0`.
        if (PLACEHOLDER.test(b) && /& ?= ?0/.test(b)) {
          dibuang++;
          continue;
        }
        sisa.push(b);
      }
      if (dibuang > 0) {
        baru = sisa.join("\n");
        sebab.push(`buang ${dibuang} baris placeholder`);
      }
    }

    // 2. En-dash di dalam rumus → minus.
    const gantiEndash = (t: string) =>
      t.replace(/(\\\(|\\\[)([^]*?)(\\\)|\\\])/g, (m) => m.replace(/\u2013/g, "-"));
    const setelah = gantiEndash(baru);
    if (setelah !== baru) {
      baru = setelah;
      sebab.push("en-dash → minus di dalam rumus");
    }

    if (baru !== eks) {
      rencana.push({
        id: r.id,
        sebelum: eks.slice(0, 120).replace(/\n/g, "\\n"),
        sesudah: baru.slice(0, 120).replace(/\n/g, "\\n"),
        sebab,
      });
    }
  }

  console.log(`Soal diperiksa : ${rows.length}`);
  console.log(`Perlu diperbaiki: ${rencana.length}\n`);

  for (const r of rencana.slice(0, 6)) {
    console.log(`  ${r.id}`);
    console.log(`    sebab  : ${r.sebab.join("; ")}`);
    console.log(`    sebelum: ${r.sebelum}`);
    console.log(`    sesudah: ${r.sesudah}\n`);
  }
  if (rencana.length > 6) console.log(`  … dan ${rencana.length - 6} lagi\n`);

  if (!APPLY) {
    console.log("(MODE KERING — tambahkan --apply untuk menulis.)");
    process.exit(0);
  }

  let ok = 0;
  for (const r of rencana) {
    const [row] = await db
      .select({ answerKey: questions.answerKey })
      .from(questions)
      .where(eq(questions.id, r.id))
      .limit(1);
    if (!row) continue;
    const ak = row.answerKey as Record<string, unknown>;
    const eks = String(ak.explanation ?? "");
    let baru = eks;
    if (PLACEHOLDER.test(baru)) {
      baru = baru
        .split("\n")
        .filter((b) => !(PLACEHOLDER.test(b) && /& ?= ?0/.test(b)))
        .join("\n");
    }
    baru = baru.replace(/(\\\(|\\\[)([^]*?)(\\\)|\\\])/g, (m) => m.replace(/\u2013/g, "-"));

    await db
      .update(questions)
      .set({ answerKey: { ...ak, explanation: baru } })
      .where(eq(questions.id, r.id));
    ok++;
    console.log(`  ✓ ${r.id}`);
  }
  console.log(`\nSelesai: ${ok} soal diperbaiki.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
