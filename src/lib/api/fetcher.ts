/**
 * Helper fetch API klien (dipakai hook React Query).
 *
 * Mengasumsikan envelope API MathBank: sukses `{ data }`, error `{ error: { code, message, details } }`.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiOptions extends RequestInit {
  ifMatch?: number | "*" | undefined;
}

export async function api<T>(url: string, init?: ApiOptions): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type") && !(init?.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (init?.ifMatch !== undefined) {
    headers.set("if-match", init.ifMatch === "*" ? "*" : `"${init.ifMatch}"`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    error?: { code?: string; message?: string; details?: unknown };
  };

  if (!res.ok) {
    throw new ApiError(
      json?.error?.message ?? `HTTP ${res.status}`,
      res.status,
      json?.error?.code,
      json?.error?.details,
    );
  }

  return json.data as T;
}

/** Alias untuk kompatibilitas hook yang memakai nama apiFetch. */
export const apiFetch = api;

