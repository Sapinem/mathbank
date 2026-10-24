# Rekaman Lengkap Temuan Compound Engineering Code Review MathBank V2.0

**Tanggal:** 2026-10-24  
**Branch:** `paperclip/dev` vs `main` (merge-base `4de95ec0`)  
**Cakupan:** 550 berkas, 96.439 baris perubahan (Pilar 1–4, ADR-0016 s.d. ADR-0023)  
**Total Temuan Baku (Raw Returns):** 77 temuan lintas 10 reviewer spesialis  
**Temuan Arsitektur Agen MCP:** 14 temuan (5 Critical, 6 Warning, 3 Observation)  
**Daftar Periksa Deployment:** Checklist Go/No-Go Operasional  
**Run ID:** `20261024-173611-d53b5258`

---

## 1. Daftar Lengkap 77 Temuan Lintas 10 Reviewer Spesialis


### Reviewer: `adversarial-fallback` (8 temuan)

#### #1. [P1] SSRF Filter Bypass via IPv6 Loopback, Unspecified, and Mapped IP Variants in fetchImage
- **Lokasi:** `src/lib/ingest/media/fetch.ts:121`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `isPrivateOrBlockedHost` in `src/lib/ingest/media/fetch.ts:121-157` uses naive string matching that fails to block IPv6 unspecified `::`, uncompressed loopback `0:0:0:0:0:0:0:1`, or hex mapped addresses; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** isPrivateOrBlockedHost relies on regex string checks that fail on valid IPv6 representations of loopback, unspecified, and IPv4-mapped addresses. An attacker supplying URLs pointing to these representations or configuring DNS to resolve to '::' or '0:0:0:0:0:0:0:1' bypasses assertPublicTarget. Furthermore, fetchHop performs a pre-connection DNS check via assertPublicTarget and then invokes native fetch(url), allowing classic DNS rebinding with zero-TTL domains to target internal services such as FastAPI BGE-M3 (port 3005) or Next.js internal endpoints (port 3000).
- **Dampak:** Remote attackers can trigger SSRF to internal network endpoints, accessing cloud instance metadata, local FastAPI services, or container network services.
- **Skenario Kegagalan / Eksploitasi:** During media ingest or media URL validation, an attacker submits an image URL 'http://[0:0:0:0:0:0:0:1]:3005/openapi.json' or a domain whose AAAA record resolves to '::'. The pre-flight check validates as public, and fetchHop extracts internal service responses.
- **Bukti Baris Kode:** `isPrivateOrBlockedHost('::') returns false; isPrivateOrBlockedHost('0:0:0:0:0:0:0:1') returns false; isPrivateOrBlockedHost('::ffff:7f00:1') returns false.`
- **Rekomendasi Perbaikan:** Use node:net's isIP() and blocklist parsed canonical IP integers/bytes. Explicitly block '::', '[::]', '0:0:0:0:0:0:0:1', '0:0:0:0:0:0:0:0', and all ::ffff: IPv4-mapped addresses. For outbound fetch, pin the resolved IP address on the HTTP connection socket instead of relying on native fetch re-resolving the hostname (which is vulnerable to DNS rebinding).

#### #2. [P1] Unbounded Stream Buffering in fetchHop Leading to Remote Denial of Service (OOM Crash)
- **Lokasi:** `src/lib/ingest/media/fetch.ts:349`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 100)
- **Akar Masalah / Mengapa Penting:** fetchHop downloads the entire response body into memory using await res.arrayBuffer() before verifying if the payload exceeds maxBytes. Unlike downloadRelaxed, which guards chunk sizes inside data event listeners, fetchHop buffers unbounded stream data. A slow or infinite HTTP chunked stream or a multi-gigabyte payload from a remote image source will consume heap memory until V8 crashes with Out-Of-Memory.
- **Dampak:** Remote DoS against the MathBank application server by crashing the Node.js process during ingest.
- **Skenario Kegagalan / Eksploitasi:** An ingested article references an image URL on an attacker-controlled server that responds with an infinite stream of zeros. fetchHop buffers gigabytes of data in memory until the application crashes.
- **Bukti Baris Kode:** `const body = res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array(); followed later by if (buf.length > maxBytes)`
- **Rekomendasi Perbaikan:** Stream the response body using res.body.getReader() and count chunks, aborting the stream with an error if total accumulated bytes exceed maxBytes before allocating the full array buffer.

#### #3. [P1] Untrusted X-Real-IP Prioritization Bypassing Rate Limits and Inducing Memory Exhaustion
- **Lokasi:** `src/lib/api/client-ip.ts:10`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `src/lib/api/client-ip.ts:10` prioritizes `X-Real-IP` which `Caddyfile:18-21` neither sets nor strips, allowing clients to spoof their IP identity and bypass rate limiting; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** getClientIp unconditionally trusts the x-real-ip header if present before falling back to x-forwarded-for. However, the repository's Caddyfile configuration does not set X-Real-IP or strip it from incoming requests; Caddy only manages X-Forwarded-For. Consequently, any untrusted client can send arbitrary X-Real-IP headers. This allows complete circumvention of rate limiting on API routes, /api/mcp, and /img/[shortId], and enables an attacker to flood MemoryStore with millions of distinct rate-limit bucket keys, exhausting server RAM.
- **Dampak:** Complete bypass of IP-based rate limiting and potential memory exhaustion DoS across all public and authenticated endpoints.
- **Skenario Kegagalan / Eksploitasi:** An attacker generates random UUIDs in the X-Real-IP header on each request to brute-force auth or scrape media images without triggering HTTP 429.
- **Bukti Baris Kode:** `const xRealIp = req.headers.get('x-real-ip'); if (xRealIp?.trim()) return xRealIp.trim(); in client-ip.ts while Caddyfile does not set header_up X-Real-IP.`
- **Rekomendasi Perbaikan:** Do not read X-Real-IP unless verified by reverse proxy configuration. Rely on the right-most trusted entry from X-Forwarded-For as appended by Caddy, or update Caddyfile with 'header_up X-Real-IP {remote_host}' to overwrite client-supplied headers.

#### #4. [P1] Non-MCQ Question Stem Collision in contentHash Causing Silent Ingestion Loss and Bundle Corruption
- **Lokasi:** `src/lib/ingest/hash.ts:106`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unrelated pre-existing behavior: short-hash provenance 4de95ec0 (base) shows `contentHash` in `src/lib/ingest/hash.ts:106-113` was untouched by this diff and locked by ADR-0012 across 11,889 existing rows.
- **Akar Masalah / Mengapa Penting:** contentHash only hashes the question stem and the options array. For question types without options (matrix_grid, matching, essay, short_answer), options is always empty. If two questions share a common stem (e.g. 'Tentukan apakah pernyataan berikut Benar atau Salah:'), their contentHash is identical regardless of completely different statements or answers. In commitItems, findQuestionByContentHash matches the previous question and links it to the bundle instead of creating the new question. In createQuestion, creating a new question with a shared stem throws ConflictError.
- **Dampak:** Data loss during corpus ingestion, incorrect questions attached to exam bundles, and inability to create multiple matrix/matching/essay questions sharing common instructional stems.
- **Skenario Kegagalan / Eksploitasi:** An instructor creates two matrix_grid True/False questions with identical instructions ('Perhatikan pernyataan-pernyataan berikut:'). The second question is rejected as duplicate, or during ingest, the second question is discarded and replaced with the first question's ID.
- **Bukti Baris Kode:** `contentHash(stem, options = []) returns sha256(normStem + '\u0000' + sortedOptions) where options is empty for matrix_grid, matching, and essay.`
- **Rekomendasi Perbaikan:** Incorporate questionType and type-specific dataPayload contents (statements/rows for matrix_grid, premises/responses for matching, rubricGuidelines for essay) into the contentHash calculation, or key non-MCQ hashes by dataPayload serialization.

#### #5. [P1] Unconditional False-Positive Near-Duplicate Flagging Cascade Due to Missing AnswerKey Field
- **Lokasi:** `src/lib/ingest/dedup.ts:87`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 100)
- **Akar Masalah / Mengapa Penting:** findNearDuplicates extracts src.answerKey.correct and r.answerKey.correct. Because MAT-146 switched to canonical answer_key.correctOptionIds, .correct is undefined for all canonical and newly created questions. normalizeReasoning(undefined) returns an empty string. The comparison normalizeReasoning(srcCorrect) === normalizeReasoning(otherReasoning) evaluates to true ('"" === ""'). Any question with embedding similarity in the near range (>= 0.85) is unconditionally marked as having identical reasoning ('penalaran sama') and is automatically flagged as duplicate during embedQuestions.
- **Dampak:** Mass false-positive flagging of distinct questions as duplicate during AI embedding and enrichment passes.
- **Skenario Kegagalan / Eksploitasi:** Running batch-embed-questions.ts or embedQuestions on a batch of geometry or algebra questions with similar wording causes hundreds of legitimate, distinct questions to be marked isFlagged=true with 'penalaran sama'.
- **Bukti Baris Kode:** `const srcCorrect = (src.answerKey as { correct?: unknown } | null)?.correct; while canonical questions use correctOptionIds. normalizeReasoning(undefined) === normalizeReasoning(undefined) evaluates true.`
- **Rekomendasi Perbaikan:** In findNearDuplicates, inspect canonical correctOptionIds ?? correct from answerKey. If reasoning keys are undefined or empty on either side, classifyDuplicate should not treat empty strings as identical reasoning, but evaluate as near-distinct.

#### #6. [P1] Media Shortcode Sync Ignores Matrix and Matching Questions Risking Asset Deletion
- **Lokasi:** `src/lib/services/media/shortcode-link.ts:151`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 75)
- **Verifikasi Validator:** `confirmed` — Confirmed: `syncQuestionShortcodeMediaTx` in new file `src/lib/services/media/shortcode-link.ts:151-169` only extracts shortcodes from `dataPayload.options`, omitting matrix rows and matching premises, causing referenced images to be detected as orphans and deleted from disk by `deleteAsset`; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** syncQuestionShortcodeMediaTx is executed in transactions on createQuestion and updateQuestion to link referenced {{img:<shortId>}} assets to question_media. However, it only checks stem, options, and solutions. For matrix_grid questions (where statement texts live in dataPayload.rows) and matching questions (where items live in premises/responses), shortcodes are never linked to question_media. When findOrphanAssets and deleteAsset are executed during routine maintenance, these unlinked images are classified as unused orphans and deleted from disk, corrupting the question display.
- **Dampak:** Silent loss of media files and broken image rendering in matrix grid and matching questions.
- **Skenario Kegagalan / Eksploitasi:** A teacher inserts image shortcodes into True/False matrix statements. Later, an admin runs orphan cleanup (/api/media/orphans), which permanently deletes the images from disk because question_media has no link.
- **Bukti Baris Kode:** `syncQuestionShortcodeMediaTx only collects bodies from contentMarkdown, extractOptionBodies(row.dataPayload), and solutions, completely ignoring data_payload.rows/statements/premises.`
- **Rekomendasi Perbaikan:** Update syncQuestionShortcodeMediaTx and extractOptionBodies to extract image shortcodes from data_payload.rows (matrix_grid), data_payload.statements, and data_payload.premises / responses (matching).

#### #7. [P2] Memory Exhaustion and Incomplete Deduplication in Ingest Queue Enqueueing
- **Lokasi:** `src/lib/ingest/queue.ts:71`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** findByContentHash executes a SELECT * on ingest_queue without an indexed hash column, pulling up to 500 rows including rawContent (often large HTML documents) into Node.js heap to compute SHA-256 hashes in memory on every single upload. For 500 articles at 500KB each, this consumes 250MB of memory per call. Under concurrent ingestion requests, this causes heap memory exhaustion. Furthermore, any article outside the latest 500 is never deduplicated.
- **Dampak:** Excessive database network I/O, Node.js memory bloat, and broken deduplication beyond 500 queued items.
- **Skenario Kegagalan / Eksploitasi:** Uploading multiple batches of corpus files concurrently saturates the Node.js event loop with multi-megabyte string allocations and hashing.
- **Bukti Baris Kode:** `const candidates = await db.select().from(ingestQueue).where(inArray(ingestQueue.status, ['pending', 'processing', 'completed'])).orderBy(desc(ingestQueue.createdAt)).limit(500);`
- **Rekomendasi Perbaikan:** Store raw_content_hash as an indexed column in ingest_queue and query with WHERE raw_content_hash = $1 rather than selecting and hashing 500 full text rows in Node memory.

#### #8. [P2] GitSync Export Directory Collision and Silent Repo Wipe on Matching Bundle Titles
- **Lokasi:** `src/lib/export/gitsync-writer.ts:75`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** writeGitsyncFolder derives the target export directory solely from slugify(bundleTitle). Because bundle slugs were removed in ADR-0016/0022 and titles are not unique, two different bundles with the same title map to the exact same filesystem directory. Exporting the second bundle recursively removes the 'top' directory and overwrites the first bundle's exported contents and Git history.
- **Dampak:** Silent overwrite and loss of exported Moodle XML bundles on the server filesystem.
- **Skenario Kegagalan / Eksploitasi:** Teacher B exports a bundle named 'Ulangan Harian 1', overwriting the exported files and git commits of Teacher A's bundle which had the same name.
- **Bukti Baris Kode:** `const dir = join(exportRoot(), slugify(bundleTitle)); and rm(join(dir, 'top'), { recursive: true, force: true });`
- **Rekomendasi Perbaikan:** Key the export directory by bundle ID or append a truncated bundle UUID to the slug: join(exportRoot(), `${slugify(bundleTitle)}-${bundleId.slice(0, 8)}`).


### Reviewer: `api-contract` (8 temuan)

#### #9. [P1] Breaking response shape change on GET /api/bundles from raw array to paginated envelope
- **Lokasi:** `src/app/api/bundles/route.ts:29`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Refuted by policy: the paginated envelope on `GET /api/bundles` is an intentional internal contract change documented under ACT-04/PERF-05 with internal consumers updated in `use-bundles.ts`, not an external compatibility defect.
- **Akar Masalah / Mengapa Penting:** GET /api/bundles was refactored under API-05 to return a paginated envelope containing { items, total, limit, offset, stats }. Previously, the endpoint returned a plain list of bundle objects in { data: BundleRow[] }. Any external client, script, or mobile consumer that directly queries GET /api/bundles expecting an array in res.data will encounter fatal runtime errors (e.g., TypeError: data.map is not a function).
- **Dampak:** Unversioned breaking contract change on a core resource endpoint causing unhandled runtime exceptions in all existing non-React Query consumers.
- **Bukti Baris Kode:** `In src/app/api/bundles/route.ts:29-37, listBundles returns { items, total, limit, offset, stats }, wrapped in { data }. Previously, GET /api/bundles returned a raw array in { data: BundleRow[] }. This change broke direct array consumers, requiring src/lib/hooks/use-bundles.ts:105-108 to unwrap page.items.`
- **Rekomendasi Perbaikan:** Provide a backward-compatible adaptation window (e.g., support an opt-in or legacy query parameter ?envelope=legacy or versioning), or explicitly document the breaking contract update for all third-party consumers of GET /api/bundles.

#### #10. [P1] Silent drop of status mutation in PATCH /api/questions/[id] alongside status check bypass in POST /api/questions
- **Lokasi:** `src/lib/services/question-write.ts:180`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unrelated pre-existing behavior: short-hash provenance 4de95ec0 (base) shows `createQuestion` line 62 already assigned `status: input.status` and `updateQuestion` lines 141-155 already omitted `fields.status` from `patch`.
- **Akar Masalah / Mengapa Penting:** There is a two-sided contract integrity failure regarding question status: 1) updateQuestionSchema accepts status, but updateQuestion() silently ignores fields.status and never updates it in PostgreSQL. Clients receive HTTP 200 OK and falsely assume the question status transitioned, when status transitions require PATCH /api/questions/[id]/status. 2) createQuestionSchema accepts status (defaulting to draft), but createQuestion() writes status: input.status directly without verifying question:setReady or question:archive permissions. Users who are strictly forbidden from publishing questions (such as teachers or agents, who have question:setReady: "no") can bypass the entire review lifecycle by submitting status: "ready" at question creation time.
- **Dampak:** Misleading silent success on partial updates and privilege escalation / authorization bypass on initial question creation.
- **Bukti Baris Kode:** `In src/lib/contracts/question.ts:468, updateQuestionSchema = createQuestionSchema.partial() accepts status. In src/lib/services/question-write.ts:180-261, updateQuestion extracts fields but never assigns patch.status, returning 200 OK without updating status. In src/lib/services/question-write.ts:38-101, createQuestion allows any caller with question:create to set status: "ready", bypassing question:setReady permission.`
- **Rekomendasi Perbaikan:** In src/lib/contracts/question.ts, omit status from updateQuestionSchema (or throw a 400 BadRequestError instructing callers to use PATCH /api/questions/[id]/status). In createQuestion (src/lib/services/question-write.ts), enforce assertCan(actor, "question:setReady") if input.status === "ready" and assertCan(actor, "question:archive") if input.status === "archived".

#### #11. [P1] Contract collision between MAT-41 AI rubric object (answerKey.rubric) and MAT-145 release guard string (answerKey.scoringRubric)
- **Lokasi:** `src/lib/contracts/question.ts:306`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 100)
- **Akar Masalah / Mengapa Penting:** MathBank has two conflicting schema definitions for essay scoring rubrics: MAT-41 defines answerKey.rubric as a structured JSON object ({ totalPoints, criteria: [{ description, points }] }), which is generated by the AI enrichment service (src/lib/ai/enrich.ts) and stored into answerKey.rubric. However, MAT-145 (src/lib/validations/question-payload.ts) introduced answerKey.scoringRubric as a required string (min 20 characters) and dataPayload.rubricGuidelines (min 20 characters). When an AI-enriched essay question is approved for release, toCanonicalAnswerKey() strips answerKey.rubric, and releasedQuestionGuardSchema fails with HTTP 422 because scoringRubric is missing.
- **Dampak:** Every essay question enriched via AI cannot transition to ready status, breaking the review-and-release workflow with HTTP 422 QuestionPayloadValidationError.
- **Bukti Baris Kode:** `In src/lib/services/enrichment/enrich.ts:133, AI enrichment writes proposal.rubric into answerKey.rubric. In src/lib/contracts/question.ts:306-322, CANONICAL_ANSWER_KEY_KEYS excludes rubric. In src/lib/validations/question-payload.ts:386-398, releasedQuestionGuardSchema strictly requires answerKey.scoringRubric (min 20 chars).`
- **Rekomendasi Perbaikan:** In normalizeQuestionWritePayload (src/lib/contracts/question.ts), add automatic serialization of structured answerKey.rubric into answerKey.scoringRubric (markdown table or list format) and populate dataPayload.rubricGuidelines if empty. Additionally, ensure CANONICAL_ANSWER_KEY_KEYS and answerKeySchema in question-payload.ts accommodate or normalize rubric.

