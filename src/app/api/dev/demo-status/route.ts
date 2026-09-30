import { NextResponse } from "next/server";

/**
 * GET /api/dev/demo-status — apakah login demo tersedia di lingkungan ini.
 *
 * Dipakai halaman `/login` untuk menampilkan/menyembunyikan pil akun demo,
 * agar di produksi (tanpa `DEMO_LOGIN=enabled`) form login tampil bersih.
 */
export async function GET() {
  const demo =
    process.env.DEMO_LOGIN === "enabled" ||
    process.env.NODE_ENV !== "production";
  return NextResponse.json({ data: { demo } });
}
