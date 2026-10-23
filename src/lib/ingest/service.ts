/**
 * Orkestrasi ingest (M9-3) — menyambungkan antrean → segmentasi → media → commit.
 *
 * Alur satu artikel:
 *   queue item (pending)
 *     → segmentArticle / segmentJson   (parsers)
 *     → ingestArticleMedia             (unduh gambar → URL lokal)
 *     → applyMedia ke stem/opsi/pembahasan
 *     → commitItems                    (soal draft)
 *     → markDone(done | failed | skipped)
 *
 * Aturan: **gagal gambar tak memblokir**; artikel tanpa soal → `skipped`.
 */
import type { Actor } from "@/lib/auth/actor";
import { segmentArticle, segmentJson } from "./parsers/segment";
import { ingestArticleMedia, applyMedia, type MediaCache } from "./media/ingest-media";
import { commitItems, type CommitFailure } from "./commit";
import { markDone, markProcessing, toMediaManifest } from "./queue";
import { registerMediaAsset } from "@/lib/services/media-service";
import type { IngestQueueItem } from "@/lib/db/schema/system";
import type { ParsedItem } from "./parsers/types";

/** Ringkasan proses satu artikel. */
export interface ProcessResult {
  id: string;
  status: "completed" | "failed" | "skipped";
  /** Bundle tujuan (untuk resolve event otomatis setelah commit). */
  bundleId?: string;
  created: number;
  /** Soal identik (konten sama) yang cukup ditambahkan ke bundle. */
  linked: number;
  skipped: number;
  /**
   * Butir yang DITOLAK gerbang Zod (MAT-147) — mis. opsi < 2 atau frasa
   * terlarang. Dihitung terpisah dari `failed` (galat DB).
   */
  rejected: number;
  /** Soal yang GAGAL dibuat di `commitItems` (mis. ditolak DB) — jangan hilang senyap. */
  failed: number;
  /** Jumlah soal tersimpan (created + linked). */
  storedCount: number;
  /** Jumlah butir yang gagal/ditolak (failed + rejected). */
  failedCount: number;
  /** Rincian kegagalan per-indeks (Pilar 2). */
  failures: CommitFailure[];
  mediaOk: number;
  mediaFailed: number;
  error?: string;
}

/** Opsi pemrosesan. */
export interface ProcessOptions {
  actor: Actor;
  /** Root penyimpanan media (MEDIA_STORAGE_PATH). */
  mediaRoot: string;
  /** Cache media lintas-artikel (agar gambar sama tak diunduh ulang). */
  mediaCache?: MediaCache;
  /** Jeda antar-unduhan gambar (ms) — hormati sumber. */
  mediaDelayMs?: number;
  grade?: string | null;
}

/** Terapkan URL lokal ke seluruh bagian soal (stem, opsi, pembahasan, rows matrix_grid). */
function applyMediaToItems(items: ParsedItem[], cache: MediaCache): ParsedItem[] {
  return items.map((it) => {
    const base = {
      ...it,
      stem: applyMedia(it.stem, cache),
      options: it.options.map((o) => ({ ...o, text: applyMedia(o.text, cache) })),
      ...(it.explanation ? { explanation: applyMedia(it.explanation, cache) } : {}),
    };
    // `matrix_grid` menyimpan pernyataan di `dataPayload.rows[].text` — gambar di
    // sana juga harus diproses (temuan: pernyataan BS bisa berupa gambar).
    if (it.dataPayload && Array.isArray((it.dataPayload as { rows?: unknown }).rows)) {
      const dp = it.dataPayload as { rows: { text?: string }[] };
      base.dataPayload = {
        ...dp,
        rows: dp.rows.map((r) =>
          r && typeof r.text === "string" ? { ...r, text: applyMedia(r.text, cache) } : r,
        ),
      };
    }
    return base;
  });
}

/** Kumpulkan teks ber-gambar dari item (untuk orkestrasi media). */
function mediaTexts(items: ParsedItem[]) {
  const texts: { text: string; role: "content" | "option" | "solution" }[] = [];
  for (const it of items) {
    texts.push({ text: it.stem, role: "content" });
    for (const o of it.options) texts.push({ text: o.text, role: "option" });
    if (it.explanation) texts.push({ text: it.explanation, role: "solution" });
    // Pernyataan `matrix_grid` juga bisa memuat gambar.
    if (it.dataPayload && Array.isArray((it.dataPayload as { rows?: unknown }).rows)) {
      const dp = it.dataPayload as { rows: { text?: string }[] };
      for (const r of dp.rows) {
        if (r && typeof r.text === "string" && r.text) {
          texts.push({ text: r.text, role: "content" });
        }
      }
    }
  }
  return texts;
}

