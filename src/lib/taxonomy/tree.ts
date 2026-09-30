/**
 * Logika pohon taksonomi — MURNI (tanpa DB), agar aman diimpor komponen klien.
 *
 * Dipisah dari `topic-service.ts` (yang mengimpor `@/lib/db`) supaya bundle
 * browser tak menarik `postgres`/`fs`. Lihat pelajaran M5: komponen klien
 * JANGAN impor service ber-DB.
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