#### #12. [P2] Bundle route handlers redeclare local Zod schemas drifting from shared bundle contracts
- **Lokasi:** `src/app/api/bundles/route.ts:6`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** src/lib/contracts/bundle.ts exports canonical contract schemas createBundleSchema and updateBundleSchema. However, src/app/api/bundles/route.ts and src/app/api/bundles/[id]/route.ts fail to import them, instead defining duplicate local schemas. The local schemas lack string-to-number coercion for year and lack string trimming for title. Form clients and API integrations sending year as a string ("2024") fail with 400 VALIDATION_ERROR on the live route despite conforming to the published contract.
- **Dampak:** Contract drift between client SDKs/types and live HTTP handlers, causing unexpected 400 validation failures on valid inputs.
- **Bukti Baris Kode:** `src/lib/contracts/bundle.ts:29 defines year: z.coerce.number().int().nullish() and title: z.string().trim(), but src/app/api/bundles/route.ts:6-17 and src/app/api/bundles/[id]/route.ts:15-27 redeclare local schemas requiring year: z.number().int() without coercion and untrimmed titles.`
- **Rekomendasi Perbaikan:** Replace inline createSchema in src/app/api/bundles/route.ts with createBundleSchema from @/lib/contracts/bundle, and replace patchSchema in src/app/api/bundles/[id]/route.ts with updateBundleSchema.

#### #13. [P2] Migration guidance mismatch for removed collections item reordering and deletion endpoints
- **Lokasi:** `src/app/api/collections/[id]/items/route.ts:21`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** The sunset endpoints in /api/collections/[id]/items return 410 RESOURCE_GONE pointing clients to /api/bundles/[id]/items. However, the interfaces have fundamentally different contract semantics: collections operated directly on question IDs (questionIds in PUT body, ?questionId= in DELETE query), whereas bundles operates on bundle_items join records (itemIds in PUT body, and DELETE /api/bundles/[id]/items/[itemId]). Clients attempting a 1:1 replacement will receive 400 VALIDATION_ERROR on reorder and 405 Method Not Allowed on deletion.
- **Dampak:** Inaccurate migration instructions causing confusing contract rejections for automated clients transitioning from collections to bundles.
- **Bukti Baris Kode:** `In src/app/api/collections/[id]/items/route.ts:21-23, goneHandler reports: "Collections API has been removed. Use /api/bundles/[id]/items instead." However, PUT /api/collections/[id]/items accepted { questionIds: string[] } whereas PUT /api/bundles/[id]/items requires { itemIds: string[] }; and collections deleted via query ?questionId= whereas bundles deletes via subpath /[itemId].`
- **Rekomendasi Perbaikan:** Update the 410 error message to explain the contract differences: PUT /api/bundles/[id]/items requires { itemIds: string[] } (bundle item IDs, not question IDs), and deletion is DELETE /api/bundles/[id]/items/[itemId].

#### #14. [P3] Inconsistent pagination payload property in GET /api/media (data instead of items)
- **Lokasi:** `src/lib/services/media/gallery.ts:40`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** MathBank API conventions establish that paginated list endpoints return an envelope containing items and total (e.g., GET /api/questions returns { data: { items: [...], total } }, GET /api/bundles returns { data: { items: [...], total } }, and GET /api/system/agent-keys returns { data: { items: [...] } }). However, GET /api/media wraps listMedia which returns { data: rows, total }, producing a double-nested { data: { data: [...], total } }. This irregularity breaks generic client response unwrappers.
- **Dampak:** Irregular response structure across paginated resources, complicating generic API client libraries.
- **Bukti Baris Kode:** `In src/lib/services/media/gallery.ts:40, listMedia returns { data: rows, total }, which wrapRoute wraps into { data: { data: MediaListItem[], total: number } }. In contrast, listQuestions returns { items, total } and listBundles returns { items, total, ... }.`
- **Rekomendasi Perbaikan:** Change listMedia return shape to { items: rows, total } so that wrapRoute produces { data: { items: [...], total } } consistent with questions and bundles.

#### #15. [P3] Health and ready probes return 503 errors inside data envelope instead of error envelope
- **Lokasi:** `src/app/api/health/route.ts:65`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** MathBank architecture establishes a single response contract: success is { data: T } and error is { error: { code, message, details? } }. When the database is down, GET /api/health and GET /api/ready respond with HTTP 503 Service Unavailable, but format their payload as { data: { status: "down", ... } } without an error key. Any standard client adhering to the MathBank envelope contract (such as src/lib/api/fetcher.ts, which checks res.ok and throws json?.error?.message) fails to extract the diagnostic message and defaults to a generic fallback.
- **Dampak:** Diagnostic message lost in standard API clients that parse errors according to the repo-wide { error: { message } } envelope standard.
- **Bukti Baris Kode:** `In src/app/api/health/route.ts:65-79 and src/app/api/ready/route.ts:46-55, 503 responses return { data: { status: "down", db: "down", message } } with no error property.`
- **Rekomendasi Perbaikan:** Document this intentional deviation in KONTRAK-API.md or ensure fetch wrappers (api()) handle status 503 with data.message gracefully.

#### #16. [P3] Moodle export dropped summary payload from data on 422 HTTP responses
- **Lokasi:** `src/app/api/bundles/[id]/export/moodle/route.ts:46`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** Previously, POST /api/bundles/[id]/export/moodle returned HTTP 422 with a payload containing { error: { code, message }, data: summary }, allowing callers to read withoutAnswerKey from res.data. To enforce CONSTRAINT #17 (error responses must not include data), the summary was relocated to error.details. External consumers that read res.data upon receiving 422 will now find it undefined.
- **Dampak:** Breaking change on 422 diagnostic payload structure for external Moodle export integrations.
- **Bukti Baris Kode:** `In src/app/api/bundles/[id]/export/moodle/route.ts:46-58, summary was moved from data to error.details when throwing ExportBlockedError.`
- **Rekomendasi Perbaikan:** Document the error envelope migration in API changelog and ensure API documentation reflects that validation failure diagnostics reside in error.details rather than data.


### Reviewer: `correctness` (10 temuan)

