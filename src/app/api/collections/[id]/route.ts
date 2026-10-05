import { NextResponse } from "next/server";

/**
 * MAT-39: `/api/collections/[id]` DIHAPUS — wadah naskah digabung ke `bundles`.
 */
export function GET() {
  return NextResponse.json(
    { error: "Collections API has been removed. Use /api/bundles instead." },
    { status: 410 },
  );
}
export function PATCH() {
  return GET();
}
export function DELETE() {
  return GET();
}
