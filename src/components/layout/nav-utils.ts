/** Utilitas navigasi sidebar (dipakai sidebar & header). */

/** Cek apakah `href` adalah rute aktif untuk `pathname` saat ini. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
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
          acc += "/" + seg;
          parts.push({ label: decodeURIComponent(seg), href: acc });
        }
        return parts;
      }
    }
  }
  return [{ label: "Dasbor", href: "/" }];
}
