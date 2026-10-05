/**
 * Tipe & utilitas bersama paket soal (L5) — pecahan `bundle-service.ts`.
 *
 * Dipakai `bundle-query.ts`, `bundle-write.ts`, `bundle-items.ts`.
 * Berisi: tipe publik, proyeksi kolom, otorisasi per-paket, slug unik.
 *
 * ⚠️ Modul ini mengimpor `@/lib/db` (untuk `uniqueSlug`) — jangan impor dari
 * komponen klien. Tipe murni (tanpa DB) boleh diimpor aman via `import type`.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bundles } from "@/lib/db/schema/bundle";
import { can, hasRole, assertCan, ForbiddenError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import { slugify } from "@/lib/taxonomy/tree";

export type BundleType = "source" | "exam";
export type BundleOrigin = "ingest" | "manual";
export type BundleItemRole = "question" | "stimulus";

export interface BundleRow {
  id: string;
  title: string;
  slug: string;
  bundleType: BundleType;
  origin: BundleOrigin;
  sourceId: string | null;
  eventId: string | null;
  year: number | null;
  grade: string | null;
  durationMinutes: number | null;
  instructions: string | null;
  status: "draft" | "review" | "ready" | "archived";
  /** Pembuat paket — dasar penegakan izin `own` (lihat `assertBundleAccess`). */
  createdById: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BundleItemRow {
  id: string;
  bundleId: string;
  questionId: string;
  role: BundleItemRole;
  orderIndex: number;
  sectionName: string | null;
  itemNumber: string | null;
  notes: string | null;
}

/**
 * Baris item paket untuk pratinjau/cetak (M8): item + soal ter-proyeksi
 * **beserta opsi**. `answerKey`/`isCorrect`/`distractorRationale` hanya ada bila
 * aktor berwenang (`canSeeAnswerKey`) — karena itu opsional.
 */
export interface BundleItemWithQuestion {
  item: BundleItemRow;
  question: Omit<
    import("./question-service").PublicQuestion,
    "options" | "answerKey"
  > & {
    answerKey?: import("@/lib/contracts/question").AnswerKey;
    /** `isCorrect`/`distractorRationale` hanya ada bila aktor berwenang. */
    options: (
      Omit<import("@/lib/db/schema/question").QuestionOption, "isCorrect" | "distractorRationale"> &
        Partial<
          Pick<
            import("@/lib/db/schema/question").QuestionOption,
            "isCorrect" | "distractorRationale"
          >
        >
    )[];
  };
}

export type BundleCore = Omit<BundleRow, "itemCount">;

export interface CreateBundleInput {
  title: string;
  bundleType: BundleType;
  origin?: BundleOrigin;
  sourceId?: string | null;
  eventId?: string | null;
  year?: number | null;
  grade?: string | null;
  durationMinutes?: number;
  instructions?: string | null;
}

export interface UpdateBundleInput {
  title?: string;
  bundleType?: BundleType;
  origin?: BundleOrigin;
  sourceId?: string | null;
  eventId?: string | null;
  year?: number | null;
  grade?: string | null;
  durationMinutes?: number;
  instructions?: string | null;
  status?: "draft" | "review" | "ready" | "archived";
}

export interface BundleValidation {
  itemCount: number;
  /** Soal yang dipakai tapi belum punya kunci jawaban (peringatan, bukan error). */
  withoutAnswerKey: { questionId: string; itemNumber: string | null }[];
  /** Soal yang ter-soft-delete tapi masih ada di paket (harus dibersihkan). */
  missingQuestions: string[];
  valid: boolean;
}

/**
 * Proyeksi kolom paket (tanpa itemCount) — dipakai `listBundles` & `getBundle`.
 * Mencegah duplikasi & konsisten dengan aturan #34 (selalu proyeksi eksplisit).
 */
export function bundleColumns() {
  return {
    id: bundles.id,
    title: bundles.title,
    slug: bundles.slug,
    bundleType: bundles.bundleType,
    origin: bundles.origin,
    sourceId: bundles.sourceId,
    eventId: bundles.eventId,
    year: bundles.year,
    grade: bundles.grade,
    durationMinutes: bundles.durationMinutes,
    instructions: bundles.instructions,
    status: bundles.status,
    createdById: bundles.createdById,
    createdAt: bundles.createdAt,
    updatedAt: bundles.updatedAt,
  };
}

/** Buat slug unik di antara paket aktif (tambah akhiran -2, -3, …). */
export async function uniqueSlug(
  base: string,
  exceptId?: string,
): Promise<string> {
  const root = slugify(base) || "paket";
  let candidate = root;
  let n = 1;
  // Cari yang belum dipakai paket AKTIF.
  for (;;) {
    const rows = await db
      .select({ id: bundles.id })
      .from(bundles)
      .where(
        and(
          eq(bundles.slug, candidate),
          isNull(bundles.deletedAt),
          exceptId ? sql`${bundles.id} <> ${exceptId}` : undefined,
        ),
      )
      .limit(1);
    if (rows.length === 0) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

/**
 * Otorisasi per-paket (L5) — di sini, BUKAN di gerbang `permission` route.
 *
 * KENAPA: `assertCan(actor, perm)` tanpa `ownerId` **selalu menolak** peran
 * ber-`own` (CONSTRAINTS #35). Dan perilaku paket bergantung pada **tipe**-nya,
 * yang baru diketahui setelah baris dibaca dari DB — jadi mustahil dinilai di
 * gerbang route.
 *
 * Aturan (keputusan pemilik produk — ADR-0009 "Opsi 2"):
 *   - `source` (KOLEKSI/arsip)      → **umum**: guru/penelaah boleh kelola bersama.
 *   - `exam` (UJIAN) → **`own`**: hanya PEMBUAT yang boleh ubah.
 *     Guru lain boleh **melihat** (`assertBundleRead`), tak boleh mengubah.
 *   - `admin` → selalu boleh.
 *
 * ⚠️ CATATAN IMPLEMENTASI: `bundle:manage` sengaja bernilai **`own`** untuk
 * teacher/reviewer. Karena itu **jangan** memakai `can(actor, "bundle:manage")`
 * tanpa `ownerId` di sini — nilainya akan selalu `false` untuk guru, termasuk
 * saat mengelola paket miliknya sendiri. Nilai peran diperiksa langsung.
 */
export function assertBundleWrite(bundle: BundleRow, actor: Actor): void {
  // Admin selalu boleh (union izin: "yes" > "own").
  if (can(actor, "bundle:manage", { ownerId: null })) return;

  // Koleksi = arsip institusional → boleh dikelola bersama (guru & penelaah).
  if (bundle.bundleType === "source") {
    if (hasRole(actor, "teacher") || hasRole(actor, "reviewer")) return;
  }

  // Latihan/Exam → hanya pembuatnya.
  if (bundle.createdById && bundle.createdById === actor.id) return;

  throw new ForbiddenError(
    bundle.createdById
      ? "Paket latihan ini milik guru lain — hanya pembuatnya yang bisa mengubah."
      : "Paket latihan tanpa pemilik hanya bisa diubah oleh admin.",
  );
}

/**
 * Otorisasi BACA paket: semua pemegang `question:view` boleh melihat paket —
 * **termasuk** latihan guru lain (keputusan pemilik produk: "boleh MELIHAT,
 * tak boleh mengubah").
 */
export function assertBundleRead(actor: Actor): void {
  assertCan(actor, "question:view");
}
