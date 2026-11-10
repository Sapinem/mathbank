import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { formalExamTheme } from "./index";

describe("formalExamTheme", () => {
  it("memiliki metadata yang benar", () => {
    expect(formalExamTheme.id).toBe("formal-exam");
    expect(formalExamTheme.name).toBe("Ujian Formal (Sekolah/Madrasah)");
    expect(formalExamTheme.Kop).toBeDefined();
    expect(formalExamTheme.Header).toBeDefined();
    expect(formalExamTheme.Footer).toBeDefined();
    expect(formalExamTheme.renderOptions).toBeDefined();
  });

  it("merender kop formal dan kotak identitas siswa", () => {
    const Kop = formalExamTheme.Kop;
    render(
      <Kop
        title="Matematika Wajib"
        institutionName="SMA Negeri 3 Bandung"
        grade="11"
        year={2026}
        questionCount={25}
        options={{}}
      />
    );

    expect(screen.getByText("SMA Negeri 3 Bandung")).toBeInTheDocument();
    expect(screen.getByText("Nama Peserta")).toBeInTheDocument();
    expect(screen.getByText("Nomor Peserta")).toBeInTheDocument();
    expect(screen.queryByTestId("supervisor-signature")).not.toBeInTheDocument();
  });

  it("merender Header dan Footer khusus formal-exam", () => {
    const Header = formalExamTheme.Header!;
    render(
      <Header
        title="Penilaian Akhir Semester"
        exerciseLabel="Latihan 1"
        options={{}}
      />
    );
    expect(screen.getByText(/penilaian akhir semester/i)).toBeInTheDocument();

    const Footer = formalExamTheme.Footer!;
    render(
      <Footer
        institutionName="SMA Negeri 3 Bandung"
        options={{}}
      />
    );
    expect(screen.getByText(/sma negeri 3 bandung/i)).toBeInTheDocument();
    expect(screen.getByText(/dokumen ujian resmi/i)).toBeInTheDocument();
  });

  it("merender kolom tanda tangan pengawas bila opsi showSupervisorSignature true", () => {
    const Kop = formalExamTheme.Kop;
    render(
      <Kop
        title="Matematika Wajib"
        institutionName="SMA Negeri 3 Bandung"
        questionCount={25}
        options={{ showSupervisorSignature: true }}
      />
    );

    expect(screen.getByText(/tanda tangan pengawas/i)).toBeInTheDocument();
  });

  it("merender opsi kustom di drawer dan memicu onChange saat diklik", () => {
    const renderOptions = formalExamTheme.renderOptions!;
    const handleChange = vi.fn();

    render(
      renderOptions({
        options: { showSupervisorSignature: false, examTypeTitle: "" },
        onChange: handleChange,
      })
    );

    const toggleButton = screen.getByRole("button", {
      name: /sembunyikan tanda tangan/i,
    });
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(handleChange).toHaveBeenCalledWith("showSupervisorSignature", true);

    const input = screen.getByLabelText(/judul \/ keterangan naskah ujian/i);
    fireEvent.change(input, { target: { value: "ASAJ 2026" } });
    expect(handleChange).toHaveBeenCalledWith("examTypeTitle", "ASAJ 2026");
  });
});
