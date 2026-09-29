/**
 * Tautan lompat ke konten utama (a11y).
 *
 * Tak terlihat sampai difokus via keyboard (Tab pertama), lalu muncul.
 * Menargetkan `#konten-utama` (lihat AppShell).
 */
export function SkipLink() {
  return (
    <a
      href="#konten-utama"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-border focus:bg-popover focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
    >
      Lompat ke konten utama
    </a>
  );
}
