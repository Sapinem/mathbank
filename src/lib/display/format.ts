/**
 * Pemformat tampilan (Bahasa Indonesia).
 *
 * Semua fungsi di sini MURNI — tanpa akses DB/jaringan — supaya mudah diuji
 * dan aman dipakai di komponen klien maupun server.
 */

/**
 * Ukuran berkas dalam satuan yang mudah dibaca.
 *
 * Memakai basis 1024 (KiB/MiB) karena itu yang diharapkan pengguna saat melihat
 * ukuran berkas di komputer. Angka < 1 KB tidak dibulatkan ke 0 KB — ditampilkan
 * sebagai byte agar tidak terlihat seperti berkas kosong.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  // Satu angka di belakang koma, kecuali bila nilainya bulat.
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}
