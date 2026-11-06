import type { PrintTheme } from "./types";
import { mathMyIdTheme } from "./math-my-id";
import { formalExamTheme } from "./formal-exam";

export const DEFAULT_THEME_ID = "math-my-id";

/**
 * Peta statis penyimpan tema cetak yang terdaftar di aplikasi.
 */
const registry = new Map<string, PrintTheme>();

/**
 * Daftarkan tema cetak baru ke dalam registri.
 */
export function registerPrintTheme(theme: PrintTheme): void {
  registry.set(theme.id, theme);
}

// Inisialisasi tema bawaan
registerPrintTheme(mathMyIdTheme);
registerPrintTheme(formalExamTheme);

/**
 * Ambil tema cetak berdasarkan ID.
 * Selalu mengembalikan tema default bila ID tidak ditemukan, kosong, atau null.
 */
export function getPrintTheme(themeId?: string | null): PrintTheme {
  if (themeId && registry.has(themeId)) {
    return registry.get(themeId)!;
  }
  const defaultTheme = registry.get(DEFAULT_THEME_ID);
  if (!defaultTheme) {
    // Fallback minimal jika registri belum terisi agar tidak pernah null
    return {
      id: DEFAULT_THEME_ID,
      name: "Standar MathBank",
      description: "Format naskah standar MathBank.",
      Kop: () => null,
    };
  }
  return defaultTheme;
}

/**
 * Kembalikan seluruh daftar tema yang terdaftar untuk keperluan dropdown UI.
 */
export function listPrintThemes(): PrintTheme[] {
  return Array.from(registry.values());
}

/**
 * Khusus untuk keperluan pengujian unit agar registri dapat dibersihkan.
 */
export function resetPrintThemeRegistryForTesting(): void {
  registry.clear();
}