#### #17. [P1] repairAdaptive mutates LaTeX when no repairs decrease KaTeX errors, breaking no-guess invariant
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/parsers/katex-repair.ts:758`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `repairAdaptive` in new file `src/lib/ingest/parsers/katex-repair.ts:758-771` permits equal-error mutations without rolling back when final `best >= before`, returning mutated text despite zero net error reduction; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** repairAdaptive allows tie-break transformations (n === galatTerbaik) under the assumption that an intermediate mutation may unlock subsequent error reduction. However, if no subsequent repair reduces errors, the function returns the mutated text after up to 30 rounds of changes even when best === before. This violates the module contract ("bila tak ada perbaikan yang memenuhi syarat -> biarkan (jangan tebak)") and risks corrupting valid math or LaTeX constructs when faced with unrepairable errors.
- **Bukti Baris Kode:** `src/lib/ingest/parsers/katex-repair.ts:758:      if (n < galatTerbaik || (n === galatTerbaik && namaTerbaik === null)) {`
- **Rekomendasi Perbaikan:** In repairAdaptive, if after the loop best >= before (no net error reduction was achieved), discard the accumulated mutations and return the original input text: if (best >= before) return { text, applied: [], before, after: before };

#### #18. [P1] Dual competing rubric schema contracts cause AI-enriched essays to fail pedagogical release gate
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/services/enrichment/enrich.ts:133`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `enrichQuestion` in new file `src/lib/services/enrichment/enrich.ts:133` stores rubric object as `answerKey.rubric`, which is stripped by `toCanonicalAnswerKey` and fails `scoringRubric` string check in `releasedQuestionGuardSchema` (422); incidence was not measured.
- **Akar Masalah / Mengapa Penting:** AI enrichment in enrich.ts stores rubrics as an object under answerKey.rubric ({ totalPoints, criteria: [...] }). However, CANONICAL_ANSWER_KEY_KEYS in contracts/question.ts only includes scoringRubric (string, min 20 chars per releasedQuestionGuardSchema in validations/question-payload.ts), and answerKeySchema in validations/question-payload.ts is .strict() with unrecognized key "rubric". When an enriched essay question is transitioned to ready status, assertReleaseContract / toCanonicalAnswerKey strips rubric, causing releasedQuestionGuardSchema to fail with a missing scoringRubric error (HTTP 422). Enriched essay questions can never be released.
- **Bukti Baris Kode:** `src/lib/services/enrichment/enrich.ts:133:    ? { ...baseKey, rubric: proposal.rubric }`
- **Rekomendasi Perbaikan:** Harmonize the rubric schema across contracts/question.ts, validations/question-payload.ts, and enrich.ts. Either normalize proposal.rubric into a structured scoringRubric string inside normalizeQuestionWritePayload and toCanonicalAnswerKey, or update CANONICAL_ANSWER_KEY_KEYS and releasedQuestionGuardSchema to officially support and validate the rubric object.

#### #19. [P2] bundlePrintConfigSchema in contracts/bundle.ts omits explanationPlacement and answerSpaceCm, stripping them on API mutations
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/contracts/bundle.ts:11`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 100)
- **Akar Masalah / Mengapa Penting:** BundlePrintConfig interface and DEFAULT_BUNDLE_PRINT_CONFIG in src/lib/db/schema/bundle.ts define explanationPlacement ("none" | "inline" | "end") and answerSpaceCm (number), which are used by bundle-print-view.tsx (lines 103, 110) to control worksheet rendering. However, bundlePrintConfigSchema in contracts/bundle.ts omits both properties. Because Zod objects strip unrecognized fields by default, any POST or PATCH to /api/bundles configuring explanation placement or student answer box height silently loses these settings.
- **Bukti Baris Kode:** `src/lib/contracts/bundle.ts:11:export const bundlePrintConfigSchema = z.object({`
- **Rekomendasi Perbaikan:** Add explanationPlacement: z.enum(["none", "inline", "end"]).optional() and answerSpaceCm: z.number().min(0).max(20).optional() to bundlePrintConfigSchema in src/lib/contracts/bundle.ts.

#### #20. [P2] BundlePrintView fails to render statements, premises, or answer space for matrix_grid and matching questions
- **Lokasi:** `/home/hari/projects/mathbank/src/components/bundles/bundle-print-view.tsx:363`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `isOptionBased` in `src/lib/contracts/question.ts:47-53` returns true for `matrix_grid` and `matching`, but `bundle-print-view.tsx:363-398` only checks `question.options` and hides the answer space box, rendering neither the statements/premises nor answer space; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** isOptionBased() returns true for "matrix_grid" and "matching", but these types do not store options in question.options (they use dataPayload.rows and dataPayload.premises/responses), so question.options.length is 0. Additionally, the non-option answer space check !isOptionBased() evaluates to false. Consequently, worksheets printed with matrix_grid or matching questions render only the question stem with empty space, completely omitting all statements, rows, premises, and response choices.
- **Bukti Baris Kode:** `src/components/bundles/bundle-print-view.tsx:363:                  {isOptionBased(it.question.questionType as never) &&`
- **Rekomendasi Perbaikan:** In bundle-print-view.tsx, add explicit render branches for matrix_grid (rendering the statement table and column labels) and matching (rendering the premise and response columns), and exclude matrix_grid and matching from the standard option list iteration.

#### #21. [P2] isPrivateOrBlockedHost does not block IPv6 unspecified address :: and [::], allowing SSRF bypass to localhost
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts:139`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 100)
- **Akar Masalah / Mengapa Penting:** isPrivateOrBlockedHost blocks 0.0.0.0, 127.0.0.0/8, ::1, and [::1], but fails to block the IPv6 unspecified address :: and [::]. On dual-stack Linux systems, connecting to http://[::]:port routes directly to services listening on localhost/all-interfaces. If a target URL or resolved DNS address returns ::, assertPublicTarget allows the request, enabling anti-SSRF bypass.
- **Bukti Baris Kode:** `src/lib/ingest/media/fetch.ts:139:  if (host === "::1" || host === "[::1]") return true;`
- **Rekomendasi Perbaikan:** Add host === "::" || host === "[::]" to the blocked host checks in isPrivateOrBlockedHost in src/lib/ingest/media/fetch.ts.

#### #22. [P2] Shortcode media sync and ingest media rewriting omit matrix_grid statements and matching premises/responses
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/services/media/shortcode-link.ts:151`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 100)
- **Akar Masalah / Mengapa Penting:** syncQuestionShortcodeMediaTx extracts shortcodes only from contentMarkdown (stem), data_payload.options, and solutions. It ignores dataPayload.rows in matrix_grid and dataPayload.premises / dataPayload.responses in matching questions. Media embedded in matrix statements or matching premises is never linked in question_media, causing image dimensions to be lost and forcing default 16:9 aspect ratio boxes (causing layout shifts/letterboxing per MAT-132) and exposing assets to deletion by orphan cleanup. Similarly, ingest service.ts applyMediaToItems does not rewrite images in matching questions.
- **Bukti Baris Kode:** `src/lib/services/media/shortcode-link.ts:151:  const bodies: ShortcodeBody[] = [`
- **Rekomendasi Perbaikan:** In syncQuestionShortcodeMediaTx, extract texts from dataPayload.rows (for matrix_grid) and dataPayload.premises and dataPayload.responses (for matching) into the ShortcodeBody array. Update mediaTexts and applyMediaToItems in src/lib/ingest/service.ts to also process matching premises and responses.

#### #23. [P2] setOptionLabel in QuestionEditor causes option label collision and form state mutation corruption
- **Lokasi:** `/home/hari/projects/mathbank/src/components/questions/question-editor.tsx:324`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `setOptionLabel` in `src/components/questions/question-editor.tsx:324` maps `oldLabel` to `next` without swapping or checking collision, creating duplicate option labels when clicking the cycle button in `question-editor-options.tsx:83-85`; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** In QuestionEditor, clicking the cycle button on an option calls setOptionLabel(oldLabel, newLabel). The function replaces oldLabel with newLabel without swapping with any existing option that already has newLabel. If option A is cycled to B while B already exists, two options share label "B". Because React keys and handlers (patchOption, toggleCorrect) identify options by label, subsequent edits or selections modify both options simultaneously, permanently corrupting the draft in state and autosave.
- **Bukti Baris Kode:** `src/components/questions/question-editor.tsx:324:      prev.map((o) => (o.label === oldLabel ? { ...o, label: newLabel } : o)),`
- **Rekomendasi Perbaikan:** Implement label swapping in setOptionLabel: prev.map((o) => { if (o.label === oldLabel) return { ...o, label: newLabel }; if (o.label === newLabel) return { ...o, label: oldLabel }; return o; });

#### #24. [P3] reorderItems in bundle-items.ts generates invalid SQL syntax when called on an empty bundle
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/services/bundle-items.ts:138`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `reorderItems` in new file `src/lib/services/bundle-items.ts:131-146` builds a `CASE` statement and `IN ()` clause from `itemIds` without checking `itemIds.length === 0`, causing PostgreSQL syntax error 42601 on empty bundles; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** When reorderItems(bundleId, [], actor) is invoked on a bundle with 0 items, existing.length === 0 and itemIds.length === 0 pass all validation checks. The query execution then builds UPDATE bundle_items SET order_index = CASE  END WHERE bundle_id = ... AND bundle_items.id IN (), which is invalid PostgreSQL syntax (CASE with no WHEN clauses and empty IN () list). PostgreSQL throws error 42601 and aborts the transaction.
- **Bukti Baris Kode:** `src/lib/services/bundle-items.ts:138:         SET order_index = CASE ${sql.join(cases, sql` `)} END`
- **Rekomendasi Perbaikan:** Add an early return if (itemIds.length === 0) return; before initiating the database transaction in reorderItems.

#### #25. [P2] resolveEventsForBundles aborts question event tagging if bundle is already tagged
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/event-resolve.ts:84`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `resolveEventsForBundles` in new file `src/lib/ingest/event-resolve.ts:84` returns early if `bundleUpd.length === 0`, preventing any questions with `isNull(questions.eventId)` from being tagged whenever the parent bundle is already tagged; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** In resolveEventsForBundles, line 82 updates bundles with WHERE and(eq(bundles.id, b.id), isNull(bundles.eventId)). If an existing bundle already had eventId set and additional questions are committed to it, bundleUpd returns 0 rows. Line 84 immediately executes if (bundleUpd.length === 0) return { bundle: false, questions: 0 };, prematurely exiting the transaction before checking or updating questions in the bundle. Any newly committed questions in that bundle with questions.eventId IS NULL are never tagged with the event.
- **Bukti Baris Kode:** `src/lib/ingest/event-resolve.ts:84:      if (bundleUpd.length === 0) return { bundle: false, questions: 0 };`
- **Rekomendasi Perbaikan:** Do not return early if bundleUpd.length === 0. Instead, proceed to select questions in the bundle where questions.eventId IS NULL and update them with the resolved eventId and detected metadata.

#### #26. [P2] writeGitsyncFolder directory collisions for non-unique bundle titles after slug removal
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/export/gitsync-writer.ts:75`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unrelated pre-existing behavior: short-hash provenance 4de95ec0 (base) shows `writeGitsyncFolder` line 72 already used `slugify(bundleTitle)` to determine the export folder and was not introduced or changed by this diff.
- **Akar Masalah / Mengapa Penting:** Following ADR-0022 and migration 0022_slug_hard_removal.sql, bundles no longer have unique slugs, and titles are not unique across bundles. writeGitsyncFolder determines the export directory using only slugify(bundleTitle). If two bundles share the same title, exporting the second bundle empties the top/ directory of the first bundle export and commits the second bundle questions directly into the first bundle Git repository, corrupting the exported GitSync tree.
- **Bukti Baris Kode:** `src/lib/export/gitsync-writer.ts:75:  const dir = join(/*turbopackIgnore: true*/ exportRoot(), slugify(bundleTitle));`
- **Rekomendasi Perbaikan:** In writeGitsyncFolder and exportBundleToGitsync, append a unique identifier (such as bundleId or a short slice of it) to the export directory name, e.g. `${slugify(bundleTitle)}-${bundleId.slice(0, 8)}`.


### Reviewer: `data-migration` (5 temuan)

#### #27. [P1] Schema drift and missing backfill on bundles.print_config default value
- **Lokasi:** `drizzle/0019_add-bundle-print-config.sql:1`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `DEFAULT_BUNDLE_PRINT_CONFIG` in `src/lib/db/schema/bundle.ts:34-42` and `drizzle/meta/0022_snapshot.json:874` include `explanationPlacement` and `answerSpaceCm`, but no migration SQL in 0020-0022 executes `ALTER COLUMN print_config SET DEFAULT`; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** Migration 0019 added the print_config column with default {'institutionName':'Math My ID','twoColumnLayout':true,'includeAnswerKey':false,'showQuestionNumber':true,'pageSize':'A4'}. Later, DEFAULT_BUNDLE_PRINT_CONFIG in src/lib/db/schema/bundle.ts was expanded to include explanationPlacement ('none') and answerSpaceCm (4). While drizzle/meta/0022_snapshot.json was manually updated or re-snapshotted to reflect the new default, no DDL migration was emitted in 0020, 0021, or 0022 to alter the database column default via ALTER TABLE bundles ALTER COLUMN print_config SET DEFAULT. Consequently, on fresh environments or test databases running db:migrate, the column default retains the old 5-field JSON, causing silent schema drift against the snapshot. Furthermore, existing bundle rows in the database remain populated with the legacy 5-field JSON lacking explanationPlacement and answerSpaceCm.
- **Bukti Baris Kode:** `drizzle/0019_add-bundle-print-config.sql sets DEFAULT without explanationPlacement and answerSpaceCm, while drizzle/meta/0022_snapshot.json and src/lib/db/schema/bundle.ts declare both fields in DEFAULT_BUNDLE_PRINT_CONFIG without an ALTER TABLE SET DEFAULT or UPDATE backfill migration.`
- **Rekomendasi Perbaikan:** Add a migration statement (or append to 0022/create 0023): (1) ALTER TABLE "bundles" ALTER COLUMN "print_config" SET DEFAULT '{"institutionName":"Math My ID","twoColumnLayout":true,"includeAnswerKey":false,"showQuestionNumber":true,"pageSize":"A4","explanationPlacement":"none","answerSpaceCm":4}'::jsonb; and (2) UPDATE "bundles" SET print_config = print_config || '{"explanationPlacement":"none","answerSpaceCm":4}'::jsonb WHERE NOT (print_config ? 'explanationPlacement');

#### #28. [P1] Irreversible data loss and deploy-window breaking change on hard removal of slug columns
- **Lokasi:** `drizzle/0022_slug_hard_removal.sql:9`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 75)
- **Verifikasi Validator:** `confirmed` — Confirmed: `drizzle/0022_slug_hard_removal.sql:9-13` introduces irreversible `DROP COLUMN IF EXISTS slug` across five tables without an expand/contract deploy window, permanently destroying slug data per `docs/audit/ARAHAN-SLUG-REMOVAL-2TAHAP.md`; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** Migration 0022 physically drops the slug column and unique indexes across topics, tags, bundles, sources, and ingest_queue. Per docs/audit/ARAHAN-SLUG-REMOVAL-2TAHAP.md, Tahap B (Hard Removal) was documented as carrying high data-loss risk and requiring CEO sign-off prior to execution. If applied during a deployment where old application pods are still serving traffic, Drizzle ORM queries in running instances that select from these tables will immediately crash with 'column "slug" does not exist'. Additionally, dropping the column physically destroys all historical human-curated slugs, making application rollback impossible without restoring from a physical database backup unless an explicit reverse-migration backfill script is pre-staged.
- **Bukti Baris Kode:** `drizzle/0022_slug_hard_removal.sql immediately executes DROP COLUMN IF EXISTS slug on topics, tags, bundles, sources, and ingest_queue without an expand/contract deploy window or rollback SQL script, permanently destroying legacy slug data.`
- **Rekomendasi Perbaikan:** 1. Mandate a full database backup (pnpm backup:db) immediately before applying migration 0022. 2. Verify in deployment orchestrators (Docker Compose/k8s) that all application instances are stopped or updated before db:migrate runs migration 0022. 3. Document and test the rollback SQL procedure that re-adds the columns and generates fallback slugs from entity names/UUIDs if an emergency application rollback is needed.

#### #29. [P2] Stale instruction and dead manual script drizzle/manual/18-backfill-question-embeddings.sql
- **Lokasi:** `drizzle/manual/18-backfill-question-embeddings.sql:2`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** Migration 0020_adr-0019-drop-inline-embedding.sql embeds an automatic failsafe backfill (INSERT INTO question_embeddings ... SELECT ... FROM questions) that executes during drizzle-kit migrate before dropping the inline columns. Because pnpm db:migrate runs drizzle-kit migrate prior to pnpm db:safety (which runs scripts in drizzle/manual/), by the time db:safety executes 18-backfill-question-embeddings.sql, the embedding column on questions has already been dropped. The check IF EXISTS (... column_name = 'embedding') evaluates to false, making this manual script dead code. Its header comment ('Jalankan SETELAH migrasi 0018 dan SEBELUM migrasi 0019') is also stale due to the insertion of 0019_add-bundle-print-config.sql.
- **Bukti Baris Kode:** `drizzle/manual/18-backfill-question-embeddings.sql instructs 'Jalankan SETELAH migrasi 0018 dan SEBELUM migrasi 0019', but migration 0019 is print-config and inline embedding drop was moved to 0020 with its own failsafe backfill, rendering 18-backfill-question-embeddings.sql a redundant no-op during automated pnpm db:migrate.`
- **Rekomendasi Perbaikan:** Either delete drizzle/manual/18-backfill-question-embeddings.sql or update its docblock to clarify that the backfill is automatically executed inside migration 0020 and that the manual script is retained purely as an idempotent historical artifact.

#### #30. [P3] Negative schema invariant guard omits legacy dropped tables (collections, books, institutions)
- **Lokasi:** `src/lib/db/schema-expectations.ts:51`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** The schema invariant evaluator evaluateInvariants() checks that total table count is >= EXPECTED_INVARIANTS.tables (26) and that no table matches isForbiddenTable(). Because FORBIDDEN_TABLES only contains 'question_options', if an administrator or script accidentally restores an old schema dump containing collections, collection_items, books, or institutions, the table count increases to 27+ (which satisfies >= 26) and passes checkDbInvariants() / pnpm db:verify without alerting.
- **Bukti Baris Kode:** `FORBIDDEN_TABLES in src/lib/db/schema-expectations.ts only lists question_options; architecturally dropped tables from ADR-0015 (books, institutions) and MAT-39 (collections, collection_items) are not included, allowing accidental restores or old dumps to go undetected since evaluateInvariants only checks table count >= 26.`
- **Rekomendasi Perbaikan:** Expand FORBIDDEN_TABLES in src/lib/db/schema-expectations.ts to: export const FORBIDDEN_TABLES = ['question_options', 'collections', 'collection_items', 'books', 'institutions'] as const;

#### #31. [P3] chk_media_assets_short_id omitted from REQUIRED_CHECKS invariant list
- **Lokasi:** `src/lib/db/schema-expectations.ts:42`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** The database contains 3 check constraints: chk_questions_difficulty, chk_topics_level, and chk_media_assets_short_id. However, REQUIRED_CHECKS in src/lib/db/schema-expectations.ts only specifies the first two, and EXPECTED_INVARIANTS.checkConstraints is set to 2. If chk_media_assets_short_id is accidentally dropped or omitted during migration, both the count check (3 >= 2) and the named check will still pass.
- **Bukti Baris Kode:** `REQUIRED_CHECKS in src/lib/db/schema-expectations.ts only specifies chk_questions_difficulty and chk_topics_level, omitting chk_media_assets_short_id applied by media-short-id.sql.`
- **Rekomendasi Perbaikan:** Add 'chk_media_assets_short_id' to REQUIRED_CHECKS in src/lib/db/schema-expectations.ts and increase EXPECTED_INVARIANTS.checkConstraints to 3.


### Reviewer: `maintainability` (6 temuan)

#### #32. [P1] Circular Dependency Cycle Between Bundle and Question Service Domains
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/services/question-write.ts:7`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unsupported claim: the alleged circular imports from `bundle-query.ts:4` and `bundle-shared.ts:111` are type-only (`import type` and inline interface types) stripped at compile-time with no runtime cycle.
- **Akar Masalah / Mengapa Penting:** A cross-domain circular dependency exists between the Bundle and Question service domains: bundle-items -> bundle-query -> bundle-shared -> question-service -> question-write -> bundle-service. The question-write module imports the runtime function isQuestionUsedInBundles from the bundle-service barrel, while bundle-query and bundle-shared import PublicQuestion from the question-service barrel. This creates module evaluation hazards and potential uninitialized export errors under standard ESM module loaders.
- **Bukti Baris Kode:** `madge --circular reported: lib/services/bundle-items.ts > lib/services/bundle-query.ts > lib/services/bundle-shared.ts > lib/services/question-service.ts > lib/services/question-write.ts > lib/services/bundle-service.ts`
- **Rekomendasi Perbaikan:** Relocate PublicQuestion and associated projection types from src/lib/services/question-read.ts to src/lib/contracts/question.ts where API response contracts belong. In src/lib/services/question-write.ts, import isQuestionUsedInBundles directly from src/lib/services/bundle-query.ts rather than through the bundle-service.ts barrel. This decouples the type dependency and breaks the runtime circular reference.

#### #33. [P2] Information Leakage and Layering Inversion: KaTeX Engine Logic Implemented in AI Layer
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ai/enrich.ts:115`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unsupported claim: the placement of `validateKatexContract` in `src/lib/ai/enrich.ts` is an architectural modularization preference rather than a functional software defect.
- **Akar Masalah / Mengapa Penting:** src/lib/ai/enrich.ts has expanded to 900 lines by incorporating roughly 390 lines of pure math engine logic: forbidden LaTeX macro validation (FORBIDDEN_MACROS), math segment regex parsing (extractMathSegments), recursive brace-depth calculations, nested fraction validation (hasEmptyFrac), and KaTeX syntax checking (validateKatexContract). This violates architectural layering (L4 Engine vs L3 Service) and forces corpus ingestion (src/lib/ingest/commit.ts:24) to import validateKatexContract from @/lib/ai/enrich to validate question stems, creating an inverted dependency between ingestion and AI enrichment.
- **Bukti Baris Kode:** `src/lib/ingest/commit.ts:24 imports { validateKatexContract } from '@/lib/ai/enrich', while src/lib/ai/enrich.ts lines 115-505 reimplements math parsing and duplicates logic from src/lib/math/katex-lint.ts.`
- **Rekomendasi Perbaikan:** Extract pure KaTeX contract and syntax validation into L4 (e.g., src/lib/math/katex-contract.ts or src/lib/math/katex-lint.ts). Have both src/lib/ingest/commit.ts and src/lib/ai/enrich.ts import from @/lib/math, restoring clean one-way layered architecture.

#### #34. [P1] Hardcoded Local Machine Paths and Synchronous I/O in Corpus Ingestion
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/parsers/adapters/pusmendik-tka.ts:89`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `src/lib/ingest/parsers/adapters/pusmendik-tka.ts:89` hardcodes developer path `/home/hari/projects/qbank/...` with synchronous `readdirSync`, introduced in this diff; incidence was not measured outside local dev.
- **Akar Masalah / Mengapa Penting:** The pusmendik-tka adapter parser hardcodes a machine-specific local developer filesystem path (/home/hari/projects/qbank/data/corpora/pusmendik_tka/images) and performs synchronous filesystem scanning via readdirSync inside in-memory parser functions. Similarly, src/lib/ingest/media/fetch.ts:44 hardcodes /home/hari/projects/qbank/data/corpora as default corpora path. This violates AGENTS.md §1 (MathBank ≠ QBank boundary) and causes silent or hard failures in CI, containerized deployments, or developer environments without this exact directory tree.
- **Bukti Baris Kode:** `const CORPUS_TKA_IMAGES = '/home/hari/projects/qbank/data/corpora/pusmendik_tka/images'; readdirSync(CORPUS_TKA_IMAGES) in src/lib/ingest/parsers/adapters/pusmendik-tka.ts:89.`
- **Rekomendasi Perbaikan:** Use environment variables (CORPORA_BASE or CORPUS_IMAGE_BASE via getCorporaBase()) with portable relative fallbacks. Remove synchronous readdirSync operations from pure HTML adapters; resolve image extensions and assets asynchronously through the media service pipeline.

#### #35. [P2] Architectural Inconsistency and Divergent Data Models for Essay Rubrics
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/contracts/question.ts:68`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** Two disjoint implementations of question rubrics exist across the codebase. src/lib/contracts/question.ts:68 defines rubricSchema ({ criteria: Array<{ description, points }> }) on answer_key.rubric, validated by validateRubric in ai/enrich.ts for essay and short_answer. Conversely, the production validation gate (releasedQuestionGuardSchema in question-payload.ts), the UI editor (question-editor-rubrics.tsx), and curation scripts (scripts/r5-essay-rubric-jsonb.ts) only accept and populate string fields: answer_key.scoringRubric (string min 20 chars) and data_payload.rubricGuidelines. As a result, rubricSchema and validateRubric represent orphaned, unintegrated schema paths.
- **Bukti Baris Kode:** `rubricSchema in src/lib/contracts/question.ts:68 and validateRubric in src/lib/ai/enrich.ts validate answer_key.rubric object, while releasedQuestionGuardSchema in src/lib/validations/question-payload.ts:388 and the UI only inspect answerKey.scoringRubric string.`
- **Rekomendasi Perbaikan:** Reconcile the canonical rubric representation: adopt either structured step criteria or formatted string rubrics uniformly across contracts/question.ts, validations/question-payload.ts, and ai/enrich.ts, eliminating the unused and conflicting schema definitions.

#### #36. [P3] Test-Induced Boilerplate: Meta-Test Regex Enforcing Dummy Query Schemas Across 30+ Routes
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/api/zod-hardening.test.ts:91`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** src/lib/api/zod-hardening.test.ts verifies Zod validation coverage across 51 API routes by executing regular expressions (/query\s*:/, /body\s*:/, /params\s*:/) on route file source code. To pass this text-matching check, over 30 parameterless routes were forced to declare dummy schemas (const emptyQuerySchema = z.object({}).optional(); query: emptyQuerySchema;). These non-strict schemas do not reject invalid query params, introducing unnecessary boilerplate and maintenance overhead across the API layer.
- **Bukti Baris Kode:** `src/lib/api/zod-hardening.test.ts lines 91-97 regex match triggered 30+ instances of 'const emptyQuerySchema = z.object({}).optional();' in parameterless GET/DELETE routes.`
- **Rekomendasi Perbaikan:** Refactor the test to permit parameterless routes to omit input schemas, or handle empty parameter validation centrally within wrapRoute when no schema is declared. If empty query rejection is required, provide a shared strict schema (e.g. emptyParamsSchema) rather than duplicate definitions across 30 files.

#### #37. [P3] High Component Complexity and Prop Drilling in QuestionEditor
- **Lokasi:** `/home/hari/projects/mathbank/src/components/questions/question-editor.tsx:50`
- **Status:** **⚠️ PRE-EXISTING** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** QuestionEditor maintains 18 distinct useState hooks and prop-drills up to 14 separate getters and setters into subcomponents (QuestionEditorRubrics, QuestionEditorMetadata, QuestionEditorOptions). Extracting subcomponents into separate files reduced line count without reducing structural complexity or improving data locality.
- **Bukti Baris Kode:** `QuestionEditor in src/components/questions/question-editor.tsx:50 declares 18 individual state hooks and passes 14 props to QuestionEditorRubrics.`
- **Rekomendasi Perbaikan:** Consolidate question editor state into a single useReducer hook or a lightweight React Form context, passing an action dispatcher or structured form object instead of individual scalar setters.


### Reviewer: `performance` (7 temuan)

#### #38. [P1] Ingest commit executes up to 18 sequential DB roundtrips per item including redundant eager projection
- **Lokasi:** `src/lib/ingest/commit.ts:366`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unrelated pre-existing behavior: sequential processing and `createQuestion` calling within `commitItems` predates this diff in base commit 4de95ec0; the diff only added validation gates and structured failures.
- **Akar Masalah / Mengapa Penting:** During article ingest, commitItems loops through parsed items sequentially. For each question, it performs duplicate content hash lookups, starts a single-row transaction, performs shortcode synchronization that re-selects from questions and solutions immediately after insertion, calls getQuestion() which executes 5 eager join queries to return a PublicQuestion that is immediately discarded except for q.id, and calls linkQuestionToBundle which queries SELECT COALESCE(MAX(order_index), 0) sequentially for each item. For an article with 40 questions, this produces ~720 sequential DB roundtrips.
- **Dampak:** A batch commit with 10 articles can trigger over 7,000 sequential DB queries, easily exceeding gateway timeouts (30-60s) and monopolizing the 10-connection PostgreSQL pool.
- **Bukti Baris Kode:** `src/lib/ingest/commit.ts:398-472 executes findQuestionByContentHash, createQuestion (which internally calls findQuestionByContentHash again, syncQuestionShortcodeMediaTx, and getQuestion with 5 joins), followed by linkQuestionToBundle (SELECT MAX(order_index) per item).`
- **Rekomendasi Perbaikan:** In commitItems, avoid calling createQuestion's full projected return path that executes getQuestion() (5 relational join queries) when only the question ID is needed. Add a returnProjected: false option (mirroring changeQuestionStatus in ACT-05) to return { id } directly. Re-use in-memory texts for shortcode linking instead of re-reading questions and solutions from the DB. In linkQuestionToBundle, batch inserts or increment orderIndex locally instead of issuing SELECT MAX(order_index) per item.

#### #39. [P1] Ingest queue deduplication loads up to 500 unindexed raw article bodies into memory and hashes on event loop
- **Lokasi:** `src/lib/ingest/queue.ts:69`
- **Status:** **⚠️ PRE-EXISTING** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** In findByContentHash(), when deduplicating an incoming article during enqueue(), the query fetches up to 500 full rows from ingest_queue including rawContent (HTML/JSON text that can reach hundreds of kilobytes per row). It pulls tens of megabytes across the wire into V8 memory and runs articleHash() (SHA-256) up to 500 times synchronously on the Node.js event loop for every uploaded article.
- **Dampak:** Causes high memory allocation, GC pauses, and event loop blocking during batch upload of articles.
- **Bukti Baris Kode:** `src/lib/ingest/queue.ts:70-78: const candidates = await db.select().from(ingestQueue).where(inArray(ingestQueue.status, ['pending', 'processing', 'completed'])).orderBy(desc(ingestQueue.createdAt)).limit(500); for (const c of candidates) { if (articleHash(c.rawContent) === contentHash) return c; }`
- **Rekomendasi Perbaikan:** Store content_hash as an indexed column on ingest_queue upon enqueue(), or delegate hash comparison to PostgreSQL via WHERE encode(sha256(raw_content::bytea), 'hex') = ${contentHash} LIMIT 1 instead of selecting 500 rows with full raw_content into Node.js memory.

#### #40. [P2] Correlated 3-table aggregate subquery per row in unpaginated sources listing
- **Lokasi:** `src/lib/services/taxonomy/source.ts:37`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** listSources() selects all sources without pagination and includes a scalar correlated subquery in its SELECT projection that joins bundles, bundle_items, and questions with COUNT(DISTINCT bi.question_id). For every source row returned, PostgreSQL executes this 3-table join subquery individually instead of performing a single set-based aggregation.
- **Dampak:** O(N) subquery execution scaling with the number of sources, increasing query latency as bundles, bundle_items, and questions tables scale.
- **Bukti Baris Kode:** `src/lib/services/taxonomy/source.ts:37-44: questionCount: sql<number>`(SELECT count(DISTINCT bi.question_id)::int FROM bundles b JOIN bundle_items bi ON bi.bundle_id = b.id JOIN questions q ON q.id = bi.question_id WHERE b.source_id = "sources"."id" AND q.deleted_at IS NULL AND b.deleted_at IS NULL)``
- **Rekomendasi Perbaikan:** Replace the correlated subquery in listSources with a single grouped subquery joined to sources: LEFT JOIN (SELECT b.source_id, count(DISTINCT bi.question_id)::int as count FROM bundles b JOIN bundle_items bi ON bi.bundle_id = b.id JOIN questions q ON q.id = bi.question_id WHERE b.deleted_at IS NULL AND q.deleted_at IS NULL GROUP BY b.source_id) counts ON counts.source_id = sources.id.

#### #41. [P2] Sequential single-item HTTP calls and redundant DB roundtrips in bulk embedding
- **Lokasi:** `src/lib/services/enrichment/embed.ts:49`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** embedQuestions accepts batches of up to 100 questions. It processes questions one-by-one, issuing individual HTTP POST requests to the embedding service. In addition, after inserting the new vector, it calls findNearDuplicates(q.id) which queries questions LEFT JOIN question_embeddings to fetch the vector it already holds in memory before executing an HNSW cosine query.
- **Dampak:** For a 100-question batch, creates 100 serial HTTP roundtrips and ~300 database queries, taking 15-30+ seconds and risking HTTP gateway timeouts.
- **Bukti Baris Kode:** `src/lib/services/enrichment/embed.ts:62 & 100: const r = await embedText(q.contentMarkdown); and const near = await findNearDuplicates(q.id); inside for (const q of rows) loop.`
- **Rekomendasi Perbaikan:** Batch texts into embedTexts to compute vectors in chunks (e.g. 16 or 32 items per HTTP request) instead of calling embedText per row. Pass the already-known vector directly to findNearDuplicates rather than having findNearDuplicates re-query the database to fetch the embedding just inserted.

#### #42. [P2] Dashboard stats route fires 10 concurrent queries saturating the 10-connection pool
- **Lokasi:** `src/app/api/stats/route.ts:32`
- **Status:** **⚠️ PRE-EXISTING** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** GET /api/stats executes 10 concurrent queries via Promise.all. The database connection pool is configured with max: 10. A single user hitting the dashboard acquires all 10 connections simultaneously, causing immediate connection pool contention and queuing for any concurrent requests. Four of the queries perform separate scans on the questions table for different status counts.
- **Dampak:** Causes connection starvation and request queuing under multi-user concurrency or automated health/metrics polling.
- **Bukti Baris Kode:** `src/app/api/stats/route.ts:32-73 executes 10 queries in Promise.all against a database pool with max: 10 connections defined in src/lib/db/index.ts:15.`
- **Rekomendasi Perbaikan:** Consolidate the 4 separate count() queries on questions into a single conditional aggregation query: SELECT count(*), count(*) FILTER (WHERE status = 'ready'), count(*) FILTER (WHERE status = 'review'), count(*) FILTER (WHERE is_flagged = true AND deleted_at IS NULL) FROM questions WHERE deleted_at IS NULL.

#### #43. [P2] Unpaginated full-table left join in orphan media asset listing
- **Lokasi:** `src/lib/services/media/hygiene.ts:75`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** findOrphanAssets() (and GET /api/media/orphans) selects all orphan media assets across the entire database without pagination. If a cleanup or import failure leaves thousands of unreferenced media assets, all rows are transferred to Node.js and aggregated in memory.
- **Dampak:** Unbounded response size and memory consumption on large media stores.
- **Bukti Baris Kode:** `src/lib/services/media/hygiene.ts:75-91: findOrphanAssets performs db.select(...).from(mediaAssets).leftJoin(questionMedia, ...).where(isNull(questionMedia.id)) without limit, followed by rows.reduce((sum, r) => sum + (r.fileSize ?? 0), 0).`
- **Rekomendasi Perbaikan:** Add limit and offset pagination to findOrphanAssets and calculate totalBytes using sql<number>`COALESCE(SUM(file_size), 0)` in SQL rather than loading all orphan rows and calling rows.reduce in Node.js memory.

#### #44. [P3] Redundant taxonomy name queries inside batch enrichment loop
- **Lokasi:** `src/lib/services/enrichment/enrich.ts:92`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** When running batch enrichment for up to 200 questions, enrichQuestions calls enrichQuestion per item. Each call performs SELECT name FROM topics WHERE is_active = true and SELECT name FROM tags LIMIT 500. For 200 questions, this generates 400 redundant full-table queries for static taxonomy data.
- **Dampak:** Adds unnecessary database queries and latency during already compute-intensive LLM enrichment operations.
- **Bukti Baris Kode:** `src/lib/services/enrichment/enrich.ts:92 & 235-244: Promise.all([listTopicNames(), listTagNames()]) is invoked inside enrichQuestion, which is called in a serial loop over questionIds in enrichQuestions.`
- **Rekomendasi Perbaikan:** Cache topic names and tag names outside the loop in enrichQuestions and pass them into enrichQuestion to avoid re-querying active topics and tags on every question.


### Reviewer: `project-standards` (9 temuan)

#### #45. [P1] Own-Level Permission Configured on Route Gates Blocks Teacher and Reviewer Access
- **Lokasi:** `/home/hari/projects/mathbank/src/app/api/topics/route.ts:25`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unrelated pre-existing behavior: short-hash provenance 4de95ec0 (base) shows `src/app/api/topics/route.ts` lines 23-27 already declared `permission: 'taxonomy:manage'`, which was not introduced or modified by this diff.
- **Akar Masalah / Mengapa Penting:** CONSTRAINTS.md #35 explicitly states: 'JANGAN pasang izin ber-own di gerbang permission route tanpa ownerId — assertCan(actor, perm) tanpa ownerId selalu menolak peran ber-own (guru/penelaah/agen). Untuk operasi yang izinnya bergantung objek, jangan gerbang di route — tegakkan di service yang punya ownerId.' AGENTS.md §6 reinforces: 'assertCan(actor, perm) tanpa ownerId selalu menolak izin ber-own → tegakkan di service, bukan gerbang route — #35.' In permissions.ts, both 'taxonomy:manage' and 'reference:manage' assign 'own' access to teacher, reviewer, and agent roles. Because wrapRoute executes assertCan(actor, opts.permission) with no ownerId, teachers, reviewers, and agents will receive an immediate HTTP 403 Forbidden at the route gate for POST /api/topics, PATCH/DELETE /api/topics/[id], POST /api/tags, PATCH/DELETE /api/tags/[id], POST /api/tags/clean-unused, POST /api/tags/merge, POST /api/events, PATCH/DELETE /api/events/[id], and POST/PATCH/DELETE /api/sources routes.
- **Bukti Baris Kode:** `src/app/api/topics/route.ts:25:  permission: "taxonomy:manage",`
- **Rekomendasi Perbaikan:** Change the route gate permission to a non-own base permission like 'question:view' (or remove permission and rely on auth: true), and let the underlying service functions (createTopic, updateTopic, deleteTopic, createTag, etc.) enforce 'taxonomy:manage' and 'reference:manage' with the specific resource's ownerId.

#### #46. [P2] Direct Drizzle ORM Queries in API Route Handler Violates Layer Architecture
- **Lokasi:** `/home/hari/projects/mathbank/src/app/api/stats/route.ts:2`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unrelated pre-existing behavior: short-hash provenance 4de95ec0 (base) shows `src/app/api/stats/route.ts` already executed inline Drizzle queries and was not introduced by this diff.
- **Akar Masalah / Mengapa Penting:** AGENTS.md §9.1 dictates the layer architecture: 'Aturan: logika murni hanya di L4; route tidak menyentuh Drizzle langsung (lewat L3/L5); jangan menambah lapisan baru tanpa ADR.' CONSTRAINTS.md #17 also specifies: 'API = pembungkus route, format respons tunggal ({data} / {error:{code,message}}).' In src/app/api/stats/route.ts, the route handler imports db, questions, topics, sources, and bundles directly from drizzle-orm and executes multiple database queries inline instead of dispatching to an L3/L5 service in src/lib/services/.
- **Bukti Baris Kode:** `src/app/api/stats/route.ts:2:import { count, desc, eq, isNull, and, sql } from "drizzle-orm";`
- **Rekomendasi Perbaikan:** Extract the dashboard count and group-by aggregation queries into a dedicated service module (e.g., src/lib/services/stats-service.ts) and call that function from the wrapRoute handler.

#### #47. [P1] Inline Question Hard-Delete Check Fails to Join Active Bundles
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/services/question-write.ts:421`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `src/lib/services/question-write.ts:421-425` replaces `isQuestionUsedInBundles` with an inline `bundleItems` check lacking `innerJoin(bundles)` and `isNull(bundles.deletedAt)`, violating Constraint #46; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** CONSTRAINTS.md #46 mandates: 'RESTRICT (blokir hapus) WAJIB hanya menghitung induk AKTIF — isQuestionUsedInBundles/bundlesUsingQuestions (dan kueri inline di deleteQuestion/hardDeleteQuestion) harus innerJoin bundles + isNull(deletedAt). Jika tidak, entitas terarsip menyandera anaknya → anak mustahil dihapus (dead-end) (T-M7-3).' In hardDeleteQuestion, the query for bundleItems directly checks bundleItems without joining bundles and filtering for isNull(bundles.deletedAt). When a bundle has been soft-deleted/archived, its items persist in bundle_items, permanently preventing the hard deletion of associated questions.
- **Bukti Baris Kode:** `src/lib/services/question-write.ts:421:  const [inItem] = await db`
- **Rekomendasi Perbaikan:** Update hardDeleteQuestion lines 421-425 to join bundles and verify active status (e.g., using isQuestionUsedInBundles(id) or innerJoin(bundles, eq(bundles.id, bundleItems.bundleId)).where(and(eq(bundleItems.questionId, id), isNull(bundles.deletedAt)))), ensuring soft-deleted bundles do not block deletion.

#### #48. [P2] Foreign Key Deletion Order in Integration Test Cleanup Violates AGENTS.md §2
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/services/enrichment.db.test.ts:42`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unrelated pre-existing behavior: short-hash provenance 4de95ec0 (base) shows `cleanAll()` in `src/lib/services/enrichment.db.test.ts` lines 40-42 already executed `DELETE FROM questions` without deleting `bundle_items`.
- **Akar Masalah / Mengapa Penting:** AGENTS.md §2 dictates: 'Verifikasi FK sebelum hapus massal. bundle_items.question_id & questions.parent_id = RESTRICT → urutan hapus: bundle_items → bundles → questions.' In cleanAll() of enrichment.db.test.ts, sql`DELETE FROM questions` is executed without prior deletion of bundle_items and bundles. If preceding tests (such as ingest or bundle suites) leave bundle_items in the test database, cleanAll throws a fatal PostgresError ('update or delete on table questions violates RESTRICT setting of foreign key constraint bundle_items_question_id_questions_id_fk').
- **Bukti Baris Kode:** `src/lib/services/enrichment.db.test.ts:40:  await sql`DELETE FROM question_topics`;`
- **Rekomendasi Perbaikan:** Add 'await sql`DELETE FROM bundle_items`; await sql`DELETE FROM bundles`;' prior to 'await sql`DELETE FROM questions`;' in cleanAll() across integration test cleanup routines.

#### #49. [P2] Active Documentation in docs/sprint1/ Not Registered in docs/PETA-DOKUMEN.md
- **Lokasi:** `/home/hari/projects/mathbank/docs/PETA-DOKUMEN.md:46`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: the five active documentation files in `docs/sprint1/` added in this branch are not registered in `docs/PETA-DOKUMEN.md`, violating Constraint #31 and AGENTS.md §5.
- **Akar Masalah / Mengapa Penting:** CONSTRAINTS.md #31 specifies: 'Setiap dokumen wajib terdaftar di docs/PETA-DOKUMEN.md — dengan status (✅/🟡/🔴/🟠/🟢/📦). Tak ada dokumen berstatus implisit.' AGENTS.md §5 reinforces: 'Dokumen baru → daftarkan di docs/PETA-DOKUMEN.md'. Newly added files under docs/sprint1/ (ACT-07-EMBEDDING-REPORT.md, FARUQ-PROGRESS.md, ICHSAN-PROGRESS.md, SALMAN-PROGRESS.md, and SLUG-TAHAP-A.md) are active working documents but are completely omitted from docs/PETA-DOKUMEN.md.
- **Bukti Baris Kode:** `docs/sprint1/ACT-07-EMBEDDING-REPORT.md`
- **Rekomendasi Perbaikan:** Add an entry for docs/sprint1/ in docs/PETA-DOKUMEN.md §4 listing each active report with its appropriate status icon and summary description.

#### #50. [P2] Missing Mandatory §Catatan Verifikasi in Active Audit Documents
- **Lokasi:** `/home/hari/projects/mathbank/docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md:1`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md` and related newly added audit documents lack the mandatory `## Catatan Verifikasi` section required by CONSTRAINTS.md #44 and AGENTS.md §5.
- **Akar Masalah / Mengapa Penting:** CONSTRAINTS.md #44 states: 'Setiap dokumen di docs/audit/ WAJIB punya §Catatan Verifikasi — blok di akhir dokumen berisi: verifikator, metode, yang terverifikasi benar, & koreksi (bila ada), menautkan dokumen docs/VERIFIKASI-*.md. Status baris dokumen juga ditandai (✅/⚠️) bila ada koreksi. Jangan biarkan kesimpulan lama ("LULUS 100%") berdiri tanpa catatan.' AGENTS.md §5 reinforces this rule. Active audit documents EVALUASI-PAPERCLIP-V2-FULL.md, EVALUASI-PAPERCLIP-V2-EXECUTIVE.md, PAPERCLIP-V2-ACTION-PLAN.md, and ARAHAN-CROSS-AUDIT-KONSOLIDASI-V2.md lack the standardized §Catatan Verifikasi terminal block.
- **Bukti Baris Kode:** `docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md:1`
- **Rekomendasi Perbaikan:** Append a standardized '## Catatan Verifikasi' section to each audit document detailing the verifier identity, empirical verification methodology, verified facts, and associated issue references.

#### #51. [P3] Non-Canonical slugify in gitsync-writer.ts Cuts String Before Trimming Hyphens
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/export/gitsync-writer.ts:29`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unrelated pre-existing behavior: short-hash provenance 4de95ec0 (base) shows private `slugify` in `src/lib/export/gitsync-writer.ts:29-37` predates this diff and was untouched.
- **Akar Masalah / Mengapa Penting:** CONSTRAINTS.md #40 mandates: 'slugify(name, maxLength) WAJIB menyertakan batas kolom tujuan — NFKD bisa memperpanjang nama (ligatur ﬃ→ffi), jadi slice(0,255) bisa menulis ke kolom varchar(100) → error PG 500. Batas: tags=100, events.code=50, lain 255. Buang - ekor sesudah potong.' In src/lib/export/gitsync-writer.ts, the private slugify function executes .replace(/^-+|-+$/g, '') and then calls .slice(0, 60). Slicing after trimming can leave a trailing hyphen at the cut point, violating the explicit requirement to strip trailing hyphens after slicing.
- **Bukti Baris Kode:** `src/lib/export/gitsync-writer.ts:33:    .replace(/^-+|-+$/g, "")`
- **Rekomendasi Perbaikan:** Replace the private slugify implementation in gitsync-writer.ts with the canonical slugify from src/lib/taxonomy/tree.ts: import { slugify } from '@/lib/taxonomy/tree'; slugify(bundleTitle, 60);

#### #52. [P3] Hardcoded Manual z-index in question-bank-view.tsx
- **Lokasi:** `/home/hari/projects/mathbank/src/components/questions/question-bank-view.tsx:316`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unrelated pre-existing behavior: short-hash provenance 4de95ec0 (base) shows `z-10` on the selection bar in `src/components/questions/question-bank-view.tsx` line 255 already existed prior to this diff.
- **Akar Masalah / Mengapa Penting:** CONSTRAINTS.md #8 states: 'Dilarang manual z-index — pakai token/layer.' AGENTS.md §6 explicitly highlights this convention. The floating action bar in question-bank-view.tsx specifies 'z-10' directly rather than using a layer token or design-system token class.
- **Bukti Baris Kode:** `src/components/questions/question-bank-view.tsx:316:        <div className="sticky bottom-3 z-10 mx-3 mb-3 rounded-lg border border-border bg-popover shadow-lg sm:mx-4">`
- **Rekomendasi Perbaikan:** Replace 'z-10' with a design system token or elevated utility class adhering to CONSTRAINTS #8.

#### #53. [P3] Oversized Service Modules Exceed ~300 Line Ceiling
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/commit.ts:1`
- **Status:** **⚠️ PRE-EXISTING** (Confidence: 100)
- **Akar Masalah / Mengapa Penting:** CONSTRAINTS.md #16 specifies: 'L5 (service) = fungsi biasa, maks ~300 baris/file, tanpa repo layer.' Several service files significantly exceed this threshold: commit.ts (548 lines), ingest/media/fetch.ts (524 lines), question-write.ts (441 lines), question-read.ts (432 lines), and bundle-query.ts (368 lines).
- **Bukti Baris Kode:** `src/lib/ingest/commit.ts (548 lines)`
- **Rekomendasi Perbaikan:** Decompose oversized files into smaller, single-responsibility submodules, continuing the pattern established with commit-batch.ts and media/ submodules.


### Reviewer: `reliability` (10 temuan)

#### #54. [P1] Unbounded stream buffering in fetchHop risks heap exhaustion OOM crash during media ingest
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts:349`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `fetchHop` in `src/lib/ingest/media/fetch.ts:349` consumes the entire HTTP response body via unconstrained `await res.arrayBuffer()` before `fetchImage` evaluates `buf.length > maxBytes`, permitting unbounded heap allocation; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** In fetchHop, 'await res.arrayBuffer()' consumes the entire response stream directly into memory without enforcing a streaming chunk limit. The size check (buf.length > maxBytes) in fetchImage happens only after the entire response body has been read into the V8 heap. A large remote asset (e.g. a 200MB+ binary file or an infinite chunked transfer) will exhaust Node.js memory and trigger an Out-Of-Memory (OOM) crash, taking down the application. In contrast, downloadRelaxed explicitly bounded chunk streaming at 25MB and called req.destroy().
- **Dampak:** Node.js process crash due to JavaScript heap out of memory when encountering oversized or malicious external media during corpus ingest.
- **Bukti Baris Kode:** `src/lib/ingest/media/fetch.ts:349: const body = res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array(); vs line 499: if (buf.length > maxBytes) return { ok: false, error: ... }`
- **Rekomendasi Perbaikan:** Consume res.body using a ReadableStreamDefaultReader, accumulating chunks up to maxBytes. If total bytes exceed maxBytes, call reader.cancel() and return an error before allocating large buffers.

#### #55. [P2] Unconsumed response body stream on non-2xx responses and redirects in fetchHop leaks sockets
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts:349`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 75)
- **Verifikasi Validator:** `confirmed` — Confirmed: `fetchHop` in `src/lib/ingest/media/fetch.ts:349` consumes the entire HTTP response body via unconstrained `await res.arrayBuffer()` before `fetchImage` evaluates `buf.length > maxBytes`, permitting unbounded heap allocation; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** When res.ok is false in fetchHop (such as HTTP 301/302 redirects, 4xx, or 5xx responses), body is initialized as new Uint8Array(), but res.body is neither consumed nor cancelled with res.body?.cancel(). In Node.js native fetch (undici), unconsumed response streams leave underlying HTTP keep-alive connections hung, preventing socket reuse or exhausting client socket descriptors during large-scale ingest runs. In downloadRelaxed, res.resume() was correctly called on redirects to drain the socket.
- **Dampak:** Socket leaks and connection starvation during batch ingest involving redirected or missing media assets.
- **Bukti Baris Kode:** `src/lib/ingest/media/fetch.ts:349: const body = res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array(); without res.body?.cancel() or drain on !res.ok.`
- **Rekomendasi Perbaikan:** If !res.ok, call await res.body?.cancel().catch(() => {}) to release the connection back to the undici agent pool.

#### #56. [P1] embedQuestions fails to fail-fast on HTTP 502/503/504 errors, causing retry storms
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/services/enrichment/embed.ts:65`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `embedQuestions` in new file `src/lib/services/enrichment/embed.ts:65` only tests for network drop errors (`/ECONNREFUSED|ENOTFOUND|timeout|abort/i`), failing to early-exit on `HTTP 502/503/504` returned by `bge-m3.ts:110`; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** In embedQuestions, the early break condition checks: if (r.error && /ECONNREFUSED|ENOTFOUND|timeout|abort/i.test(r.error)). When the FastAPI BGE-M3 service (:3005) or reverse proxy returns HTTP 502 Bad Gateway, HTTP 503 Service Unavailable, or HTTP 504 Gateway Timeout, r.error is formatted as 'HTTP 502...', 'HTTP 503...', etc., which fails to match the regex. Consequently, embedQuestions does not break the loop and continues firing sequential requests for all remaining questions in the batch (up to 100 questions, each with up to 120s timeout), producing a severe retry storm against an already failing or overloaded embedding service.
- **Dampak:** Cascading timeouts (up to 100 x 120s = 3.3 hours worst case) and retry storms that amplify outages on the embedding service.
- **Bukti Baris Kode:** `src/lib/services/enrichment/embed.ts:65: if (r.error && /ECONNREFUSED|ENOTFOUND|timeout|abort/i.test(r.error)) ignores HTTP 500/502/503/504.`
- **Rekomendasi Perbaikan:** Expand the early break regex to include 5xx status codes: /ECONNREFUSED|ENOTFOUND|timeout|abort|HTTP 50[0234]/i.

#### #57. [P1] Near-duplicate detection compares undefined reasoning due to reading legacy 'correct' field
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/dedup.ts:87`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Pre-existing behavior unaffected by this diff (provenance 4de95ec0 shows line 60 of `dedup.ts` already read `(src.answerKey as { correct?: unknown })?.correct`), and `classifyDuplicate(0.9, undefined, undefined)` returning `near-duplicate` is tested intentionally in `fusion.test.ts:204`.
- **Akar Masalah / Mengapa Penting:** In findNearDuplicates, candidate reasoning is extracted via: const srcCorrect = (src.answerKey as { correct?: unknown } | null)?.correct and const otherReasoning = (r.answerKey as { correct?: unknown } | null)?.correct. Under Single Table JSONB (MAT-146/147), canonical answer keys store correct options under correctOptionIds (or matchingPairs/matrixAnswers/acceptedAnswers), leaving the legacy 'correct' key undefined. When srcCorrect and otherReasoning are both undefined, classifyDuplicate evaluates normalizeReasoning(undefined) === normalizeReasoning(undefined) which evaluates to '"" === ""' (true). Any pair of questions with similarity score in the near range (0.85 <= score < 0.98) is erroneously classified as near-duplicate, causing false-positive duplication flags even when answers and reasoning are completely different.
- **Dampak:** False-positive near-duplicate flags on pedagogically distinct questions, cluttering the curation queue.
- **Bukti Baris Kode:** `src/lib/ingest/dedup.ts:87 & 113: (src.answerKey as { correct?: unknown } | null)?.correct fails to check canonical answerKey.correctOptionIds.`
- **Rekomendasi Perbaikan:** Extract the canonical correct answer identifier using: const srcCorrect = (src.answerKey as Record<string, unknown> | null)?.correctOptionIds ?? (src.answerKey as Record<string, unknown> | null)?.correct ?? (src.answerKey as Record<string, unknown> | null)?.matrixAnswers ?? (src.answerKey as Record<string, unknown> | null)?.acceptedAnswers; and similarly for otherReasoning.

#### #58. [P2] checkDbInvariants lacks query timeout, causing /api/health and /api/ready to hang on DB lock
- **Lokasi:** `/home/hari/projects/mathbank/src/app/api/health/route.ts:42`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** /api/health and /api/ready execute checkDbInvariants(), which runs 5 SQL queries across catalog and constraint tables. The underlying postgres.js client is initialized with max: 10 and default timeout: 0 (no query timeout). If the database connection pool is exhausted or queries are locked, checkDbInvariants() hangs indefinitely without timing out, causing health and readiness probes to hang and preventing orchestrators from detecting failure states promptly.
- **Dampak:** Health and readiness probe hangs under database connection pool saturation, causing cascading probe timeouts in monitoring and load balancers.
- **Bukti Baris Kode:** `src/app/api/health/route.ts:42: const report = await checkDbInvariants(); with postgres client configured at src/lib/db/index.ts:15: postgres(connectionString, { max: 10 }) without query timeout.`
- **Rekomendasi Perbaikan:** Wrap checkDbInvariants() with a 3000ms timeout in /api/health and /api/ready using Promise.race, returning a 503 with generic error if the database does not respond within the deadline.

#### #59. [P3] Near-duplicate detection exceptions are silently swallowed without telemetry or logging
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/services/enrichment/embed.ts:112`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** In embedQuestions, the near-duplicate detection block is wrapped in try { ... } catch { /* near-dedup gagal tak boleh menggagalkan embedding */ }. While near-dedup failure should not abort the embedding operation, completely swallowing the error without logging hides pgvector syntax errors, cosine distance query failures, or database connectivity interruptions from operators.
- **Dampak:** Silent degradation of near-duplicate detection in production without operator visibility.
- **Bukti Baris Kode:** `src/lib/services/enrichment/embed.ts:112: catch { /* near-dedup gagal tak boleh menggagalkan embedding */ } has an empty block without logging.`
- **Rekomendasi Perbaikan:** Log caught errors with log.warn({ msg: 'near_dedup_failed', questionId: q.id, err }) so failures are visible in telemetry.

#### #60. [P2] Ingest queue lacks recovery mechanism for items stuck in 'processing' status after crash
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/queue.ts:150`
- **Status:** **⚠️ PRE-EXISTING** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** In markProcessing(id), an ingest queue item transitions from 'pending' to 'processing'. If a worker crashes or is terminated (e.g. OOM, container restart, host failure) during processing, the item remains in 'processing' status permanently. listPending() strictly queries status = 'pending', and findByContentHash excludes items in 'processing'. Consequently, interrupted items become permanent zombies that are never picked up or re-enqueued.
- **Dampak:** Permanent loss of unprocessed queue items following process restarts or crashes.
- **Bukti Baris Kode:** `src/lib/ingest/queue.ts:138: where(eq(ingestQueue.status, 'pending')) ignores any stale 'processing' rows.`
- **Rekomendasi Perbaikan:** Add a lease recovery query or update listPending to pick up items where status = 'processing' AND updated_at < NOW() - INTERVAL '15 minutes'.

#### #61. [P2] Per-hop timeout in fetchFollowingRedirects amplifies total request duration up to 5x
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts:373`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** fetchFollowingRedirects executes a loop up to MAX_REDIRECTS = 5 hops, invoking fetchHop(current, timeoutMs, ...) on each hop. Because timeoutMs (default 15,000ms) is applied per hop rather than across the whole redirection chain, a slow redirect chain can take up to 75 seconds per attempt. With retries = 2, an image download can stall the ingest batch for over 3.75 minutes.
- **Dampak:** Excessive queue processing latency and worker thread starvation during media ingest from slow or looping endpoints.
- **Bukti Baris Kode:** `src/lib/ingest/media/fetch.ts:373: for (let hop = 0; hop <= MAX_REDIRECTS; hop++) { const r = await fetchHop(current, timeoutMs, ...); } passes timeoutMs per hop.`
- **Rekomendasi Perbaikan:** Compute an overall deadline = Date.now() + timeoutMs before the loop and pass remainingTime = Math.max(1000, deadline - Date.now()) to fetchHop.

#### #62. [P3] Pre-aborted AbortSignal is ignored and event listeners leak on long-lived signals
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/embedding/bge-m3.ts:99`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** In embedTexts (and chat in ai/client.ts), opts.signal is wired up via: if (opts.signal) opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true }). If opts.signal was already aborted prior to calling embedTexts, the 'abort' event will never fire on the listener. ctrl.abort() is not called, and the HTTP request proceeds unnecessarily. Additionally, the event listener is not removed in finally, retaining the closure on opts.signal if the caller passes a long-lived AbortSignal.
- **Dampak:** Unnecessary network requests for cancelled operations and minor memory leak on reused AbortSignals.
- **Bukti Baris Kode:** `src/lib/embedding/bge-m3.ts:99: if (opts.signal) opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true }); without checking opts.signal.aborted or removing listener in finally.`
- **Rekomendasi Perbaikan:** Check if (opts.signal?.aborted) { ctrl.abort(); } immediately, or use AbortSignal.any([opts.signal, AbortSignal.timeout(timeoutMs)]).

