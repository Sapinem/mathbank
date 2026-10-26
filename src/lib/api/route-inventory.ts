import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Authz, NonOwnPermission } from "./authz";
import { PERMISSIONS, type Permission } from "../auth/permissions";

/**
 * Inventaris route API (L2) — satu sumber kebenaran untuk daftar method dan
 * deklarasi otorisasinya.
 *
 * KENAPA pemindai sendiri, bukan regex: tes lama memakai pola
 * `export const GET = wrapRoute\(\{([\s\S]*?)\n\}\);` yang berhenti di `});`
 * pertama, sehingga opsi dengan objek bersarang terbaca terpotong dan
 * jumlahnya harus ditulis tangan (48/60). Di sini objek diisolasi dengan
 * pencocokan kurung yang melewati string & komentar, jadi struktur bersarang
 * aman dan tidak ada angka yang perlu disunting saat route bertambah.
 *
 * Dipakai oleh `scripts/check-authz.ts` (gerbang CI) dan tes
 * `src/lib/api/authz-coverage.test.ts`.
 */

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** Bentuk deklarasi: lewat `wrapRoute`, fungsi manual, atau delegasi pustaka. */
export type RouteShape = "wrap" | "manual" | "delegate";

export interface RouteMethod {
  method: HttpMethod;
  shape: RouteShape;
  /** `null` untuk method manual/delegasi (otorisasi ada di dalam handler). */
  authz: Authz | null;
  /** Opsi `wrapRoute` memuat `query`/`body`/`params` (CONSTRAINT #22). */
  hasSchema: boolean;
  /** Kunci top-level opsi `wrapRoute` — untuk mendeteksi kunci warisan. */
  optionKeys: string[];
  /** Path berkas relatif terhadap akar repo. */
  file: string;
  /** Path URL, mis. `/api/questions/[id]`. */
  path: string;
}

export interface RouteFile {
  file: string;
  path: string;
  methods: RouteMethod[];
  /**
   * Masalah tingkat BERKAS yang tak terbaca dari `methods` — mis. dua `authz`,
   * kunci warisan, spread, atau `route.ts` tanpa method. Ikut dilaporkan
   * `verifyAuthz`; tanpa ini, berkas cacat lolos gerbang secara diam-diam.
   */
  problems: AuthzProblem[];
}

export interface AuthzProblem {
  file: string;
  method: string | null;
  message: string;
}

/** Akar pemindaian (relatif terhadap akar repo). */
const ROUTES_ROOT = join("src", "app", "api");

/**
 * Route yang **sengaja** tidak memakai `wrapRoute` — masing-masing beralasan.
 *
 * Kunci: `METHOD /path`. Menambah entri di sini adalah tindakan sadar; itulah
 * gunanya: route baru yang melewati `wrapRoute` gagal di `pnpm lint:authz`.
 */
export const MANUAL_ROUTES: Readonly<Record<string, string>> = {
  "GET /api/health":
    "Probe liveness/readiness publik; status sukses dinamis 200/503, sedangkan wrapRoute memakai satu status tetap.",
  "GET /api/ready":
    "Probe readiness publik; alasan sama dengan /api/health (status 200/503).",
  "GET /api/metrics":
    "Metrik runtime; dijaga token METRICS_TOKEN, dan 404 di produksi bila token tak diset.",
  "GET /api/mcp":
    "Transport MCP (Streamable HTTP): GET membuka stream/405, otorisasi bearer di handler.",
  "POST /api/mcp":
    "Transport MCP: JSON-RPC + notifikasi; otorisasi bearer di handler, bukan gerbang izin peran.",
  "DELETE /api/mcp":
    "Transport MCP: mengakhiri sesi; otorisasi bearer di handler.",
  "POST /api/dev/quick-login":
    "Login demo; pagar ganda env (demoLoginAllowed) + rate-limit manual, kontrak respons 404/400/500 dipertahankan.",
  "GET /api/auth/[...all]":
    "Delegasi Better Auth (toNextJsHandler) — menangani login/sesi/OAuth.",
  "POST /api/auth/[...all]":
    "Delegasi Better Auth (toNextJsHandler) — menangani login/sesi/OAuth.",
  // Alias deprecated (ADR-0028): meneruskan ke handler kanonik /api/ingest/*,
  // jadi otorisasi & skema tetap milik handler kanonik, bukan diduplikasi.
  "POST /api/v1/ingest/upload":
    "Alias deprecated /api/ingest/upload — mendelegasikan ke handler kanonik (ADR-0028).",
  "GET /api/v1/ingest/queue":
    "Alias deprecated /api/ingest/queue — mendelegasikan ke handler kanonik (ADR-0028).",
  "POST /api/v1/ingest/commit":
    "Alias deprecated /api/ingest/commit — mendelegasikan ke handler kanonik (ADR-0028).",
};

