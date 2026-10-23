/**
 * Snapshot metrik DB — angka acuan yang DIHASILKAN, bukan disalin tangan.
 *
 * KENAPA skrip ini ada: tabel metrik di `AGENTS.md` §8 dan
 * `docs/SNAPSHOT-METRIK-*.md` dulu ditulis manual. Saat diukur ulang
 * (2026-10-24) tiga angka sudah berbeda dari kenyataan (jumlah soal, cakupan
 * embedding, cakupan Zod). Angka yang disalin tangan selalu basi, dan angka
 * basi menghasilkan "temuan" palsu.
 *
 * Jalankan: `pnpm metrics:snapshot`
 * Keluaran: `docs/SNAPSHOT-METRIK-<YYYY-MM-DD>.md` (menimpa berkas hari yang sama)
 * Exit 1 bila invarian skema di bawah harapan — sehingga bisa dipakai sebagai gerbang.
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import postgres from "postgres";
import { EXPECTED_INVARIANTS } from "../src/lib/db/schema-expectations";

config({ path: ".env", quiet: true });

const SQL_SCHEMA = `SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
  (SELECT count(*) FROM pg_constraint
    WHERE contype='c' AND connamespace='public'::regnamespace) AS checks,
  (SELECT count(*) FROM pg_indexes WHERE schemaname='public') AS indexes,
  (SELECT count(*) FROM pg_indexes WHERE indexdef ILIKE '%hnsw%') AS hnsw,
  (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal) AS triggers`;

const SQL_QUESTIONS = `SELECT
  count(*) FILTER (WHERE deleted_at IS NULL) AS aktif,
  count(*) FILTER (WHERE deleted_at IS NULL AND status='draft') AS draft,
  count(*) FILTER (WHERE deleted_at IS NULL AND status='review') AS review,
  count(*) FILTER (WHERE deleted_at IS NULL AND status='ready') AS ready,
  count(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted,
  count(*) FILTER (WHERE deleted_at IS NULL AND answer_key <> '{}'::jsonb) AS ber_kunci,
  count(*) FILTER (WHERE deleted_at IS NULL AND is_flagged) AS ditandai,
  count(*) FILTER (WHERE deleted_at IS NULL AND event_id IS NOT NULL) AS ber_event
 FROM questions`;

const SQL_ENRICHMENT = `SELECT
  count(*) FILTER (WHERE jsonb_typeof(data_payload->'options')='array') AS soal_pg,
  count(*) FILTER (WHERE (SELECT count(*) FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(data_payload->'options')='array'
           THEN data_payload->'options' ELSE '[]'::jsonb END) o
      WHERE o ? 'distractorRationale') > 0) AS ber_distraktor,
  count(*) FILTER (WHERE answer_key ? 'rubric') AS ber_rubrik
 FROM questions WHERE deleted_at IS NULL`;

const SQL_RELATIONS = `SELECT
  (SELECT count(*) FROM question_topics) AS tautan_topik,
  (SELECT count(DISTINCT question_id) FROM question_topics) AS soal_bertopik,
  (SELECT count(*) FROM question_media) AS tautan_media,
  (SELECT count(DISTINCT question_id) FROM question_media) AS soal_bermedia,
  (SELECT count(*) FROM question_tags) AS tautan_tag,
  (SELECT count(DISTINCT question_id) FROM question_tags) AS soal_bertag,
  (SELECT count(*) FROM question_embeddings) AS embedding,
  (SELECT count(*) FROM topics) AS topik,
  (SELECT count(*) FROM media_assets) AS aset_media,
  (SELECT count(*) FROM tags) AS tag,
  (SELECT count(*) FROM sources) AS sumber,
  (SELECT count(*) FROM events) AS event`;

const SQL_BUNDLES = `SELECT
  count(*) FILTER (WHERE deleted_at IS NULL) AS aktif,
  count(*) FILTER (WHERE deleted_at IS NOT NULL) AS arsip,
  (SELECT count(*) FROM bundle_items) AS butir,
  (SELECT round(avg(c)::numeric,1) FROM (
     SELECT count(*) c FROM bundle_items GROUP BY bundle_id) x) AS rata_butir
 FROM bundles`;

const SQL_EMBEDDING_DIM = `SELECT vector_dims(embedding) AS dim FROM question_embeddings LIMIT 1`;

/** Tabel sisa migrasi/backup — objek yang tak seharusnya hidup di DB produksi. */
const SQL_LEFTOVER_TABLES = `SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
    AND table_name LIKE '%\\_backup' ESCAPE '\\'
  ORDER BY 1`;

