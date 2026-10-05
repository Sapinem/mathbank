/**
 * Logika pohon taksonomi — MURNI (tanpa DB), agar aman diimpor komponen klien.
 *
 * Dipisah dari `topic-service.ts` (yang mengimpor `@/lib/db`) supaya bundle
 * browser tak menarik `postgres`/`fs`. Lihat pelajaran M5: komponen klien
 * JANGAN impor service ber-DB.
 *
 * Berisi:
 *  - Tipe node pohon (`TopicNode`, `TopicTree`).
 *  - `buildTree`: susun pohon dari daftar datar.
 *  - `slugify`: slug dari nama (amankan panjang kolom DB).
 *  - `resolveLevel`: level induk→anak (maks 3).
 *  - `isSelfOrDescendant`: anti-siklus (dari snapshot datar).
 *  - `descendantIds`: kumpulkan id seluruh keturunan (dari snapshot).
 *  - `subtreeMaxDepth`: kedalaman maksimum subtree (dari snapshot).
 *
 * Semua fungsi menerima struktur data datar (snapshot) — TIDAK melakukan query
 * DB internal. Pemanggil (service L5) menyediakan snapshot dari DB.
 */

export interface TopicNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  level: number;
  description: string | null;
  sortOrder: number;
  usageCount: number;
  isActive: boolean;
}

export interface TopicTree extends TopicNode {
  children: TopicTree[];
}

/** Susun pohon dari daftar datar (anak urut sesuai urutan masukan). */
export function buildTree(flat: TopicNode[]): TopicTree[] {
  const byId = new Map<string, TopicTree>();
  for (const t of flat) byId.set(t.id, { ...t, children: [] });
  const roots: TopicTree[] = [];
  for (const t of flat) {
    const node = byId.get(t.id)!;
    if (t.parentId && byId.has(t.parentId)) {
      byId.get(t.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Slug dari nama: huruf kecil, non-alfanumerik → tanda hubung.
 *
 * **#2 (enterprise):** `maxLength` **wajib** disesuaikan dengan batas kolom DB.
 * Nama bisa MEMPERPANJANG saat `normalize("NFKD")` (ligatur `ﬃ`→`ffi`, `ǅ`→`Dž`),
 * sehingga `slice(0,255)` bisa menulis 255 char ke kolom `varchar(100)` → error
 * PG `value too long` (500). Buang trailing `-` **sesudah** potong, bukan sebelum.
 */
export function slugify(name: string, maxLength = 255): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, ""); // buang '-' ekor yang tersisa setelah pemotongan
}

// ── Bentuk ringkas untuk perhitungan pure (tak perlu seluruh kolom) ──────

/** Edge pohon: id + parentId (cukup untuk traversal). */
export interface TreeEdge {
  id: string;
  parentId: string | null;
}

// ── Sinyal error MURNI (tak bergantung auth/guards) ───────────────────
// Pemanggil L5 (mis. `topic-service.ts`) menangkap & menerjemahkan ke
// `NotFoundError`/`ConflictError` domain — menjaga L6 tetap murni.

/** Sinyal: induk topik tak ditemukan dalam snapshot. */
export class TopicParentNotFoundError extends Error {
  constructor() {
    super("Induk topik tidak ditemukan.");
    this.name = "TopicParentNotFoundError";
  }
}

/** Sinyal: kedalaman taksonomi melebihi maksimum 3 level. */
export class TopicMaxDepthError extends Error {
  constructor() {
    super("Kedalaman taksonomi maksimum 3 level (Kategori › Topik › SubTopik).");
    this.name = "TopicMaxDepthError";
  }
}

/** Node dengan level (untuk perhitungan level induk→anak). */
export interface TreeEdgeWithLevel extends TreeEdge {
  level: number;
}

/**
 * Level yang benar untuk sebuah induk: tak ada induk → 1; ada → induk.level+1
 * (maks 3). Melempar bila melebihi kedalaman 3.
 *
 * Pure: `rows` = snapshot seluruh topik (agar tak query berulang).
 */
export function resolveLevel(
  rows: TreeEdgeWithLevel[],
  parentId: string | null | undefined,
  errorOnMissing = true,
): number {
  if (!parentId) return 1;
  const parent = rows.find((r) => r.id === parentId);
  if (!parent) {
    if (errorOnMissing) {
      throw new TopicParentNotFoundError();
    }
    return 1;
  }
  const level = parent.level + 1;
  if (level > 3) {
    throw new TopicMaxDepthError();
  }
  return level;
}

/**
 * Apakah `candidateId` = `nodeId` atau keturunannya? (anti-siklus)
 * Dihitung dari snapshot di memori — tanpa query berulang.
 *
 * Pure: menerima `rows` (id/parentId).
 */
export function isSelfOrDescendant(
  rows: TreeEdge[],
  nodeId: string,
  candidateId: string,
): boolean {
  if (nodeId === candidateId) return true;
  const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
  let cursor: string | null = candidateId;
  const guard = new Set<string>();
  while (cursor) {
    if (guard.has(cursor)) break;
    guard.add(cursor);
    if (cursor === nodeId) return true;
    cursor = parentOf.get(cursor) ?? null;
  }
  return false;
}

/**
 * Kumpulkan id SELURUH keturunan `id` (tak termasuk dirinya) dari snapshot.
 * Pure: menerima `rows` (id/parentId).
 */
export function descendantIds(rows: TreeEdge[], id: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const r of rows) {
    if (r.parentId) {
      const arr = childrenOf.get(r.parentId) ?? [];
      arr.push(r.id);
      childrenOf.set(r.parentId, arr);
    }
  }
  const out: string[] = [];
  const stack = [...(childrenOf.get(id) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    stack.push(...(childrenOf.get(cur) ?? []));
  }
  return out;
}

/**
 * Kedalaman maksimum subtree di bawah `id` dari snapshot (0 = tanpa anak).
 * Pure: menerima `rows` (id/parentId).
 */
export function subtreeMaxDepth(rows: TreeEdge[], id: string): number {
  const childrenOf = new Map<string, string[]>();
  for (const r of rows) {
    if (r.parentId) {
      const arr = childrenOf.get(r.parentId) ?? [];
      arr.push(r.id);
      childrenOf.set(r.parentId, arr);
    }
  }
  const walk = (nodeId: string): number => {
    const kids = childrenOf.get(nodeId) ?? [];
    if (kids.length === 0) return 0;
    return 1 + Math.max(...kids.map(walk));
  };
  return walk(id);
}
