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
 *
 * Gerbang invarian TIDAK ditulis di sini: dipanggil lewat `evaluateInvariants()`,
 * sumber yang sama dengan `pnpm db:verify` dan health check. Sebelumnya salinan
 * di berkas ini hanya memeriksa angka, sehingga snapshot bisa hijau saat
 * `db:verify` merah.
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import postgres from "postgres";
import {
  EXPECTED_INVARIANTS,
  evaluateInvariants,
  isForbiddenTable,
} from "../src/lib/db/schema-expectations";

config({ path: ".env", quiet: true });

/**
 * Hitungan tabel MENGECUALIKAN sisa migrasi (`*_backup`): tabel seperti
 * `question_options_mat146_backup` bukan bagian skema, dan bila ikut dihitung
 * ia menjadi kelonggaran yang menutupi hilangnya satu tabel sungguhan.
 */
const SQL_SCHEMA = `SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND right(table_name, 7) <> '_backup') AS tables,
  (SELECT count(*) FROM pg_constraint
    WHERE contype='c' AND connamespace='public'::regnamespace) AS checks,
  (SELECT count(*) FROM pg_indexes WHERE schemaname='public') AS indexes,
  (SELECT count(*) FROM pg_indexes WHERE indexdef ILIKE '%hnsw%') AS hnsw,
  (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal) AS triggers`;

const SQL_TABLE_NAMES = `SELECT table_name AS name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'`;

const SQL_CHECK_NAMES = `SELECT conname AS name FROM pg_constraint
  WHERE contype='c' AND connamespace='public'::regnamespace`;

const SQL_TRIGGER_NAMES = `SELECT tgname AS name FROM pg_trigger WHERE NOT tgisinternal`;

const SQL_PK = `SELECT column_default FROM information_schema.columns
  WHERE table_name='questions' AND column_name='id'`;

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

/** Postgres mengembalikan `count(*)` sebagai bigint (string di driver ini). */
type Num = number | string;

type SchemaRow = {
  tables: Num; checks: Num; indexes: Num; hnsw: Num; triggers: Num;
};
type QuestionsRow = {
  aktif: Num; draft: Num; review: Num; ready: Num;
  soft_deleted: Num; ber_kunci: Num; ditandai: Num; ber_event: Num;
};
type EnrichmentRow = { soal_pg: Num; ber_distraktor: Num; ber_rubrik: Num };
type RelationsRow = {
  tautan_topik: Num; soal_bertopik: Num; tautan_media: Num; soal_bermedia: Num;
  tautan_tag: Num; soal_bertag: Num; embedding: Num;
  topik: Num; aset_media: Num; tag: Num; sumber: Num; event: Num;
};
type BundlesRow = { aktif: Num; arsip: Num; butir: Num; rata_butir: Num | null };
type NameRow = { name: string };
type PkRow = { column_default: string | null };

/**
 * Baca kolom numerik dengan tegas: kolom yang hilang/ganti nama HARUS gagal,
 * bukan menjadi 0. Sebelumnya `Number(v ?? 0)` mengubah alias SQL yang berubah
 * nama menjadi "0 (0,0%)" dengan exit 0 — persis mode kegagalan "angka palsu"
 * yang skrip ini ada untuk menghapus.
 */
const n = (v: Num | null | undefined, field: string): number => {
  if (v === undefined || v === null) {
    throw new Error(`kolom "${field}" tidak ada di hasil query — periksa alias SQL`);
  }
  return Number(v);
};

