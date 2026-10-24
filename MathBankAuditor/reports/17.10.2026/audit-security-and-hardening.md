# Security Audit Report: MathBank v2.0

> ⚠️ **DIGANTIKAN (2026-10-17)** — laporan ini tidak memuat bukti eksekusi, melewatkan
> ≥4 temuan HIGH yang terverifikasi (otorisasi `question:flag`, spoof `X-Forwarded-For`,
> TLS *relaxed*, root ekspor GitSync), dan merekomendasikan perbaikan traversal
> `corpus://` yang **belum diterapkan** (masih dapat dieksploitasi).
> Rujukan berlaku: `MathBankAuditor/reports/2026-10-17/audit-security-and-hardening.md`.
> Jangan jadikan dokumen ini dasar sign-off.

**Target File Path:** `MathBankAuditor/reports/17.10.2026/audit-security-and-hardening.md`  
**Audit Date:** 17 Oktober 2026  
**Auditor Persona:** Security Engineer (`security-and-hardening`)  
**Scope:** Core Architecture, Authentication & Authorization (L1), API Gateways (L4), Domain Services (L5), Pure Engines (L6), Data Projections & Storage (L7/L8), External Integrations, Media Ingestion & MCP/AI (L9).

---

### Summary

| Severity | Count | Status / Action |
|---|:---:|---|
| **Critical** | 0 | None identified |
| **High** | 2 | Must be resolved before v2.0 production release |
| **Medium** | 3 | Address during current sprint / v2.0 preparation |
| **Low** | 2 | Defense-in-depth and operational hardening |

---

### Findings

#### [HIGH] SEC-01: Path Traversal in `fetchCorpusImage` via Permissive Regex
- **Location:** [`src/lib/ingest/media/fetch.ts:349-368`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L349-L368)
- **Vulnerability Type:** CWE-22: Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')
- **Description:**  
  In `fetchCorpusImage`, incoming `corpus://` URLs are split into path segments and validated with the regex `/^[A-Za-z0-9._\-]+$/`. Although the inline comment claims to reject `..` traversal, the dot character `.` is explicitly included in the allowed character set. Consequently, a segment consisting of `".."` satisfies `safe.test("..") === true`.
  When `absPath` is constructed using `join(CORPORA_BASE, sumber!, "images", ...sisa)`, `join` traverses out of the intended `CORPORA_BASE` directory into parent filesystem directories.
  While `sniffMime` enforces that the file starts with recognized image magic bytes or `<svg`/`<?xml`, any arbitrary file on the system that is an image or begins with XML markup (e.g., XML configurations, POM files, SVG files) can be read from arbitrary filesystem paths.
- **Impact:**  
  Unauthorized read access to local host files matching image/XML signatures (arbitrary file disclosure on the server hosting the ingestion process).
- **Proof of Concept:**  
  Providing a corpus URL with traversal segments:
  ```typescript
  const evilUrl = "corpus://defantri/../../../../etc/somexml.xml";
  // parts = ["defantri", "..", "..", "..", "..", "etc", "somexml.xml"]
  // parts.every((p) => /^[A-Za-z0-9._\-]+$/.test(p)) evaluates to TRUE
  // absPath resolves to "/etc/somexml.xml"
  ```
