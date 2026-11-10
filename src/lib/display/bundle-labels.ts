/**
 * Label & kelas tampilan untuk status paket.
 *
 * Satu sumber untuk semua tampilan bundle: sebelumnya `statusBadgeClass`
 * disalin di daftar dan detail, sehingga perubahan palet harus dicari manual di
 * beberapa berkas dan mudah terlewat.
 */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case "ready":
      return "border-success/30 bg-success/10 text-success";
    case "review":
      return "border-gold/30 bg-gold/10 text-gold";
    case "draft":
      return "border-border bg-muted/60 text-muted-foreground";
    case "archived":
      return "border-border/60 bg-muted/30 text-muted-foreground/70";
    default:
      return "";
  }
}