const pct = (part: number, total: number): string =>
  total === 0 ? "—" : `${((part / total) * 100).toFixed(1).replace(".", ",")}%`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL tidak diset (perlu .env).");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    const [schema] = await sql.unsafe<SchemaRow[]>(SQL_SCHEMA);
    const [q] = await sql.unsafe<QuestionsRow[]>(SQL_QUESTIONS);
    const [enr] = await sql.unsafe<EnrichmentRow[]>(SQL_ENRICHMENT);
    const [rel] = await sql.unsafe<RelationsRow[]>(SQL_RELATIONS);
    const [b] = await sql.unsafe<BundlesRow[]>(SQL_BUNDLES);
    const dimRows = await sql.unsafe<{ dim: Num }[]>(SQL_EMBEDDING_DIM);
    const tableNames = new Set(
      (await sql.unsafe<NameRow[]>(SQL_TABLE_NAMES)).map((r) => r.name),
    );
    const checkNames = new Set(
      (await sql.unsafe<NameRow[]>(SQL_CHECK_NAMES)).map((r) => r.name),
    );
    const triggerNames = new Set(
      (await sql.unsafe<NameRow[]>(SQL_TRIGGER_NAMES)).map((r) => r.name),
    );
    const [pk] = await sql.unsafe<PkRow[]>(SQL_PK);

    if (!schema || !q || !enr || !rel || !b) {
      throw new Error("salah satu query agregat tidak mengembalikan baris");
    }

    const counts = {
      tables: n(schema.tables, "tables"),
      checkConstraints: n(schema.checks, "checks"),
      hnswIndexes: n(schema.hnsw, "hnsw"),
      triggers: n(schema.triggers, "triggers"),
    };

    const verdict = evaluateInvariants(counts, {
      tables: tableNames,
      checks: checkNames,
      triggers: triggerNames,
      pkUsesUuidv7: (pk?.column_default ?? "").includes("uuidv7"),
    });

    const leftovers = [...tableNames].filter(isForbiddenTable).sort();

    const aktif = n(q.aktif, "aktif");
    const draft = n(q.draft, "draft");
    const ready = n(q.ready, "ready");
    const soalPg = n(enr.soal_pg, "soal_pg");
    const berDistraktor = n(enr.ber_distraktor, "ber_distraktor");
    const berRubrik = n(enr.ber_rubrik, "ber_rubrik");
    const tautanTopik = n(rel.tautan_topik, "tautan_topik");
    const soalBertopik = n(rel.soal_bertopik, "soal_bertopik");
    const tautanMedia = n(rel.tautan_media, "tautan_media");
    const soalBermedia = n(rel.soal_bermedia, "soal_bermedia");
    const tautanTag = n(rel.tautan_tag, "tautan_tag");
    const soalBertag = n(rel.soal_bertag, "soal_bertag");
    const embedding = n(rel.embedding, "embedding");

    // Tanggal LOKAL, bukan UTC: snapshot yang dibuat lewat tengah malam lokal
    // tidak boleh mundur sehari hanya karena zona waktu.
    const now = new Date();
    const tanggal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const berkas = `docs/SNAPSHOT-METRIK-${tanggal}.md`;
    const dimLabel = dimRows[0] ? `vector(${Number(dimRows[0].dim)})` : "belum ada vektor";

    const doc = `# Snapshot Metrik DB — ${tanggal}

> **Dihasilkan otomatis** oleh \`scripts/snapshot-metrics.ts\` (\`pnpm metrics:snapshot\`).
> Jangan menyunting angka di sini — jalankan ulang skripnya.
> Sumber angka: DB pada \`DATABASE_URL\` saat skrip dijalankan. Setiap baris punya query asalnya (§5).

## 1. Ringkasan

| Aspek | Nilai |
|---|---|
| Skema | **${counts.tables} tabel** · **${counts.triggers} trigger** · ${counts.checkConstraints} CHECK · **${n(schema.indexes, "indexes")} index** (${counts.hnswIndexes} HNSW) |
| Soal | **${aktif.toLocaleString("id-ID")}** — ${pct(draft, aktif)} \`draft\`, **${ready} \`ready\`**, ${n(q.soft_deleted, "soft_deleted")} soft-deleted, ${pct(n(q.ber_kunci, "ber_kunci"), aktif)} ber-\`answer_key\`, ${pct(n(q.ditandai, "ditandai"), aktif)} \`is_flagged\` |
| Bundle | **${n(b.aktif, "aktif")} aktif** · ${n(b.arsip, "arsip")} arsip · ${n(b.butir, "butir").toLocaleString("id-ID")} butir · rata-rata ${b.rata_butir === null ? "—" : Number(b.rata_butir).toLocaleString("id-ID")} butir/paket |
| Topik | **${n(rel.topik, "topik").toLocaleString("id-ID")}** · ${soalBertopik.toLocaleString("id-ID")} soal terpetakan (${tautanTopik.toLocaleString("id-ID")} tautan — ${pct(soalBertopik, aktif)}) |
| Media | **${n(rel.aset_media, "aset_media").toLocaleString("id-ID")}** aset · ${tautanMedia.toLocaleString("id-ID")} tautan menjangkau ${soalBermedia.toLocaleString("id-ID")} soal (${pct(soalBermedia, aktif)}) |
| Tag | **${n(rel.tag, "tag")}** · ${tautanTag.toLocaleString("id-ID")} tautan (${soalBertag.toLocaleString("id-ID")} soal) |
| Provenance | **${n(rel.sumber, "sumber")} sumber** · **${n(rel.event, "event")} event** · ${pct(n(q.ber_event, "ber_event"), aktif)} soal ber-\`event_id\` |
| Vektor | **${embedding.toLocaleString("id-ID")} embedding** (${pct(embedding, aktif)}) · \`${dimLabel}\` |

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

${verdict.ok
  ? "✓ Semua invarian memenuhi minimum."
  : verdict.problems.map((p) => `✗ ${p}`).join("\n")}

Aturan lulus/gagal: \`evaluateInvariants()\` di \`src/lib/db/schema-expectations.ts\` — sama persis dengan \`pnpm db:verify\` dan health check.

## 4. Objek di luar harapan

${leftovers.length === 0
  ? "✓ Tidak ada tabel sisa migrasi / objek terlarang."
  : leftovers.map((name) => `⚠️ \`${name}\` — tabel sisa migrasi, bukan bagian skema. Gerbang health/ready melaporkannya sebagai terlarang sampai pemilik mengarsipkan isinya lalu DROP.`).join("\n")}

## 5. Query sumber (reproduksi)

\`\`\`sql
-- skema
${SQL_SCHEMA};

-- nama objek (dipakai gerbang invarian)
${SQL_TABLE_NAMES};
${SQL_CHECK_NAMES};
${SQL_TRIGGER_NAMES};
${SQL_PK};

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
\`\`\`

Reproduksi cepat: \`pnpm metrics:snapshot\` (menulis ulang berkas ini) atau \`pnpm db:verify\` untuk invarian saja.
`;

    writeFileSync(berkas, doc);
    console.log(`✓ ${berkas}`);
    console.log(
      `  soal ${aktif} (draft ${draft}, ready ${ready}) · distraktor ${berDistraktor}/${soalPg} · rubrik ${berRubrik} · embedding ${embedding}`,
    );
    if (!verdict.ok) {
      console.error(`✗ Invarian skema bermasalah: ${verdict.problems.join("; ")}`);
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
