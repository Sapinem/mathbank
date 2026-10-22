/**
 * MAT-147 — BUKTI IMPORT KORPUS ATOMIK (Single Table + Hybrid JSONB).
 *
 * Membuktikan DoD MAT-147 pada data korpus **nyata**:
 *   1. Satu butir korpus = **satu INSERT** ke `questions`, dan baris itu sudah
 *      membawa soal + opsi (`data_payload.options`) + kunci (`answer_key`).
 *   2. Tidak ada tabel `question_options` yang tersentuh — kolomnya JSONB.
 *   3. Butir yang melanggar skema Zod ditolak dengan peringatan validasi,
 *      bukan meledak sebagai galat 500.
 *
 * Alur: berkas korpus mentah → adapter (defantri / pusmendik_dayaserap) →
 * `commitItems` (gerbang Zod → `createQuestion`) → verifikasi baris di DB.
 *
 * Jalankan (DB dev/uji — TULIS data!):
 *   pnpm tsx --env-file=.env scripts/ingest-atomic-proof.ts [defantri|pusmendik|semua] [limitButir]
 *
 * Contoh: pnpm tsx --env-file=.env scripts/ingest-atomic-proof.ts semua 5
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { Actor } from "../src/lib/auth/actor";
import { db } from "../src/lib/db";
import { commitItems } from "../src/lib/ingest/commit";
import { defantriAdapter } from "../src/lib/ingest/parsers/adapters/defantri";
import { pusmendikDayaserapAdapter } from "../src/lib/ingest/parsers/adapters/pusmendik-dayaserap";
import type { ParsedItem, SegmentResult } from "../src/lib/ingest/parsers/types";

/** Root korpus mentah (donor). Bisa dioverride lewat CORPUS_ROOT. */
const CORPUS_ROOT = process.env.CORPUS_ROOT?.trim() || "/home/hari/projects/qbank/data/corpora";

/** Aktor mesin — sama seperti yang dipakai route ingest (`permission` apikey). */
const MACHINE: Actor = {
  id: "ingest-atomic-proof",
  name: "Bukti Import Atomik (MAT-147)",
  roles: ["machine"],
  via: "system",
};

const target = (process.argv[2] ?? "semua").toLowerCase();
const limit = Math.max(1, Number(process.argv[3] ?? 3));

interface Case {
  label: string;
  sourceOrigin: string;
  sourceUrl: string | null;
  title: string;
  grade: string;
  segment: SegmentResult;
}

/** Artikel defantri pertama yang menghasilkan butir (dari korpus nyata). */
function loadDefantri(): Case | null {
  const dir = join(CORPUS_ROOT, "defantri");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  // Prioritaskan artikel yang jelas berisi soal UTBK/TKA (paling banyak butir).
  const prioritas = (f: string) => /utbk|tka|osn/i.test(f) && /matematika|math/i.test(f);
  const ordered = [
    ...files.filter(prioritas),
    ...files.filter((f) => /utbk|tka|osn/i.test(f) && !prioritas(f)),
    ...files.filter((f) => !/utbk|tka|osn/i.test(f)),
  ];
  for (const file of ordered) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
      url?: string;
      title?: string;
      rawHtml?: string;
    };
    if (!raw.rawHtml) continue;
    const segment = defantriAdapter(raw.rawHtml, {
      source: "defantri",
      url: raw.url,
      title: raw.title,
    });
    if (segment.items.length > 0) {
      return {
        label: `defantri/${file}`,
        sourceOrigin: "defantri",
        sourceUrl: raw.url ?? null,
        title: raw.title ?? file,
        grade: "umum",
        segment,
      };
    }
  }
  return null;
}

/** Sampel pusmendik daya serap (JSON terstruktur). */
function loadPusmendik(): Case | null {
  const dir = join(CORPUS_ROOT, "pusmendik_dayaserap");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
      kd_mapel?: string;
      even_tka?: string;
      nama_mapel?: string;
    };
    const segment = pusmendikDayaserapAdapter(raw, { source: "pusmendik_dayaserap" });
    if (segment.items.length > 0) {
      return {
        label: `pusmendik_dayaserap/${file}`,
        sourceOrigin: "pusmendik_dayaserap",
        sourceUrl: null,
        title: `Daya Serap ${raw.even_tka ?? ""} ${raw.nama_mapel ?? file}`.trim(),
        grade: "umum",
        segment,
      };
    }
  }
  return null;
}

/** Ambil butir yang representatif: pilihan ganda lebih dulu (opsi + kunci terlihat). */
function pickItems(items: ParsedItem[], n: number): ParsedItem[] {
  const optioned = items.filter((i) => i.options.length >= 2);
  const rest = items.filter((i) => i.options.length < 2);
  return [...optioned, ...rest].slice(0, n);
}

interface Row {
  id: string;
  question_type: string;
  payload_type: string | null;
  n_options: number | null;
  kunci: unknown;
  has_explanation: boolean;
}

async function rowsFor(ids: string[]): Promise<Row[]> {
  if (ids.length === 0) return [];
  const res = await db.execute(sql`
    SELECT id,
           question_type::text AS question_type,
           data_payload->>'type' AS payload_type,
           jsonb_array_length(COALESCE(data_payload->'options', '[]'::jsonb)) AS n_options,
           answer_key->'correctOptionIds' AS kunci,
           (answer_key ? 'explanationMarkdown') AS has_explanation
    FROM questions
    WHERE id = ANY(${sql.raw(`ARRAY[${ids.map((i) => `'${i}'::uuid`).join(",")}]`)})
    ORDER BY created_at
  `);
  return res as unknown as Row[];
}

