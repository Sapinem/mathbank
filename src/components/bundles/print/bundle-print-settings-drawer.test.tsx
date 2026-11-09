import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BundlePrintSettingsDrawer } from "./bundle-print-settings-drawer";
import type { BundlePrintSettingsDrawerProps } from "./bundle-print-settings-drawer";

function createProps(overrides: Partial<BundlePrintSettingsDrawerProps> = {}): BundlePrintSettingsDrawerProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    applyStudentPreset: vi.fn(),
    applyTeacherPreset: vi.fn(),
    canShowKey: true,
    canShowExplanation: true,
    isTwoColumn: true,
    setBodyColumns: vi.fn(),
    columns: "1",
    setColumns: vi.fn(),
    effectiveBackgroundWatermark: true,
    setBackgroundWatermarkOverride: vi.fn(),
    effectiveBackgroundGrid: false,
    setBackgroundGridOverride: vi.fn(),
    questionItems: [],
    effectiveColumnBreaks: [],
    toggleColumnBreak: vi.fn(),
    effectiveBrandColor: "#0158ca",
    setBrandColorOverride: vi.fn(),
    brandPresetColors: [{ label: "Biru", value: "#0158ca" }],
    effectiveAnswerSpaceCm: 3,
    setAnswerSpaceCmOverride: vi.fn(),
    answerSpaceOptions: [0, 2, 3],
    effectiveKeyMode: "hidden",
    setKeyModeOverride: vi.fn(),
    effectiveExplanationMode: "none",
    setExplanationModeOverride: vi.fn(),
    includeAnswerSheet: true,
    setIncludeAnswerSheet: vi.fn(),
    handleSaveDefault: vi.fn(),
    isSaving: false,
    ...overrides,
  };
}

describe("BundlePrintSettingsDrawer with Themes", () => {
  it("merender dropdown pemilih tema naskah cetak", () => {
    render(<BundlePrintSettingsDrawer {...createProps()} />);
    const select = screen.getByLabelText(/pilih format bingkai & kop/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Standar MathBank")).toBeInTheDocument();
    expect(screen.getByText("Ujian Formal (Sekolah/Madrasah)")).toBeInTheDocument();
  });

  it("memicu onThemeChange saat pengguna memilih tema baru", () => {
    const onThemeChange = vi.fn();
    render(<BundlePrintSettingsDrawer {...createProps({ onThemeChange })} />);
    const select = screen.getByLabelText(/pilih format bingkai & kop/i);

    fireEvent.change(select, { target: { value: "formal-exam" } });
    expect(onThemeChange).toHaveBeenCalledWith("formal-exam");
  });

  it("merender slot opsi kustom ketika tema aktif adalah formal-exam", () => {
    render(
      <BundlePrintSettingsDrawer
        {...createProps({
          activeThemeId: "formal-exam",
          themeOptions: {
            "formal-exam": { showSupervisorSignature: false },
          },
        })}
      />
    );

    expect(screen.getByText(/opsi khusus: ujian formal/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sembunyikan tanda tangan/i })
    ).toBeInTheDocument();
  });

  it("memicu onThemeOptionChange saat kontrol kustom di dalam slot tema diubah", () => {
    const onThemeOptionChange = vi.fn();
    render(
      <BundlePrintSettingsDrawer
        {...createProps({
          activeThemeId: "formal-exam",
          themeOptions: {
            "formal-exam": { showSupervisorSignature: false },
          },
          onThemeOptionChange,
        })}
      />
    );

    const toggleButton = screen.getByRole("button", {
      name: /sembunyikan tanda tangan/i,
    });
    fireEvent.click(toggleButton);

    expect(onThemeOptionChange).toHaveBeenCalledWith(
      "formal-exam",
      "showSupervisorSignature",
      true
    );
  });

  it("merender slot opsi kustom ketika tema aktif math-my-id (U6)", () => {
    render(
      <BundlePrintSettingsDrawer
        {...createProps({
          activeThemeId: "math-my-id",
        })}
      />
    );

    expect(screen.getByText(/opsi khusus: standar mathbank/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gaya strip header/i)).toBeInTheDocument();
  });
});
