import { redirect } from "next/navigation";

/**
 * MAT-40: `/collections/[id]` DIHAPUS — dialihkan ke `/bundles/[id]`.
 */
export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/bundles/${id}`);
}