let failures = 0;
function check(ok: boolean, message: string) {
  console.log(`${ok ? "  ✓" : "  ✗"} ${message}`);
  if (!ok) failures++;
}

async function main() {
  console.log("═══ MAT-147 · Bukti Import Korpus Atomik ═══");
  console.log(`DB      : ${(process.env.DATABASE_URL ?? "(tak diset)").replace(/:[^:@]*@/, ":***@")}`);
  console.log(`Korpus  : ${CORPUS_ROOT}`);
  console.log(`Target  : ${target} · limit ${limit} butir/artikel\n`);

  // Tabel relasional lama harus benar-benar tidak ada (MAT-146).
  const legacy = (await db.execute(sql`SELECT to_regclass('public.question_options') AS t`)) as unknown as {
    t: string | null;
  }[];
  check(legacy[0]?.t === null || legacy[0]?.t === undefined, "tabel `question_options` tidak ada (single table)");

  const cases: Case[] = [];
  if (target === "defantri" || target === "semua") {
    const c = loadDefantri();
    if (c) cases.push(c);
    else console.log("  ! korpus defantri tak ditemukan/dihasilkan butir");
  }
  if (target === "pusmendik" || target === "semua") {
    const c = loadPusmendik();
    if (c) cases.push(c);
    else console.log("  ! korpus pusmendik tak ditemukan/dihasilkan butir");
  }

  for (const c of cases) {
    const items = pickItems(c.segment.items, limit);
    console.log(`\n── ${c.label}`);
    console.log(`   ${c.segment.items.length} butir terdeteksi · mengambil ${items.length}`);

    const res = await commitItems(items, MACHINE, {
      sourceOrigin: c.sourceOrigin,
      sourceUrl: c.sourceUrl,
      articleTitle: c.title,
      grade: c.grade,
    });

    console.log(
      `   hasil: dibuat ${res.created} · ditautkan ${res.linked} · ditolak ${res.rejected} · gagal ${res.failed} · dilewati ${res.skipped}`,
    );
    if (res.errors.length) {
      for (const e of res.errors.slice(0, 5)) console.log(`   ! ${e}`);
      if (res.errors.length > 5) console.log(`   ! … ${res.errors.length - 5} pesan lain`);
    }

    const rows = await rowsFor(res.questionIds);
    console.log("   baris `questions` (1 baris = 1 butir lengkap, zero join):");
    for (const r of rows) {
      const kunci = Array.isArray(r.kunci) ? r.kunci.join(",") : String(r.kunci ?? "-");
      console.log(
        `     • ${r.question_type.padEnd(26)} payload=${String(r.payload_type).padEnd(22)} opsi=${r.n_options} kunci=${kunci}`,
      );
    }

    // ── Verifikasi ────────────────────────────────────────────────────────
    check(res.created + res.linked === items.length - res.skipped - res.rejected - res.failed,
      "setiap butir sah = tepat satu baris `questions` (created+linked)");
    check(rows.length === res.questionIds.length, "semua id hasil commit bisa dibaca kembali");

    const mc = rows.filter((r) => r.payload_type === "multiple_choice" || r.payload_type === "complex_multiple_choice");
    if (mc.length > 0) {
      check(mc.every((r) => (r.n_options ?? 0) >= 2), "PG: opsi tersimpan di data_payload.options (≥2)");

      // Kunci: sumber pusmendik memang KOSONG (kunci_jawaban null) → jangan
      // menuntut kunci, tapi pastikan tak ada kunci hasil tebakan.
      const keyedExpected = items.filter((i) => i.correct.length > 0).length;
      const keyedRows = mc.filter((r) => r.kunci !== null && r.kunci !== undefined).length;
      if (keyedExpected > 0) {
        check(
          keyedRows >= Math.min(keyedExpected, mc.length),
          `PG: kunci sumber tersimpan di answer_key.correctOptionIds (${keyedRows}/${keyedExpected})`,
        );
      } else {
        console.log("  · sumber tanpa kunci (kunci_jawaban null) — kunci sengaja dikosongkan, tak menebak");
      }
      check(keyedRows <= keyedExpected, "PG: tak ada kunci hasil tebakan (≤ butir berkunci di sumber)");
    } else {
      console.log("  · tak ada butir PG di sampel ini (matriks/uraian)");
    }
    check(rows.every((r) => r.has_explanation), "answer_key.explanationMarkdown terisi (nyata/placeholder)");

    // Idempotensi: ingest ulang artikel yang sama tak menggandakan soal.
    const again = await commitItems(items, MACHINE, {
      sourceOrigin: c.sourceOrigin,
      sourceUrl: c.sourceUrl,
      articleTitle: c.title,
      grade: c.grade,
    });
    check(again.created === 0 && again.linked > 0, "ingest ulang artikel sama → 0 soal baru (idempoten)");
  }

  console.log(`\n═══ ${failures === 0 ? "PASS" : `FAIL (${failures} pemeriksaan)`} ═══`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Gagal menjalankan bukti import:", e);
  process.exit(1);
});