/**
 * Proses satu baris antrean → soal draft. Menangani status antrean sendiri
 * (markProcessing → markDone).
 */
export async function processQueueItem(item: IngestQueueItem, opts: ProcessOptions): Promise<ProcessResult> {
  // Guard balapan: hanya lanjut bila berhasil menandai `processing`.
  const ok = await markProcessing(item.id);
  if (!ok) {
    return {
      id: item.id,
      status: "skipped",
      created: 0,
      linked: 0,
      skipped: 0,
      rejected: 0,
      failed: 0,
      storedCount: 0,
      failedCount: 0,
      failures: [],
      mediaOk: 0,
      mediaFailed: 0,
      error: "sudah diproses",
    };
  }

  const meta = { source: item.sourceOrigin, url: item.sourceUrl ?? undefined, title: item.title };

  try {
    // 1. Segmentasi. Sumber JSON diproses terpisah.
    const seg =
      item.rawFormat === "json"
        ? segmentJson(parseJson(item.rawContent), meta)
        : segmentArticle(item.rawContent, meta);

    if (seg.items.length === 0) {
      await markDone(item.id, "skipped", {
        errorMessage: seg.warnings.join("; ") || "Tak ada soal terdeteksi",
        aiNotes: seg.warnings.join("; ") || "Artikel tanpa soal (dilewati)",
        importedQuestionsCount: 0,
      });
      return {
        id: item.id,
        status: "skipped",
        created: 0,
        linked: 0,
        skipped: 0,
        rejected: 0,
        failed: 0,
        storedCount: 0,
        failedCount: 0,
        failures: [],
        mediaOk: 0,
        mediaFailed: 0,
      };
    }

    // 2. Unduh gambar + DAFTARKAN ke media_assets (gagal tak memblokir).
    //    Pendaftaran prasyarat: markdown memakai `{{img:<shortId>}}`, dan
    //    short_id lahir dari pendaftaran. Registrasi disuntikkan dari sini
    //    (L5) agar lapisan media tetap murni (CONSTRAINTS #15).
    const cache = await ingestArticleMedia(mediaTexts(seg.items), {
      rootDir: opts.mediaRoot,
      articleUrl: item.sourceUrl ?? undefined,
      ...(opts.mediaCache ? { cache: opts.mediaCache } : {}),
      delayMs: opts.mediaDelayMs ?? 0,
      register: async (m) => {
        const asset = await registerMediaAsset({
          ...m,
          sourceOrigin: "web_ingest",
        });
        return { shortId: asset.shortId };
      },
    });
    let mediaOk = 0;
    let mediaFailed = 0;
    for (const o of cache.values()) {
      if (o.ok) mediaOk++;
      else mediaFailed++;
    }

    // 3. Terapkan URL lokal + commit → soal draft.
    const items = applyMediaToItems(seg.items, cache);
    const commit = await commitItems(items, opts.actor, {
      sourceOrigin: item.sourceOrigin,
      sourceUrl: item.sourceUrl,
      articleTitle: item.title,
      accessedAt: item.processedAt ?? item.createdAt ?? null,
      grade: opts.grade ?? item.targetGrade ?? null,
      topicId: item.targetTopicId ?? null,
    });

    await markDone(item.id, "completed", {
      mediaManifest: toMediaManifest([...cache.values()]),
      importedQuestionsCount: commit.created + commit.linked,
      aiNotes:
        `${commit.created} soal dibuat, ${commit.linked} soal identik (sumber ditambah), ` +
        `${commit.skipped} dilewati` +
        (commit.rejected ? `, ${commit.rejected} ditolak validasi Zod/KaTeX` : "") +
        (mediaFailed ? `, ${mediaFailed} gambar gagal` : ""),
    });
    return {
      id: item.id,
      status: "completed",
      bundleId: commit.bundleId,
      created: commit.created,
      linked: commit.linked,
      skipped: commit.skipped,
      rejected: commit.rejected,
      failed: commit.failed,
      storedCount: commit.storedCount,
      failedCount: commit.failedCount,
      failures: commit.failures,
      mediaOk,
      mediaFailed,
      ...(commit.errors.length ? { error: commit.errors.slice(0, 3).join("; ") } : {}),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markDone(item.id, "failed", { errorMessage: msg.slice(0, 1000) });
    return {
      id: item.id,
      status: "failed",
      created: 0,
      linked: 0,
      skipped: 0,
      rejected: 0,
      failed: 0,
      storedCount: 0,
      failedCount: 1,
      failures: [{ index: 0, stemPreview: "", reason: msg }],
      mediaOk: 0,
      mediaFailed: 0,
      error: msg,
    };
  }
}

/** Parse JSON aman; kembalikan `null` bila rusak. */
function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
