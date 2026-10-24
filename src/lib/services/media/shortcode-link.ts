/**
 * Penautan media dari shortcode di dalam badan soal (L5) — pecahan `media-service.ts`.
 *
 * KENAPA modul ini ada (follow-up D-M1 / MAT-132):
 *   `question.media` dibaca dari tabel `question_media` (JOIN `media_assets`).
 *   Aset hanya punya `width`/`height` bila baris tautan itu ada; tanpa baris,
 *   renderer terpaksa memakai kotak cadangan 16:9 sehingga gambar non-16:9
 *   bergeser/ter-letterbox saat tinggi aslinya tiba.
 *
 *   Jalur ingest sudah menautkan gambar dengan peran yang benar (`content` /
 *   `option` / `solution`). Jalur TULIS lain (editor, REST API, MCP) hanya
 *   menyimpan markdown — `{{img:<shortId>}}` di dalam **pembahasan** karena itu
 *   tidak pernah punya baris `question_media`. Akibatnya detail soal tak bisa
 *   menganotasi ukuran aslinya.
 *
 *   Modul ini menutup celah itu secara mekanis: setelah baris soal ditulis,
 *   semua shortcode yang benar-benar tampil di badan soal (stem, opsi,
 *   pembahasan) ditautkan ke aset yang SUDAH terdaftar.
 *
 * INVARIAN:
 *  - Satu query `IN (…)` untuk aset (bukan lookup per-baris).
 *  - Idempotent: `onConflictDoNothing` pada UNIQUE (question, media, role, order).
 *  - Aditif saja: tidak pernah menghapus tautan (tautan unggahan manual tanpa
 *    shortcode di badan soal tidak boleh ikut terhapus).
 *  - Shortcode yang asetnya belum terdaftar diabaikan (bukan error) — ingest
 *    yang bertanggung jawab menyediakan berkasnya.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaAssets, questionMedia } from "@/lib/db/schema/media";
import { questions } from "@/lib/db/schema/question";
import { solutions } from "@/lib/db/schema/solution";
import { extractShortIds } from "@/lib/media/shortcode";
import type { MediaRole } from "./shared";

/** Tipe transaksi Drizzle — agar penautan ikut atomik dengan penulisan soal. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Satu potongan badan soal yang bisa memuat shortcode. */
export interface ShortcodeBody {
  /** Markdown badan (boleh null/kosong). */
  text: string | null | undefined;
  /** Peran gambar bila shortcode di potongan ini yang menang. */
  role: MediaRole;
}

/** Peran paling spesifik menang bila shortcode sama muncul di beberapa badan. */
const ROLE_RANK: Record<MediaRole, number> = {
  content: 0, // stem = paling menentukan konteks gambar
  option: 1,
  solution: 2,
  thumbnail: 3,
};

/**
 * Peta `shortId → peran` dari seluruh badan soal (murni, tanpa I/O).
 *
 * Urutan kunci = urutan kemunculan pertama, sehingga `orderIndex` stabil.
 */
export function collectShortcodeRoles(bodies: ShortcodeBody[]): Map<string, MediaRole> {
  const out = new Map<string, MediaRole>();
  for (const body of bodies) {
    if (!body.text) continue;
    for (const shortId of extractShortIds(body.text)) {
      const prev = out.get(shortId);
      if (!prev || ROLE_RANK[body.role] < ROLE_RANK[prev]) out.set(shortId, body.role);
    }
  }
  return out;
}

/** Batas elemen per query `IN (…)` — jaga parameter binding tetap wajar. */
const IN_CHUNK = 500;

/**
 * Tautkan aset terdaftar yang dirujuk shortcode ke `question_media`.
 *
 * @returns jumlah baris tautan baru (0 bila tak ada shortcode / aset belum terdaftar).
 */
export async function linkShortcodeMediaTx(
  tx: Tx,
  questionId: string,
  bodies: ShortcodeBody[],
): Promise<number> {
  const roles = collectShortcodeRoles(bodies);
  if (roles.size === 0) return 0;

  const shortIds = [...roles.keys()];
  const assets: { id: string; shortId: string }[] = [];
  for (let i = 0; i < shortIds.length; i += IN_CHUNK) {
    const chunk = shortIds.slice(i, i + IN_CHUNK);
    const rows = await tx
      .select({ id: mediaAssets.id, shortId: mediaAssets.shortId })
      .from(mediaAssets)
      .where(inArray(mediaAssets.shortId, chunk));
    assets.push(...rows);
  }
  if (assets.length === 0) return 0;

  // orderIndex per peran — mengikuti urutan kemunculan shortcode di badan soal.
  const perRoleCounter = new Map<MediaRole, number>();
  const values = assets.map((asset) => {
    const role = roles.get(asset.shortId)!;
    const orderIndex = perRoleCounter.get(role) ?? 0;
    perRoleCounter.set(role, orderIndex + 1);
    return { questionId, mediaId: asset.id, role, orderIndex };
  });

  const inserted = await tx
    .insert(questionMedia)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: questionMedia.id });

  return inserted.length;
}

