/**
 * Seeder taksonomi — baca curriculum.yaml (repo ini) → seed MathBank DB.
 * Jalankan: pnpm tsx scripts/seed-taxonomy.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

const CURRICULUM_PATH = resolve(
  process.env.CURRICULUM_YAML ?? "docs/archive/historis/curriculum.yaml",
);

interface Grade {
  id: string;
  label: string;
  level_group?: string;
  curriculum_phase?: string;
  order_index?: number;
  is_active?: boolean;
}
interface Difficulty {
  value: number;
  label: string;
  color_token?: string;
  time_guideline?: string;
  target_success_rate?: string;
  description?: string;
  order_index?: number;
  is_active?: boolean;
}
interface Cognitive {
  id: string;
  code: string;
  label: string;
  short_label?: string;
  bloom_equivalent?: string;
  color_token?: string;
  order_index?: number;
}
interface Curriculum {
  grades: Grade[];
  difficulties: Difficulty[];
  cognitive_levels: Cognitive[];
}

async function main() {
  const yaml = readFileSync(CURRICULUM_PATH, "utf8");
  const data = parse(yaml) as Curriculum;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diatur");
  const sql = postgres(url, { max: 1 });

  const EXCLUDED_GRADES = new Set(["utbk", "mandiri", "umum", "11w", "11l", "12w", "12l"]);
  const validGrades = data.grades.filter((g) => !EXCLUDED_GRADES.has(g.id));

  console.log(
    `Seed: ${validGrades.length} grades (filtered ${data.grades.length - validGrades.length} legacy), ${data.difficulties.length} difficulties, ${data.cognitive_levels.length} cognitive`,
  );

  for (const g of validGrades) {
    await sql`
      INSERT INTO grades (id, label, level_group, curriculum_phase, order_index, is_active)
      VALUES (${g.id}, ${g.label}, ${g.level_group ?? null}, ${g.curriculum_phase ?? null},
              ${g.order_index ?? 0}, ${g.is_active ?? true})
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label, level_group = EXCLUDED.level_group,
        curriculum_phase = EXCLUDED.curriculum_phase, order_index = EXCLUDED.order_index,
        is_active = EXCLUDED.is_active, updated_at = now()`;
  }

  for (const d of data.difficulties) {
    await sql`
      INSERT INTO difficulty_levels (value, label, color_token, time_guideline, target_success_rate, description, order_index, is_active)
      VALUES (${d.value}, ${d.label}, ${d.color_token ?? null}, ${d.time_guideline ?? null},
              ${d.target_success_rate ?? null}, ${d.description ?? null}, ${d.order_index ?? 0}, ${d.is_active ?? true})
      ON CONFLICT (value) DO UPDATE SET
        label = EXCLUDED.label, color_token = EXCLUDED.color_token,
        time_guideline = EXCLUDED.time_guideline, target_success_rate = EXCLUDED.target_success_rate,
        description = EXCLUDED.description, order_index = EXCLUDED.order_index,
        is_active = EXCLUDED.is_active, updated_at = now()`;
  }

  for (const c of data.cognitive_levels) {
    await sql`
      INSERT INTO cognitive_levels (id, code, label, short_label, bloom_equivalent, color_token, order_index)
      VALUES (${c.id}, ${c.code}, ${c.label}, ${c.short_label ?? null},
              ${c.bloom_equivalent ?? null}, ${c.color_token ?? null}, ${c.order_index ?? 0})
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code, label = EXCLUDED.label, short_label = EXCLUDED.short_label,
        bloom_equivalent = EXCLUDED.bloom_equivalent, color_token = EXCLUDED.color_token,
        order_index = EXCLUDED.order_index, updated_at = now()`;
  }

  const [{ g }] = await sql<[{ g: number }]>`SELECT count(*)::int AS g FROM grades`;
  const [{ d }] = await sql<[{ d: number }]>`SELECT count(*)::int AS d FROM difficulty_levels`;
  const [{ c }] = await sql<[{ c: number }]>`SELECT count(*)::int AS c FROM cognitive_levels`;
  console.log(`Selesai: grades=${g}, difficulties=${d}, cognitive=${c}`);

  await sql.end();
}

main().catch((e) => {
  console.error("Seed gagal:", e);
  process.exit(1);
});
