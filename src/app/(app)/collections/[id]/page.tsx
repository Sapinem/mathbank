import { CollectionDetailView } from "@/components/collections/collection-detail-view";

export const metadata = { title: "Koleksi — MathBank" };

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollectionDetailView id={id} />;
}
