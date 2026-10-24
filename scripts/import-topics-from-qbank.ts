/**
 * Impor taksonomi topik dari QBank (`categories`) → MathBank (`topics`).
 *
 * Latar: MathBank membangun ulang dari kanvas bersih; taksonomi topiknya belum
 * ada, sementara QBank sudah punya 3-level (Kategori › Topik › SubTopik) hasil
 * kerja nyata. Skrip ini memindahkannya.
 *
 * ⚠️ QBank `categories` juga memuat SAMPAH UJI (nama berakhiran timestamp,
 * mis. "Aljabar 1790643244606", "Cat A 1790643245401"). Skrip ini **menyaring
 * 342 baris sampah** itu dan hanya mengimpor yang bersih (192 baris, slug unik).
 *
 * Pemetaan:
 *   categories.name        → topics.name
 *   categories.slug        → topics.slug
 *   categories.parent_id   → topics.parent_id (dipetakan ulang ke id baru)
 *   categories.description → topics.description
 *   categories.sort_order  → topics.sort_order
 *   categories.is_active   → topics.is_active
 *   level (dihitung dari kedalaman hierarki) → topics.level  (1..3)
 *
 * Pemakaian:
 *   pnpm tsx scripts/import-topics-from-qbank.ts            # uji (dry-run)
 *   pnpm tsx scripts/import-topics-from-qbank.ts --apply    # tulis ke DB
 */
import { config } from "dotenv";
config({ path: ".env" });

import postgres from "postgres";

const QBANK_URL =
  process.env.QBANK_DATABASE_URL ??
  "postgresql://hari@localhost:5432/qbank";
const MATHBANK_URL = process.env.DATABASE_URL;

if (!MATHBANK_URL) throw new Error("DATABASE_URL (MathBank) wajib diisi.");

const APPLY = process.argv.includes("--apply");

/**
 * Penanda sampah uji.
 *
 * ⚠️ Terbukti lewat dry-run: memeriksa `name` saja BOCOR — ada 18 baris dengan
 * nama bersih tapi slug ber-timestamp (mis. "Persamaan Kuadrat" /
 * `persamaan-kuadrat-1790643249730`), semuanya duplikat sampah. Jadi **nama DAN
 * slug** diperiksa.
 */
const TIMESTAMP_RE = /[0-9]{10,}/;
function isSampah(c: { name: string; slug: string }): boolean {
  return TIMESTAMP_RE.test(c.name) || TIMESTAMP_RE.test(c.slug);
}

interface QCategory {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

async function importTopicsFromQbank() {
  const qbank = postgres(QBANK_URL, { max: 2 });
  const mathbank = postgres(MATHBANK_URL!, { max: 2 });

  try {
    // ── 1. Ambil yang BERSIH saja (buang sampah timestamp) ──────────────
    const semua = await qbank<QCategory[]>`
      SELECT id, name, slug, parent_id, description, sort_order, is_active
      FROM categories
      ORDER BY sort_order, name`;
    const bersih = semua.filter((c) => !isSampah(c));
    const sampah = semua.length - bersih.length;

    console.log(`QBank categories : ${semua.length}`);
    console.log(`  sampah uji     : ${sampah} (dibuang — nama ber-timestamp)`);
    console.log(`  bersih         : ${bersih.length}`);

    // ── 2. Hitung level dari kedalaman hierarki ────────────────────────
    const byId = new Map(bersih.map((c) => [c.id, c]));
    /** Kedalaman: akar = 1. Induk sampah/tak ada → dianggap akar. */
    function levelOf(c: QCategory): number {
      let lvl = 1;
      let cur = c.parent_id;
      let guard = 0;
      while (cur && guard++ < 10) {
        const p = byId.get(cur);
        if (!p) break; // induknya sampah / di luar himpunan bersih → jadikan akar
        lvl += 1;
        cur = p.parent_id;
      }
      return Math.min(lvl, 3); // MathBank: CHECK level 1..3
    }
    for (const c of bersih) Object.assign(c, { _level: levelOf(c) });

    // Urutkan: level 1 dulu, agar induk selalu ada sebelum anak.
    const urut = [...bersih].sort((a, b) => {
      const la = (a as unknown as { _level: number })._level;
      const lb = (b as unknown as { _level: number })._level;
      return la - lb || a.sort_order - b.sort_order;
    });

    const perLevel = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    for (const c of urut) {
      const l = (c as unknown as { _level: number })._level;
      perLevel[l] = (perLevel[l] ?? 0) + 1;
    }
    console.log(`  level 1/2/3    : ${perLevel[1]}/${perLevel[2]}/${perLevel[3]}`);

    if (!APPLY) {
      console.log("\n[dry-run] Tak ada yang ditulis. Jalankan dengan --apply.");
      console.log("Contoh 6 akar pertama:");
      for (const c of urut.filter(
        (x) => (x as unknown as { _level: number })._level === 1,
      ).slice(0, 6)) {
        console.log(`  • ${c.name}  (${c.slug})`);
      }
      return;
    }

    // ── 3. Tulis ke MathBank (transaksi) ───────────────────────────────
    const [existing] = await mathbank<{ n: number }[]>`
      SELECT count(*)::int AS n FROM topics`;
    if (existing.n > 0) {
      throw new Error(
        `MathBank.topics tidak kosong (${existing.n} baris). ` +
          `Kosongkan dulu — impor ini dirancang untuk sekali jalan.`,
      );
    }

    let written = 0;
    await mathbank.begin(async (tx) => {
      /** qbank category id → mathbank topic id */
      const idMap = new Map<string, string>();
      for (const c of urut) {
        const lvl = (c as unknown as { _level: number })._level;
        // Induk: hanya bila induknya IKUT impor (bukan sampah).
        const parentId = c.parent_id ? (idMap.get(c.parent_id) ?? null) : null;
        const [row] = await tx<{ id: string }[]>`
          INSERT INTO topics
            (name, parent_id, level, description, sort_order, is_active)
          VALUES
            (${c.name}, ${parentId}, ${lvl},
             ${c.description}, ${c.sort_order}, ${c.is_active})
          RETURNING id`;
        idMap.set(c.id, row!.id);
        written += 1;
      }
    });

    const [after] = await mathbank<{ n: number }[]>`
      SELECT count(*)::int AS n FROM topics`;
    console.log(`\n✓ Selesai. Ditulis: ${written} topik (total di DB: ${after.n}).`);
  } finally {
    await qbank.end();
    await mathbank.end();
  }
}

importTopicsFromQbank().catch((e) => {
  console.error("Impor gagal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
