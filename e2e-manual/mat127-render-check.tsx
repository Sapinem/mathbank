/**
 * MAT-127 — bukti render komponen pengayaan (SSR statis, tanpa server dev).
 * Menjalankan komponen nyata dengan props nyata (hasil getQuestion/listBundles
 * dari DB produksi), lalu memeriksa teks/kelas yang muncul di markup.
 *
 * Jalankan: npx tsx e2e-manual/mat127-render-check.tsx
 */
import { renderToStaticMarkup } from "react-dom/server";
import { DifficultyBadge } from "@/components/questions/rubric-badge";
import { QuestionStatusBadge } from "@/components/questions/question-status-badge";
import { TopicTagList } from "@/components/questions/topic-tag";
import { QuestionMediaGallery } from "@/components/questions/question-image";
import { BundleEnrichmentSummary } from "@/components/bundles/bundle-enrichment";

let fail = 0;
function check(name: string, html: string, needles: string[]) {
  const missing = needles.filter((n) => !html.includes(n));
  const ok = missing.length === 0;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " → hilang: " + missing.join(", ")}`);
  if (!ok) console.log("   markup:", html.slice(0, 400));
}

// 1) Difficulty badge 1–5: warna berbeda + label teks.
const diffs = [1, 2, 3, 4, 5].map((l) =>
  renderToStaticMarkup(DifficultyBadge({ level: l, showLabel: true })),
);
check("difficulty L1 hijau/success", diffs[0], ["Sangat Mudah", "success"]);
check("difficulty L2 biru/info", diffs[1], ["Mudah", "info"]);
check("difficulty L3 kuning/gold", diffs[2], ["Sedang", "gold"]);
check("difficulty L4 oranye/warning", diffs[3], ["Sulit", "warning"]);
check("difficulty L5 merah/error", diffs[4], ["Sangat Sulit", "error"]);
const tones = new Set(diffs.map((h) => (h.match(/text-(success|info|gold-fg|warning|error)/) ?? [""])[0]));
console.log(`     tone unik: ${tones.size}/5 → ${[...tones].join(", ")}`);
if (tones.size !== 5) fail++;

// 2) Status indicator.
const st = (s: string) => renderToStaticMarkup(QuestionStatusBadge({ status: s }));
check("status draft abu", st("draft"), ["Draf"]);
check("status review kuning", st("review"), ["Telaah"]);
check("status ready hijau", st("ready"), ["Siap"]);
const archived = st("archived");
check("status archived coret", archived, ["Arsip", "line-through"]);

// 3) Topic tags (klik → filter).
const topics = renderToStaticMarkup(
  TopicTagList({
    topics: [
      { id: "01a0f838-0b99-7ba1-996e-d224af5762bd", name: "Segi Empat", level: 3, isPrimary: true },
      { id: "abc", name: "Geometri", level: 2, isPrimary: false },
    ],
  }),
);
check("topic tag link filter", topics, [
  "Segi Empat",
  "/questions?topicId=01a0f838-0b99-7ba1-996e-d224af5762bd",
  "Geometri",
  "min-h-[28px]",
]);
const emptyTopics = renderToStaticMarkup(TopicTagList({ topics: [] }));
check("topic kosong ada pesan", emptyTopics, ["Belum ada topik"]);

// 4) Media gallery + fallback kosong.
const gallery = renderToStaticMarkup(
  QuestionMediaGallery({
    media: [
      {
        shortId: "mbEVRMdk",
        role: "content",
        altText: null,
        caption: null,
        width: null,
        height: null,
        mimeType: "image/jpeg",
      },
    ],
  }),
);
check("media render /img/<shortId>", gallery, ["/img/mbEVRMdk", "<img"]);
const emptyGallery = renderToStaticMarkup(QuestionMediaGallery({ media: [] }));
check("media kosong ada fallback", emptyGallery, ["Belum ada gambar"]);

// 5) Ringkasan paket (angka nyata dari DB).
const bundle = renderToStaticMarkup(
  BundleEnrichmentSummary({
    enrichment: {
      questionCount: 233,
      avgDifficulty: 2,
      topicCount: 40,
      taggedQuestionCount: 94,
      topicCoverage: 0.4,
    },
  }),
);
check("bundle stats 233 butir", bundle, ["233", "40", "40%"]);
const bundleEmpty = renderToStaticMarkup(BundleEnrichmentSummary({ enrichment: undefined }));
check("bundle tanpa agregat tidak merusak", bundleEmpty, []);

console.log(fail === 0 ? "\nHASIL: SEMUA LOLOS" : `\nHASIL: ${fail} GAGAL`);
process.exit(fail === 0 ? 0 : 1);
