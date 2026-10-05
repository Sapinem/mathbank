import { describe, it, expect } from "vitest";
import {
  buildTree,
  slugify,
  resolveLevel,
  isSelfOrDescendant,
  descendantIds,
  subtreeMaxDepth,
  TopicParentNotFoundError,
  TopicMaxDepthError,
  type TopicNode,
  type TreeEdge,
  type TreeEdgeWithLevel,
} from "./tree";

function node(over: Partial<TopicNode> & { id: string }): TopicNode {
  return {
    name: "n",
    slug: "n",
    parentId: null,
    level: 1,
    description: null,
    sortOrder: 0,
    usageCount: 0,
    isActive: true,
    ...over,
  };
}

describe("slugify", () => {
  it("huruf kecil & ganti non-alfanumerik", () => {
    expect(slugify("Aljabar Linear")).toBe("aljabar-linear");
  });
  it("buang tanda di ujung", () => {
    expect(slugify("  --Fungsi Kuadrat!-- ")).toBe("fungsi-kuadrat");
  });
  it("pertahankan huruf beraksen (NFKD)", () => {
    expect(slugify("Café")).toBe("cafe");
  });
  it("batas 255 karakter", () => {
    expect(slugify("a".repeat(300)).length).toBe(255);
  });
  it("#2: maxLength khusus (tags=100) — ligatur NFKD tak melebihi batas", () => {
    // 'ﬃ' ×60 → NFKD 'ffi' ×60 = 180 char; dipotong ke 100.
    expect(slugify("ﬃ".repeat(60), 100).length).toBeLessThanOrEqual(100);
    expect(slugify("a".repeat(300), 100).length).toBe(100);
  });
  it("#2: '-' ekor dibuang SESUDAH pemotongan", () => {
    // 5 'a' + '-' + 5 'b' → pada maxLength 6 hasil 'aaaaa-' → harus jadi 'aaaaa'.
    expect(slugify("aaaaa bbbbb", 6)).toBe("aaaaa");
  });
});