/**
 * Sinkronkan tautan media soal dari SELURUH badan yang dirender halaman detail:
 * `content_markdown` (stem), `data_payload.options[].contentMarkdown`, dan
 * `answer_key.explanationMarkdown` + tabel `solutions`.
 *
 * Dipanggil DI DALAM transaksi tulis soal agar tautan tidak pernah setengah jadi.
 */
export async function syncQuestionShortcodeMediaTx(tx: Tx, questionId: string): Promise<number> {
  const [row] = await tx
    .select({
      contentMarkdown: questions.contentMarkdown,
      dataPayload: questions.dataPayload,
      answerKey: questions.answerKey,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!row) return 0;

  const payloadBodies = extractPayloadBodies(row.dataPayload);
  const answerKey = (row.answerKey ?? {}) as { explanationMarkdown?: unknown; explanation?: unknown };
  const explanation =
    typeof answerKey.explanationMarkdown === "string"
      ? answerKey.explanationMarkdown
      : typeof answerKey.explanation === "string"
        ? answerKey.explanation
        : undefined;

  const solutionRows = await tx
    .select({ contentMarkdown: solutions.contentMarkdown })
    .from(solutions)
    .where(eq(solutions.questionId, questionId));

  const bodies: ShortcodeBody[] = [
    { text: row.contentMarkdown, role: "content" },
    ...payloadBodies.map((text) => ({ text, role: "option" as const })),
    { text: explanation, role: "solution" },
    ...solutionRows.map((s) => ({ text: s.contentMarkdown, role: "solution" as const })),
  ];

  return linkShortcodeMediaTx(tx, questionId, bodies);
}

/**
 * Ambil markdown tiap opsi/baris dari `data_payload` (bentuk JSONB kanonik).
 * Mendukung:
 * - Opsi pilihan ganda (`dataPayload.options[].contentMarkdown`)
 * - Baris matriks (`dataPayload.rows[].text` / `.contentMarkdown` / `dataPayload.statements[].contentMarkdown`)
 * - Premis & respons matching (`dataPayload.premises[].contentMarkdown`, `dataPayload.responses[].contentMarkdown`)
 */
function extractPayloadBodies(dataPayload: unknown): string[] {
  if (!dataPayload || typeof dataPayload !== "object") return [];
  const p = dataPayload as Record<string, unknown>;
  const texts: string[] = [];

  // 1. Opsi standar pilihan ganda
  if (Array.isArray(p.options)) {
    for (const o of p.options) {
      const text = (o as { contentMarkdown?: unknown } | null)?.contentMarkdown;
      if (typeof text === "string" && text.length > 0) texts.push(text);
    }
  }

  // 2. Baris matriks (rows / statements)
  if (Array.isArray(p.rows)) {
    for (const r of p.rows) {
      const t = (r as { text?: unknown; contentMarkdown?: unknown } | null);
      if (typeof t?.text === "string" && t.text.length > 0) texts.push(t.text);
      if (typeof t?.contentMarkdown === "string" && t.contentMarkdown.length > 0) texts.push(t.contentMarkdown);
    }
  }
  if (Array.isArray(p.statements)) {
    for (const s of p.statements) {
      const t = (s as { contentMarkdown?: unknown } | null)?.contentMarkdown;
      if (typeof t === "string" && t.length > 0) texts.push(t);
    }
  }

  // 3. Matching (premis & respons)
  if (Array.isArray(p.premises)) {
    for (const pr of p.premises) {
      const t = (pr as { contentMarkdown?: unknown } | null)?.contentMarkdown;
      if (typeof t === "string" && t.length > 0) texts.push(t);
    }
  }
  if (Array.isArray(p.responses)) {
    for (const res of p.responses) {
      const t = (res as { contentMarkdown?: unknown } | null)?.contentMarkdown;
      if (typeof t === "string" && t.length > 0) texts.push(t);
    }
  }

  return texts;
}

/** Alias kompatibilitas mundur untuk extractPayloadBodies. */
export function extractOptionBodies(dataPayload: unknown): string[] {
  return extractPayloadBodies(dataPayload);
}

/** Re-export kecil agar pemanggil bisa memakai predikat yang sama tanpa impor ganda. */
export { extractShortIds };

/** Helper internal: dipakai tes untuk memastikan tautan per (question, media). */
export async function findLinkedMediaIds(questionId: string): Promise<string[]> {
  const rows = await db
    .select({ mediaId: questionMedia.mediaId })
    .from(questionMedia)
    .where(and(eq(questionMedia.questionId, questionId)));
  return rows.map((r) => r.mediaId);
}