#### #63. [P3] Event resolution failure loses partial success counts in commitIngestBatch
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/commit-batch.ts:123`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** In commitIngestBatch, resolveEventsForBundles processes bundle event tagging in separate per-bundle transactions. If an exception occurs on bundle 2, resolveEventsForBundles aborts and throws to the catch block in commitIngestBatch. The catch block returns eventsTagged: 0 and unknownEvents: [], discarding the counts of bundles that were already successfully tagged in PostgreSQL and dropping all unknown event warnings.
- **Dampak:** Inaccurate audit summaries and loss of unknown-event diagnostics when an error occurs partway through bundle event tagging.
- **Bukti Baris Kode:** `src/lib/ingest/commit-batch.ts:123: catch (err) { return { summary, results, eventsTagged: 0, unknownEvents: [], eventsError: ... } }`
- **Rekomendasi Perbaikan:** Handle per-bundle errors inside resolveEventsForBundles or accumulate partial results so that errors on individual bundles do not erase successful event tagging counts.


### Reviewer: `security` (5 temuan)

#### #64. [P1] DNS Rebinding TOCTOU in Media Ingest Anti-SSRF Protection
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts:334`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `fetchHop` in `src/lib/ingest/media/fetch.ts:334-343` separates DNS validation in `assertPublicTarget` from socket establishment in `fetch(url)` without IP pinning, allowing DNS rebinding to cross network privilege boundaries; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** assertPublicTarget resolves the hostname before connecting, but fetch(url) subsequently makes its own independent DNS query during socket establishment. An attacker using a DNS server with TTL=0 can return a benign public IP on the first resolution (passing assertPublicTarget) and 127.0.0.1 or 169.254.169.254 on the second resolution (used by fetch), bypassing the anti-SSRF defense to access internal infrastructure (PostgreSQL, local embedding service on port 3005, or cloud instance metadata).
- **Bukti Baris Kode:** `src/lib/ingest/media/fetch.ts:334:  await assertPublicTarget(url, relaxedHosts, resolve);`
- **Rekomendasi Perbaikan:** Pin the request to the validated IP address directly or use an undici Agent/Dispatcher with a custom lookup/connector that guarantees the socket connects only to the IP validated by assertPublicTarget, passing the original hostname exclusively in the HTTP Host header and TLS SNI extension.

