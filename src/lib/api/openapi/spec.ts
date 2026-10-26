import { toJSONSchema, z } from "zod";
import type { Authz } from "../authz";
import { MANUAL_OPERATIONS, OPERATIONS, type OperationDoc } from "./registry";

/**
 * Penyusun dokumen OpenAPI 3.1 — **murni** (tanpa fs/db), supaya bisa diuji.
 *
 * Sumber kebenaran:
 *  - daftar method & `authz` → `route-inventory.ts` (pemindaian sumber);
 *  - skema query/body/params & status → deklarasi yang ditempel `wrapRoute`
 *    (`ROUTE_DECLARATION`), yaitu skema yang PERSIS dipakai runtime;
 *  - ringkasan, tag, dan skema respons → `registry.ts`.
 *
 * Yang TIDAK dijanjikan: skema per-endpoint untuk respons non-JSON dan route
 * non-wrap — itu didokumentasikan manual di `MANUAL_OPERATIONS`.
 */

export interface RouteLike {
  method: string;
  path: string;
  shape: "wrap" | "manual" | "delegate";
  authz: Authz | null;
}

/** Bentuk struktural deklarasi; sengaja tidak mengimpor `route-wrapper` (db). */
export interface DeclarationLike {
  authz: Authz;
  query?: z.ZodType;
  body?: z.ZodType;
  params?: z.ZodType;
  status: number;
  idempotent: boolean;
}

export interface BuildInput {
  routes: readonly RouteLike[];
  declarations: ReadonlyMap<string, DeclarationLike>;
  info?: { title?: string; version?: string; description?: string };
}

export interface BuildResult {
  spec: Record<string, unknown>;
  problems: string[];
}

type Json = Record<string, unknown>;

/** Buang `$schema` rekursif — OpenAPI 3.1 sudah menetapkan dialeknya. */
function stripSchemaKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSchemaKeys);
  if (value && typeof value === "object") {
    const out: Json = {};
    for (const [key, val] of Object.entries(value as Json)) {
      if (key === "$schema") continue;
      out[key] = stripSchemaKeys(val);
    }
    return out;
  }
  return value;
}

/** Zod → JSON Schema 2020-12 (mode `input`: aman untuk `.transform()`). */
export function jsonSchemaOf(schema: z.ZodType): Json {
  return stripSchemaKeys(toJSONSchema(schema, { io: "input" })) as Json;
}

/** Skema respons sukses selalu dibungkus envelope `{ data }` (CONSTRAINT #17). */
export function envelopeOf(data: z.ZodType): Json {
  return jsonSchemaOf(z.object({ data }));
}

const ERROR_SCHEMA: Json = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string", description: "Kode galat stabil (mis. VALIDATION_ERROR)." },
        message: { type: "string" },
        details: { description: "Rincian tambahan bila ada (isu Zod, daftar soal, dst.)." },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const jsonContent = (schema: Json): Json => ({
  "application/json": { schema },
});

/** Respons galat bersama — satu definisi, dipakai semua operasi. */
function errorResponse(description: string, extra: Json = {}): Json {
  return { description, content: jsonContent(ERROR_SCHEMA), ...extra };
}

const ERROR_RESPONSES: Record<number, Json> = {
  400: errorResponse("Validasi input gagal (Zod)."),
  401: errorResponse("Tidak ada sesi/API key valid."),
  403: errorResponse("Tidak punya izin, atau wajib ganti password."),
  404: errorResponse("Sumber daya tidak ditemukan."),
  409: errorResponse("Konflik data, atau transisi FSM tidak sah."),
  422: errorResponse("Guard domain menolak (mis. soal belum siap)."),
  429: errorResponse("Rate limit terlampaui.", {
    headers: {
      "Retry-After": {
        description: "Detik sampai boleh mencoba lagi.",
        schema: { type: "integer" },
      },
    },
  }),
  500: errorResponse("Kesalahan server tak terduga."),
};

