/**
 * Seed events — katalog ujian nyata (UTBK/OSN/SIMAK/UM/UAS).
 *
 * Melewati service resmi (bukan SQL langsung) supaya otorisasi `assertCan`
 * & pembentukan `code`/`fullname` ikut teruji.
 *
 * Jalankan: pnpm tsx --env-file=.env scripts/seed-events.ts
 * (impor dinamis: `@/lib/db` membaca DATABASE_URL saat modul dimuat, jadi env
 *  harus siap sebelum impor).
 */
import type { Actor } from "../src/lib/auth/actor";

const ADMIN: Actor = {
  id: "seed-events",
  name: "Seed Events",
  roles: ["admin"],
  via: "system",
};

/** Katalog event — 'category' mengelompokkan jenis seleksi. */
const EVENTS = [
  {
    name: "UTBK-SNBT",
    shortname: "UTBK",
    category: "utbk",
    subtests: ["Penalaran Matematika", "Pengetahuan Kuantitatif"],
    aliases: ["SNBT", "UTBK", "Tes Potensi Skolastik", "TPS"],
  },
  {
    name: "OSN Matematika",
    shortname: "OSN",
    category: "osn",
    subtests: [],
    aliases: ["Olimpiade Sains Nasional", "OSK", "OSP", "OSN-K", "OSN-P"],
  },
  {
    name: "SIMAK UI",
    shortname: "SIMAK UI",
    category: "sbmptn",
    subtests: ["Matematika Dasar", "Matematika IPA"],
    aliases: ["Simak", "Seleksi Masuk UI"],
  },
  {
    name: "Ujian Mandiri PTN",
    shortname: "UM PTN",
    category: "sbmptn",
    subtests: [],
    aliases: ["UM", "SMMPTN", "Seleksi Mandiri"],
  },
  {
    name: "Ujian Sekolah",
    shortname: "US",
    category: "ujian_sekolah",
    subtests: [],
    aliases: ["UAS", "ASAJ", "PAT", "PAS"],
  },
];

async function main() {
  const { createEvent, listEvents } = await import("../src/lib/services/taxonomy-service");

  const before = await listEvents();
  console.log(`Events sebelum: ${before.length}`);

  for (const e of EVENTS) {
    try {
      const row = await createEvent(e, ADMIN);
      console.log(`  + ${row.name} (${row.shortname})`);
    } catch (err) {
      console.log(`  = ${e.name} — dilewati (${(err as Error).message})`);
    }
  }

  const after = await listEvents();
  console.log(`\nEvents sesudah: ${after.length}`);
  for (const e of after) {
    console.log(`  [${e.category}] ${e.name} — subtes: ${e.subtests.length}, alias: ${e.aliases.length}`);
  }
  process.exit(0);
}
main();
