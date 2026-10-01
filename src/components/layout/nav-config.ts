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
  badge?: "review";
  /** Nilai badge (jumlah). Kosong = badge tak tampil. */
  badgeCount?: number;
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
      { label: "Bank Soal", href: "/questions", icon: BookOpen },
      { label: "Telaah", href: "/review", icon: ClipboardCheck, badge: "review" },
      { label: "Paket Soal", href: "/bundles", icon: Package },
    ],
  },
  {
    label: "Referensi",
    items: [
      { label: "Topik", href: "/references/topics", icon: FolderTree },
      { label: "Sumber & Asal", href: "/references/sources", icon: Database },
      { label: "Event", href: "/references/events", icon: CalendarDays },
      { label: "Label", href: "/references/labels", icon: Tag },
    ],
  },
  {
    label: "Studio",
    items: [
      { label: "Galeri Aset", href: "/studio/assets", icon: ImageIcon },
      { label: "TikZ Studio", href: "/studio/tikz", icon: PenTool },
    ],
  },
  {
    label: "Sistem",
    items: [
      // Disembunyikan sampai M9 (RENCANA-UI.md §4)
      { label: "Ingest & Integrasi", href: "/system/ingest", icon: Upload, hidden: true },
      { label: "Pengaturan", href: "/system/settings", icon: Settings },
    ],
  },
];
