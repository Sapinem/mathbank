import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopicPicker } from "./topic-picker";
import type { TopicNode } from "@/lib/taxonomy/tree";

/**
 * Tes pemilih topik (editor). Yang diuji: struktur hierarki dibangun benar,
 * pencarian bekerja, dan pemilihan (toggle) mengirim id yang tepat.
 */

// ADR-0030: `version` wajib ada di TopicNode (dipakai sebagai ETag/If-Match).
const TOPICS: TopicNode[] = [
  { id: "t-alj", version: 1, name: "Aljabar & Persamaan", parentId: null, level: 1, sortOrder: 0, description: null, usageCount: 0, isActive: true },
  { id: "t-pk", version: 1, name: "Persamaan Kuadrat", parentId: "t-alj", level: 2, sortOrder: 0, description: null, usageCount: 0, isActive: true },
  { id: "t-akar", version: 1, name: "Bentuk Akar", parentId: "t-alj", level: 2, sortOrder: 1, description: null, usageCount: 0, isActive: true },
  { id: "t-geo", version: 1, name: "Geometri & Trigonometri", parentId: null, level: 1, sortOrder: 1, description: null, usageCount: 0, isActive: true },
  { id: "t-trig", version: 1, name: "Trigonometri", parentId: "t-geo", level: 2, sortOrder: 0, description: null, usageCount: 0, isActive: true },
  { id: "t-sinus", version: 1, name: "Aturan Sinus & Cosinus", parentId: "t-trig", level: 3, sortOrder: 0, description: null, usageCount: 0, isActive: true },
];

const mockUseTopicList = vi.fn();
vi.mock("@/lib/hooks/use-taxonomy", () => ({
  useTopicList: () => mockUseTopicList(),
}));

beforeEach(() => {
  mockUseTopicList.mockReturnValue({ data: TOPICS, isLoading: false });
});

describe("TopicPicker", () => {
  it("judul grup (punya anak) tampil sebagai label, bukan tombol pilihan", () => {
    render(<TopicPicker value={[]} onChange={() => {}} />);
    // "Aljabar & Persamaan" adalah grup (punya anak) → label teks
    expect(screen.getByText("Aljabar & Persamaan")).toBeDefined();
    // Daunnya bisa dipilih
    expect(screen.getByRole("button", { name: "Persamaan Kuadrat" })).toBeDefined();
  });

  it("memilih daun memanggil onChange dengan id-nya", () => {
    const onChange = vi.fn();
    render(<TopicPicker value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Persamaan Kuadrat" }));
    expect(onChange).toHaveBeenCalledWith(["t-pk"]);
  });

  it("membatalkan pilihan membuang id dari daftar", () => {
    const onChange = vi.fn();
    render(<TopicPicker value={["t-pk", "t-akar"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Persamaan Kuadrat" }));
    expect(onChange).toHaveBeenCalledWith(["t-akar"]);
  });

  it("pencarian menyaring dan menampilkan jalur lengkap", () => {
    render(<TopicPicker value={[]} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText("Cari topik"), { target: { value: "sinus" } });
    // Cocok via nama, dan jalur induknya ditampilkan
    expect(screen.getByRole("button", { name: /Aturan Sinus/ })).toBeDefined();
    expect(screen.getByText("Geometri & Trigonometri › Trigonometri")).toBeDefined();
  });

  it("mendukung hierarki 3 level (subtopik level-3 dapat dipilih)", () => {
    const onChange = vi.fn();
    render(<TopicPicker value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Aturan Sinus/ }));
    expect(onChange).toHaveBeenCalledWith(["t-sinus"]);
  });

  it("saat daftar topik kosong, tampilkan petunjuk", () => {
    mockUseTopicList.mockReturnValue({ data: [], isLoading: false });
    render(<TopicPicker value={[]} onChange={() => {}} />);
    expect(screen.getByText(/Belum ada topik/)).toBeDefined();
  });
});
