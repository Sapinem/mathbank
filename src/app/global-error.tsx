"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Global error boundary (M15) — menangkap galat di root layout.
 *
 * Wajib menyediakan `<html>`/`<body>` sendiri (Next.js melepas layout saat ini).
 * Karena layout (dan CSS bertema) bisa gagal, gaya di sini **inline & minimal**
 * agar tetap tampil walau stylesheet gagal dimuat. Tidak membocorkan stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#fafafa",
          color: "#18181b",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <div
            style={{
              width: "3.5rem",
              height: "3.5rem",
              margin: "0 auto 1rem",
              display: "grid",
              placeItems: "center",
              borderRadius: "1rem",
              background: "rgba(220,38,38,0.1)",
              color: "#dc2626",
            }}
            aria-hidden
          >
            <AlertTriangle size={24} />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            Terjadi kesalahan fatal
          </h1>
          <p style={{ color: "#71717a", fontSize: "0.875rem", margin: "0 0 1.5rem" }}>
            Aplikasi gagal dimuat. Coba muat ulang halaman.
            {error.digest ? ` (Kode: ${error.digest})` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              border: "none",
              borderRadius: "0.5rem",
              background: "#18181b",
              color: "#fafafa",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={16} />
            Muat ulang
          </button>
        </div>
      </body>
    </html>
  );
}
