import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TopicTag,
  TopicTagList,
  topicFilterHref,
  type TopicTagItem,
} from "./topic-tag";

// ── Helper ──────────────────────────────────────────────────────────────────

function tag(over: Partial<TopicTagItem> = {}): TopicTagItem {
  return { id: "t1", name: "Aljabar", ...over };
}

// ── topicFilterHref ─────────────────────────────────────────────────────────

describe("topicFilterHref", () => {
  it("menghasilkan URL dengan topicId yang di-encode", () => {
    expect(topicFilterHref("abc-123")).toBe("/questions?topicId=abc-123");
  });

  it("meng-encode karakter spesial di topicId", () => {
    expect(topicFilterHref("foo bar")).toBe("/questions?topicId=foo%20bar");
    expect(topicFilterHref("a/b")).toBe("/questions?topicId=a%2Fb");
  });

  it("TIDAK menggunakan slug — hanya id", () => {
    const href = topicFilterHref("my-id");
    expect(href).not.toContain("slug");
    expect(href).toContain("topicId=my-id");
  });
});

// ── TopicTag ────────────────────────────────────────────────────────────────

describe("TopicTag", () => {
  it("merender tautan dengan href berbasis id, BUKAN slug", () => {
    render(<TopicTag topic={tag({ id: "cat-uuid", name: "Kalkulus" })} />);
    const link = screen.getByRole("link", { name: /Kalkulus/ });
    expect(link).toHaveAttribute("href", "/questions?topicId=cat-uuid");
    expect(link).not.toHaveAttribute("href", expect.stringContaining("slug"));
  });

  it("menampilkan nama topik tanpa teks slug", () => {
    render(<TopicTag topic={tag({ name: "Bilangan Prima", id: "bp-1" })} />);
    expect(screen.getByText("Bilangan Prima")).toBeInTheDocument();
    // Pastikan tidak ada kata 'slug' dirender
    expect(screen.queryByText(/slug/i)).not.toBeInTheDocument();
  });

  it("menampilkan badge Utama hanya saat isPrimary=true", () => {
    const { rerender } = render(<TopicTag topic={tag({ isPrimary: false })} />);
    expect(screen.queryByText("Utama")).not.toBeInTheDocument();

    rerender(<TopicTag topic={tag({ isPrimary: true })} />);
    expect(screen.getByText("Utama")).toBeInTheDocument();
  });

  it("merender span (bukan link) saat clickable=false", () => {
    render(<TopicTag topic={tag()} clickable={false} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByTitle("Aljabar")).toBeInTheDocument();
  });

  it("title link berisi nama topik", () => {
    render(<TopicTag topic={tag({ name: "Statistika" })} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("title", "Saring Bank Soal: Statistika");
  });

  it("level 1 mendapat kelas font-medium (lebih tegas)", () => {
    const { container } = render(<TopicTag topic={tag({ level: 1 })} />);
    expect(container.firstChild).toHaveClass("font-medium");
  });

  it("level 3 tidak mendapat kelas font-medium (lebih ringan)", () => {
    const { container } = render(<TopicTag topic={tag({ level: 3 })} />);
    expect(container.firstChild).not.toHaveClass("font-medium");
  });

  it("level null memakai default level 2 (tidak crash)", () => {
    const { container } = render(<TopicTag topic={tag({ level: null })} />);
    // Tidak crash — elemen utama tetap ada
    expect(container.firstChild).toBeInTheDocument();
  });
});

// ── TopicTagList ────────────────────────────────────────────────────────────

describe("TopicTagList", () => {
  it("merender empty-state eksplisit saat topics=[]", () => {
    render(<TopicTagList topics={[]} />);
    expect(screen.getByText("Belum ada topik.")).toBeInTheDocument();
  });

  it("empty-state menampilkan emptyLabel kustom", () => {
    render(<TopicTagList topics={[]} emptyLabel="Tidak ada topik terpilih." />);
    expect(screen.getByText("Tidak ada topik terpilih.")).toBeInTheDocument();
  });

  it("empty-state dengan showEmptyIcon=true tidak crash", () => {
    const { container } = render(
      <TopicTagList topics={[]} showEmptyIcon={true} />
    );
    expect(container).toBeInTheDocument();
  });

  it("merender daftar tag saat topics tidak kosong", () => {
    const topics: TopicTagItem[] = [
      { id: "t1", name: "Aljabar" },
      { id: "t2", name: "Geometri" },
    ];
    render(<TopicTagList topics={topics} />);
    expect(screen.getByText("Aljabar")).toBeInTheDocument();
    expect(screen.getByText("Geometri")).toBeInTheDocument();
  });

  it("setiap tag merender tautan dengan topicId (id), BUKAN slug", () => {
    const topics: TopicTagItem[] = [
      { id: "uuid-111", name: "Fungsi" },
      { id: "uuid-222", name: "Limit" },
    ];
    render(<TopicTagList topics={topics} />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute(
      "href",
      "/questions?topicId=uuid-111"
    );
    expect(links[1]).toHaveAttribute(
      "href",
      "/questions?topicId=uuid-222"
    );
  });

  it("tidak merender teks/atribut slug sama sekali", () => {
    const topics: TopicTagItem[] = [{ id: "t3", name: "Matriks" }];
    render(<TopicTagList topics={topics} />);
    expect(screen.queryByText(/slug/i)).not.toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).not.toContain("slug");
  });
});
