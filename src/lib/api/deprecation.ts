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

/** Jalur kanonik pengganti (untuk header `Link: rel="successor-version"`). */
export const INGEST_CANONICAL = "/api/ingest";

import type { NextRouteArgs } from "./route-wrapper";

type RouteHandler = (req: Request, args?: NextRouteArgs) => Promise<Response>;

/**
 * Bungkus handler kanonik dengan header deprecation.
 *
 * Header disetel pada objek respons yang dikembalikan handler kanonik, sehingga
 * seluruh perilaku (rate limit, idempotensi, envelope, `Cache-Control`) tetap
 * berasal dari `wrapRoute` dan tidak diduplikasi di sini.
 */
export function ingestV1Alias(handler: RouteHandler): RouteHandler {
  return async (req, args) => {
    const response = await handler(req, args);
    response.headers.set("Deprecation", "true");
    response.headers.set("Sunset", INGEST_V1_SUNSET);
    response.headers.set("Link", `<${INGEST_CANONICAL}>; rel="successor-version"`);
    return response;
  };
}
