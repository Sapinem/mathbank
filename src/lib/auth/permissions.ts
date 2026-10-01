import type { Role } from "./roles";

/**
 * Matriks izin MathBank (L1) — SATU tempat: "siapa boleh apa".
 * `own` = hanya untuk sumber daya miliknya sendiri (authorId === actor.id).
 */
export type Access = "yes" | "own" | "no";

export interface PermissionMatrix {
  /** Lihat soal. */
  "question:view": Access;
  /** Buat soal baru. */
  "question:create": Access;
  /** Edit soal (own = hanya miliknya). */
  "question:edit": Access;
  /** Hapus soal (soft) — own = miliknya sendiri. */
  "question:delete": Access;
  /** Hapus permanen (hard-delete). */
  "question:hardDelete": Access;
  /** Set status `ready` (menyetujui). */
  "question:setReady": Access;
  /** Set status `archived`. */
  "question:archive": Access;
  /** Tandai/lepas tanda "perlu perhatian" (flag). */
  "question:flag": Access;

  /** Kelola taksonomi (topik/grade/difficulty/cognitive/tag). */
  "taxonomy:manage": Access;
  /** Kelola sumber & event. */
  "reference:manage": Access;
  /** Kelola paket soal. */
  "bundle:manage": Access;
  /** Lihat koleksi (arsip publik, ADR-0016) — semua peran. */
  "collection:view": Access;
  /** Kelola koleksi (arsip publik) — guru/reviewer/admin. */
  "collection:manage": Access;
  /** Kelola aset media. */
  "media:manage": Access;
  /** Kelola pengaturan sistem. */
  "settings:manage": Access;
  /** Kelola pengguna & peran. */
  "user:manage": Access;
  /** Enrichment AI (tagging/embedding). */
  "enrichment:run": Access;
}

/**
 * Matriks peran × aksi.
 *
 * Peran: admin · teacher · reviewer · agent · machine.
 * Catatan (L1):
 *  - teacher boleh hard-delete SOAL SENDIRI (maka `own`).
 *  - reviewer boleh set ready (tanpa jadi admin).
 *  - agent: buat soal/aset, cari, enrichment — TIDAK boleh bundle/hapus/status/taksonomi.
 *  - machine: hanya ingest (endpoint khusus).
 *  - taksonomi: bukan admin-only (teacher/reviewer/agent boleh kelola miliknya).
 */
export const PERMISSIONS: Record<keyof PermissionMatrix, Record<Role, Access>> = {
  "question:view": {
    admin: "yes",
    teacher: "yes",
    reviewer: "yes",
    agent: "yes",
    machine: "no",
  },
  "question:create": {
    admin: "yes",
    teacher: "yes",
    reviewer: "yes",
    agent: "yes",
    machine: "yes", // ingest menghasilkan soal (draft)
  },
  "question:edit": {
    admin: "yes",
    teacher: "own",
    reviewer: "own",
    agent: "own",
    machine: "no",
  },
  "question:delete": {
    admin: "yes",
    teacher: "own",
    reviewer: "own",
    agent: "no",
    machine: "no",
  },
  "question:hardDelete": {
    admin: "yes",
    teacher: "own", // L1: guru boleh hard-delete soal sendiri
    reviewer: "own",
    agent: "no",
    machine: "no",
  },
  "question:setReady": {
    admin: "yes",
    teacher: "no",
    reviewer: "yes", // L1: reviewer bisa set ready
    agent: "no",
    machine: "no",
  },
  "question:archive": {
    admin: "yes",
    teacher: "no",
    reviewer: "no",
    agent: "no",
    machine: "no",
  },
  "question:flag": {
    admin: "yes",
    teacher: "own",
    reviewer: "yes", // reviewer menandai masalah kualitas
    agent: "yes", // dedup/agen boleh menandai
    machine: "no",
  },
  "taxonomy:manage": {
    admin: "yes",
    teacher: "own",
    reviewer: "own",
    agent: "own",
    machine: "yes",
  },
  "reference:manage": {
    admin: "yes",
    teacher: "own",
    reviewer: "own",
    agent: "own",
    machine: "no",
  },
  "bundle:manage": {
    admin: "yes",
    teacher: "own", // ADR-0009 "Opsi 2": latihan = milik pembuat; koleksi = umum
    reviewer: "own",
    agent: "no", // agent TIDAK boleh bundle
    machine: "no",
  },
  // ADR-0016: `collections` = arsip PUBLIK — beda hakikat dari `bundles` (own).
  // Karena tak ada `ownerId`, izin ini BERLAKU di gerbang route (CONSTRAINTS #35
  // hanya mengikat izin ber-`own`).
  "collection:view": {
    admin: "yes",
    teacher: "yes",
    reviewer: "yes",
    agent: "yes", // arsip boleh dicari agent
    machine: "yes",
  },
  "collection:manage": {
    admin: "yes",
    teacher: "yes", // publik/institusional: semua guru boleh kelola
    reviewer: "yes",
    agent: "no",
    machine: "no",
  },
  "media:manage": {
    admin: "yes",
    teacher: "yes",
    reviewer: "yes",
    agent: "yes",
    machine: "no",
  },
  "settings:manage": {
    admin: "yes",
    teacher: "no",
    reviewer: "no",
    agent: "no",
    machine: "no",
  },
  "user:manage": {
    admin: "yes",
    teacher: "no",
    reviewer: "no",
    agent: "no",
    machine: "no",
  },
  "enrichment:run": {
    admin: "yes",
    teacher: "yes", // keputusan pemilik produk: guru boleh memicu enrichment manual
    reviewer: "yes", // penelaah boleh memicu enrichment saat menelaah
    agent: "yes", // L1: MCP/agen boleh enrichment (izin khusus)
    machine: "yes", // pipeline ingest menjalankan enrichment
  },
};

export type Permission = keyof PermissionMatrix;
