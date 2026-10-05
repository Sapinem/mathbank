import { redirect } from "next/navigation";

/**
 * MAT-40: `/collections` DIHAPUS — wadah naskah digabung ke `/bundles`.
 * Semua arsip/koleksi sekarang ditangani oleh antarmuka Bundles terpadu.
 */
export default function CollectionsPage() {
  redirect("/bundles");
}