/**
 * Route `wrapRoute` yang boleh `kind: "public"`.
 *
 * `reason` pada deklarasi menjelaskan *mengapa*; daftar ini memaksa
 * persetujuan kedua saat route publik baru muncul, sehingga `kind: "public"`
 * yang lolos tak sengaja tertangkap di tinjauan.
 */
export const PUBLIC_ROUTES: Readonly<Record<string, string>> = {
  "GET /api/dev/demo-status":
    "Dibaca halaman /login sebelum ada sesi (menentukan tampil/tidaknya tombol demo).",
};

/* ── Pemindai teks ────────────────────────────────────────────────────── */

const OPEN_TO_CLOSE: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** Indeks setelah string/template yang mulai di `i`. */
function skipString(text: string, i: number): number {
  const quote = text[i];
  let j = i + 1;
  while (j < text.length) {
    const c = text[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === quote) return j + 1;
    j++;
  }
  return text.length;
}

/** Indeks setelah komentar yang mulai di `i`. */
function skipComment(text: string, i: number): number {
  if (text[i + 1] === "/") {
    const nl = text.indexOf("\n", i + 2);
    return nl === -1 ? text.length : nl + 1;
  }
  const end = text.indexOf("*/", i + 2);
  return end === -1 ? text.length : end + 2;
}

function isCommentStart(text: string, i: number): boolean {
  return text[i] === "/" && (text[i + 1] === "/" || text[i + 1] === "*");
}

/** Lewati spasi & komentar. */
function skipTrivia(text: string, i: number): number {
  let j = i;
  while (j < text.length) {
    const c = text[j];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      j++;
      continue;
    }
    if (isCommentStart(text, j)) {
      j = skipComment(text, j);
      continue;
    }
    break;
  }
  return j;
}

/** Indeks setelah kurung penutup yang berpasangan dengan `start`. */
function matchBracket(text: string, start: number): number {
  const open = text[start];
  const close = OPEN_TO_CLOSE[open];
  if (!close) return -1;
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(text, i);
      continue;
    }
    if (isCommentStart(text, i)) {
      i = skipComment(text, i);
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return -1;
}

/**
 * Salinan teks dengan isi string & komentar diganti spasi (panjang & posisi
 * tetap). Dipakai untuk *mencari* deklarasi tanpa tertipu teks di dalam
 * komentar; nilai tetap dibaca dari teks asli.
 */
function maskNonCode(text: string): string {
  const out = text.split("");
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < out.length; k++) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      const end = skipString(text, i);
      blank(i, end);
      i = end;
      continue;
    }
    if (isCommentStart(text, i)) {
      const end = skipComment(text, i);
      blank(i, end);
      i = end;
      continue;
    }
    i++;
  }
  return out.join("");
}

/** Indeks titik dua pertama pada kedalaman 0. */
function topLevelColon(text: string): number {
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(text, i);
      continue;
    }
    if (c === "{" || c === "[" || c === "(") {
      depth++;
      i++;
      continue;
    }
    if (c === "}" || c === "]" || c === ")") {
      depth--;
      i++;
      continue;
    }
    if (c === ":" && depth === 0) return i;
    i++;
  }
  return -1;
}

function unquote(text: string): string {
  const t = text.trim();
  if (t.length >= 2) {
    const q = t[0];
    if ((q === '"' || q === "'" || q === "`") && t[t.length - 1] === q) {
      return t.slice(1, -1);
    }
  }
  return t;
}

/** Isi string literal murni; `null` bila bukan literal (variabel, template dinamis). */
function readStringLiteral(value: string): string | null {
  const t = value.trim();
  if (t.length < 2) return null;
  const q = t[0];
  if (q !== '"' && q !== "'" && q !== "`") return null;
  if (t[t.length - 1] !== q) return null;
  const inner = t.slice(1, -1);
  if (q === "`" && inner.includes("${")) return null;
  if (inner.includes("\\")) return null;
  return inner;
}

