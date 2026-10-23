/**
 * Commit hasil segmentasi → soal draft (M9-3).
 *
 * Aturan (keputusan user 2026-09-30):
 *   - **SEMUA hasil = `draft`** (walau kunci jelas).
 *   - **Jangan menebak kunci** — kunci kosong + flag lebih baik.
 *   - `sourceId` di-resolve dari `sourceOrigin` (dibuat bila belum ada, kind=website).
 *   - Idempoten (ADR-0012): soal dengan **konten sama** (`contentHash` stem+opsi,
 *     LINTAS-SUMBER) TIDAK dibuat ulang — cukup tambahkan provenance `question_sources`.
 *
 * Menggunakan `createQuestion` (L5) agar seluruh invarian & audit tetap berlaku.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema/source";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { questions } from "@/lib/db/schema/question";
import { ingestQueue } from "@/lib/db/schema/system";
import { createQuestion } from "@/lib/services/question-service";
import { slugify } from "@/lib/taxonomy/tree";
import { ConflictError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import type { AnswerKey } from "@/lib/contracts/question";
import { answerKeySchema, questionDataPayloadSchema } from "@/lib/validations/question-payload";
import { validateKatexContract } from "@/lib/ai/enrich";
import { contentHash, itemHash } from "./hash";
import { buildQuestionPayload, type BuiltQuestionPayload } from "./parsers/types";
import type { ParsedItem } from "./parsers/types";

/** Rincian butir yang gagal/ditolak saat commit (Pilar 2 v2.0). */
export interface CommitFailure {
  index: number;
  stemPreview: string; // 80 char pertama soal
  reason: string;      // pesan error spesifik
}

/** Hasil commit satu artikel. */
export interface CommitResult {
  /** Bundle tempat soal-soal ini dimasukkan (untuk resolve event, dll.). */
  bundleId: string;
  created: number;
  /** Soal identik (konten sama, exact) → provenance ditambahkan, soal TIDAK dibuat ulang. */
  linked: number;
  skipped: number;
  /**
   * Butir yang **ditolak gerbang Zod / KaTeX** (MAT-147 / Pilar 2) — mis. opsi < 2, frasa
   * terlarang ("semua jawaban benar"), atau rumus KaTeX rusak.
   *
   * Dihitung terpisah dari `failed` (galat DB) supaya operator tahu mana yang
   * perlu diperbaiki di parser/sumber dan mana yang murni galat teknis.
   */
  rejected: number;
  failed: number;
  /** Jumlah soal tersimpan (created + linked). */
  storedCount: number;
  /** Jumlah butir yang gagal/ditolak (rejected + failed). */
  failedCount: number;
  /** Daftar kegagalan terstruktur per-indeks (Pilar 2). */
  failures: CommitFailure[];
  questionIds: string[];
  /** Pesan galat DB **dan** alasan penolakan validasi (berprefiks `#<ref>`). */
  errors: string[];
}

/** Opsi commit. */
export interface CommitOptions {
  /** Sumber (nama, mis. "mathcyber") → di-resolve/buat ke tabel `sources`. */
  sourceOrigin: string;
  sourceUrl?: string | null;
  /** Judul artikel (provenance butir, ADR-0012) — dari antrean ingest. */
  articleTitle?: string | null;
  /** Waktu akses/pengambilan artikel (provenance butir). */
  accessedAt?: Date | null;
  /** Grade wajib; default "umum" bila kosong. */
  grade?: string | null;
  topicId?: string | null;
}

/** Kelas default & peta tipe → difficulty/cognitive (dapat ditelaah nanti). */
const DEFAULT_DIFFICULTY = 3;
const DEFAULT_COGNITIVE = "understand" as const;

/**
 * Resolve `sourceId` untuk `sourceOrigin` (kind=website). Buat bila belum ada.
 * Tak memakai `createSource` karena butuh izin `reference:manage` (mesin tak punya)
 * — di sini cukup idempoten & aman untuk pipeline.
 */