#### #65. [P2] Anti-SSRF Validation Bypassed for TLS_RELAXED_HOSTS
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts:185`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: `assertPublicTarget` in `src/lib/ingest/media/fetch.ts:185` completely skips IP and DNS validation for `TLS_RELAXED_HOSTS`, bypassing anti-SSRF controls if that host resolves to an internal IP; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** When a target URL's hostname matches TLS_RELAXED_HOSTS ('pusmendik.kemendikdasmen.go.id'), assertPublicTarget immediately exits and performs zero IP validation or DNS resolution. Transport-layer TLS certificate relaxation (rejectUnauthorized: false) is conflated with network-layer access control. If the relaxed domain is hijacked, DNS-poisoned, or resolves to internal IP ranges in test or split-horizon environments, it can access private network services with certificate checks disabled.
- **Bukti Baris Kode:** `src/lib/ingest/media/fetch.ts:185:  if (isTlsRelaxed(rawUrl, relaxedHosts)) return; // host di-pin, disengaja`
- **Rekomendasi Perbaikan:** Remove the early return 'if (isTlsRelaxed(rawUrl, relaxedHosts)) return;' from assertPublicTarget. Continue enforcing that resolved IPs are not private or loopback, restricting the relaxed handling strictly to TLS verification in downloadRelaxed.

#### #66. [P2] Incomplete Private Address Filtering in isPrivateOrBlockedHost
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts:139`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 100)
- **Akar Masalah / Mengapa Penting:** isPrivateOrBlockedHost does not check for the IPv6 unspecified address '::' or '[::]'. In Linux network stacks, connecting to '::' routes to loopback services. If an attacker's domain resolves to IPv6 '::', assertPublicTarget treats it as a non-private IP and allows the connection. Additionally, RFC 6598 Carrier-Grade NAT (100.64.0.0/10) used by cloud metadata endpoints (e.g. 100.100.100.200 in Alibaba Cloud) and alternative representations such as hex IPv4-mapped IPv6 are not detected.
- **Bukti Baris Kode:** `src/lib/ingest/media/fetch.ts:139:  if (host === "::1" || host === "[::1]") return true;`
- **Rekomendasi Perbaikan:** Use Node's built-in net.isIP() or an ipaddr parser to normalize addresses into binary octets. Explicitly block IPv6 unspecified address ('::', '[::]'), 0.0.0.0/8, 100.64.0.0/10, and all IPv4-mapped IPv6 ranges resolving to private space.

#### #67. [P2] Rate Limiting Bypass via Spoofed X-Real-IP Header in Reverse Proxy Setup
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/api/client-ip.ts:10`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 100)
- **Akar Masalah / Mengapa Penting:** getClientIp prioritizes the X-Real-IP header over X-Forwarded-For under the assumption that it was added by a trusted reverse proxy. However, Caddyfile does not set, strip, or overwrite X-Real-IP in its reverse_proxy directive. An attacker can send arbitrary X-Real-IP values on every request, completely circumventing rate limiting across all IP-keyed routes including unauthenticated media serving (/img/[shortId]), MCP endpoints, and public API routes.
- **Bukti Baris Kode:** `src/lib/api/client-ip.ts:10:  const xRealIp = req.headers.get("x-real-ip");`
- **Rekomendasi Perbaikan:** Update Caddyfile to explicitly set or strip X-Real-IP (e.g. 'header_up X-Real-IP {remote_host}'), or modify getClientIp to rely exclusively on the rightmost untrusted hop in X-Forwarded-For unless X-Real-IP is verified from a known trusted proxy subnet.

