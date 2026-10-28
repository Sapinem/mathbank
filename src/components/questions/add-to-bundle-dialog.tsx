"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ListPlus, BookOpen, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldGroup, Field } from "@/components/ui/field-group";
import { useBundles, useAddBundleItem } from "@/lib/hooks/use-bundles";

interface AddToBundleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string;
}

export function AddToBundleDialog({
  open,
  onOpenChange,
  questionId,
}: AddToBundleDialogProps) {
  const { data: bundles = [], isPending: bundlesLoading } = useBundles({ status: "active" });

  const [selectedBundleId, setSelectedBundleId] = useState("");
  const [role, setRole] = useState<"question" | "stimulus">("question");

  const selectedBundle = bundles.find((b) => b.id === selectedBundleId);
  const addItem = useAddBundleItem(selectedBundleId, selectedBundle?.version);

  function handleAdd() {
    if (!selectedBundleId) {
      toast.error("Silakan pilih paket soal terlebih dahulu.");
      return;
    }

    addItem.mutate(
      {
        questionId,
        role,
      },
      {
        onSuccess: () => {
          toast.success("Soal berhasil ditambahkan ke naskah paket.");
          onOpenChange(false);
          setSelectedBundleId("");
        },
        onError: (err) => {
          toast.error("Gagal menambahkan ke paket", {
            description: (err as Error).message,
          });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ListPlus className="size-5 text-primary" />
            <span>Masukkan Soal ke Paket</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tautkan butir soal ini ke salah satu naskah ujian atau paket bahan aktif.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="py-2">
          <Field label="Pilih Paket Naskah Ujian" htmlFor="select-bundle-dest">
            <Select
              value={selectedBundleId}
              onValueChange={(val) => setSelectedBundleId(val ?? "")}
              disabled={bundlesLoading || bundles.length === 0}
            >
              <SelectTrigger id="select-bundle-dest" className="min-h-[44px] w-full">
                <SelectValue
                  placeholder={
                    bundlesLoading
                      ? "Memuat daftar paket…"
                      : bundles.length === 0
                        ? "Belum ada paket aktif"
                        : "Pilih paket naskah tujuan"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {bundles.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{b.title}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {b.bundleType === "exam" ? "Ujian" : "Bahan"} · {b.itemCount ?? 0} butir
                        {b.grade ? ` · Kelas ${b.grade}` : ""}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Peran Butir dalam Naskah" htmlFor="select-bundle-role">
            <Select
              value={role}
              onValueChange={(val) => setRole(val as "question" | "stimulus")}
            >
              <SelectTrigger id="select-bundle-role" className="min-h-[44px] w-full">
                <SelectValue placeholder="Pilih peran butir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="question">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4" />
                    <span>Soal Biasa (Berskoring &amp; Bernomor)</span>
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
          </Field>
        </FieldGroup>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] w-full sm:w-auto"
          >
            Batal
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedBundleId || addItem.isPending}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {addItem.isPending ? "Menambahkan…" : "Tambahkan ke Paket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