export async function resolveSourceId(sourceOrigin: string, sourceUrl?: string | null): Promise<string> {
  const slug = slugify(sourceOrigin, 255);
  const [existing] = await db.select({ id: sources.id }).from(sources).where(eq(sources.slug, slug)).limit(1);
  if (existing) return existing.id;

  try {
    const [row] = await db
      .insert(sources)
      .values({ kind: "website", label: sourceOrigin, slug, url: sourceUrl ?? null })
      .returning({ id: sources.id });
    return row!.id;
  } catch {
    // Balapan: baris dibuat proses lain → ambil ulang.
    const [again] = await db.select({ id: sources.id }).from(sources).where(eq(sources.slug, slug)).limit(1);
    if (again) return again.id;
    throw new ConflictError("Gagal membuat/mengambil sumber ingest.");
  }
}

/**
 * Himpunan hash soal lama (`itemHash`, source+stem) — DIPERTAHANKAN untuk
 * kompatibilitas tes lama. ⚠️ Bukan lagi dasar dedup (lihat `contentHash`).
 */
export async function existingItemHashes(sourceId: string): Promise<Set<string>> {
  // ADR-0014: `questions.source_id` dibuang — asal soal dilacak lewat bundle.
  const rows = await db
    .select({ c: questions.contentMarkdown })
    .from(questions)
    .innerJoin(bundleItems, eq(bundleItems.questionId, questions.id))
    .innerJoin(bundles, eq(bundles.id, bundleItems.bundleId))
    .where(eq(bundles.sourceId, sourceId));
  const set = new Set<string>();
  for (const r of rows) set.add(itemHash(sourceId, r.c));
  return set;
}

/**
 * Cari soal dengan `content_hash` sama (dedup lintas-sumber, ADR-0012).
 *
 * Dulu tinggal di `question-source-service`; berkas itu dihapus oleh ADR-0014,
 * jadi fungsi ini pindah ke sini — dedup tetap berlaku, kini diwujudkan lewat
 * keanggotaan bundle alih-alih baris provenance.
 */
