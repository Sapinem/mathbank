import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masuk - MathBank",
  description: "Masuk ke akun MathBank untuk kurasi, susun, dan terbitkan paket soal matematika.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
