import { NextResponse } from "next/server";

/**
 * MAT-39: `/api/collections/[id]/items` DIHAPUS — wadah naskah digabung ke `bundles`.
 * Gunakan `/api/bundles/[id]/items` sebagai pengganti.
 */
export function GET() {
  return NextResponse.json(
    {
      error: {
        code: "RESOURCE_GONE",
        message: "Collections API has been removed. Use /api/bundles/[id]/items instead.",
      },
    },
    { status: 410 },
  );
}
export function POST() {
  return GET();
}
export function PUT() {
  return GET();
}
export function DELETE() {
  return GET();
}
