import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Package,
  FolderTree,
  Database,
  CalendarDays,
  Tag,
  Image as ImageIcon,
  PenTool,
  Upload,
  Settings,
  type LucideIcon,
} from "lucide-react";

/** Item menu sidebar. */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Tampilkan badge dinamis (mis. jumlah antrean). */
  badge?: "telaah";
  /** Menu tersembunyi (belum aktif sampai milestone tertentu). */
  hidden?: boolean;
}

/** Grup sidebar. */
export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Struktur sidebar — 4 grup (RENCANA-UI.md §2). */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Kerja",
    items: [
      { label: "Dasbor", href: "/", icon: LayoutDashboard },
      { label: "Bank Soal", href: "/bank-soal", icon: BookOpen },
      { label: "Telaah", href: "/telaah", icon: ClipboardCheck, badge: "telaah" },
      { label: "Paket Soal", href: "/paket", icon: Package },
    ],
  },
  {
    label: "Referensi",
    items: [
      { label: "Topik", href: "/referensi/topik", icon: FolderTree },
      { label: "Sumber & Asal", href: "/referensi/sumber", icon: Database },
      { label: "Event", href: "/referensi/event", icon: CalendarDays },
      { label: "Label", href: "/referensi/label", icon: Tag },
    ],
  },
  {
    label: "Studio",
    items: [
      { label: "Galeri Aset", href: "/studio/aset", icon: ImageIcon },
      { label: "TikZ Studio", href: "/studio/tikz", icon: PenTool },
    ],
  },
  {
    label: "Sistem",
    items: [
      // Disembunyikan sampai M9 (RENCANA-UI.md §4)
      { label: "Ingest & Integrasi", href: "/sistem/ingest", icon: Upload, hidden: true },
      { label: "Pengaturan", href: "/sistem/pengaturan", icon: Settings },
    ],
  },
];
