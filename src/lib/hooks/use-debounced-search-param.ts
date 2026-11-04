import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Hook untuk menyinkronkan input pencarian lokal dengan query parameter URL
 * secara debounce (default 300 ms). Menghapus parameter `page` saat kata kunci berubah.
 */
export function useDebouncedSearchParam(
  basePath: string,
  paramKey = "q",
  delayMs = 300,
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramValue = searchParams.get(paramKey) ?? "";
  const [search, setSearch] = useState(paramValue);

  const [prevParam, setPrevParam] = useState(paramValue);
  if (prevParam !== paramValue) {
    setPrevParam(paramValue);
    setSearch(paramValue);
  }

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === paramValue) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (trimmed) next.set(paramKey, trimmed);
      else next.delete(paramKey);
      next.delete("page");
      const qs = next.toString();
      router.replace(`${basePath}${qs ? `?${qs}` : ""}`, { scroll: false });
    }, delayMs);
    return () => clearTimeout(t);
  }, [search, paramValue, searchParams, router, basePath, paramKey, delayMs]);

  return [search, setSearch] as const;
}
