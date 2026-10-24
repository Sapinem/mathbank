import { isIP } from "node:net";

/**
 * Resolusi IP klien yang aman dari spoofing di belakang reverse proxy.
 *
 * 1. Prioritaskan header `X-Real-IP` (ditetapkan langsung oleh reverse proxy tepercaya).
 *    Nilai diverifikasi sebagai alamat IP valid (IPv4 atau IPv6).
 * 2. Jika membaca `X-Forwarded-For`, ambil IP TERAKHIR (paling kanan) yang ditambahkan
 *    oleh reverse proxy tepercaya. Mengambil IP pertama memungkinkan penyerang
 *    memalsukan header `X-Forwarded-For` untuk memutar IP dan melewati rate limit.
 */
export function getClientIp(req: Request): string | null {
  const xRealIp = req.headers.get("x-real-ip")?.trim();
  if (xRealIp && isIP(xRealIp)) return xRealIp;

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const candidate = parts[parts.length - 1]!;
      if (isIP(candidate)) return candidate;
    }
  }
  return null;
}
