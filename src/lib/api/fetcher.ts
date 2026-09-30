/**
 * Helper fetch API klien (dipakai hook React Query).
 *
 * **C3:** sebelumnya disalin-tempel di `use-bundles.ts` & `use-taxonomy-refs.ts`.
 * Disatukan agar format error & header konsisten, dan perbaikan hanya di satu tempat.
 *
 * Mengasumsikan envelope API MathBank: sukses `{ data }`, error `{ error: { code, message } }`.
 */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json?.error?.message ?? "Terjadi kesalahan.");
  return json.data as T;
}
