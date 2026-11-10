import type { ComponentType, ReactNode } from "react";

/**
 * Properti data umum yang diberikan ke komponen Kop halaman pertama naskah cetak.
 */
export interface ThemeKopProps {
  title: string;
  grade?: string | null;
  year?: number | null;
  questionCount: number;
  durationMinutes?: number | null;
  exerciseLabel?: string;
  institutionName: string;
  tagline?: string | null;
  logoUrl?: string;
  onLogoError?: () => void;
  options: Record<string, unknown>;
  brandColor?: string;
  instructions?: string | null;
}

/**
 * Properti data untuk Running Header naskah (Halaman 2+).
 */
export interface ThemeHeaderProps {
  title: string;
  exerciseLabel?: string;
  options: Record<string, unknown>;
}

/**
 * Properti data untuk Running Footer naskah.
 */
export interface ThemeFooterProps {
  institutionName?: string;
  options: Record<string, unknown>;
}

/**
 * Properti data untuk seksi tambahan tema di akhir naskah (misal: lembar tanda tangan pengawas).
 */
export interface ThemeExtraSectionProps {
  title: string;
  institutionName?: string;
  options: Record<string, unknown>;
}

/**
 * Properti yang dioper ke fungsi renderOptions tema di dalam Drawer Pengaturan Cetak.
 */
export interface ThemeOptionsRenderProps {
  options: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

/**
 * Kontrak antarmuka tema halaman cetak naskah (Publishing Engine V2).
 */
export interface PrintTheme {
  /** ID unik tema (kebab-case, misal: "math-my-id", "formal-exam"). */
  id: string;
  /** Nama tampilan tema untuk dropdown antarmuka pengguna (Indonesia). */
  name: string;
  /** Deskripsi ringkas peruntukan tema. */
  description: string;
  /** Komponen kop resmi halaman pertama. */
  Kop: ComponentType<ThemeKopProps>;
  /** Komponen running header (opsional, jika tidak ada memakai header bawaan). */
  Header?: ComponentType<ThemeHeaderProps>;
  /** Komponen running footer (opsional, jika tidak ada memakai footer bawaan). */
  Footer?: ComponentType<ThemeFooterProps>;
  /** Komponen seksi tambahan di akhir naskah (opsional). */
  ExtraSection?: ComponentType<ThemeExtraSectionProps>;
  /** Fungsi render kontrol formulir kustom di drawer (opsional). */
  renderOptions?: (props: ThemeOptionsRenderProps) => ReactNode;
  /** Nilai baku opsi kustom tema. */
  defaultOptions?: Record<string, unknown>;
}
