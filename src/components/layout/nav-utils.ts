/** Utilitas navigasi sidebar (dipakai sidebar & header). */

/** Cek apakah `href` adalah rute aktif untuk `pathname` saat ini. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Terjemahkan segmen teknis (UUID atau slug aksi) ke teks Indonesia yang ramah pengguna. */
export function humanizeSegment(seg: string, parentHref: string): string {
  const decoded = decodeURIComponent(seg);
  if (UUID_RE.test(decoded)) {
    if (parentHref.startsWith("/questions")) return "Detail Soal";
    if (parentHref.startsWith("/bundles")) return "Detail Paket";
    return "Detail";
  }
  if (decoded === "edit") {
    if (parentHref.startsWith("/bundles")) return "Susun Paket";
    return "Sunting";
  }
  if (decoded === "new") {
    if (parentHref.startsWith("/questions")) return "Buat Soal";
    if (parentHref.startsWith("/bundles")) return "Buat Paket";
    return "Baru";
  }
  if (decoded === "print") {
    return "Cetak Naskah";
  }
  return decoded;
}

/**
 * Bangun jejak breadcrumb dari pathname berdasarkan daftar item navigasi.
 * Mengembalikan minimal satu crumb (fallback: Dasbor).
 */
export function breadcrumbFromPath(
  pathname: string,
  groups: { items: { label: string; href: string }[] }[],
): { label: string; href: string }[] {
  for (const group of groups) {
    for (const item of group.items) {
      if (
        item.href !== "/" &&
        (pathname === item.href || pathname.startsWith(item.href + "/"))
      ) {
        const parts = [{ label: item.label, href: item.href }];
        const rest = pathname
          .slice(item.href.length)
          .split("/")
          .filter(Boolean);
        let acc = item.href;
        for (const seg of rest) {
          const parentHref = acc;
          acc += "/" + seg;
          parts.push({ label: humanizeSegment(seg, parentHref), href: acc });
        }
        return parts;
      }
    }
  }
  return [{ label: "Dasbor", href: "/" }];
}