const SECURITY_SCHEMES: Json = {
  sessionCookie: {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
    description: "Sesi Better Auth (login lewat /api/auth).",
  },
  apiKey: {
    type: "apiKey",
    in: "header",
    name: "x-api-key",
    description: "API key agen/mesin (dibuat di /api/system/agent-keys).",
  },
};

function securityFor(authz: Authz | null): Json[] {
  if (!authz || authz.kind === "public") return [];
  return [{ sessionCookie: [] }, { apiKey: [] }];
}

/** `/api/questions/[id]` → `/api/questions/{id}` (templating OpenAPI). */
export function openApiPathOf(path: string): string {
  return path.replace(/\[(?:\.{0,3})([^\]]+)\]/g, "{$1}");
}

/** `GET /api/questions/[id]` → `getQuestionsById`. */
export function operationIdOf(method: string, path: string): string {
  const segments = path
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const dynamic = /^\[(?:\.{0,3})([^\]]+)\]$/.exec(segment);
      if (dynamic) return "By" + capitalize(dynamic[1]);
      return capitalize(segment.replace(/[^A-Za-z0-9]+/g, " ").trim());
    })
    .filter(Boolean);
  return method.toLowerCase() + segments.join("");
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function queryParameters(schema: z.ZodType): Json[] {
  const json = jsonSchemaOf(schema);
  const properties = (json.properties ?? {}) as Record<string, Json>;
  const required = new Set((json.required ?? []) as string[]);
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: property,
  }));
}

function pathParameters(schema: z.ZodType): Json[] {
  const json = jsonSchemaOf(schema);
  const properties = (json.properties ?? {}) as Record<string, Json>;
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: "path",
    required: true,
    schema: property,
  }));
}

function wrapOperation(
  key: string,
  route: RouteLike,
  decl: DeclarationLike,
  meta: OperationDoc,
): Json {
  const parameters = [
    ...(decl.params ? pathParameters(decl.params) : []),
    ...(decl.query ? queryParameters(decl.query) : []),
  ];
  const responses: Json = {};
  responses[String(decl.status)] = {
    description: meta.successDescription ?? "Sukses.",
    content: jsonContent(envelopeOf(meta.response)),
  };
  const isPublic = decl.authz.kind === "public";
  const codes = new Set<number>([400, 429, 500, ...(meta.extraErrors ?? [])]);
  if (!isPublic) {
    codes.add(401);
    codes.add(403);
  }
  if (decl.params) codes.add(404);
  for (const code of [...codes].sort((a, b) => a - b)) {
    responses[String(code)] = ERROR_RESPONSES[code];
  }

  return {
    operationId: operationIdOf(route.method, route.path),
    summary: meta.summary,
    ...(meta.description ? { description: meta.description } : {}),
    tags: meta.tags,
    ...(meta.deprecated ? { deprecated: true } : {}),
    security: securityFor(decl.authz),
    ...(parameters.length ? { parameters } : {}),
    ...(decl.body
      ? {
          requestBody: {
            required: true,
            content: jsonContent(jsonSchemaOf(decl.body)),
          },
        }
      : {}),
    responses,
    "x-mathbank": {
      authz: decl.authz.kind,
      ...(decl.authz.kind === "route" ? { permission: decl.authz.permission } : {}),
      ...(decl.authz.kind === "service"
        ? {
            enforcedIn: decl.authz.enforcedIn,
            ...(decl.authz.routeGate ? { routeGate: decl.authz.routeGate } : {}),
          }
        : {}),
      ...(decl.authz.kind === "public" ? { reason: decl.authz.reason } : {}),
      ...(decl.idempotent ? { idempotent: true } : {}),
      ...(meta.notes ? { notes: meta.notes } : {}),
      source: "src/app/api (wrapRoute)",
    },
  };
}