- **Recommendation:**  
  Enforce explicit checks against `.` and `..` segments, and verify that the canonicalized path resides strictly within `CORPORA_BASE`.

  ```typescript
  // Fix in src/lib/ingest/media/fetch.ts
  const safe = /^[A-Za-z0-9_\-]+$/; // do not allow dots in folder/slug segments
  if (parts.some((p) => p === ".." || p === ".")) {
    return { ok: false, error: `corpus:// path traversal detected: ${url}` };
  }
  const [sumber, ...sisa] = parts;
  const targetDir = resolve(join(CORPORA_BASE, sumber!, "images"));
  const absPath = resolve(join(targetDir, ...sisa));
  if (!absPath.startsWith(targetDir + sep)) {
    return { ok: false, error: `corpus:// path keluar dari direktori yang diizinkan` };
  }
  ```

---

#### [HIGH] SEC-02: SSRF TOCTOU (DNS Rebinding) & Incomplete IP Blacklist in Media Fetcher
- **Location:** [`src/lib/ingest/media/fetch.ts:111-141`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L111-L141) and [`src/lib/ingest/media/fetch.ts:281-304`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts#L281-L304)
- **Vulnerability Type:** CWE-918: Server-Side Request Forgery (SSRF) / Time-of-Check to Time-of-Use (TOCTOU)
- **Description:**  
  The media download engine in `fetch.ts` has two distinct SSRF gaps:
  1. **TOCTOU / DNS Rebinding:** In `fetchHop()`, the host is pre-resolved via `assertPublicTarget(url, relaxedHosts, resolve)`. Once verified, Node's standard `fetch(url, { redirect: "manual" })` is executed. Node's HTTP client (`undici`) initiates its own independent DNS resolution during connection setup. If an attacker configures an authoritative DNS server with a TTL of 0 seconds, the verification resolution returns an external IP (e.g. `93.184.216.34`), but the subsequent `fetch()` resolves to `127.0.0.1` or the cloud metadata endpoint `169.254.169.254`.
  2. **Incomplete IP Validation:** The function `isPrivateOrBlockedHost()` relies on a regex matching standard 4-octet IPv4 notation (`/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/`). It does not detect:
     - IPv4-mapped IPv6 literals: `[::ffff:127.0.0.1]` or `[::ffff:169.254.169.254]`.
     - Decimal/hexadecimal representations: `http://2130706433/` (`127.0.0.1`).
     - Carrier-Grade NAT (CGNAT) RFC 6598 range (`100.64.0.0/10`), commonly used in cloud private networks.
- **Impact:**  
  Attacker-controlled ingestion sources can probe and exfiltrate internal services, local databases, or cloud instance metadata credentials.
- **Proof of Concept:**  
  1. An attacker serves an image URL with an IPv4-mapped IPv6 host:
     `http://[::ffff:127.0.0.1]:1234/api/metrics`
     `isPrivateOrBlockedHost()` only checks `fe80:`, `fc`, `fd`, and `::1`. It fails to detect `::ffff:`, bypassing the filter.
  2. An attacker sets up a domain `rebind.evil.com` with TTL=0. Query 1 returns `1.1.1.1` (passes `assertPublicTarget`). Query 2 executed by `fetch()` returns `169.254.169.254`.
- **Recommendation:**  
  Use a canonical IP parser (such as `ipaddr.js`) to assert `range() === 'unicast'`. Pin the HTTP request to the resolved IP directly using a custom dispatcher or undici agent.

  ```typescript
  import ipaddr from "ipaddr.js";

  export function isPrivateOrBlockedHost(hostname: string): boolean {
    const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host === "0.0.0.0") return true;
    try {
      const addr = ipaddr.parse(host);
      const range = addr.range();
      return range !== "unicast";
    } catch {
      // Not a raw IP literal; proceed to DNS resolution check
      return false;
    }
  }
  ```

---

