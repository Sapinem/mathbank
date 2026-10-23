import type { Metadata, Viewport } from "next";
import { Roboto_Flex, Roboto_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const robotoFlex = Roboto_Flex({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MathBank",
  description: "Bank soal matematika — kurasi, susun, terbitkan.",
};

/**
 * MAJ — Viewport iOS.
 *
 * `viewportFit: "cover"` wajib agar `env(safe-area-inset-*)` bernilai non-nol
 * di iPhone ber-notch/gesture bar; tanpa ini safe-area selalu 0 dan konten
 * tertutup gesture bar bawah.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${robotoFlex.variable} ${robotoMono.variable} h-full antialiased`}
    >
      {/*
        MAJ — Ergonomi mobile iOS (di-inline agar tidak menyentuh globals.css
        dan tak bergantung varian Tailwind arbitrary yang rapuh di Turbopack):
        - Kontrol form dipaksa font ≥ 16px pada perangkat sentuh / layar kecil
          agar iOS Safari TIDAK auto-zoom saat input difokus (zoom memecah
          tata letak & memicu CLS). Checkbox/radio dikecualikan (tak memicu zoom).
        - `body` memakai `pb-[env(safe-area-inset-bottom)]` (lihat className)
          untuk memberi ruang gesture bar iOS.
      */}
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `.audit-probe{color:red}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col pb-[env(safe-area-inset-bottom)]">
        <ThemeProvider>
          <QueryProvider>
            {children}
            <Toaster
              mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
            />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