interface ObjectEntry {
  key: string;
  value: string;
}

/** Uraikan objek literal mulai `openIndex` (`{`) menjadi entri top-level. */
function objectEntries(
  text: string,
  openIndex: number,
): { entries: ObjectEntry[]; hasSpread: boolean } | null {
  const end = matchBracket(text, openIndex);
  if (end < 0) return null;
  const entries: ObjectEntry[] = [];
  let hasSpread = false;
  let depth = 0;
  let itemStart = openIndex + 1;

  const flush = (stop: number) => {
    // Item bisa diawali komentar (`rateLimit: {...}, // catatan\n authz: ...`);
    // tanpa ini, komentar ber-kolon menjadi kunci dan `authz` hilang.
    const raw = text.slice(skipTrivia(text, itemStart), stop);
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("...")) {
      hasSpread = true;
      return;
    }
    const colon = topLevelColon(trimmed);
    if (colon < 0) return;
    entries.push({
      key: unquote(trimmed.slice(0, colon)),
      value: trimmed.slice(colon + 1).trim(),
    });
  };

  let i = openIndex + 1;
  while (i < end - 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(text, i);
      continue;
    }
    if (isCommentStart(text, i)) {
      i = skipComment(text, i);
      continue;
    }
    if (c === "{" || c === "[" || c === "(") {
      depth++;
      i++;
      continue;
    }
    if (c === "}" || c === "]" || c === ")") {
      depth--;
      i++;
      continue;
    }
    if (c === "," && depth === 0) {
      flush(i);
      itemStart = i + 1;
    }
    i++;
  }
  flush(end - 1);
  return { entries, hasSpread };
}

/* ── Pembacaan `authz` ────────────────────────────────────────────────── */

interface ParsedAuthz {
  authz: Authz | null;
  problems: string[];
}

const AUTHZ_KINDS = new Set(["public", "authenticated", "route", "service"]);

function parseAuthz(value: string): ParsedAuthz {
  const problems: string[] = [];
  const t = value.trim();
  if (!t.startsWith("{")) {
    return { authz: null, problems: ["authz harus objek literal agar bisa diverifikasi"] };
  }
  const obj = objectEntries(t, 0);
  if (!obj) return { authz: null, problems: ["authz tidak tertutup rapi"] };
  if (obj.hasSpread) {
    problems.push("authz memuat spread — pemeriksa tak bisa memastikan isinya");
  }

  const get = (key: string) => obj.entries.find((e) => e.key === key)?.value;
  const duplicates = obj.entries
    .map((e) => e.key)
    .filter((k, idx, all) => all.indexOf(k) !== idx);
  if (duplicates.length) problems.push("authz memuat kunci ganda: " + duplicates.join(", "));

  const kindRaw = get("kind");
  const kind = kindRaw ? readStringLiteral(kindRaw) : null;
  if (!kind) {
    problems.push("authz.kind wajib string literal");
    return { authz: null, problems };
  }
  if (!AUTHZ_KINDS.has(kind)) {
    problems.push('authz.kind "' + kind + '" tidak dikenal');
    return { authz: null, problems };
  }

  if (kind === "public") {
    const raw = get("reason");
    const reason = raw ? readStringLiteral(raw) : null;
    if (!reason || !reason.trim()) problems.push("authz public wajib `reason` berupa teks");
    return { authz: { kind: "public", reason: reason ?? "" }, problems };
  }
  if (kind === "authenticated") {
    return { authz: { kind: "authenticated" }, problems };
  }

  const permissionKey = kind === "route" ? "permission" : "routeGate";
  const permissionRaw = get(permissionKey);
  const permission = permissionRaw ? readStringLiteral(permissionRaw) : null;
  if (kind === "route" || permissionRaw !== undefined) {
    if (!permission) problems.push("authz." + permissionKey + " wajib string literal");
  }
  if (kind === "route") {
    if (!permission) return { authz: null, problems };
    return { authz: { kind: "route", permission: permission as NonOwnPermission }, problems };
  }

  const enforcedRaw = get("enforcedIn");
  const enforcedIn = enforcedRaw ? readStringLiteral(enforcedRaw) : null;
  if (!enforcedIn) problems.push("authz service wajib `enforcedIn` (path.ts:namaFungsi)");
  const service: Authz = permission
    ? { kind: "service", enforcedIn: enforcedIn ?? "", routeGate: permission as NonOwnPermission }
    : { kind: "service", enforcedIn: enforcedIn ?? "" };
  return { authz: service, problems };
}

