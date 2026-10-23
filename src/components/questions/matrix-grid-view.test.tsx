/**
 * Tes tampilan matrix_grid (benar-salah) di halaman detail.
 *
 * Latar: sebelumnya `question-detail-view` hanya merender `q.options`,
 * sehingga pernyataan di `dataPayload.rows` tidak pernah muncul.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatrixGridView, readMatrixGridPayload } from "./matrix-grid-view";

/** Bentuk RESMI dari pipeline ingest (defantri-tf.ts). */
const PAYLOAD = {
  rows: [
    { text: "Jika pemain menembak angka \\(7\\), poinnya \\(400\\).", answer: "Benar" },
    { text: "Pemain tidak akan pernah dapat poin ganjil.", answer: "Benar" },
    { text: "Poin terbesar adalah \\(500\\).", answer: "Salah" },
  ],
  labels: ["Benar", "Salah"],
};

describe("readMatrixGridPayload", () => {
  it("membaca bentuk resmi (text + answer + labels)", () => {
    const p = readMatrixGridPayload(PAYLOAD);
    expect(p.rows).toHaveLength(3);
    expect(p.labels).toEqual(["Benar", "Salah"]);
    expect(p.rows[0]!.answer).toBe("Benar");
  });

  it("toleran terhadap bentuk editor lama (label + columns)", () => {
    const p = readMatrixGridPayload({
      columns: ["B", "S"],
      rows: [{ label: "pernyataan lama" }],
    });
    expect(p.rows[0]!.text).toBe("pernyataan lama");
    expect(p.rows[0]!.answer).toBeNull();
  });

  it("aman untuk dataPayload kosong/aneh", () => {
    expect(readMatrixGridPayload(undefined).rows).toEqual([]);
    expect(readMatrixGridPayload(null).labels).toEqual(["Benar", "Salah"]);
    expect(readMatrixGridPayload({ rows: "bukan array" }).rows).toEqual([]);
  });
});

describe("MatrixGridView", () => {
  it("menampilkan SEMUA pernyataan beserta kuncinya", () => {
    render(<MatrixGridView payload={readMatrixGridPayload(PAYLOAD)} />);
    expect(screen.getByText(/menembak angka/)).toBeTruthy();
    expect(screen.getByText(/tidak akan pernah dapat poin ganjil/)).toBeTruthy();
    expect(screen.getByText(/Poin terbesar/)).toBeTruthy();
    // 2 kunci Benar + 1 Salah.
    expect(screen.getAllByText("Benar").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Salah").length).toBeGreaterThanOrEqual(1);
  });

  it("tidak merender apa pun bila tak ada pernyataan (mis. soal PG)", () => {
    const { container } = render(<MatrixGridView payload={{ rows: [], labels: [] }} />);
    expect(container.innerHTML).toBe("");
  });

  it("menandai pernyataan tanpa kunci dengan '—'", () => {
    render(
      <MatrixGridView payload={{ rows: [{ text: "tanpa kunci", answer: null }], labels: ["Benar", "Salah"] }} />,
    );
    expect(screen.getByText("—")).toBeTruthy();
  });
});
