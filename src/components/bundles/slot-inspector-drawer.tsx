"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, BookOpen, Save } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldGroup, Field } from "@/components/ui/field-group";
import { MathContent } from "@/components/math/math-content";
import { useUpdateBundleItemSlot, type BundleItemView } from "@/lib/hooks/use-bundles";

interface SlotInspectorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundleId: string;
  bundleVersion?: number | "*";
  slotItem: BundleItemView | null;
  slotOrdinal: number;
}

/** Form editor slot dengan key-based remount pattern (menghilangkan useEffect setState). */
function SlotInspectorForm({
  slotItem,
  slotOrdinal,
  bundleId,
  bundleVersion,
  onClose,
}: {
  slotItem: BundleItemView;
  slotOrdinal: number;
  bundleId: string;
  bundleVersion?: number | "*";
  onClose: () => void;
}) {
  const updateSlot = useUpdateBundleItemSlot(bundleId, bundleVersion);

  const [itemNumber, setItemNumber] = useState(slotItem.item.itemNumber ?? "");
  const [role, setRole] = useState<"question" | "stimulus">(slotItem.item.role);
  const [sectionName, setSectionName] = useState(slotItem.item.sectionName ?? "");
  const [notes, setNotes] = useState(slotItem.item.notes ?? "");

  function handleSave() {
    updateSlot.mutate(
      {
        itemId: slotItem.item.id,
        patch: {
          itemNumber: itemNumber.trim() ? itemNumber.trim() : null,
          role,
          sectionName: sectionName.trim() ? sectionName.trim() : null,
          notes: notes.trim() ? notes.trim() : null,
        },
        version: bundleVersion,
      },
      {
        onSuccess: () => {
          toast.success("Pengaturan butir soal berhasil disimpan");
          onClose();
        },
        onError: (err) => {
          toast.error("Gagal menyimpan butir soal", {
            description: err.message,
          });
        },
      },
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {role === "stimulus" ? (
            <BookOpen className="size-5 text-info" />
          ) : (
            <FileText className="size-5 text-primary" />
          )}
          <span>Pengaturan Butir #{slotOrdinal}</span>
        </SheetTitle>
        <SheetDescription>
          Sesuaikan nomor khusus naskah, peran butir, seksi naskah, dan catatan internal untuk lembar cetak.
        </SheetDescription>
      </SheetHeader>

      {/* Pratinjau Naskah Soal */}
      <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pratinjau Butir
        </span>
        <div className="max-h-36 overflow-y-auto text-xs">
          <MathContent
            content={slotItem.question.contentMarkdown}
            className="line-clamp-4"
          />
        </div>
      </div>

      {/* Form Pengaturan Slot */}
      <FieldGroup>
        <Field
          label="Nomor Butir Khusus (Opsional)"
          htmlFor="slot-item-number"
        >
          <Input
            id="slot-item-number"
            value={itemNumber}
            onChange={(e) => setItemNumber(e.target.value)}
            placeholder={`Default: ${slotOrdinal} (mis. "1a", "A.1", "Wacana 1")`}
            className="min-h-[44px]"
          />
          <span className="text-[11px] text-muted-foreground">
            Kosongkan untuk menggunakan penomoran urut otomatis naskah.
          </span>
        </Field>

        <Field label="Peran Butir dalam Naskah" htmlFor="slot-role">
          <Select
            value={role}
            onValueChange={(val) => setRole(val as "question" | "stimulus")}
          >
            <SelectTrigger id="slot-role" className="min-h-[44px] w-full">
              <SelectValue placeholder="Pilih peran butir" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="question">
                <div className="flex items-center gap-2">
                  <FileText className="size-4" />
                  <span>Soal (Berskoring &amp; Bernomor)</span>
                </div>
              </SelectItem>
              <SelectItem value="stimulus">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4 text-info" />
                  <span>Wacana / Stimulus (Tanpa Nomor)</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">
            Wacana tampil sebagai kotak stimulus bersama tanpa mengurangi jatah nomor soal.
          </span>
        </Field>

        <Field
          label="Nama Seksi / Bagian Naskah"
          htmlFor="slot-section-name"
        >
          <Input
            id="slot-section-name"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            placeholder='Contoh: "Bagian I: Pilihan Ganda"'
            className="min-h-[44px]"
          />
          <span className="text-[11px] text-muted-foreground">
            Memisahkan soal ke dalam bab/seksi ujian pada lembar cetak A4.
          </span>
        </Field>

        <Field
          label="Catatan Internal / Rubrik Guru"
          htmlFor="slot-notes"
        >
          <Textarea
            id="slot-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan pengerjaan atau kisi-kisi khusus untuk butir ini..."
            rows={3}
            className="resize-none"
          />
        </Field>
      </FieldGroup>

      <SheetFooter className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
        <Button
          variant="outline"
          onClick={onClose}
          className="min-h-[44px] w-full sm:w-auto"
        >
          Batal
        </Button>
        <Button
          onClick={handleSave}
          disabled={updateSlot.isPending}
          className="min-h-[44px] w-full sm:w-auto"
        >
          <Save className="size-4" data-icon="inline-start" />
          <span>{updateSlot.isPending ? "Menyimpan…" : "Simpan Perubahan"}</span>
        </Button>
      </SheetFooter>
    </>
  );
}

export function SlotInspectorDrawer({
  open,
  onOpenChange,
  bundleId,
  bundleVersion,
  slotItem,
  slotOrdinal,
}: SlotInspectorDrawerProps) {
  if (!slotItem) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-6 overflow-y-auto sm:max-w-md">
        <SlotInspectorForm
          key={slotItem.item.id}
          slotItem={slotItem}
          slotOrdinal={slotOrdinal}
          bundleId={bundleId}
          bundleVersion={bundleVersion}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