#### [MEDIUM] SEC-03: Spoofable Client IP in Rate Limiter via Unverified `X-Forwarded-For`
- **Location:** [`src/lib/api/route-wrapper.ts:87-91`](file:///home/hari/projects/mathbank/src/lib/api/route-wrapper.ts#L87-L91) and [`src/app/img/[shortId]/route.ts:32-36`](file:///home/hari/projects/mathbank/src/app/img/%5BshortId%5D/route.ts#L32-L36)
- **Vulnerability Type:** CWE-345 / CWE-290: Improper Authentication / Rate Limit Bypass by IP Spoofing
- **Description:**  
  The `clientIp(req)` helper in `route-wrapper.ts` and `[shortId]/route.ts` reads the client IP by taking the first element of `req.headers.get("x-forwarded-for")`.  
  In contrast, [`src/lib/auth/server.ts:72-80`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L72-L80) explicitly warns:
  ```typescript
  // IP asli klien di balik Cloudflare ada di header cf-connecting-ip
  // (header default x-forwarded-for tak dapat dipercaya di sini).
  ```
  Because any HTTP client can set an arbitrary `X-Forwarded-For` header, unauthenticated or IP-keyed rate limits (such as `media:serve` in `/img/[shortId]` or unauthenticated endpoints) can be bypassed by rotating the header value.
- **Impact:**  
  Denial of Service (DoS) and brute-force protection bypass on IP-throttled routes.
- **Proof of Concept:**  
  An attacker script emits requests with randomized headers:
  ```bash
  for i in {1..500}; do
    curl -H "X-Forwarded-For: 203.0.113.$i" https://b.iyo.my.id/img/LIVETEST
  done
  ```
  Each request is assigned a unique rate-limit key (`media:serve:203.0.113.i`), completely avoiding HTTP 429 throttling.
- **Recommendation:**  
  Align `clientIp()` across the codebase to prioritize trusted headers provided by the reverse proxy (e.g. `cf-connecting-ip` for Cloudflare) and ignore untrusted `X-Forwarded-For` entries.

  ```typescript
  export function getClientIp(req: Request): string | null {
    // 1. Prioritize reverse-proxy headers that cannot be forged by clients
    const cfIp = req.headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();

    // 2. Fall back to proxy headers if configured
    const xRealIp = req.headers.get("x-real-ip");
    if (xRealIp) return xRealIp.trim();

    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();

    return null;
  }
  ```

---

#### [MEDIUM] SEC-04: Client-Mutable `mustChangePassword` in Better Auth Additional Fields
- **Location:** [`src/lib/auth/server.ts:51-56`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts#L51-L56)
- **Vulnerability Type:** CWE-269: Improper Privilege Management / Mass Assignment
- **Description:**  
  In `auth/server.ts`, the `user.additionalFields` schema defines:
  ```typescript
  mustChangePassword: {
    type: "boolean",
    required: false,
    defaultValue: false,
    input: true,
  }
  ```
  In Better Auth, setting `input: true` marks the field as client-writable via client SDK calls (`updateUser` or registration payload).  
  A user flagged with `mustChangePassword: true` (e.g., after an administrative credential reset) can issue a call to `/api/auth/update-user` specifying `{ "mustChangePassword": false }`, bypassing the password change requirement without actually updating their password.
  Additionally, `/api/auth/change-password` does not currently possess a database hook to clear this flag on password update, leading to logical inconsistency.
- **Impact:**  
  Compromised or reset accounts can bypass mandatory password rotations.
- **Proof of Concept:**  
  A user account with `mustChangePassword === true` is blocked with HTTP 403 `PASSWORD_CHANGE_REQUIRED` on `/api/questions`.
  The user sends:
  ```http
  POST /api/auth/update-user HTTP/1.1
  Content-Type: application/json

  { "mustChangePassword": false }
  ```
  Better Auth updates the record in PostgreSQL (`UPDATE "user" SET must_change_password = false`), allowing the user full API access without resetting their temporary password.
- **Recommendation:**  
  Set `input: false` to forbid client updates. Manage `mustChangePassword` strictly on the server side via Better Auth database hooks or an administrative service.

  ```typescript
  // src/lib/auth/server.ts
  mustChangePassword: {
    type: "boolean",
    required: false,
    defaultValue: false,
    input: false, // Disallow client manipulation
  }
  ```

---

#### [MEDIUM] SEC-05: Missing Rate Limiting and Subprocess Overhead on Moodle Export Endpoint
- **Location:** [`src/app/api/bundles/[id]/export/moodle/route.ts:28-97`](file:///home/hari/projects/mathbank/src/app/api/bundles/%5Bid%5D/export/moodle/route.ts#L28-L97)
- **Vulnerability Type:** CWE-770: Allocation of Resources Without Limits or Throttling
- **Description:**  
  The endpoint `POST /api/bundles/[id]/export/moodle` bypasses the standard `wrapRoute` middleware and contains no rate-limiting mechanism (violating project rule `CONSTRAINTS.md #33`).
  Upon execution, the handler compiles Moodle XML files, performs disk cleanup, writes dozens of files, and invokes external Git subprocesses (`git init`, `git config`, `git add -A`, `git status`, `git commit`).
- **Impact:**  
  An authenticated teacher or reviewer can send rapid bursts of export requests, exhausting server file descriptors and CPU capacity via concurrent Git subprocess executions.
- **Proof of Concept:**  
  An authenticated actor issues 50 concurrent `POST` requests to `/api/bundles/<id>/export/moodle`. The server spawns up to 250 `git` CLI processes in parallel, causing high load and potential thread exhaustion.
- **Recommendation:**  
  Wrap the route using `wrapRoute` and apply a strict token bucket limit:

  ```typescript
  export const POST = wrapRoute({
    permission: "bundle:manage",
    rateLimit: { capacity: 5, refillPerSec: 0.1 }, // 6 requests/minute max
    handler: async ({ params, actor }) => {
      const { summary, result, write } = await exportBundleToGitsync(params.id, actor);
      // ... handler logic
    },
  });
  ```

---

#### [LOW] SEC-06: Unrestricted URL Format in AI `baseUrl` Setting
- **Location:** [`src/lib/contracts/ai.ts:20`](file:///home/hari/projects/mathbank/src/lib/contracts/ai.ts#L20) and [`src/lib/ai/client.ts:68`](file:///home/hari/projects/mathbank/src/lib/ai/client.ts#L68)
- **Vulnerability Type:** CWE-20: Improper Input Validation
- **Description:**  
  The AI settings contract defines `baseUrl: z.string().trim().max(500).optional()`. It does not validate URL syntax or restrict protocols to `https:`. If an administrative account sets `baseUrl` to an internal or non-HTTP scheme, subsequent calls to `chat()` or `listModels()` will transmit the stored `ai.api_key` in the `Authorization` header to that address.
- **Recommendation:**  
  Validate that `baseUrl` is a well-formed URL with an approved scheme (`https:` in production, `http:` only for localhost in development).

  ```typescript
  baseUrl: z.string().url().refine((u) => {
    const parsed = new URL(u);
    return process.env.NODE_ENV === "production"
      ? parsed.protocol === "https:"
      : ["http:", "https:"].includes(parsed.protocol);
  }, { message: "URL AI wajib HTTPS di produksi" }),
  ```

---

#### [LOW] SEC-07: Soft-Deleted Bundle Association Leakage in `listBundleItems`
- **Location:** [`src/lib/services/bundle-query.ts:153-156`](file:///home/hari/projects/mathbank/src/lib/services/bundle-query.ts#L153-L156)
- **Vulnerability Type:** CWE-200: Information Exposure (Logic Flaw)
- **Description:**  
  `listBundleItems(id, actor)` filters items strictly by `where(eq(bundleItems.bundleId, id))`. It does not verify whether the parent bundle is soft-deleted (`bundles.deletedAt IS NULL`). While `getBundle(id)` returns `404` for archived bundles, `listBundleItems` continues to disclose question associations and projected data from deleted bundles.
- **Recommendation:**  
  Add an inner join to `bundles` verifying `isNull(bundles.deletedAt)` or assert bundle existence via `getBundle(id)` prior to querying items.

---

### Positive Observations

1. **Strict RBAC & Ownership Model (L1):**  
   The permission matrix in [`src/lib/auth/permissions.ts`](file:///home/hari/projects/mathbank/src/lib/auth/permissions.ts) clearly defines `yes | own | no` access rules. Services consistently enforce ownership checks (e.g., `assertCan(actor, "question:edit", { ownerId: existing.authorId })`), preventing IDOR vulnerabilities.
2. **Robust Data Projection & Masking (S3):**  
   Sensitive fields—specifically `answer_key`, `is_correct`, `distractor_rationale`, and embedding vectors—are protected at the query projection layer ([`src/lib/db/projections/question.ts`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts)). They are omitted before data leaves the database boundary, preventing leakage regardless of client role.
3. **Trigger-Level Audit Log Immutability:**  
   In [`drizzle/manual/db_safety.sql:193-205`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql#L193-L205), `audit_logs` has an explicit PostgreSQL trigger `trg_audit_logs_immutable` that blocks all `UPDATE` and `DELETE` queries at the database engine level.
4. **At-Rest Secret Encryption (AES-256-GCM):**  
   External secrets (such as `ai.api_key`) are encrypted at rest using AES-256-GCM with randomized 12-byte IVs and authenticated tags ([`src/lib/crypto/secrets.ts`](file:///home/hari/projects/mathbank/src/lib/crypto/secrets.ts)), and values are masked with `"***"` when retrieved by the UI.
5. **KaTeX Macro Sandboxing & AST Validation:**  
   Mathematical formula processing ([`src/lib/ai/enrich.ts`](file:///home/hari/projects/mathbank/src/lib/ai/enrich.ts)) blocks unsafe LaTeX primitives (`\input`, `\write`, `\htmlClass`, `\url`, etc.), enforces `trust: false`, and sets a strict expansion limit (`maxExpand: 1000`) to eliminate XSS and macro expansion DoS.
6. **SVG Cross-Site Scripting Mitigation:**  
   The media serving route ([`src/app/img/[shortId]/route.ts`](file:///home/hari/projects/mathbank/src/app/img/%5BshortId%5D/route.ts)) attaches a strict `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline';` header specifically when serving SVGs, preventing Stored SVG XSS.
7. **Safe Subprocess Execution:**  
   Subprocess invocations in [`src/lib/export/gitsync-writer.ts`](file:///home/hari/projects/mathbank/src/lib/export/gitsync-writer.ts) rely on `execFile` without shell interpolation, mitigating OS command injection.
8. **Dev Bypass Triple-Guardrail:**  
   [`src/lib/auth/resolve.ts`](file:///home/hari/projects/mathbank/src/lib/auth/resolve.ts) implements three separate checks (`NODE_ENV !== "production"`, `APP_ENV !== "staging"`/`"production"`, and literal `"true"`) ensuring `AUTH_DEV_BYPASS` cannot be accidentally activated in staging or production.

---

### OWASP Top 10 for LLM Applications Compliance

| Category | Assessment | Verification Status |
|---|---|:---:|
| **LLM01: Prompt Injection** | System prompts in [`src/lib/ai/enrich.ts`](file:///home/hari/projects/mathbank/src/lib/ai/enrich.ts) are strictly demarcated. Model proposals cannot alter the verified `answer_key` or bypass schema boundaries. | **PASS** |
| **LLM02: Sensitive Data Exposure** | Prompts include only question stem and taxonomy keywords. PII, credentials, and full system prompts are never included in the context window. | **PASS** |
| **LLM03: Supply Chain Risk** | `pnpm audit` reports 0 vulnerabilities. Sub-dependencies are audited via `scripts/security-advisories.ts`. | **PASS** |
| **LLM05: Improper Output Handling** | Model responses are parsed through `normalizeProposal()`, validated against strict enums and string length limits, and never passed to `eval`, raw SQL, or HTML. | **PASS** |
| **LLM06: Excessive Agency** | MCP tools and AI actions are restricted to proposing drafts. They cannot transition questions to `ready` or publish content. | **PASS** |
| **LLM10: Unbounded Consumption** | LLM HTTP requests enforce hard timeouts (`timeoutMs`), strict token caps (`maxTokens`), and centralized token bucket rate limits. | **PASS** |

---

### Remediation Roadmap

1. **Immediate (Sprint Blockers):**
   - Patch `safe` regex and add path canonicalization in `fetchCorpusImage` ([`fetch.ts`](file:///home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts)).
   - Implement `ipaddr.js` range validation in `isPrivateOrBlockedHost` and pin socket connections to mitigate DNS rebinding.
2. **Current Sprint:**
   - Change `input: false` on `mustChangePassword` in [`auth/server.ts`](file:///home/hari/projects/mathbank/src/lib/auth/server.ts) and add a server-side password change completion hook.
   - Standardize `clientIp()` extraction to rely on verified reverse-proxy headers (`cf-connecting-ip`).
   - Wrap `POST /api/bundles/[id]/export/moodle` with `wrapRoute` and enforce rate limiting.
3. **Defense-in-Depth:**
   - Add URL and protocol validation for AI `baseUrl`.
   - Filter soft-deleted parent bundles in `listBundleItems`.

*Laporan audit komprehensif ini selesai dan siap diarsipkan ke `MathBankAuditor/reports/17.10.2026/audit-security-and-hardening.md`.*