function manualOperation(key: string, route: RouteLike): Json | null {
  const doc = MANUAL_OPERATIONS[key];
  if (!doc) return null;
  return {
    operationId: operationIdOf(route.method, route.path),
    summary: doc.summary,
    description: doc.description,
    tags: doc.tags,
    ...(doc.deprecated ? { deprecated: true } : {}),
    security: doc.security === "none" ? [] : doc.security === "bearer" ? [{ apiKey: [] }] : [],
    ...(doc.parameters ? { parameters: doc.parameters } : {}),
    ...(doc.requestBody ? { requestBody: doc.requestBody } : {}),
    responses: doc.responses,
    "x-mathbank": {
      authz: "manual",
      security: doc.security,
      ...(doc.accessLabel ? { accessLabel: doc.accessLabel } : {}),
      ...(doc.notes ? { notes: doc.notes } : {}),
    },
  };
}

/** Susun dokumen OpenAPI lengkap + daftar masalah (kosong = lengkap). */
export function buildOpenApi(input: BuildInput): BuildResult {
  const problems: string[] = [];
  const paths: Record<string, Json> = {};

  for (const route of input.routes) {
    const key = `${route.method} ${route.path}`;
    const path = openApiPathOf(route.path);

    if (route.shape === "wrap") {
      const decl = input.declarations.get(key);
      const meta = OPERATIONS[key];
      if (!decl) {
        problems.push(`${key}: deklarasi tidak terbaca dari handler (cek ekspor wrapRoute)`);
        continue;
      }
      if (!meta) {
        problems.push(`${key}: belum ada di OPERATIONS (src/lib/api/openapi/registry.ts)`);
        continue;
      }
      try {
        const operation = wrapOperation(key, route, decl, meta);
        ((paths[path] ??= {}) as Json)[route.method.toLowerCase()] = operation;
      } catch (err) {
        problems.push(`${key}: gagal menyusun operasi — ${(err as Error).message}`);
      }
      continue;
    }

    const operation = manualOperation(key, route);
    if (!operation) {
      problems.push(`${key}: route non-wrap tanpa entri MANUAL_OPERATIONS`);
      continue;
    }
    ((paths[path] ??= {}) as Json)[route.method.toLowerCase()] = operation;
  }

  const declaredKeys = new Set(input.routes.map((r) => `${r.method} ${r.path}`));
  for (const key of Object.keys(OPERATIONS)) {
    if (!declaredKeys.has(key)) problems.push(`${key}: ada di OPERATIONS tapi route-nya tidak ada`);
  }
  for (const key of Object.keys(MANUAL_OPERATIONS)) {
    if (!declaredKeys.has(key)) {
      problems.push(`${key}: ada di MANUAL_OPERATIONS tapi route-nya tidak ada`);
    }
  }

  const spec = {
    openapi: "3.1.0",
    info: {
      title: input.info?.title ?? "MathBank API",
      version: input.info?.version ?? "0.1.0",
      description:
        input.info?.description ??
        "Kontrak HTTP MathBank. Envelope sukses `{ data }`, galat `{ error: { code, message } }`. " +
        "Dihasilkan dari kode (`pnpm openapi:generate`); jangan disunting tangan.",
    },
    servers: [{ url: "/", description: "Relatif terhadap origin aplikasi." }],
    tags: TAGS_FOR_SPEC,
    paths,
    components: { securitySchemes: SECURITY_SCHEMES },
  };

  return { spec: stripSchemaKeys(spec) as Record<string, unknown>, problems };
}

/** Tag operasi (Inggris) + deskripsi Indonesia — dipakai juga oleh tabel dokumen. */
export const TAGS_FOR_SPEC: Json[] = [
  { name: "auth", description: "Autentikasi & identitas (Better Auth)." },
  { name: "questions", description: "Bank soal: baca, tulis, transisi status." },
  { name: "bundles", description: "Paket soal, item, ekspor Moodle." },
  { name: "taxonomy", description: "Topik, label, sumber, event, jenjang." },
  { name: "media", description: "Aset media." },
  { name: "ai", description: "Embedding & enrichment pedagogis." },
  { name: "ingest", description: "Antrean ingest naskah (wajah mesin)." },
  { name: "system", description: "Pengaturan, API key agen, dev." },
  { name: "observability", description: "Health, readiness, metrik." },
];