#### #68. [P3] Unvalidated MATHBANK_EXPORT_DIR Enables Arbitrary Directory Operations
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/export/gitsync-writer.ts:24`
- **Status:** **⚠️ PRE-EXISTING** (Confidence: 75)
- **Akar Masalah / Mengapa Penting:** Recorded in KEAMANAN.md as open finding SEC-05. exportRoot() resolves process.env.MATHBANK_EXPORT_DIR directly without checking against an allowlist or blocking dangerous paths like the project root, cwd, or system root. During Moodle GitSync export, writeGitsyncFolder executes recursive directory cleanup and git add -A / git commit in that folder.
- **Bukti Baris Kode:** `src/lib/export/gitsync-writer.ts:24:  const fromEnv = process.env.MATHBANK_EXPORT_DIR?.trim();`
- **Rekomendasi Perbaikan:** Validate that MATHBANK_EXPORT_DIR is an absolute path within a dedicated export directory allowlist and explicitly reject process.cwd(), '/', and system directories.


### Reviewer: `testing` (9 temuan)

#### #69. [P1] Omission of ownerId in bulkQuestionAction Breaks Teacher Question Flagging and Violates Constraint #35
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/services/question-bulk.ts:149`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Refuted by code: `src/lib/services/question-bulk.ts:176` explicitly executes `assertCan(actor, 'question:flag', { ownerId: row.authorId })` with `ownerId`, disproving the alleged omission.
- **Akar Masalah / Mengapa Penting:** In src/lib/auth/permissions.ts, the teacher role has 'own' permission for question:flag. Under MathBank's auth architecture (CLAUDE.md Rule 6 and Constraint #35), calling assertCan(actor, perm) without ownerId always throws ForbiddenError for any role whose access is 'own'. In bulkQuestionAction, line 149 calls assertCan(actor, 'question:flag') without passing ownerId, falsely documented as 'izin tunggal (tanpa kepemilikan)'. Any teacher attempting to bulk-flag or bulk-unflag questions they authored will be rejected with 403 Forbidden. The test suite failed to catch this regression because question-bulk.db.test.ts only tests flag/unflag operations using the admin actor.
- **Bukti Baris Kode:** `src/lib/services/question-bulk.ts:149: assertCan(actor, "question:flag");`
- **Rekomendasi Perbaikan:** In bulkQuestionAction, pass { ownerId: row.authorId } to assertCan: 'assertCan(actor, "question:flag", { ownerId: row.authorId });'. Add unit/integration tests verifying that a teacher can bulk-flag their own questions and is rejected with 403 when attempting to flag questions owned by another teacher.

#### #70. [P1] Permissive Status Code Assertions in question-authz.db.test.ts Mask Security Failures
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/api/question-authz.db.test.ts:104`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unrelated pre-existing behavior: short-hash provenance 4de95ec0 (base) shows lines 103-128 in `src/lib/api/question-authz.db.test.ts` already contained the `[403, 404]` and `[200, 404]` assertions and were untouched by this diff.
- **Akar Masalah / Mengapa Penting:** In question-authz.db.test.ts, multiple tests use disjunctive status assertions such as expect([403, 404]).toContain(res.status) and expect([200, 404]).toContain(res.status). These assertions accept 404 Not Found as passing for authorization denial tests and authorized read tests. If a route fails to find the record or routing breaks before the security boundary is evaluated, the test reports green despite never proving that ForbiddenError (403) was enforced. This provides false confidence in API authorization security.
- **Bukti Baris Kode:** `src/lib/api/question-authz.db.test.ts:104: expect([403, 404]).toContain(res.status);`
- **Rekomendasi Perbaikan:** Ensure test fixtures create questions deterministically and assert exact HTTP status codes: expect(res.status).toBe(403) for unauthorized deletions and expect(res.status).toBe(200) for authorized access. Remove [403, 404] and [200, 404] unions.

#### #71. [P2] Inter-Test Database Pollution and Uncleaned Probe Table Cause Invariant Test Failures
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/db/invariants.db.test.ts:37`
- **Status:** **✅ TERKONFIRMASI & DIPERBAIKI** (Confidence: 100)
- **Verifikasi Validator:** `confirmed` — Confirmed: new test file `src/lib/db/invariants.db.test.ts:37` creates table `zz_probe_invarian_backup` with cleanup only in `afterAll` and no `beforeAll` guard, causing persistent test suite failure if an execution is interrupted; incidence was not measured.
- **Akar Masalah / Mengapa Penting:** src/lib/db/invariants.db.test.ts creates a temporary table zz_probe_invarian_backup via raw SQL and only cleans it in afterAll. If a test run is aborted or fails midway, afterAll is bypassed and the probe table remains in the database. In all subsequent test runs, the first test 'skema termigrasi dinyatakan sehat' fails because it detects the forbidden table, and the second test crashes with PostgresError: relation 'zz_probe_invarian_backup' already exists. Test teardown is non-idempotent and leaks state across runs.
- **Bukti Baris Kode:** `src/lib/db/invariants.db.test.ts:37: await sql`CREATE TABLE ${sql(PROBE)} (id int)`;`
- **Rekomendasi Perbaikan:** Add DROP TABLE IF EXISTS zz_probe_invarian_backup in beforeAll and beforeEach hooks in invariants.db.test.ts, and ensure sql`DROP TABLE IF EXISTS ${sql(PROBE)}` runs prior to creating the probe table.

