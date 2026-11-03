import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlotInspectorDrawer } from "./slot-inspector-drawer";
import type { BundleItemView } from "@/lib/hooks/use-bundles";

const mutateMock = vi.fn();
vi.mock("@/lib/hooks/use-bundles", () => ({
  useUpdateBundleItemSlot: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
}));

vi.mock("@/components/math/math-content", () => ({
  MathContent: ({ content }: { content: string }) => <span data-testid="math">{content}</span>,
}));

const mockSlotItem: BundleItemView = {
  item: {
    id: "bi-123",
    bundleId: "b-456",
    questionId: "q-789",
    orderIndex: 0,
    role: "question",
    itemNumber: "1a",
    sectionName: "Bagian A",
    notes: "Catatan internal",
  },
  question: {
    id: "q-789",
    contentMarkdown: "Jika $2x + 1 = 5$, hitunglah $x$.",
    questionType: "short_answer",
    status: "ready",
    options: [],
  },
};

describe("SlotInspectorDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merender form pengaturan slot dengan nilai awal yang tepat", () => {
    render(
      <SlotInspectorDrawer
        open={true}
        onOpenChange={vi.fn()}
        bundleId="b-456"
        bundleVersion={1}
        slotItem={mockSlotItem}
        slotOrdinal={1}
      />,
    );

    expect(screen.getByText("Pengaturan Butir #1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1a")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bagian A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Catatan internal")).toBeInTheDocument();
    expect(screen.getByTestId("math")).toHaveTextContent("Jika $2x + 1 = 5$, hitunglah $x$.");
  });

  it("mengirim mutasi dengan nilai baru saat tombol Simpan diklik", () => {
    const onOpenChange = vi.fn();
    render(
      <SlotInspectorDrawer
        open={true}
        onOpenChange={onOpenChange}
        bundleId="b-456"
        bundleVersion={2}
        slotItem={mockSlotItem}
        slotOrdinal={1}
      />,
    );

    const itemNumberInput = screen.getByDisplayValue("1a");
    fireEvent.change(itemNumberInput, { target: { value: "1b" } });

    const saveButton = screen.getByRole("button", { name: /Simpan Perubahan/i });
    fireEvent.click(saveButton);

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(
      {
        itemId: "bi-123",
        patch: {
          itemNumber: "1b",
          role: "question",
          sectionName: "Bagian A",
          notes: "Catatan internal",
        },
        version: 2,
      },
      expect.any(Object),
    );
  });

  it("mengirim null untuk field teks yang dikosongkan", () => {
    render(
      <SlotInspectorDrawer
        open={true}
        onOpenChange={vi.fn()}
        bundleId="b-456"
        bundleVersion={1}
        slotItem={mockSlotItem}
        slotOrdinal={1}
      />,
    );

    const itemNumberInput = screen.getByDisplayValue("1a");
    fireEvent.change(itemNumberInput, { target: { value: "   " } });

    const sectionInput = screen.getByDisplayValue("Bagian A");
    fireEvent.change(sectionInput, { target: { value: "" } });

    const notesInput = screen.getByDisplayValue("Catatan internal");
    fireEvent.change(notesInput, { target: { value: "   " } });

    const saveButton = screen.getByRole("button", { name: /Simpan Perubahan/i });
    fireEvent.click(saveButton);

    expect(mutateMock).toHaveBeenCalledWith(
      {
        itemId: "bi-123",
        patch: {
          itemNumber: null,
          role: "question",
          sectionName: null,
          notes: null,
        },
        version: 1,
      },
      expect.any(Object),
    );
  });
});
