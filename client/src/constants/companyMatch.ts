/**
 * @file companyMatch.ts
 * @description Tunable thresholds for Contact Company Matcher deterministic tiering.
 */

/** Best score must be at least this to consider auto-match (0–1). */
export const MATCH_SCORE_HIGH = 0.91

/** Second-best must be at least this far below best for auto (0–1). */
export const MATCH_SCORE_GAP = 0.04

/** Below this, treat as weak and send to LLM assist (0–1). */
export const MATCH_SCORE_LOW = 0.72

/** Max canonical strings to score per raw after blocking expand. */
export const MATCH_MAX_CANDIDATES_FULL_SCAN = 400

/** If a blocking bucket has fewer than this, expand to all names starting with same first char. */
export const MATCH_BLOCKING_EXPAND_THRESHOLD = 12

/** Top candidates to send to the LLM per unresolved raw string. */
export const MATCH_LLM_TOP_K = 8

/** Max items per POST /api/match-companies request (generic callers). */
export const MATCH_API_BATCH_SIZE = 80

/**
 * Max unique contact import strings in one matcher run via a single POST (must match server
 * `MATCH_MAX_ITEMS_PER_REQUEST` / canonical cap). Above this, the client falls back to chunked
 * requests with concurrency 1.
 */
export const MATCH_MAX_MATCHER_ITEMS = 2500

/**
 * Chunk size when the matcher must use multiple POSTs (over {@link MATCH_MAX_MATCHER_ITEMS} unique
 * strings). Sequential requests (concurrency 1) preserve step-1 LRU warmup between chunks.
 */
export const MATCH_MATCHER_CLIENT_BATCH_SIZE = 30

export const MATCHED_COMPANY_HEADER = 'Matched Company'
