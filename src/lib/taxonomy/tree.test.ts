import { describe, it, expect } from "vitest";
import { buildTree, slugify, type TopicNode } from "./tree";

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
});