describe("buildTree", () => {
  it("menyusun anak ke induk", () => {
    const flat = [
      node({ id: "a" }),
      node({ id: "b", parentId: "a", level: 2 }),
      node({ id: "c", parentId: "b", level: 3 }),
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe("c");
  });

  it("induk tak ada di daftar → jadi root", () => {
    const tree = buildTree([node({ id: "x", parentId: "hilang" })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("x");
  });

  it("daftar kosong → []", () => {
    expect(buildTree([])).toEqual([]);
  });

  it("menyusun struktur hirarkis 3-level dari flat snapshot", () => {
    const flat = [
      node({ id: "root", name: "Kategori", sortOrder: 1 }),
      node({ id: "topik", name: "Topik", parentId: "root", level: 2, sortOrder: 1 }),
      node({ id: "subtopik", name: "SubTopik", parentId: "topik", level: 3, sortOrder: 1 }),
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("root");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe("topik");
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe("subtopik");
    // level disalin dari input
    expect(tree[0].level).toBe(1);
    expect(tree[0].children[0].level).toBe(2);
    expect(tree[0].children[0].children[0].level).toBe(3);
  });

  it("mempertahankan urutan sesuai sortOrder input", () => {
    const flat = [
      node({ id: "z", parentId: "root", sortOrder: 3 }),
      node({ id: "a", parentId: "root", sortOrder: 1 }),
      node({ id: "m", parentId: "root", sortOrder: 2 }),
      node({ id: "root", sortOrder: 0 }),
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(1);
    // Anak dimasukkan sesuai urutan input array (z, a, m)
    expect(tree[0].children.map((c) => c.id)).toEqual(["z", "a", "m"]);
    // sortOrder disalin dari input
    expect(tree[0].children.map((c) => c.sortOrder)).toEqual([3, 1, 2]);
  });

  it("mempertahankan flag isActive pada node", () => {
    const flat = [
      node({ id: "active", isActive: true }),
      node({ id: "inactive", isActive: false }),
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(2);
    const byId = Object.fromEntries(tree.map((n) => [n.id, n]));
    expect(byId.active.isActive).toBe(true);
    expect(byId.inactive.isActive).toBe(false);
  });

  it("membuat node anak secara rekursif dengan children array kosong", () => {
    const flat = [
      node({ id: "a" }),
      node({ id: "b", parentId: "a" }),
      node({ id: "c", parentId: "b" }),
    ];
    const tree = buildTree(flat);
    // Daun (leaf) punya children array kosong
    expect(tree[0].children[0].children[0].children).toEqual([]);
    // Root punya children array
    expect(Array.isArray(tree[0].children)).toBe(true);
    // Node tidak saling berbagi referensi (deep copy via spread)
    expect(tree[0].children[0]).not.toBe(
      flat.find((f) => f.id === "b"),
    );
  });

  it("multiple roots — semua node tanpa parentId menjadi root", () => {
    const flat = [
      node({ id: "r1" }),
      node({ id: "r2" }),
      node({ id: "c1", parentId: "r1" }),
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(2);
    const ids = tree.map((n) => n.id).sort();
    expect(ids).toEqual(["r1", "r2"]);
    const r1 = tree.find((n) => n.id === "r1")!;
    expect(r1.children).toHaveLength(1);
    expect(r1.children[0].id).toBe("c1");
  });

  it("mempertahankan properti tambahan (name, slug, description, usageCount)", () => {
    const flat = [
      node({
        id: "a",
        name: "Aljabar",
        slug: "aljabar",
        description: "Bidang aljabar",
        usageCount: 42,
      }),
    ];
    const tree = buildTree(flat);
    expect(tree[0].name).toBe("Aljabar");
    expect(tree[0].slug).toBe("aljabar");
    expect(tree[0].description).toBe("Bidang aljabar");
    expect(tree[0].usageCount).toBe(42);
  });
});

describe("resolveLevel", () => {
  it("level 1 untuk root (parentId null)", () => {
    expect(resolveLevel([], null)).toBe(1);
  });

  it("level 1 untuk parentId undefined", () => {
    expect(resolveLevel([], undefined)).toBe(1);
  });

  it("parent.level + 1 untuk child", () => {
    const rows: TreeEdgeWithLevel[] = [
      { id: "a", parentId: null, level: 1 },
      { id: "b", parentId: "a", level: 2 },
      { id: "c", parentId: "b", level: 3 },
    ];
    // child dari a (level 1) → level 2
    expect(resolveLevel(rows, "a")).toBe(2);
    // child dari b (level 2) → level 3
    expect(resolveLevel(rows, "b")).toBe(3);
  });

  it("melempar TopicParentNotFoundError bila parentId tidak ditemukan (errorOnMissing=true default)", () => {
    const rows: TreeEdgeWithLevel[] = [
      { id: "a", parentId: null, level: 1 },
    ];
    expect(() => resolveLevel(rows, "nonexistent")).toThrow(TopicParentNotFoundError);
    expect(() => resolveLevel(rows, "nonexistent")).toThrow(
      "Induk topik tidak ditemukan.",
    );
  });

  it("mengembalikan level 1 bila parentId tidak ditemukan & errorOnMissing=false", () => {
    const rows: TreeEdgeWithLevel[] = [
      { id: "a", parentId: null, level: 1 },
    ];
    expect(resolveLevel(rows, "nonexistent", false)).toBe(1);
  });

  it("melempar TopicMaxDepthError bila level hasil kalkulasi > 3", () => {
    // parent di level 3 → child level 4 → melebihi maksimum
    const rows: TreeEdgeWithLevel[] = [
      { id: "a", parentId: null, level: 1 },
      { id: "b", parentId: "a", level: 2 },
      { id: "c", parentId: "b", level: 3 },
    ];
    expect(() => resolveLevel(rows, "c")).toThrow(TopicMaxDepthError);
    expect(() => resolveLevel(rows, "c")).toThrow(
      "Kedalaman taksonomi maksimum 3 level",
    );
  });

  it("errorOnMissing=false tidak menutupi TopicMaxDepthError", () => {
    // parent di level 3 → child level 4 → tetap melempar TopicMaxDepthError
    // meskipun errorOnMissing=false
    const rows: TreeEdgeWithLevel[] = [
      { id: "c", parentId: null, level: 3 },
    ];
    expect(() => resolveLevel(rows, "c", false)).toThrow(TopicMaxDepthError);
  });
});

describe("isSelfOrDescendant", () => {
  const edges: TreeEdge[] = [
    { id: "grandparent", parentId: null },
    { id: "parent", parentId: "grandparent" },
    { id: "child", parentId: "parent" },
    { id: "grandchild", parentId: "child" },
    { id: "sibling", parentId: "grandparent" },
  ];

  it("true bila target == candidate (identitas node)", () => {
    expect(isSelfOrDescendant(edges, "child", "child")).toBe(true);
    expect(isSelfOrDescendant(edges, "parent", "parent")).toBe(true);
  });

  it("true untuk relasi anak langsung", () => {
    // parent adalah ancestor dari child
    expect(isSelfOrDescendant(edges, "parent", "child")).toBe(true);
  });

  it("true untuk relasi cucu (grandchild)", () => {
    // grandparent adalah ancestor dari grandchild
    expect(isSelfOrDescendant(edges, "grandparent", "grandchild")).toBe(true);
    expect(isSelfOrDescendant(edges, "grandparent", "child")).toBe(true);
  });

  it("false untuk hubungan saudara (sibling)", () => {
    // parent dan sibling adalah saudara (anak grandparent)
    expect(isSelfOrDescendant(edges, "parent", "sibling")).toBe(false);
    expect(isSelfOrDescendant(edges, "sibling", "parent")).toBe(false);
  });

  it("false untuk hubungan induk (candidate adalah ancestor dari nodeId)", () => {
    // child adalah turunan dari parent, tapi parent BUKAN turunan dari child
    expect(isSelfOrDescendant(edges, "child", "parent")).toBe(false);
    expect(isSelfOrDescendant(edges, "grandchild", "grandparent")).toBe(false);
  });

  it("false bila tidak ada hubungan kekeluargaan sama sekali", () => {
    // Dua root terpisah
    const separate: TreeEdge[] = [
      { id: "r1", parentId: null },
      { id: "r2", parentId: null },
    ];
    expect(isSelfOrDescendant(separate, "r1", "r2")).toBe(false);
  });

  it("penjagaan guard set terhadap siklus dalam snapshot", () => {
    // Siklus: a → b → a (parentId saling menunjuk)
    const cyclic: TreeEdge[] = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    // Meski ada siklus, fungsi harus berhenti (guard set) dan tidak infinite loop.
    // Dalam siklus, kedua node saling merupakan keturunan satu sama lain (secara
    // transitif) — guard set memastikan iterasi berhenti, bukan mengubah hasil.
    expect(isSelfOrDescendant(cyclic, "a", "b")).toBe(true);
    expect(isSelfOrDescendant(cyclic, "b", "a")).toBe(true);
  });

  it("penjagaan guard set terhadap self-loop (parentId menunjuk diri sendiri)", () => {
    const selfLoop: TreeEdge[] = [
      { id: "x", parentId: "x" },
      { id: "y", parentId: "x" },
    ];
    // x menunjuk diri sendiri sebagai parent.
    // x adalah keturunan x (identitas) → true
    expect(isSelfOrDescendant(selfLoop, "x", "x")).toBe(true);
    // y adalah anak x → x adalah ancestor y → true
    expect(isSelfOrDescendant(selfLoop, "x", "y")).toBe(true);
  });
});

describe("descendantIds", () => {
  it("mengumpulkan seluruh ID keturunan (anak, cucu) secara iteratif", () => {
    const edges: TreeEdge[] = [
      { id: "gp", parentId: null },
      { id: "p", parentId: "gp" },
      { id: "c1", parentId: "p" },
      { id: "c2", parentId: "p" },
      { id: "gc1", parentId: "c1" },
      { id: "gc2", parentId: "c2" },
    ];
    const ids = new Set(descendantIds(edges, "gp"));
    expect(ids.size).toBe(5);
    expect(ids.has("p")).toBe(true);
    expect(ids.has("c1")).toBe(true);
    expect(ids.has("c2")).toBe(true);
    expect(ids.has("gc1")).toBe(true);
    expect(ids.has("gc2")).toBe(true);
  });

  it("tidak termasuk dirinya sendiri", () => {
    const edges: TreeEdge[] = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
    ];
    const ids = descendantIds(edges, "a");
    expect(ids).not.toContain("a");
    expect(ids).toEqual(["b"]);
  });

  it("mengembalikan array kosong untuk daun tanpa anak", () => {
    const edges: TreeEdge[] = [
      { id: "leaf", parentId: null },
    ];
    expect(descendantIds(edges, "leaf")).toEqual([]);
  });

  it("hanya anak langsung (1-level)", () => {
    const edges: TreeEdge[] = [
      { id: "root", parentId: null },
      { id: "a", parentId: "root" },
      { id: "b", parentId: "root" },
    ];
    const ids = new Set(descendantIds(edges, "root"));
    expect(ids.size).toBe(2);
    expect(ids.has("a")).toBe(true);
    expect(ids.has("b")).toBe(true);
  });

  it("menangani id yang tidak ada dalam snapshot → []", () => {
    const edges: TreeEdge[] = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
    ];
    expect(descendantIds(edges, "nonexistent")).toEqual([]);
  });

  it("penanganan siklus tidak infinite loop (dedup via seen set)", () => {
    // Siklus: a → b → a
    const cyclic: TreeEdge[] = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    // Harus berhenti, bukan infinite loop. Dalam siklus, kedua node saling
    // keturunan (transitif) — seen set menjamin berhenti & dedup.
    const ids = new Set(descendantIds(cyclic, "a"));
    expect(ids.has("b")).toBe(true);
    // a adalah keturunan dirinya sendiri secara transitif dalam siklus
    expect(ids.has("a")).toBe(true);
  });

  it("node dengan parentId null tidak ditambahkan ke childrenOf", () => {
    const edges: TreeEdge[] = [
      { id: "root", parentId: null },
      { id: "child", parentId: "root" },
    ];
    // root.parentId = null → tidak masuk childrenOf manapun
    const ids = descendantIds(edges, "root");
    expect(ids).toEqual(["child"]);
  });
});

describe("subtreeMaxDepth", () => {
  it("0 untuk daun tanpa anak", () => {
    const edges: TreeEdge[] = [
      { id: "leaf", parentId: null },
    ];
    expect(subtreeMaxDepth(edges, "leaf")).toBe(0);
  });

  it("1 untuk orang tua dengan anak (1-level)", () => {
    const edges: TreeEdge[] = [
      { id: "parent", parentId: null },
      { id: "child", parentId: "parent" },
    ];
    expect(subtreeMaxDepth(edges, "parent")).toBe(1);
  });

  it("2 untuk kakek dengan cucu (2-level)", () => {
    const edges: TreeEdge[] = [
      { id: "gp", parentId: null },
      { id: "p", parentId: "gp" },
      { id: "c", parentId: "p" },
    ];
    expect(subtreeMaxDepth(edges, "gp")).toBe(2);
  });

  it("3 untuk struktur 3-level penuh", () => {
    const edges: TreeEdge[] = [
      { id: "r", parentId: null },
      { id: "l1", parentId: "r" },
      { id: "l2", parentId: "l1" },
      { id: "l3", parentId: "l2" },
    ];
    expect(subtreeMaxDepth(edges, "r")).toBe(3);
  });

  it("mengembalikan kedalaman maksimum dari beberapa cabang", () => {
    // Cabang kiri 2-level, cabang kanan 1-level → maks 2
    const edges: TreeEdge[] = [
      { id: "root", parentId: null },
      { id: "left", parentId: "root" },
      { id: "leftChild", parentId: "left" },
      { id: "right", parentId: "root" },
    ];
    expect(subtreeMaxDepth(edges, "root")).toBe(2);
  });

  it("0 untuk id yang tidak ada dalam snapshot", () => {
    const edges: TreeEdge[] = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
    ];
    expect(subtreeMaxDepth(edges, "nonexistent")).toBe(0);
  });

  it("anak dengan beberapa cucu pada level berbeda → ambil maksimum", () => {
    const edges: TreeEdge[] = [
      { id: "root", parentId: null },
      { id: "a", parentId: "root" },
      { id: "a1", parentId: "a" },
      { id: "a2", parentId: "a1" },
      { id: "b", parentId: "root" }, // b adalah daun
    ];
    expect(subtreeMaxDepth(edges, "root")).toBe(3);
    // Subtree dari a: a→a1→a2 = depth 2
    expect(subtreeMaxDepth(edges, "a")).toBe(2);
    // Subtree dari b: daun = 0
    expect(subtreeMaxDepth(edges, "b")).toBe(0);
  });
});

describe("Error classes", () => {
  it("TopicParentNotFoundError adalah instance Error dengan pesan yang benar", () => {
    const err = new TopicParentNotFoundError();
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Induk topik tidak ditemukan.");
    expect(err.name).toBe("TopicParentNotFoundError");
  });

  it("TopicMaxDepthError adalah instance Error dengan pesan yang benar", () => {
    const err = new TopicMaxDepthError();
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe(
      "Kedalaman taksonomi maksimum 3 level (Kategori › Topik › SubTopik).",
    );
    expect(err.name).toBe("TopicMaxDepthError");
  });

  it("error dapat ditangkap via instance name", () => {
    let caught: Error | null = null;
    try {
      throw new TopicParentNotFoundError();
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(TopicParentNotFoundError);
    expect(caught?.name).toBe("TopicParentNotFoundError");
  });
});