const n = (v: unknown): number => Number(v ?? 0);
const pct = (part: number, total: number): string =>
  total === 0 ? "—" : `${((part / total) * 100).toFixed(1).replace(".", ",")}%`;

type Row = Record<string, unknown>;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL tidak diset (perlu .env).");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    const [schema] = await sql.unsafe<Row[]>(SQL_SCHEMA);
    const [q] = await sql.unsafe<Row[]>(SQL_QUESTIONS);
    const [enr] = await sql.unsafe<Row[]>(SQL_ENRICHMENT);
    const [rel] = await sql.unsafe<Row[]>(SQL_RELATIONS);
    const [b] = await sql.unsafe<Row[]>(SQL_BUNDLES);
    const [dim] = await sql.unsafe<Row[]>(SQL_EMBEDDING_DIM);
    const leftovers = await sql.unsafe<Row[]>(SQL_LEFTOVER_TABLES);

    const s = schema!;
    const counts = {
      tables: n(s.tables),
      checkConstraints: n(s.checks),
      hnswIndexes: n(s.hnsw),
      triggers: n(s.triggers),
    };
    const problems = (Object.keys(EXPECTED_INVARIANTS) as (keyof typeof EXPECTED_INVARIANTS)[])
      .filter((k) => counts[k] < EXPECTED_INVARIANTS[k])
      .map((k) => `${k}: ${counts[k]} < ${EXPECTED_INVARIANTS[k]}`);

    const aktif = n(q!.aktif);
    const draft = n(q!.draft);
    const ready = n(q!.ready);
    const soalPg = n(enr!.soal_pg);
    const berDistraktor = n(enr!.ber_distraktor);
    const berRubrik = n(enr!.ber_rubrik);
    const tautanTopik = n(rel!.tautan_topik);
    const soalBertopik = n(rel!.soal_bertopik);
    const tautanMedia = n(rel!.tautan_media);
    const soalBermedia = n(rel!.soal_bermedia);
    const tautanTag = n(rel!.tautan_tag);
    const soalBertag = n(rel!.soal_bertag);
    const embedding = n(rel!.embedding);

    // Tanggal LOKAL, bukan UTC: snapshot yang dibuat lewat tengah malam lokal
    // tidak boleh mundur sehari hanya karena zona waktu.
    const now = new Date();
    const tanggal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const berkas = `docs/SNAPSHOT-METRIK-${tanggal}.md`;

    const doc = `# Snapshot Metrik DB — ${tanggal}

> **Dihasilkan otomatis** oleh \`scripts/snapshot-metrics.ts\` (\`pnpm metrics:snapshot\`).
> Jangan menyunting angka di sini — jalankan ulang skripnya.
> Sumber angka: DB pada \`DATABASE_URL\` saat skrip dijalankan. Setiap baris punya query asalnya (§5).

## 1. Ringkasan

| Aspek | Nilai |
|---|---|
| Skema | **${counts.tables} tabel** · **${counts.triggers} trigger** · ${counts.checkConstraints} CHECK · **${n(s.indexes)} index** (${counts.hnswIndexes} HNSW) |
| Soal | **${aktif.toLocaleString("id-ID")}** — ${pct(draft, aktif)} \`draft\`, **${ready} \`ready\`**, ${n(q!.soft_deleted)} soft-deleted, ${pct(n(q!.ber_kunci), aktif)} ber-\`answer_key\`, ${pct(n(q!.ditandai), aktif)} \`is_flagged\` |
| Bundle | **${n(b!.aktif)} aktif** · ${n(b!.arsip)} arsip · ${n(b!.butir).toLocaleString("id-ID")} butir · rata-rata ${b!.rata_butir ? Number(b!.rata_butir).toLocaleString("id-ID") : "—"} butir/paket |
| Topik | **${n(rel!.topik).toLocaleString("id-ID")}** · ${soalBertopik.toLocaleString("id-ID")} soal terpetakan (${tautanTopik.toLocaleString("id-ID")} tautan — ${pct(soalBertopik, aktif)}) |
| Media | **${n(rel!.aset_media).toLocaleString("id-ID")}** aset · ${tautanMedia.toLocaleString("id-ID")} tautan menjangkau ${soalBermedia.toLocaleString("id-ID")} soal (${pct(soalBermedia, aktif)}) |
| Tag | **${n(rel!.tag)}** · ${tautanTag.toLocaleString("id-ID")} tautan (${soalBertag.toLocaleString("id-ID")} soal) |
| Provenance | **${n(rel!.sumber)} sumber** · **${n(rel!.event)} event** · ${pct(n(q!.ber_event), aktif)} soal ber-\`event_id\` |
| Vektor | **${embedding.toLocaleString("id-ID")} embedding** (${pct(embedding, aktif)}) · \`vector(${n(dim?.dim)})\` |

## 2. Kelengkapan pedagogis (gerbang rilis)

Angka ini yang menentukan berapa soal yang **boleh** keluar ke siswa — bukan jumlah soal tersimpan.

| Ukuran | Nilai | Arti |
|---|---|---|
| Soal pilihan ganda | ${soalPg.toLocaleString("id-ID")} | punya \`data_payload.options\` array |
| Punya \`distractorRationale\` | **${berDistraktor.toLocaleString("id-ID")}** (${pct(berDistraktor, soalPg)} dari PG) | syarat kontrak rilis |
| Punya \`answer_key.rubric\` | **${berRubrik}** | syarat soal esai |
| Status \`ready\` | **${ready}** | satu-satunya status yang boleh dipakai siswa |

## 3. Invarian skema

| Invarian | Aktual | Minimum | Status |
|---|---|---|---|
${(Object.keys(EXPECTED_INVARIANTS) as (keyof typeof EXPECTED_INVARIANTS)[])
  .map((k) => `| \`${k}\` | ${counts[k]} | ${EXPECTED_INVARIANTS[k]} | ${counts[k] >= EXPECTED_INVARIANTS[k] ? "✓" : "✗"} |`)
  .join("\n")}