export async function findQuestionByContentHash(
  hash: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.contentHash, hash), isNull(questions.deletedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Cari/buat bundle untuk satu naskah (ADR-0014 #7).
 *
 * Kunci idempotensi: (sourceId, url) — satu artikel = satu bundle. Bila URL
 * kosong, jatuh ke (sourceId, title) supaya naskah tanpa URL tetap satu bundle.
 */
export async function resolveBundleId(input: {
  sourceId: string;
  title: string;
  url: string | null;
  grade: string;
}): Promise<string> {
  const where = input.url
    ? and(eq(bundles.sourceId, input.sourceId), eq(bundles.url, input.url))
    : and(eq(bundles.sourceId, input.sourceId), eq(bundles.title, input.title));

  const [existing] = await db
    .select({ id: bundles.id })
    .from(bundles)
    .where(and(where, isNull(bundles.deletedAt)))
    .limit(1);
  if (existing) return existing.id;

  const [row] = await db
    .insert(bundles)
    .values({
      title: input.title.slice(0, 255),
      // Slug wajib unik antar-bundle aktif (uq_bundles_slug_active). Judul
      // artikel bisa sama antar-naskah, jadi tambahkan penanda unik dari
      // URL-nya (atau judulnya bila tanpa URL) — bukan dari sourceId, karena
      // satu sumber bisa punya banyak artikel berjudul sama.
      slug: slugify(`${input.title}-${itemHash(input.url ?? input.title, "")}`, 255),
      bundleType: "source", // naskah dari sumber — bukan ujian (exam)
      origin: "ingest",     // ADR-0014: pipeline ingest, bukan input manual
      sourceId: input.sourceId,
      url: input.url,
      grade: input.grade,
      status: "draft",
    })
    .returning({ id: bundles.id });
  return row!.id;
}

/**
 * Masukkan soal ke bundle (ADR-0014: pengganti provenance per-butir).
 *
 * Idempoten — `bundle_items` punya UNIQUE (bundle_id, question_id), jadi
 * ingest ulang artikel yang sama tak menggandakan keanggotaan.
 */
export async function linkQuestionToBundle(
  bundleId: string,
  questionId: string,
  itemNumber?: string | null,
): Promise<void> {
  const [last] = await db
    .select({ max: sql<number>`COALESCE(MAX(${bundleItems.orderIndex}), 0)` })
    .from(bundleItems)
    .where(eq(bundleItems.bundleId, bundleId));

  await db
    .insert(bundleItems)
    .values({
      bundleId,
      questionId,
      orderIndex: Number(last?.max ?? 0) + 1,
      itemNumber: itemNumber ?? null,
    })
    .onConflictDoNothing();
}

/**
 * Hasil gerbang validasi satu butir: payload kanonik yang lolos skema, atau
 * alasan penolakan yang bisa dibaca operator.
 */
type PayloadGate =
  | { ok: true; dataPayload: Record<string, unknown>; answerKey: AnswerKey }
  | { ok: false; message: string };

/**
 * Rangkum `ZodError.issues` jadi satu baris pendek (maks 4 issue).
 *
 * `path` di Zod 4 bertipe `PropertyKey[]` (bisa memuat `symbol`), bukan
 * `(string | number)[]` — karena itu tiap segmen di-`String()` lebih dulu
 * (MAT-159).
 */
function formatIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .slice(0, 4)
    .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

/**
 * Gerbang Zod wajib sebelum `createQuestion` (MAT-147).
 *
 * Dua skema dari `src/lib/validations/question-payload.ts` dipanggil di sini —
 * bukan di service — supaya butir korpus yang melanggar kontrak ditolak
 * **sebelum** menyentuh DB, dengan pesan validasi yang bisa dilacak ke butir
 * asalnya (`#<ref.index>`), bukan meledak sebagai galat 500.
 *
 * Pengecualian yang disengaja:
 *   - **Kontainer stimulus/wacana** (`data_payload` tanpa `type`): tak punya
 *     kunci jawaban sendiri, jadi `answer_key` kosong dan tak divalidasi.
 */
function gatePayload(built: BuiltQuestionPayload): PayloadGate {
  if (typeof built.dataPayload.type === "string") {
    const data = questionDataPayloadSchema.safeParse(built.dataPayload);
    if (!data.success) {
      return { ok: false, message: `data_payload ditolak skema: ${formatIssues(data.error)}` };
    }
  }

  if (Object.keys(built.answerKey).length > 0) {
    const key = answerKeySchema.safeParse(built.answerKey);
    if (!key.success) {
      return { ok: false, message: `answer_key ditolak skema: ${formatIssues(key.error)}` };
    }
  }

  return {
    ok: true,
    dataPayload: built.dataPayload,
    answerKey: built.answerKey as AnswerKey,
  };
}

/**
 * Validasi per-butir sebelum menyentuh DB (Pilar 2 v2.0).
 * Memeriksa stem tidak kosong dan sintaks KaTeX berpasangan (CONSTRAINT #29).
 * Melempar Error bila cacat.
 */
export function validateParsedItem(item: ParsedItem): void {
  if (!item.stem || !item.stem.trim()) {
    throw new Error("Stem/teks soal tidak boleh kosong");
  }

  const stemCheck = validateKatexContract(item.stem);
  if (!stemCheck.ok) {
    const issues = stemCheck.issues.map((i) => i.message).join("; ");
    throw new Error(`Validasi KaTeX gagal pada stem: ${issues}`);
  }

  for (const opt of item.options ?? []) {
    if (opt.text) {
      const optCheck = validateKatexContract(opt.text);
      if (!optCheck.ok) {
        const issues = optCheck.issues.map((i) => i.message).join("; ");
        throw new Error(`Validasi KaTeX gagal pada opsi ${opt.label || ""}: ${issues}`);
      }
    }
  }

  if (item.explanation) {
    const expCheck = validateKatexContract(item.explanation);
    if (!expCheck.ok) {
      const issues = expCheck.issues.map((i) => i.message).join("; ");
      throw new Error(`Validasi KaTeX gagal pada pembahasan: ${issues}`);
    }
  }

  if (item.dataPayload && typeof item.dataPayload === "object") {
    const dp = item.dataPayload as Record<string, unknown>;
    const rows = Array.isArray(dp.rows) ? dp.rows : Array.isArray(dp.statements) ? dp.statements : [];
    for (const r of rows) {
      const text = typeof r?.text === "string" ? r.text : typeof r?.contentMarkdown === "string" ? r.contentMarkdown : "";
      if (text) {
        const rowCheck = validateKatexContract(text);
        if (!rowCheck.ok) {
          const issues = rowCheck.issues.map((i) => i.message).join("; ");
          throw new Error(`Validasi KaTeX gagal pada baris pernyataan: ${issues}`);
        }
      }
    }
  }
}

/**
 * Commit daftar `ParsedItem` (dari satu artikel) → soal draft.
 *
 * Dedup berbasis `contentHash(stem, opsi)` **tanpa sumber** (ADR-0012):
 *   - soal ada (konten sama) → **tambahkan provenance**, jangan buat soal baru;
 *   - soal baru → buat soal + provenance.
 *
 * Sejak MAT-147 seluruh isi soal (opsi + kunci) dibentuk **atomik** ke
 * `data_payload` / `answer_key` lalu divalidasi Zod — satu INSERT ke `questions`
 * sudah membawa soal, opsi, dan kunci. Tak ada lagi jalur `question_options`.
 */
export async function commitItems(
  items: ParsedItem[],
  actor: Actor,
  opts: CommitOptions,
): Promise<CommitResult> {
  const sourceId = await resolveSourceId(opts.sourceOrigin, opts.sourceUrl);
  const grade = (opts.grade && opts.grade.trim()) || "umum";

  // ADR-0014 #7: ingest WAJIB membuat bundle — tak ada soal "nyasar" tanpa naskah.
  // Bundle = naskah/artikel utuh dari satu sumber; URL artikel hidup di sini
  // (`sources.url` = situsnya, `bundles.url` = artikelnya).
  const bundleId = await resolveBundleId({
    sourceId,
    title: opts.articleTitle ?? opts.sourceOrigin,
    url: opts.sourceUrl ?? null,
    grade,
  });

  const result: CommitResult = {
    bundleId,
    created: 0,
    linked: 0,
    skipped: 0,
    rejected: 0,
    failed: 0,
    storedCount: 0,
    failedCount: 0,
    failures: [],
    questionIds: [],
    errors: [],
  };

  // Peta `ref.index` → id soal yang baru dibuat (untuk menyambung anak
  // wacana/stimulus ke induknya lewat `parentRefIndex`).
  const idByRefIndex = new Map<number, string>();

  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const itemIndex = it.ref?.index !== undefined ? it.ref.index : i;

    // Aturan mutu: stem kosong → lewati (jangan simpan sampah).
    if (!it.stem || it.stem.trim().length === 0) {
      result.skipped++;
      continue;
    }

    // Validasi per-butir (KaTeX & format dasar) sebelum menyentuh DB (Pilar 2).
    try {
      validateParsedItem(it);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.rejected++;
      result.failedCount++;
      result.errors.push(`#${itemIndex} ditolak: ${msg}`);
      result.failures.push({
        index: itemIndex,
        stemPreview: (it.stem ?? "").trim().slice(0, 80),
        reason: msg,
      });
      continue;
    }

    const hash = contentHash(it.stem, it.options.map((o) => o.text));

    try {
      // 1) Sudah ada soal dengan konten sama? → cukup masukkan ke bundle.
      //    (Dedup lintas-sumber tetap berlaku: soal yang sama muncul di
      //     beberapa naskah → satu soal, banyak keanggotaan bundle.)
      const existing = await findQuestionByContentHash(hash);
      if (existing) {
        await linkQuestionToBundle(bundleId, existing.id, String(itemIndex));
        idByRefIndex.set(itemIndex, existing.id);
        result.linked++;
        result.storedCount++;
        result.questionIds.push(existing.id);
        continue;
      }

      // 2) Belum ada → bentuk payload kanonik (data_payload + answer_key) dan
      //    lewatkan gerbang Zod SEBELUM menyentuh DB (MAT-147).
      const built = buildQuestionPayload(it);
      const gate = gatePayload(built);
      if (!gate.ok) {
        // Gagal secara anggun: butir dicatat & dilaporkan, bukan melempar 500.
        result.rejected++;
        result.failedCount++;
        const msg = `#${itemIndex} ditolak: ${gate.message}`;
        result.errors.push(msg);
        result.failures.push({
          index: itemIndex,
          stemPreview: (it.stem ?? "").trim().slice(0, 80),
          reason: gate.message,
        });
        continue;
      }

      // Catatan mutu parser + catatan konversi payload (mis. placeholder
      // pembahasan/rubrik dipasang) → satu daftar flag yang bisa ditelaah.
      const notes = [...it.warnings, ...built.warnings];

      // Induk wacana/stimulus: petakan `parentRefIndex` → id soal induk yang
      // sudah dibuat sebelumnya pada commit yang sama.
      const parentId = it.parentRefIndex != null ? idByRefIndex.get(it.parentRefIndex) : undefined;
      const q = await createQuestion(
        {
          questionType: it.type,
          difficulty: DEFAULT_DIFFICULTY,
          cognitiveLevel: DEFAULT_COGNITIVE,
          grade,
          contentMarkdown: it.stem,
          // Opsi & kunci TIDAK lagi lewat parameter relasional `options`
          // (MAT-147): keduanya sudah di dalam JSONB di bawah.
          //
          // `options: []` tetap dikirim karena kontrak `CreateQuestionInput`
          // mewajibkan field itu (default Zod `[]` = wajib di tipe keluaran).
          // Nilai kosong membuat normalisasi gerbang tulis tidak menyentuh
          // `data_payload.options` — bentuk legacy ini hanya jaring kompatibilitas.
          options: [],
          dataPayload: gate.dataPayload,
          answerKey: gate.answerKey,
          status: "draft", // keputusan: SEMUA draft
          childOrder: it.childOrder ?? 0,
          ...(parentId ? { parentId } : {}),
          topicIds: opts.topicId ? [opts.topicId] : [],
          solutions: it.explanation
            ? [
                {
                  solutionType: "conceptual" as const,
                  title: "Pembahasan Konseptual",
                  contentMarkdown: it.explanation,
                  isPrimary: true,
                },
              ]
            : [],
          tagIds: [],
          // Peringatan parser → tanda "perlu telaah" (STRATEGI-INGEST §3.2).
          // Sebelumnya dibuang, jadi soal tanpa kunci masuk tanpa tanda apa pun.
          isFlagged: notes.length > 0,
          flagNotes: notes.length > 0 ? notes.join("; ") : null,
        },
        actor,
      );
      await linkQuestionToBundle(bundleId, q.id, String(itemIndex));
      idByRefIndex.set(itemIndex, q.id);
      result.created++;
      result.storedCount++;
      result.questionIds.push(q.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.failed++;
      result.failedCount++;
      result.errors.push(msg);
      result.failures.push({
        index: itemIndex,
        stemPreview: (it.stem ?? "").trim().slice(0, 80),
        reason: msg,
      });
    }
  }

  return result;
}

/**
 * Commit hasil parse butir-soal secara per-item (Pilar 2 v2.0).
 *
 * Menerima daftar ParsedItem dan queueItemId (atau CommitOptions langsung).
 * Mengembalikan ringkasan tersimpan & gagal per-indeks.
 */
export async function commitParsedItems(
  items: ParsedItem[],
  queueItemIdOrOptions: string | CommitOptions,
  actor?: Actor,
  opts?: CommitOptions,
): Promise<CommitResult> {
  const machine: Actor = actor ?? {
    id: "system:ingest",
    name: "Mesin Ingest",
    roles: ["machine"],
    via: "apikey",
  };

  let commitOpts: CommitOptions;
  if (typeof queueItemIdOrOptions === "string") {
    const queueId = queueItemIdOrOptions;
    let foundSource = "pipeline";
    let foundUrl: string | null = null;
    let foundTitle = `Queue ${queueId}`;
    let foundGrade: string | null = null;

    try {
      const [queueItem] = await db
        .select()
        .from(ingestQueue)
        .where(eq(ingestQueue.id, queueId))
        .limit(1);
      if (queueItem) {
        foundSource = queueItem.sourceOrigin;
        foundUrl = queueItem.sourceUrl;
        foundTitle = queueItem.title;
        foundGrade = queueItem.targetGrade;
      }
    } catch {
      // jika queueId bukan UUID atau mode uji
    }

    commitOpts = {
      sourceOrigin: opts?.sourceOrigin ?? foundSource,
      sourceUrl: opts?.sourceUrl ?? foundUrl,
      articleTitle: opts?.articleTitle ?? foundTitle,
      grade: opts?.grade ?? foundGrade,
      topicId: opts?.topicId ?? null,
    };
  } else {
    commitOpts = queueItemIdOrOptions;
  }

  return commitItems(items, machine, commitOpts);
}
