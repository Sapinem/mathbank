import { NextResponse } from "next/server";

/**
 * MAT-39: `/api/collections` DIHAPUS — wadah naskah digabung ke `bundles`.
 * Gunakan `/api/bundles?bundleType=source` sebagai pengganti.
 */
export function GET() {
  return NextResponse.json(
    { error: "Collections API has been removed. Use /api/bundles?bundleType=source instead." },
    { status: 410 },
  );
}
export function POST() {
  return GET();
}
