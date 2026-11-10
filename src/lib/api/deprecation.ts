/**
 * Alias API yang sudah digantikan — pembungkus masa transisi (ADR-0028).
 *
 * KENAPA ada: rute ingest dulu ber-prefix `/api/v1` padahal tak ada route lain
 * yang berversi. Memindahkannya tanpa masa transisi memutus klien mesin yang
 * sudah berjalan. Alias karena itu **mendelegasikan** ke handler kanonik — bukan
 * menyalin logikanya — lalu menambahkan header penanda.
 *
 * Header mengikuti RFC 9745 (`Deprecation`) dan RFC 8594 (`Sunset`).
 */

/** Batas akhir alias ingest v1 — 90 hari sejak 2026-10-27. */
export const INGEST_V1_SUNSET = "Mon, 25 Jan 2027 00:00:00 GMT";

/**
 * Tanggal alias dinyatakan deprecated, dalam bentuk Structured Field Date
 * (RFC 9745 §2.1: `@<unix-seconds>`). Nilai `true` dari draft pra-RFC tidak
 * valid dan ditolak parser structured-field.
 */
export const INGEST_V1_DEPRECATED = "@1793059200"; // 2026-10-27T00:00:00Z

/** Batas akhir endpoint ingest raw HTML lama — 90 hari sejak 2026-11-09 (ADR-0031). */
export const INGEST_RAW_SUNSET = "Mon, 08 Feb 2027 00:00:00 GMT";

/** Tanggal rute ingest raw HTML dinyatakan deprecated. */
export const INGEST_RAW_DEPRECATED = "@1794182400"; // 2026-11-09T00:00:00Z

export const INGEST_RAW_SUCCESSOR = "</api/ingest/questions>; rel=\"successor-version\"";

export const INGEST_RAW_DEPRECATION_HEADERS = {
  Deprecation: INGEST_RAW_DEPRECATED,
  Sunset: INGEST_RAW_SUNSET,
  Link: INGEST_RAW_SUCCESSOR,
} as const;

import type { NextRouteArgs } from "./route-wrapper";

type RouteHandler = (req: Request, args?: NextRouteArgs) => Promise<Response>;

/**
 * Bungkus handler kanonik dengan header deprecation.
 *
 * Header disetel pada objek respons yang dikembalikan handler kanonik, sehingga
 * seluruh perilaku (rate limit, idempotensi, envelope, `Cache-Control`) tetap
 * berasal dari `wrapRoute` dan tidak diduplikasi di sini.
 */
export function ingestV1Alias(handler: RouteHandler, canonicalPath: string): RouteHandler {
  return async (req, args) => {
    const response = await handler(req, args);
    response.headers.set("Deprecation", INGEST_V1_DEPRECATED);
    response.headers.set("Sunset", INGEST_V1_SUNSET);
    response.headers.set("Link", `<${canonicalPath}>; rel="successor-version"`);
    return response;
  };
}