/* ── Pemindaian berkas route ──────────────────────────────────────────── */

function walkRouteFiles(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = join(dir, entry);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) out = out.concat(walkRouteFiles(abs));
    else if (entry === "route.ts") out.push(abs);
  }
  return out;
}

function routePathFromFile(file: string, root: string): string {
  const rel = relative(join(root, ROUTES_ROOT), file).split(sep).join("/");
  const segments = rel.split("/").slice(0, -1);
  return segments.length ? "/api/" + segments.join("/") : "/api";
}

interface Declaration {
  method: HttpMethod;
  shape: RouteShape;
  /** Indeks awal nilai inisialisasi (setelah `=`). */
  initIndex: number;
}

function findDeclarations(masked: string): Declaration[] {
  const found: Declaration[] = [];
  const methods = HTTP_METHODS.join("|");

  const fn = new RegExp("(?:^|[^\\w$])export\\s+(?:async\\s+)?function\\s+(" + methods + ")\\s*\\(", "g");
  for (const m of masked.matchAll(fn)) {
    found.push({ method: m[1] as HttpMethod, shape: "manual", initIndex: m.index ?? 0 });
  }

  const single = new RegExp("(?:^|[^\\w$])export\\s+const\\s+(" + methods + ")\\s*=", "g");
  for (const m of masked.matchAll(single)) {
    found.push({
      method: m[1] as HttpMethod,
      shape: "delegate",
      initIndex: (m.index ?? 0) + m[0].length,
    });
  }

  const destructured = new RegExp("(?:^|[^\\w$])export\\s+const\\s*\\{([^}]*)\\}\\s*=", "g");
  for (const m of masked.matchAll(destructured)) {
    const names = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is HttpMethod => (HTTP_METHODS as readonly string[]).includes(s));
    for (const name of names) {
      found.push({
        method: name,
        shape: "delegate",
        initIndex: (m.index ?? 0) + m[0].length,
      });
    }
  }

  return found;
}

/** Uraikan satu berkas route menjadi method + deklarasi otorisasinya. */
function scanFile(file: string, root: string): { entry: RouteFile; problems: AuthzProblem[] } {
  const text = readFileSync(file, "utf8");
  const masked = maskNonCode(text);
  const relFile = relative(root, file).split(sep).join("/");
  const path = routePathFromFile(file, root);
  const problems: AuthzProblem[] = [];
  const methods: RouteMethod[] = [];

  const seen = new Set<HttpMethod>();
  for (const decl of findDeclarations(masked)) {
    if (seen.has(decl.method)) {
      problems.push({
        file: relFile,
        method: decl.method,
        message: "method diekspor lebih dari sekali",
      });
      continue;
    }
    seen.add(decl.method);

    const initIndex = skipTrivia(masked, decl.initIndex);
    const isWrap = masked.startsWith("wrapRoute", initIndex);

    if (decl.shape === "manual" || !isWrap) {
      methods.push({
        method: decl.method,
        shape: decl.shape === "manual" ? "manual" : "delegate",
        authz: null,
        hasSchema: false,
        optionKeys: [],
        file: relFile,
        path,
      });
      continue;
    }

    // Lewati nama fungsi + generik opsional, lalu buka objek opsi.
    let i = skipTrivia(masked, initIndex + "wrapRoute".length);
    if (masked[i] === "<") {
      const close = matchBracket(masked, i);
      i = close < 0 ? masked.length : skipTrivia(masked, close);
    }
    if (masked[i] !== "(") {
      problems.push({
        file: relFile,
        method: decl.method,
        message: "panggilan wrapRoute tidak terbaca",
      });
      continue;
    }
    i = skipTrivia(masked, i + 1);
    if (masked[i] !== "{") {
      problems.push({
        file: relFile,
        method: decl.method,
        message: "argumen wrapRoute bukan objek literal",
      });
      continue;
    }
    const obj = objectEntries(text, i);
    if (!obj) {
      problems.push({
        file: relFile,
        method: decl.method,
        message: "opsi wrapRoute tidak tertutup rapi",
      });
      continue;
    }

    const optionKeys = obj.entries.map((e) => e.key);
    const authzEntries = obj.entries.filter((e) => e.key === "authz");
    const legacy = optionKeys.filter((k) => k === "permission" || k === "auth");

    if (legacy.length) {
      problems.push({
        file: relFile,
        method: decl.method,
        message: "kunci warisan (" + legacy.join(", ") + ") — pakai `authz`",
      });
    }
    if (obj.hasSpread) {
      problems.push({
        file: relFile,
        method: decl.method,
        message: "opsi wrapRoute memuat spread — isi authz tak bisa dipastikan",
      });
    }
    if (authzEntries.length !== 1) {
      problems.push({
        file: relFile,
        method: decl.method,
        message: "wajib tepat satu `authz` (ditemukan " + authzEntries.length + ")",
      });
    }

    const parsed = authzEntries[0]
      ? parseAuthz(authzEntries[0].value)
      : { authz: null, problems: [] as string[] };
    for (const message of parsed.problems) {
      problems.push({ file: relFile, method: decl.method, message });
    }

    methods.push({
      method: decl.method,
      shape: "wrap",
      authz: parsed.authz,
      hasSchema: ["query", "body", "params"].some((k) => optionKeys.includes(k)),
      optionKeys,
      file: relFile,
      path,
    });
  }

  if (methods.length === 0) {
    problems.push({ file: relFile, method: null, message: "route tanpa method HTTP" });
  }

  return { entry: { file: relFile, path, methods, problems }, problems };
}