${problems.length === 0
  ? "✓ Semua invarian memenuhi minimum. Selisih **di atas** minimum (mis. jumlah tabel lebih banyak) tidak otomatis sehat — periksa §4."
  : problems.map((p) => `✗ ${p}`).join("\n")}

Sumber angka minimum: \`src/lib/db/schema-expectations.ts\` — sama dengan \`pnpm db:verify\`.

## 4. Objek di luar harapan

${leftovers.length === 0
  ? "✓ Tidak ada tabel backup sisa migrasi."
  : leftovers.map((l) => `⚠️ \`${String(l.table_name)}\` — tabel sisa migrasi, bukan bagian skema. Perlu keputusan pemilik: arsipkan isinya lalu DROP.`).join("\n")}

## 5. Query sumber (reproduksi)

\`\`\`sql
-- skema
${SQL_SCHEMA};

-- soal
${SQL_QUESTIONS};

-- kelengkapan pedagogis
${SQL_ENRICHMENT};

-- keterhubungan
${SQL_RELATIONS};

-- bundle
${SQL_BUNDLES};

-- dimensi vektor
${SQL_EMBEDDING_DIM};

-- tabel sisa migrasi
${SQL_LEFTOVER_TABLES};
\`\`\`

Reproduksi cepat: \`pnpm metrics:snapshot\` (menulis ulang berkas ini) atau \`pnpm db:verify\` untuk invarian saja.
`;

    writeFileSync(berkas, doc);
    console.log(`✓ ${berkas}`);
    console.log(
      `  soal ${aktif} (draft ${draft}, ready ${ready}) · distraktor ${berDistraktor}/${soalPg} · rubrik ${berRubrik} · embedding ${embedding}`,
    );
    if (problems.length > 0) {
      console.error(`✗ Invarian skema di bawah harapan: ${problems.join("; ")}`);
      process.exitCode = 1;
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗ Snapshot gagal:", err);
  process.exit(1);
});
