/**
 * Diagnosa: kenapa gambar tidak tersambung ke soal?
 * Membandingkan apa yang dideteksi vs apa yang tersimpan.
 */
import { readFile } from "node:fs/promises";
import { config } from "dotenv";

config({ path: ".env" });

async function main() {
  const file = process.argv[2] ?? "/tmp/corpus/mathcyber.html";
  const source = process.argv[3] ?? "mathcyber";

  const html = await readFile(file, "utf8");
  const { HTML_ADAPTERS } = await import("../../src/lib/ingest/parsers/adapters");
  const { collectUrls, applyMedia } = await import("../../src/lib/ingest/media/ingest-media");

  const res = HTML_ADAPTERS[source]!(html, { source });
  const teks: { text: string; role: "content" | "option" | "solution" }[] = [];
  for (const it of res.items) {
    teks.push({ text: it.stem, role: "content" });
    for (const o of it.options) teks.push({ text: o.text, role: "option" });
    if (it.explanation) teks.push({ text: it.explanation, role: "solution" });
  }

  const urls = new Map<string, string>();
  for (const t of teks) {
    for (const u of collectUrls(t.text, "https://example.test/x", t.role)) {
      urls.set(u.url, u.role);
    }
  }

  console.log(`1. URL gambar terdeteksi : ${urls.size}`);
  for (const [u, role] of urls) console.log(`   [${role}] ${u.split("/").pop()}`);

  // Simulasi: seandainya semua berhasil, apakah teks berubah?
  const cache = new Map(
    [...urls.keys()].map((u, i) => [
      u,
      { ok: true, shortId: `TEST${String(i).padStart(4, "0")}`, shortcode: `{{img:TEST${String(i).padStart(4, "0")}}}` },
    ]),
  ) as never;

  let berubah = 0;
  let sisa = 0;
  for (const t of teks) {
    const hasil = applyMedia(t.text, cache);
    if (hasil !== t.text) berubah++;
    if (hasil.includes("![")) sisa++;
  }
  console.log(`\n2. Teks yang berubah    : ${berubah}/${teks.length}`);
  console.log(`3. Teks sisa '!['       : ${sisa}`);
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exit(1);
});