/** Pindai seluruh `src/app/api/**\/route.ts`. */
export function scanRoutes(root: string = process.cwd()): RouteFile[] {
  return walkRouteFiles(join(root, ROUTES_ROOT))
    .sort()
    .map((file) => scanFile(file, root).entry);
}

/* ── Pemeriksaan kebijakan ────────────────────────────────────────────── */

const ENFORCED_IN_PATTERN = /^([\w./@[\]-]+\.ts):([A-Za-z_$][\w$]*)$/;
const AUTHZ_MARKER = /(?:assertCan\s*\(|assertBundle\w*\s*\(|hasRole\s*\(|ForbiddenError)/;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Badan fungsi bernama `name` (deklarasi `function` atau `const = (...) => {}`). */
function functionBodies(text: string, name: string): string[] {
  const masked = maskNonCode(text);
  const bodies: string[] = [];
  const esc = escapeRegExp(name);

  const decls = new RegExp(
    "(?:^|[^\\w$])(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s+" +
      esc +
      "\\s*(?:<[^<>()]*>)?\\s*\\(",
    "g",
  );
  for (const m of masked.matchAll(decls)) {
    const parenIndex = (m.index ?? 0) + m[0].length - 1;
    const body = bodyAfterParams(text, masked, parenIndex);
    if (body) bodies.push(body);
  }

  const arrows = new RegExp(
    "(?:^|[^\\w$])(?:export\\s+)?(?:const|let|var)\\s+" +
      esc +
      "\\s*=\\s*(?:async\\s*)?",
    "g",
  );
  for (const m of masked.matchAll(arrows)) {
    let i = skipTrivia(masked, (m.index ?? 0) + m[0].length);
    if (masked.startsWith("function", i)) continue;
    if (masked[i] === "(") {
      const close = matchBracket(masked, i);
      if (close < 0) continue;
      i = skipTrivia(masked, close);
      if (!masked.startsWith("=>", i)) continue;
      i = skipTrivia(masked, i + 2);
    }
    if (masked[i] === "{") {
      const end = matchBracket(masked, i);
      if (end > 0) bodies.push(text.slice(i, end));
    }
  }

  return bodies;
}

function bodyAfterParams(text: string, masked: string, parenIndex: number): string | null {
  const close = matchBracket(masked, parenIndex);
  if (close < 0) return null;
  let i = skipTrivia(masked, close);
  // Tipe balik: lewati sampai `{` (badan) atau `;` (deklarasi overload).
  while (i < masked.length && masked[i] !== "{" && masked[i] !== ";") {
    if (masked[i] === "(" || masked[i] === "[") {
      const end = matchBracket(masked, i);
      if (end < 0) return null;
      i = skipTrivia(masked, end);
      continue;
    }
    i++;
  }
  if (masked[i] !== "{") return null;
  const end = matchBracket(masked, i);
  return end < 0 ? null : text.slice(i, end);
}

function isOwnForAnyRole(permission: string): boolean {
  const row = PERMISSIONS[permission as Permission];
  if (!row) return false;
  return Object.values(row).some((access) => access === "own");
}

function checkPermission(
  permission: string,
  where: string,
  file: string,
  method: string,
): AuthzProblem[] {
  if (!(permission in PERMISSIONS)) {
    return [
      {
        file,
        method,
        message: where + ': izin "' + permission + '" tidak ada di matriks PERMISSIONS',
      },
    ];
  }
  if (isOwnForAnyRole(permission)) {
    return [
      {
        file,
        method,
        message:
          where +
          ': "' +
          permission +
          '" ber-`own` untuk suatu peran — assertCan tanpa ownerId selalu menolak ' +
          "(CONSTRAINT #35). Tegakkan di service.",
      },
    ];
  }
  return [];
}

/**
 * Periksa seluruh inventaris terhadap aturan otorisasi.
 *
 * Mengembalikan daftar pelanggaran; array kosong = lolos.
 */
export function verifyAuthz(
  routes: RouteFile[] = scanRoutes(),
  root: string = process.cwd(),
): AuthzProblem[] {
  const problems: AuthzProblem[] = [];
  const serviceText = new Map<string, string | null>();

  const readService = (file: string): string | null => {
    if (!serviceText.has(file)) {
      try {
        serviceText.set(file, readFileSync(join(root, file), "utf8"));
      } catch {
        serviceText.set(file, null);
      }
    }
    return serviceText.get(file) ?? null;
  };

  for (const route of routes) {
    problems.push(...route.problems);
    for (const m of route.methods) {
      const key = m.method + " " + m.path;

      if (m.shape !== "wrap") {
        if (!(key in MANUAL_ROUTES)) {
          problems.push({
            file: m.file,
            method: m.method,
            message:
              "method " + m.shape + " di luar allowlist — pakai `wrapRoute` atau daftarkan " +
              "alasannya di MANUAL_ROUTES (src/lib/api/route-inventory.ts)",
          });
        }
        continue;
      }

      if (!m.hasSchema) {
        problems.push({
          file: m.file,
          method: m.method,
          message: "opsi wrapRoute tanpa `query`/`body`/`params` (CONSTRAINT #22)",
        });
      }

      const authz = m.authz;
      if (!authz) {
        problems.push({ file: m.file, method: m.method, message: "authz tidak terbaca" });
        continue;
      }

      if (authz.kind === "public") {
        if (!authz.reason.trim()) {
          problems.push({ file: m.file, method: m.method, message: "authz public tanpa reason" });
        }
        if (!(key in PUBLIC_ROUTES)) {
          problems.push({
            file: m.file,
            method: m.method,
            message:
              "route publik " + key + " belum disetujui — tambahkan ke PUBLIC_ROUTES " +
              "(src/lib/api/route-inventory.ts) bila memang disengaja",
          });
        }
        continue;
      }

      if (authz.kind === "route") {
        problems.push(...checkPermission(authz.permission, "authz.permission", m.file, m.method));
        continue;
      }

      if (authz.kind !== "service") continue;

      if (authz.routeGate) {
        problems.push(...checkPermission(authz.routeGate, "authz.routeGate", m.file, m.method));
      }

      const match = ENFORCED_IN_PATTERN.exec(authz.enforcedIn);
      if (!match) {
        problems.push({
          file: m.file,
          method: m.method,
          message:
            'authz.enforcedIn "' + authz.enforcedIn + '" tidak berbentuk path.ts:namaFungsi',
        });
        continue;
      }

      const serviceFile = match[1];
      const fnName = match[2];
      const text = readService(serviceFile);
      if (text === null) {
        problems.push({
          file: m.file,
          method: m.method,
          message: "authz.enforcedIn: berkas " + serviceFile + " tidak ditemukan",
        });
        continue;
      }

      const bodies = functionBodies(text, fnName);
      if (bodies.length === 0) {
        problems.push({
          file: m.file,
          method: m.method,
          message: "authz.enforcedIn: fungsi " + fnName + " tidak ditemukan di " + serviceFile,
        });
        continue;
      }
      if (!bodies.some((body) => AUTHZ_MARKER.test(body))) {
        problems.push({
          file: m.file,
          method: m.method,
          message:
            "authz.enforcedIn: " + serviceFile + ":" + fnName +
            " tidak memuat pemeriksaan otorisasi " +
            "(assertCan/assertBundle/hasRole/ForbiddenError) — komentar bisa basi",
        });
      }
    }
  }

  return problems;
}