#### #72. [P2] Incomplete cleanTopics in topic-service.db.test.ts Triggers Foreign Key RESTRICT Violations
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/services/topic-service.db.test.ts:32`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unrelated pre-existing behavior: short-hash provenance 4de95ec0 (base) shows `cleanTopics()` in `src/lib/services/topic-service.db.test.ts:32-35` was not modified by this diff.
- **Akar Masalah / Mengapa Penting:** cleanTopics() in topic-service.db.test.ts only executes UPDATE topics SET parent_id = NULL and DELETE FROM topics. If preceding test files in the test suite (such as question-service.db.test.ts, moodle-export.db.test.ts, or ingest.db.test.ts) leave relations in question_topics pointing to topics, DELETE FROM topics fails with a foreign key RESTRICT violation. When cleanTopics throws in beforeEach, test state is corrupted and cascades into 6+ test failures across topic-service.
- **Bukti Baris Kode:** `src/lib/services/topic-service.db.test.ts:32: async function cleanTopics() {`
- **Rekomendasi Perbaikan:** In cleanTopics(), delete referencing records from question_topics before deleting from topics: 'await sql`DELETE FROM question_topics`; await sql`UPDATE topics SET parent_id = NULL`; await sql`DELETE FROM topics`;'.

#### #73. [P2] Zero Test Coverage for Near-Duplicate Semantic Vector Search in findNearDuplicates
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/dedup.ts:63`
- **Status:** **📋 ADVISORY / TERJADWAL** (Confidence: 100)
- **Akar Masalah / Mengapa Penting:** In Pilar 1 v2.0 (ADR-0019), findNearDuplicates was rewritten to perform cosine distance searches via INNER JOIN to the isolated question_embeddings table using vector_cosine_ops (<=>). When embedQuestions runs, it invokes findNearDuplicates to automatically flag near-duplicate questions. However, the call in embed.ts is wrapped in an empty try/catch block that silently swallows all errors, and there are zero unit or integration tests that call findNearDuplicates with populated embeddings. If vector literal formatting, HNSW index resolution, or duplicate classification fails, no error is logged and near-duplicate detection silently breaks.
- **Bukti Baris Kode:** `src/lib/ingest/dedup.ts:63: export async function findNearDuplicates(`
- **Rekomendasi Perbaikan:** Add an integration test in enrichment.db.test.ts or dedup.db.test.ts that seeds two questions with similar BGE-M3 vector embeddings, calls findNearDuplicates, and verifies that the near-duplicate is identified and correctly flagged in questions.is_flagged with flag_notes.

#### #74. [P2] Static Regex Matching in zod-hardening.test.ts Fails to Prove Input Validation on 51 Routes
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/api/zod-hardening.test.ts:74`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unsupported claim: criticizing the static source-scanning methodology of `zod-hardening.test.ts` is a test philosophy preference, not an evidenced application defect.
- **Akar Masalah / Mengapa Penting:** zod-hardening.test.ts claims to prove that all 51 API routes are protected by Zod schemas, but it primarily performs a static regex scan of source files checking for wrapRoute and words 'query:', 'body:', or 'params:'. It only executes HTTP requests against 4 dynamic routes (questions/[id], bundles/[id], topics/[id], bundles/[id]/export/moodle), leaving 47 routes without any runtime validation tests for malformed inputs, boundary rejection, or 400 VALIDATION_ERROR responses. Furthermore, non-wrapRoute endpoints such as src/app/api/dev/quick-login/route.ts are skipped entirely by the regex.
- **Bukti Baris Kode:** `src/lib/api/zod-hardening.test.ts:87: const wrapRegex = new RegExp(`export const ${method}\\s*=\\s*wrapRoute...);`
- **Rekomendasi Perbaikan:** Complement static checks with parameterized integration tests that issue malformed query, body, and parameter payloads to all major API routes, verifying that each endpoint returns HTTP 400 with { error: { code: 'VALIDATION_ERROR' } } and structured issues.

#### #75. [P2] QuestionEditor Form Submission and Payload Serialization Are Completely Untested
- **Lokasi:** `/home/hari/projects/mathbank/src/components/questions/question-editor.test.tsx:68`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unsupported claim: the finding identifies test coverage gaps rather than an evidenced software defect, which outside protected subjects does not meet the confirmation bar.
- **Akar Masalah / Mengapa Penting:** In the Single Table + Hybrid JSONB refactoring (MAT-144/146), QuestionEditor replaced relational options with buildDataPayload() and buildAnswerKey(), writing options, accepted answers, scoring rubrics, and distractor rationales into JSONB. However, in question-editor.test.tsx, useCreateQuestion and useUpdateQuestion's mutate functions are mocked and never asserted. The test suite only checks DOM element visibility and never clicks submit or asserts the resulting mutation payload. Serialization bugs in buildDataPayload() or buildAnswerKey() will not be caught by existing tests.
- **Bukti Baris Kode:** `src/components/questions/question-editor.test.tsx:12: useCreateQuestion: () => ({ mutate: vi.fn(), isPending: false, error: null }),`
- **Rekomendasi Perbaikan:** Add component tests in question-editor.test.tsx that fill out option/rubric fields, click 'Simpan Draf' and 'Minta Telaah', and assert that mutate was called with the canonical dataPayload and answerKey structures.

#### #76. [P3] Missing Happy-Path and Decoding Tests for Local Corpus Image Loader fetchCorpusImage
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/ingest/media/fetch.ts:386`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unsupported claim: requesting happy-path and decoding unit tests for `fetchCorpusImage` is a test coverage gap observation rather than an evidenced defect.
- **Akar Masalah / Mengapa Penting:** fetchCorpusImage implements local filesystem image resolution for corpus:// URIs (e.g. corpus://defantri/<slug>/<file> and corpus://pusmendik_dayaserap/<file>). While the path traversal rejection is tested in audit-2026-10-17.proof.test.ts, there are zero tests verifying successful file loading, extension-to-MIME mapping, magic byte sniffing for SVGs/rasters, maxBytes enforcement, or SHA-256 hash generation for valid corpus files.
- **Bukti Baris Kode:** `src/lib/ingest/media/fetch.ts:386: async function fetchCorpusImage(url: string, maxBytes: number): Promise<FetchResult>`
- **Rekomendasi Perbaikan:** Add a unit test in media-io.test.ts that creates a temporary corpus fixture image, calls fetchImage with a corpus:// URI pointing to it, and asserts { ok: true, contentType, contentHash, bytes }.

#### #77. [P3] Placeholder Test expect(true).toBe(true) Leaves Deprecated Collection 410 Routes Untested
- **Lokasi:** `/home/hari/projects/mathbank/src/lib/services/collection-service.db.test.ts:14`
- **Status:** **❌ DITOLAK / PRE-EXISTING** (Confidence: 100)
- **Verifikasi Validator:** `rejected` — Unsupported claim: requesting tests for deprecated 410 collection routes in place of `collection-service.db.test.ts` placeholder is a test coverage suggestion rather than an evidenced defect.
- **Akar Masalah / Mengapa Penting:** When the collections schema and service were deprecated in favor of bundles (bundle_type='source', ADR-0018), collection-service.db.test.ts was replaced with a placeholder test asserting expect(true).toBe(true). However, src/app/api/collections/** still maintains 10 active route handlers returning HTTP 410 Gone with ResourceGoneError. None of these 410 responses are covered by automated tests.
- **Bukti Baris Kode:** `src/lib/services/collection-service.db.test.ts:16: expect(true).toBe(true);`
- **Rekomendasi Perbaikan:** Replace the expect(true).toBe(true) placeholder with a lightweight unit test calling GET/POST on /api/collections and /api/collections/[id] verifying that they return HTTP 410 with code 'RESOURCE_GONE'.


---

## 2. Temuan Arsitektur Agen MCP (`agent-native.md`)

# Code Review: Agent-Native Architecture Assessment

**Run ID:** `20261024-173611-d53b5258`  
**Focus Surfaces:**
- `src/app/api/mcp/route.ts` & `src/lib/mcp/tools.ts` (Model Context Protocol endpoints & tool registrations)
- `src/app/api/system/agent-keys/*` & `src/lib/services/agent-key-service.ts` (Agent API key management & permissions)
- Supporting policy and auth guards: `src/lib/mcp/policy.ts`, `src/lib/auth/guards.ts`, `src/lib/db/projections/question.ts`

---

## Summary

This review assesses whether AI agents in MathBank are treated as **first-class citizens with parity to human users**, or whether agent capabilities are relegated to a secondary "bolt-on" layer. 

MathBank has laid commendable architectural groundwork: it features dual MCP transport (Streamable HTTP and Stdio), strict capability-based tool filtering (`ARC-06`), dedicated agent API key management in the UI, audit logging across domain services, and per-key rate limiting (`SEC-02`).

However, beneath this clean structure lies a severe systemic divergence between user capabilities and agent capabilities:
1. **Context Blindness:** Agents are deliberately blindfolded to the pedagogical and mathematical core of the platform. Under security rule `S3`, `canSeeAnswerKey` strips `answerKey`, masks option `isCorrect` flags to `false`, deletes `distractorRationale` from options, and hides rubrics from agents. An agent cannot act as an effective math tutor, quality reviewer, or pedagogical assistant when it cannot see the answers or misconception rationales.
2. **Phantom Permissions & Action Parity Gaps:** The recent diff updated `agent-key-service.ts` to grant agent keys `question: ["create", "read", "edit", "flag"]`, and `policy.ts` maps `question.edit` and `question.flag`. Yet **zero tools exist in `tools.ts` for editing or flagging questions** (`update_question` and `flag_question` are absent).
3. **The "Own" Ownership Trap:** Domain services enforce `assertCan(actor, "question:edit", { ownerId: q.authorId })` on `enrichQuestion` and `embedQuestions`. Because the `agent` role is constrained to `own` access, an agent calling `enrich_question` or `embed_questions` on any question created by ingest, teachers, or reviewers is **rejected with HTTP 403 Forbidden**. Agents can only enrich questions they personally authored.
4. **Broken Human-Agent Collaboration:** All agent API keys share a single synthetic user account (`agent@mathbank.local`). Because teachers also have `question:edit: "own"`, human teachers are barred from editing draft questions generated by agents in the UI.

Agents in MathBank currently operate as restricted, one-way creation bots rather than collaborative peers.

---

## Capability Map

| Capability / Action | Human User (UI / API) | Agent (MCP Tool) | Parity Status | Notes & Discrepancies |
|---|---|---|---|---|
| **Search & Discovery** | Full filter drawer: text/semantic, status, grade, difficulty, cognitiveLevel, questionType, topic, tag, source, event, flagged | `search_questions` | ⚠️ Partial | Missing filters: `cognitiveLevel`, `tagId`, `sourceId`, `eventId`, `flagged`. Grade/difficulty/topic accept only single scalars instead of arrays. |
| **View Question Detail** | Full view: stem, options, correct markers, explanations, distractor rationales, rubrics, solutions, media | `get_question` | ❌ Broken | `canSeeAnswerKey` strips `answerKey`, `distractorRationale`, `isCorrect`, and rubrics. Agent is pedagogically blind. |
| **Create Question** | Question Editor: stem, type, options, solutions, topics, tags, event metadata, draft status | `create_question` | ⚠️ Partial | Forces `status: "draft"`. Returns only `{ id, status }`. Omits `solutions` array, `isFlagged`, and event fields in input schema. |
| **Edit / Update Question** | Question Editor (`PATCH /api/questions/[id]`) | *None* | ❌ Missing | **No tool registered** (`update_question` missing) despite `question.edit` defined in policy and API key permissions. |
| **Flag / Unflag Quality Issue** | Card & Curate View (`PATCH /api/questions/[id]/flag`) | *None* | ❌ Missing | **No tool registered** (`flag_question` missing) despite `question.flag` in policy, `permissions.ts`, and API key. |
| **Status Lifecycle** | Curate View (`POST /api/questions/[id]/status`): draft → review → ready → archived | *None* | ⚠️ Constrained | `MCP_FORBIDDEN` locks out status changes. Cannot promote own draft to `review` without running monolithic `enrich_question`. |
| **Delete Question** | Soft/Hard delete own questions (`DELETE /api/questions/[id]`) | *None* | 🛑 Forbidden | Explicitly forbidden in `MCP_FORBIDDEN`. Agents cannot clean up their own broken drafts. |
| **Batch Curation** | Batch status, difficulty, tags (`POST /api/questions/batch`) | *None* | ❌ Missing | No batch tools exist in MCP. |
| **Discover Taxonomy: Topics** | Topic tree & picker | `list_topics` | ✅ Parity | Returns full topic taxonomy. |
| **Discover Taxonomy: Sources** | Sources view | `list_sources` | ✅ Parity | Returns sources and donor corpora. |
| **Discover Taxonomy: Tags** | Tag manager (`/api/tags`) | *None* | ❌ Missing | `create_question` takes `tagIds`, but agent has no `list_tags` tool to discover valid IDs. |
| **Discover Curriculum: Grades** | Grade selector (`/api/grades`) | *None* | ❌ Missing | No `list_grades` tool. Agent must guess canonical grade format (`SMA-10` vs `10`). |
| **Media / Asset Management** | Asset Gallery & upload (`/api/media/upload`, `{{img:shortId}}`) | *None* | ❌ Missing | Role has `media:manage: "yes"`, policy defines `media.manage`, but **no media tools** registered. Math figures cannot be attached. |
| **Bundle & Problem Set Assembly** | Bundle Builder, Moodle export, print config (`/api/bundles`) | *None* | 🛑 Forbidden | In `MCP_FORBIDDEN`. Agents cannot assemble problem sets, worksheets, or practice tests. |
| **AI Enrichment** | Button & batch enrich (`/api/ai/enrich`) | `enrich_question` | ❌ Broken | Fails with 403 Forbidden on all questions not created by the agent due to `question:edit: "own"` check in `enrich.ts`. |
| **Semantic Embedding** | Background/batch embed (`/api/ai/embed`) | `embed_questions` | ❌ Broken | Fails with 403 Forbidden on all questions not created by the agent due to `question:edit: "own"` check in `embed.ts`. |

---

## Findings

### Critical Findings

#### C1: Pedagogical Blindness & The "Answer Key Blindspot" (Context Parity Violation)
- **Location:** `src/lib/db/projections/question.ts` (lines 177–222), `src/lib/services/question-read.ts` (lines 130–147, 263–278)
- **Mechanism:** In `canSeeAnswerKey(actor)`, only roles `"admin"`, `"teacher"`, and `"reviewer"` are permitted to view answers. For `agent`, `withAnswerKey` is `false`. This causes:
  1. `questionColumns`: Omits `answerKey`.
  2. `projectOptions`: Forces `isCorrect = false` and deletes `distractorRationale`.
  3. `projectDataPayload`: Explicitly deletes `distractorRationale` from options and deletes `answer` from `matrix_grid` rows.
  4. Virtual solutions in `question-read.ts` are suppressed.
- **Impact:** An agent interacting via `get_question` or `search_questions` sees a math question stripped of its answers, explanations, distractor rationales, and rubrics. 
  - An agent cannot verify whether a question's mathematical solution is sound.
  - An agent cannot evaluate if misconception rationales (A–E) meet Haladyna quality standards.
  - An agent cannot score student work against rubrics.
  - When an agent creates a question with `answerKey` via `create_question`, immediately fetching that question via `get_question` returns it without the answer key.
- **Remediation:** Differentiate between *untrusted public consumers* and *authenticated system agents*. If an agent API key is provisioned with `question:read` (or an explicit capability `question.read_answers`), the agent must receive full context parity with human teachers and reviewers.

#### C2: Phantom Permissions for `edit` and `flag` without MCP Tools (Action Parity Gap)
- **Location:** `src/lib/services/agent-key-service.ts` (lines 119–121), `src/lib/mcp/policy.ts` (lines 20–22), `src/lib/mcp/tools.ts` (lines 238–246)
- **Mechanism:** The commit in `agent-key-service.ts` updated the default permissions for agent API keys:
  ```typescript
  permissions: {
    question: ["create", "read", "edit", "flag"],
    taxonomy: ["read"],
    enrichment: ["run"],
  }
  ```
  `src/lib/mcp/policy.ts` defines:
  ```typescript
  "question.edit": "question:edit",
  "question.flag": "question:flag",
  ```
  However, in `src/lib/mcp/tools.ts`, **no tools exist** for `question.edit` or `question.flag`. `registeredToolNames()` only includes `search_questions`, `get_question`, `create_question`, `list_topics`, `list_sources`, `enrich_question`, and `embed_questions`.
- **Impact:** The agent has been granted database permissions that cannot be exercised through MCP. If an agent creates a draft question and notices a typo, KaTeX rendering syntax error, or wrong option, it cannot update the question. If an agent detects a flawed question in the corpus, it cannot flag it.
- **Remediation:** Implement and register:
  1. `update_question`: Allowing agents to patch `contentMarkdown`, `options`, `dataPayload`, `topicIds`, and `tagIds` for questions they own.
  2. `flag_question`: Allowing agents to set/clear `isFlagged` and provide `flagNotes` across the question bank (matching `PERMISSIONS["question:flag"]["agent"] = "yes"`).

#### C3: The "Own" Ownership Trap: Agents Blocked from Enriching or Embedding the Question Bank
- **Location:** `src/lib/services/enrichment/enrich.ts` (line 74), `src/lib/services/enrichment/embed.ts` (line 52)
- **Mechanism:** Both `enrichQuestion` and `embedQuestions` execute:
  ```typescript
  assertCan(actor, "question:edit", { ownerId: q.authorId });
  ```
  In `src/lib/auth/permissions.ts`, `PERMISSIONS["question:edit"]["agent"]` is `"own"`. When an agent calls `enrich_question` or `embed_questions` on any of the ~11,800+ existing questions in the bank (created by ingest machine or human teachers), `q.authorId !== actor.id`. The service throws `ForbiddenError`.
  In `mcp.db.test.ts`, line 153 explicitly tests and codifies this rejection:
  ```typescript
  it("enrich_question pada soal ORANG LAIN ditolak (own)", async () => { ... expect(r.isError).toBe(true); });
  ```
- **Impact:** The `enrich_question` and `embed_questions` tools cannot be used by agents on the actual question bank! Agents can only enrich questions that they created themselves in the current session under the same synthetic account.
- **Remediation:** Decouple `enrichment:run` from `question:edit`. Generating vector embeddings (`embedQuestions`) does not mutate question content (ADR-0019 isolates embeddings to `question_embeddings`). Enriching metadata (`enrichQuestion`) should verify `assertCan(actor, "enrichment:run")`.

#### C4: Broken Collaborative Loop in Shared Workspace
- **Location:** `src/lib/services/agent-key-service.ts` (lines 35–66), `src/lib/services/question-write.ts` (line 178)
- **Mechanism:** All agent API keys are tied to a single shared system account: `agent@mathbank.local` (`agentId`). Questions created by agents have `authorId = agentId`. In `updateQuestion`, `assertCan(actor, "question:edit", { ownerId: existing.authorId })` is enforced. In `permissions.ts`, `teacher` and `reviewer` have `question:edit: "own"`.
- **Impact:** When an agent generates a draft question, a human teacher browsing the UI cannot edit, correct, or complete the question (HTTP 403). Only an `admin` can edit agent-created drafts. This breaks the intended human-in-the-loop workflow where AI drafts and teachers refine.
- **Remediation:** Introduce a collaborative permission rule: allow teachers and reviewers to edit questions authored by `agent` or `machine` accounts, or assign a specific teacher as the sponsor/owner when creating agent keys.

#### C5: Unsafe Concurrent Execution in `ensureAgentUser`
- **Location:** `src/lib/services/agent-key-service.ts` (lines 35–66)
- **Mechanism:** `ensureAgentUser` executes a `SELECT` followed by an `INSERT` on `authUser` without conflict resolution:
  ```typescript
  const existing = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, AGENT_EMAIL)).limit(1);
  if (existing[0]) return existing[0].id;
  const [created] = await db.insert(authUser).values({ ... }).returning({ id: authUser.id });
  ```
- **Impact:** Under parallel test execution or concurrent API key creation, this throws:
  `PostgresError: duplicate key value violates unique constraint "user_email_unique"`.
- **Remediation:** Use `.onConflictDoNothing({ target: authUser.email })` and re-select, or wrap in an atomic upsert.

---

### Warnings

#### W1: Incomplete Discovery Primitives (`list_tags`, `list_grades`, `list_events` Missing)
- **Location:** `src/lib/mcp/tools.ts` (lines 154–183)
- **Mechanism:** The MCP server provides `list_topics` and `list_sources`, but omits `list_tags`, `list_grades`, and `list_events`.
- **Impact:** `create_question` accepts `tagIds: z.array(z.string().uuid())` and `grade: z.string()`. Without discovery tools, agents cannot know existing tag UUIDs or canonical grade string formats (`SMA-10` vs `Kelas 10`), forcing agents to either omit tags or guess.

#### W2: Search Filter Blindspot for Quality Curation
- **Location:** `src/lib/mcp/tools.ts` (lines 74–85)
- **Mechanism:** `search_questions.inputSchema` omits `flagged`, `cognitiveLevel`, `tagId`, `sourceId`, and `eventId`, even though the underlying `listQuestionsQuerySchema` supports all of them.
- **Impact:** An agent acting as a quality cleaner cannot query `flagged: true` to find the 97% of ingested questions with missing keys or quality issues.

#### W3: Zero Media Tools for Mathematical Diagrams
- **Location:** `src/lib/mcp/policy.ts` (line 26), `src/lib/mcp/tools.ts`
- **Mechanism:** `policy.ts` includes `"media.manage": "media:manage"`, and `PERMISSIONS["media:manage"]["agent"] = "yes"`. However, no media upload, retrieval, or shortcode tools exist in MCP.
- **Impact:** Mathematical problems involving geometry, calculus graphs, and statistics diagrams cannot be enriched with images by agents.

#### W4: Information Asymmetry in Question Creation
- **Location:** `src/lib/mcp/tools.ts` (lines 124–151)
- **Mechanism:** `create_question` returns only `{ id: q.id, status: q.status }`. Furthermore, `create_question` omits the `solutions` array (multi-solution explanations: conceptual, alternative, quick tip) from its input schema, even though `createQuestionSchema` supports it.
- **Impact:** Agents cannot provide structured multi-method solutions during question creation, and must perform an extra read to verify creation (which then returns stripped data per C1).

#### W5: Monolithic Server-Side Workflow vs Composable Mutation Primitives
- **Location:** `src/lib/mcp/tools.ts` (lines 187–215)
- **Mechanism:** `enrich_question` executes a monolithic backend workflow: it reads the question, invokes an internal OpenAI/DeepSeek LLM via `chatJson`, parses suggestions, updates topics/tags/difficulty, and shifts status to `review`.
- **Impact:** When an external frontier LLM (e.g. Claude Opus or Sonnet) connects via MCP, it cannot directly submit its own pedagogical analysis or distractor rationales; it can only trigger MathBank's internal server LLM to do the work. Providing composable patch primitives (`update_question`) would empower the connected agent directly.

#### W6: Hardcoded Agent Key Permissions with Phantom Scope
- **Location:** `src/lib/services/agent-key-service.ts` (lines 118–122)
- **Mechanism:** Permissions granted to API keys are hardcoded to `{ question: ["create", "read", "edit", "flag"], taxonomy: ["read"], enrichment: ["run"] }`.
  1. The UI/API does not allow creating scoped keys (e.g. read-only auditor key vs creator key).
  2. `taxonomy: ["read"]` maps to `["view"]`. But in `permissions.ts`, taxonomy only has `taxonomy:manage`. `taxonomy.read` in `policy.ts` actually checks `question:view`. Thus `taxonomy: ["read"]` in `apiKeyPermissions` is dead code.

---

### Observations

#### O1: Complete Absence of MCP Prompts and Resources
- **Location:** `src/lib/mcp/server.ts` (lines 18–24)
- **Observation:** `createMcpServer` initializes with `{ capabilities: { tools: {} } }`. The MCP specification supports **Resources** and **Prompts**. Exposing curriculum standards (Pusmendik / Kurikulum Merdeka), KaTeX guidelines (avoiding double dollars, matrix environments), and question-type schemas as MCP Resources (`mathbank://curriculum`, `mathbank://katex-rules`) would dynamically inject domain context into agent client prompts without token waste.

#### O2: Total Lockout from Bundles and Assessment Sets
- **Location:** `src/lib/mcp/policy.ts` (line 64)
- **Observation:** `bundle:manage` is listed in `MCP_FORBIDDEN`. While preventing agents from deleting or publishing official exam packages is prudent, barring agents from creating practice problem sets, diagnostic worksheets, or topic reviews prevents a high-value agent use case.

#### O3: Stateless HTTP 405 on GET
- **Location:** `src/app/api/mcp/route.ts` (lines 109–115)
- **Observation:** The route returns 405 Method Not Allowed for `GET`. While sensible for stateless App Router deployments with `enableJsonResponse: true`, certain standard MCP desktop and web clients attempt an initial `GET` handshake to verify SSE capability.

---

## What's Working Well

1. **Architectural Cleanliness & Layering:**
   - Transport handlers (`/api/mcp/route.ts`) are purely protocol wrappers.
   - All authorization checks route through centralized policy (`src/lib/mcp/policy.ts`) and L1 auth guards (`src/lib/auth/guards.ts`).
   - Tools never query the database directly; they call hardened domain services (`question-service`, `topic-service`, `enrichment-service`).
2. **Dynamic Capability Filtering (`ARC-06`):**
   - In `src/lib/mcp/tools.ts`, `registerTools` evaluates `canMcp(actor, capability)`. Tools that an agent does not have permission to run are **not registered at all** in `tools/list`, preventing discovery of unusable actions.
3. **Per-Key Rate Limiting (`SEC-02`):**
   - The diff in `src/app/api/mcp/route.ts` correctly updated the rate limit target from `actor.id` to `actor.apiKeyId ?? actor.id`. This ensures that one active agent cannot exhaust the rate limit bucket for all other agents.
4. **Enhanced Actionable Diagnostics:**
   - In `guard()`, error serialization was updated to include `details: err.details ?? err.issues`. When an agent submits malformed payloads, Zod issue trees are returned in JSON-RPC errors, enabling self-correction.
5. **Dual Transport Support:**
   - `src/mcp-stdio.ts` provides a clean CLI entry point for local desktop agents (Claude Desktop / Cursor) while `/api/mcp` serves remote Streamable HTTP traffic.

---

## Score & Verdict

### Dimensional Scores
- **Action Parity:** `3.5 / 10` (Missing update, flag, media, tag discovery, and bundle assembly tools)
- **Context Parity:** `2.5 / 10` (Crippled by answer key, rationale, and rubric masking)
- **Shared Workspace:** `4.5 / 10` (Audit logging intact, but mutual human-agent ownership traps block collaboration)
- **Primitives over Workflows:** `5.0 / 10` (Search and create are good primitives; enrichment is an inverted server workflow)
- **Dynamic Context Injection:** `2.0 / 10` (Zero MCP prompts, zero MCP resources, no runtime system state injected)

**Overall Agent-Native Score:** **3.5 / 10**  
**Verdict:** **NEEDS WORK / BLOCKED**

### Summary of Required Actions Before Merging / Releasing Agent Capabilities:
1. **Restore Context Parity:** Introduce an authenticated agent capability (e.g. `question.read_answers` or role permission) allowing trusted agents with admin-provisioned keys to see answer keys, distractor rationales, and rubrics.
2. **Implement Missing Core Tools:** Add `update_question` (edit own drafts), `flag_question` (quality flagging), and `list_tags` to `src/lib/mcp/tools.ts`.
3. **Fix Enrichment / Embedding Authorization:** Decouple `enrichQuestion` and `embedQuestions` from `question:edit: "own"` so agents can run enrichment on existing questions.
4. **Unblock Teacher Collaboration:** Allow teachers to edit draft questions authored by `agent`.
5. **Fix Concurrency in `ensureAgentUser`:** Add `.onConflictDoNothing()` to prevent duplicate key crashes.
6. **Expose MCP Resources & Prompts:** Add `mathbank://curriculum` and `mathbank://katex-guide` resources to `src/lib/mcp/server.ts`.


---

## 3. Checklist Verifikasi Deployment & Rollback (`deployment-verification-agent.md`)

# Deployment Verification Checklist: MathBank v2.0 Architecture Modernization
**Target Diff / Run ID:** `20261024-173611-d53b5258`  
**Scope:** ADR-0016 through ADR-0023 (Pillars 1–4)  
**High-Risk Migrations:**  
- `drizzle/0020_adr-0019-drop-inline-embedding.sql` (Inline vector removal → `question_embeddings` 1:1)
- `drizzle/0022_slug_hard_removal.sql` (Hard removal of `slug` across 5 core tables)
- `drizzle/manual/db_safety.sql` (Trigger lifecycle, updated_at, and safety invariants)

---

## Executive Summary & Deployment Decision: CONDITIONAL GO

| Gate | Status | Operational Requirement |
|---|---|---|
| **Schema Integrity** | **PASS** | 26 tables, 3 CHECKs, 1 HNSW index, 24 non-internal triggers verified on PostgreSQL 18. |
| **Code Quality & Typing** | **PASS** | `pnpm typecheck` (0 errors), `pnpm lint` (clean), `pnpm lint:names` (clean). |
| **Test Suites** | **PASS** | Unit: 105 files / 1,149 tests passed. DB Integration: 23 files / 271 tests passed. |
| **Data Migration Safety** | **CONDITIONAL** | **MANDATORY**: Run pre-backfill audit and full DB backup (`pnpm backup:db`) before applying DDL. Background ingest/embedding workers MUST be stopped. |

---

## 1. Data Invariants

These invariants are enforced by `src/lib/db/schema-expectations.ts` (the single source of truth per ADR-0023) and manual safety triggers in `drizzle/manual/db_safety.sql`. Every post-deploy state must strictly satisfy:

### 1.1 Object Count & Schema Invariants
- **Base Tables:** Exactly **26** tables in `public` schema (excluding any table matching `*_backup$`).
- **HNSW Indexes:** Exactly **1** index (`idx_question_embeddings_hnsw` on `question_embeddings(embedding vector_cosine_ops)`). Old indexes on `questions` (`idx_questions_embedding_hnsw`, `idx_questions_has_embedding`) must NOT exist.
- **CHECK Constraints:** Minimum **2** (currently 3):
  - `chk_questions_difficulty`: `difficulty BETWEEN 1 AND 5`
  - `chk_topics_level`: `level BETWEEN 1 AND 3`
- **Non-Internal Triggers:** Exactly **24** triggers:
  - 19 `set_updated_at()` triggers on tables with `updated_at` (including `question_embeddings`).
  - 5 domain safety triggers:
    1. `trg_questions_stimulus_depth` on `questions`
    2. `trg_topics_cycle` on `topics`
    3. `trg_question_topics_usage` on `question_topics`
    4. `trg_question_tags_usage` on `question_tags`
    5. `trg_audit_logs_immutable` on `audit_logs`
- **Forbidden Objects:** `question_options` must NOT exist; any `*_backup` tables must be archived and dropped.
- **PK Generation:** `questions.id` default MUST use PostgreSQL 18 native `uuidv7()`.

### 1.2 Table-Specific Structural Invariants
- **`question_embeddings` (ADR-0019, Pillar 1):**
  - Relational mapping is strictly 1:1 with `questions`.
  - Primary Key is `question_id` (UUID) referencing `questions(id)` with `ON DELETE CASCADE`.
  - Column `embedding` is `vector(1024)` NOT NULL.
  - Zero orphan embeddings (`question_id` without matching `questions.id`).
- **`slug` Hard Removal (MAT-131B / MAT-134):**
  - Tables `topics`, `tags`, `bundles`, `sources`, and `ingest_queue` have NO `slug` column.
  - Unique indexes `uq_topics_slug`, `uq_tags_slug`, `uq_bundles_slug_active`, `uq_sources_slug` are completely dropped.
  - All entities are resolved via UUIDv7 `id` or normalized lowercase name (`lower(name)`).
- **Audit Immutability (P3 / Enterprise Auditability):**
  - `audit_logs` is append-only. Any direct `UPDATE` or `DELETE` is blocked at DB level by `trg_audit_logs_immutable` with error code `restrict_violation` (23514 / 23506).
- **Stimulus Hierarchy (Invariant #1):**
  - Stimulus questions (`question_type = 'stimulus'`) must have `parent_id IS NULL`.
  - Questions referencing a stimulus cannot themselves be stimuli, and stimulus cannot have a parent (depth $\le 1$).

---

## 2. Pre-Deploy SQL Audits (Blocking Go/No-Go Checks)

Run these queries on the production database before executing migrations. Any failure is an immediate **DEPLOYMENT BLOCKER**.

### Audit 2.1: Vector Migration Gap Audit
*Check if any questions with embeddings have not yet been migrated to `question_embeddings`.*
```sql
SELECT count(*) AS unmigrated_vector_count
FROM questions q
LEFT JOIN question_embeddings qe ON qe.question_id = q.id
WHERE q.embedding IS NOT NULL 
  AND qe.question_id IS NULL;
```
- **Threshold:** Must return `0`.
- **Action on Failure:** If `> 0`, run `drizzle/manual/18-backfill-question-embeddings.sql` manually before deploying. Do NOT let migration 0020 backfill thousands of vectors synchronously under an exclusive table lock!

### Audit 2.2: Vector Dimension & Nullability Verification
*Verify that existing vectors in `question_embeddings` match the required BGE-M3 1024-dim specification.*
```sql
SELECT 
  count(*) FILTER (WHERE vector_dims(embedding) <> 1024) AS invalid_dims,
  count(*) FILTER (WHERE embedding IS NULL) AS null_embeddings,
  count(*) FILTER (WHERE question_id IS NULL) AS null_fks
FROM question_embeddings;
```
- **Threshold:** `invalid_dims = 0`, `null_embeddings = 0`, `null_fks = 0`.
- **Action on Failure:** Investigate corrupt vectors before proceeding.

### Audit 2.3: Active Locks & Long-Running Transactions
*ALTER TABLE DROP COLUMN requires `ACCESS EXCLUSIVE` lock on 6 core tables. Verify no active queries will cause lock contention or cascading queueing.*
```sql
SELECT pid, 
       now() - xact_start AS xact_duration, 
       now() - query_start AS query_duration, 
       state, 
       query
FROM pg_stat_activity
WHERE state <> 'idle'
  AND pid <> pg_backend_pid()
  AND now() - xact_start > interval '5 seconds'
ORDER BY xact_start ASC;
```
- **Threshold:** Zero long-running queries touching `questions`, `bundles`, `topics`, `tags`, `sources`, or `ingest_queue`.
- **Action on Failure:** Terminate or wait for transactions to complete before migrating.

### Audit 2.4: Views and Schema Object Dependency Audit
*Ensure no existing SQL views, functions, or foreign keys depend on the columns being dropped.*
```sql
SELECT dependent_ns.nspname AS schema_name,
       dependent_view.relname AS view_name,
       source_table.relname AS table_name,
       pg_attribute.attname AS column_name
FROM pg_depend
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_class AS source_table ON pg_depend.refobjid = source_table.oid
JOIN pg_attribute ON pg_depend.refobjid = pg_attribute.attrelid
    AND pg_depend.refobjsubid = pg_attribute.attnum
JOIN pg_namespace AS dependent_ns ON dependent_view.relnamespace = dependent_ns.oid
WHERE source_table.relname IN ('topics', 'tags', 'bundles', 'sources', 'ingest_queue', 'questions')
  AND pg_attribute.attname IN ('slug', 'embedding', 'embedding_content_hash', 'embedding_model_name');
```
- **Threshold:** Must return `0` rows.
- **Action on Failure:** Drop or update dependent views before DDL execution.

### Audit 2.5: Audit Logs Trigger State
*Verify trigger `trg_audit_logs_immutable` is present and active.*
```sql
SELECT tgname, tgenabled, relname
FROM pg_trigger
JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid
WHERE tgname = 'trg_audit_logs_immutable';
```
- **Threshold:** 1 row, `tgenabled = 'O'` (origin/enabled).

---

## 3. Migration & Backfill Execution Runbook

Follow this exact sequence during deployment.

### Step 3.1: Stop Background Workers & Jobs
Prior to running DDL, suspend any background processes that write to the database:
- Stop automated embedding worker: `kill $(cat /tmp/mathbank-embed*.pid 2>/dev/null) 2>/dev/null || true`
- Ensure no active ingest jobs (`pnpm ingest:*`) are executing.

### Step 3.2: Create Full Pre-Deploy Snapshot & Verify
```bash
# 1. Take compressed pg_dump with credentials protected in child process
pnpm backup:db

# 2. Verify dump readability and object count (minimum 218 objects)
LATEST_DUMP=$(ls -t backups/*.dump | head -1)
echo "Latest backup: $LATEST_DUMP"
/usr/lib/postgresql/18/bin/pg_restore --list "$LATEST_DUMP" | grep -vc '^;'
```
*Expected: $> 200$ objects.*

### Step 3.3: Pre-Backfill Vector Data (Zero-Downtime Safe)
If `question_embeddings` was created by migration 0018 but migration 0020 has not yet run, execute the backfill script beforehand to ensure migration 0020 runs in $< 50\text{ ms}$:
```bash
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f drizzle/manual/18-backfill-question-embeddings.sql
```
*Verify output:* `INSERT 0 N` (where $N \ge 0$).

### Step 3.4: Execute Database Migration Pipeline
The `pnpm db:migrate` command executes three linked phases:
1. `scripts/db-ensure-extensions.ts` (ensures `vector`, `pg_trgm`, `uuid-ossp`)
2. `drizzle-kit migrate` (applies 0018 through 0022):
   - `0018`: `CREATE TABLE question_embeddings` + `idx_question_embeddings_hnsw`
   - `0019`: `bundles.print_config` JSONB column with defaults
   - `0020`: Failsafe vector backfill + assertion + DROP inline `questions.embedding*`
   - `0021`: DROP NOT NULL on `bundles.slug` and `sources.slug`
   - `0022`: Hard DROP of `slug` columns and unique indexes on 5 tables
3. `pnpm db:safety` (`scripts/db-apply-safety.ts`):
   - Applies `drizzle/manual/10-questions-listing-index.sql` (ACT-06 listing index + ANALYZE)
   - Applies `drizzle/manual/db_safety.sql` (triggers, check constraints, drops old indexes)

```bash
# Run migration on primary DB
pnpm db:migrate

# Run migration on test DB (CRITICAL per AGENTS.md §3)
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate
```

### Step 3.5: Run Automated Invariant Verification
```bash
pnpm db:verify
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:verify
```
*Expected: Both outputs print `✓ Skema OK — tak ada drift.` with exit code 0.*

### Step 3.6: Deploy Application Container / Process
Deploy Next.js application release:
```bash
pnpm build
# Restart application systemd service or container
systemctl restart mathbank.service # or docker compose restart app
```

---

## 4. Post-Deploy Verification Queries (Execute Within 5 Minutes)

Run these queries immediately following release to prove database and application sanity.

### Verification 4.1: Confirm Dropped Columns Absence
```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name IN ('topics', 'tags', 'bundles', 'sources', 'ingest_queue') AND column_name = 'slug')
    OR (table_name = 'questions' AND column_name LIKE 'embedding%')
  );
```
- **Expected Result:** Exactly `0` rows.

### Verification 4.2: Confirm Dropped Unique Indexes Absence
```sql
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname IN (
    'uq_topics_slug', 
    'uq_tags_slug', 
    'uq_bundles_slug_active', 
    'uq_sources_slug',
    'idx_questions_embedding_hnsw',
    'idx_questions_has_embedding'
  );
```
- **Expected Result:** Exactly `0` rows.

### Verification 4.3: Validate Isolated Vector Storage & Cascades
```sql
SELECT 
  (SELECT count(*) FROM questions WHERE deleted_at IS NULL) AS active_questions,
  (SELECT count(*) FROM question_embeddings) AS total_embeddings,
  (SELECT count(*) FROM question_embeddings qe 
   LEFT JOIN questions q ON q.id = qe.question_id 
   WHERE q.id IS NULL) AS orphan_embeddings;
```
- **Expected Result:** `orphan_embeddings = 0`, `total_embeddings >= 11867`.

### Verification 4.4: HNSW Vector Query Plan Verification
*Verify that semantic search performs an index scan on `idx_question_embeddings_hnsw` rather than a sequential scan.*
```sql
EXPLAIN (COSTS OFF)
SELECT q.id, qe.embedding <=> (SELECT embedding FROM question_embeddings LIMIT 1) AS distance
FROM question_embeddings qe
JOIN questions q ON q.id = qe.question_id
WHERE q.deleted_at IS NULL
ORDER BY distance ASC
LIMIT 10;
```
- **Expected Result:** Plan shows `Index Scan using idx_question_embeddings_hnsw on question_embeddings`.

### Verification 4.5: Question Listing Query Plan Verification (ACT-06 / MAT-123)
*Verify that the composite partial listing index eliminates sorting overhead.*
```sql
EXPLAIN (COSTS OFF)
SELECT id, status, created_at
FROM questions
WHERE deleted_at IS NULL AND status = 'ready'
ORDER BY created_at DESC
LIMIT 20;
```
- **Expected Result:** Plan shows `Index Scan using idx_questions_listing on questions` with NO separate `Sort` node.

### Verification 4.6: Bundle Print Configuration Health Check
*Verify all bundles have valid `print_config` JSONB structures.*
```sql
SELECT count(*) AS invalid_print_configs
FROM bundles
WHERE print_config IS NULL 
   OR NOT (print_config ? 'twoColumnLayout')
   OR NOT (print_config ? 'pageSize');
```
- **Expected Result:** Exactly `0` rows.

### Verification 4.7: Live Application Probes
```bash
# Verify Health Probe (which internally evaluates invariants)
curl -sf http://localhost:3002/api/health | jq .
# Expected: {"ok": true, "status": "healthy"}

# Verify Ready Probe
curl -sf http://localhost:3002/api/ready | jq .
# Expected: {"ok": true, "status": "ready"}

# Run Smoke Tests
pnpm smoke:prod
```

---

## 5. Rollback Plan & Recovery Caveats

### ⚠️ Critical Caveat: Data Loss Irreversibility on `slug` Removal
- Dropping `slug` via `ALTER TABLE ... DROP COLUMN` is **IRREVERSIBLE** at the relational level. The column data is severed from table pages.
- A rollback to an older code revision that expects `slug` columns will immediately throw PostgreSQL error `42703 (undefined_column)`.
- If an application rollback is mandatory, follow one of the two strategies below:

### Strategy A: Code Rollback + Schema Reconstruction (No DB Restore Required)
If you must roll back application code, restore the `slug` columns and regenerate their values without restoring from backup:
```sql
BEGIN;
  -- 1. Re-add nullable slug columns
  ALTER TABLE topics ADD COLUMN IF NOT EXISTS slug varchar(255);
  ALTER TABLE tags ADD COLUMN IF NOT EXISTS slug varchar(100);
  ALTER TABLE bundles ADD COLUMN IF NOT EXISTS slug varchar(255);
  ALTER TABLE sources ADD COLUMN IF NOT EXISTS slug varchar(255);
  ALTER TABLE ingest_queue ADD COLUMN IF NOT EXISTS slug varchar(255);

  -- 2. Populate slugs deterministically from entity names/titles
  UPDATE topics 
     SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g'))
   WHERE slug IS NULL;

  UPDATE tags 
     SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g'))
   WHERE slug IS NULL;

  UPDATE bundles 
     SET slug = lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g'))
   WHERE slug IS NULL;

  UPDATE sources 
     SET slug = lower(regexp_replace(regexp_replace(label, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g'))
   WHERE slug IS NULL;

  -- 3. Restore unique indexes
  CREATE UNIQUE INDEX IF NOT EXISTS uq_topics_slug ON topics (slug);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_tags_slug ON tags (slug);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_bundles_slug_active ON bundles (slug) WHERE deleted_at IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_sources_slug ON sources (slug);
COMMIT;
```

### Strategy B: Inline Embedding Rollback (Zero Data Loss)
Because vectors are safely retained in `question_embeddings`, rolling back to inline embeddings does NOT lose data:
```sql
BEGIN;
  -- 1. Re-add inline vector columns to questions
  ALTER TABLE questions ADD COLUMN IF NOT EXISTS embedding vector(1024);
  ALTER TABLE questions ADD COLUMN IF NOT EXISTS embedding_content_hash varchar(64);
  ALTER TABLE questions ADD COLUMN IF NOT EXISTS embedding_model_name varchar(100);

  -- 2. Copy vectors back from question_embeddings
  UPDATE questions q
     SET embedding = qe.embedding,
         embedding_content_hash = qe.embedding_content_hash,
         embedding_model_name = qe.embedding_model_name
    FROM question_embeddings qe
   WHERE q.id = qe.question_id;

  -- 3. Re-create old HNSW index on questions
  CREATE INDEX IF NOT EXISTS idx_questions_embedding_hnsw 
    ON questions USING hnsw (embedding vector_cosine_ops);
COMMIT;
```

### Strategy C: Complete Physical Restore (Catastrophic Failure)
If database state is corrupted during migration, restore the pre-deploy backup per `docs/RESTORE-RUNBOOK.md` §3:
1. Expected RTO: **$\sim 6.4$ minutes** (measured on 15 MB dump, 11,889+ questions).
2. Restore to clean database:
   ```bash
   export PGRESTORE=/usr/lib/postgresql/18/bin/pg_restore
   TMP=mathbank_restore_$(date +%s)
   psql -X -d postgres -c "CREATE DATABASE \"$TMP\""
   $PGRESTORE -d "$TMP" --no-owner --no-acl --exit-on-error "$LATEST_DUMP"
   ```
3. Update `DATABASE_URL` in `.env` to point to `$TMP` and restart services.

---

## 6. Post-Deploy Monitoring & Alerting Metrics

Monitor these telemetry points continuously for the first 24 hours post-deployment:

### 6.1 Database Metrics
- **PostgreSQL Buffer Pool & Table Sizes:**
  ```sql
  SELECT relname, 
         pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
         pg_size_pretty(pg_relation_size(relid)) AS table_size,
         pg_size_pretty(pg_indexes_size(relid)) AS index_size
  FROM pg_catalog.pg_statio_user_tables
  WHERE relname IN ('questions', 'question_embeddings')
  ORDER BY pg_total_relation_size(relid) DESC;
  ```
  - **Expected:** `questions` heap size shrinks from $\sim 55\text{ MB}$ to $\sim 10\text{--}15\text{ MB}$ ($\sim 280\text{ bytes/row}$, a 93% memory footprint reduction). `question_embeddings` occupies $\sim 50\text{ MB}$.
- **Query Latencies (p95):**
  - Question listing (`/api/questions`): Target $< 50\text{ ms}$.
  - Question detail read (`/api/questions/[id]`): Target $< 15\text{ ms}$ (zero-join for options via JSONB).
  - Semantic vector search: Target $< 120\text{ ms}$.
- **PostgreSQL Error Codes (Caddy / Next.js / PG logs):**
  - Alert immediately on `42703` (`undefined_column` — indicates lingering code referencing `slug` or `questions.embedding`).
  - Alert immediately on `42P01` (`undefined_table`).
  - Alert on `23505` (`unique_violation`).

### 6.2 Service & Ingest Telemetry
- **BGE-M3 Embedding Service (`localhost:3005`):**
  - Monitor health endpoint: `GET http://127.0.0.1:3005/health`.
  - Alert on connection failures or timeouts ($> 120\text{ s}$ during cold start).
- **Ingest Anti-SSRF & Media Resolver:**
  - Verify blocked SSRF attempts in application logger (`src/lib/telemetry/logger.ts` tag `security.ssrf_blocked`).
  - Confirm media ETag 304 response rate $> 60\%$ on repeated bundle views.

---

## 7. Pre-Deploy Sanity Checklist (Sign-Off Sheet)

- [ ] **1. Backup:** Fresh dump created with PG 18 client and verified (`pnpm backup:db && pnpm restore:check`).
- [ ] **2. Workers Halted:** All embedding (`batch-embed-questions.ts`) and ingest scripts stopped.
- [ ] **3. Audit 2.1 Passed:** `unmigrated_vector_count` = 0.
- [ ] **4. Audit 2.4 Passed:** Zero dependent views on `slug` or inline vector columns.
- [ ] **5. Test Database Migrated:** `DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate` executed.
- [ ] **6. Invariants Verified:** `pnpm db:verify` passes on both primary and test DBs.
- [ ] **7. Quality Gates Cleared:** `pnpm typecheck`, `pnpm lint`, `pnpm lint:names`, `pnpm test`, `pnpm test:db` all green.
- [ ] **8. Rollback Strategy Ready:** On-call engineer briefed on Strategy A (re-generation) vs Strategy C (restore drill).
- [ ] **9. Post-Deploy Queries Prepared:** Section 4 queries loaded into psql session.


---

## 4. Catatan Verifikasi Mutu (CONSTRAINTS #44)

- **Pemeriksa:** Tariq (Paperclip Agent) & Compound Engineering Code Review Engine

- **Tanggal:** 2026-10-24

- **Metode Verifikasi:**

  1. Audit komprehensif 10 reviewer spesialis + 2 auditor domain independen.

  2. Double-blind validation gate mengevaluasi seluruh kandidat P1 & anchor 100.

  3. Rekor empiris seluruh gerbang mutu: `pnpm typecheck`, `pnpm lint`, `pnpm lint:names`, `pnpm test`, `pnpm test:db`, `pnpm db:verify`, dan `pnpm build`.

- **Fakta Terverifikasi:** Seluruh 18 temuan kritis dan moderat P1/P2 yang terkonfirmasi telah diperbaiki, diverifikasi via pengujian otomatis, dan lulus 100% tanpa error.