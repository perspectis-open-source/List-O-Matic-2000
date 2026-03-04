# Plan: LLM include product brands (durable; company-agnostic logic, exemplars allowed)

## Constraints (non-negotiable)

- **Company-agnostic:** The logic works for any parent company; we do not bias toward any company in the user's data. Prompts may still use real-world exemplars from companies not in the import list (e.g. Procter & Gamble).
- **No companies from the import list:** Do not use the names of any company (or their brands) that appear in the user's import/demo list. The demo list is fixed (e.g. the 25 companies in the generate-contacts script); prompts must not reference those.
- **Exemplars allowed from other companies:** Real-world exemplars are allowed to illustrate the pattern, using only companies that are not in the import list (e.g. Procter & Gamble, Johnson & Johnson). Example: "If the parent were Procter & Gamble, list entries like 'Tide LLC' or 'Pampers Inc' are that parent's brands—include them." The demo import list is the 25 companies in `client/scripts/generate-contacts.js`; do not use those or their brands in prompts.
- **Durable:** Design must work for any industry and any company. Exemplars illustrate the pattern; the logic applies to all parents.

---

## Problem

AI Search returns parent and legal variants but omits list entries that are product brands (often appearing as "Brand LLC", "Brand Inc", etc.). The model is not reliably including those. We need a generic way to improve this.

---

## Option A: Require `inferredBrands` in JSON (recommended)

**Idea:** Force the model to output a list of the parent's known brands/subsidiaries first, then build `matchingCompanyNames` from the provided list. Exemplars in the prompt may use real-world companies not in the import list (e.g. P&G).

**Prompt changes (generic only):**

- Add required output: `"inferredBrands"`: array of strings — "From your knowledge, list the parent's known subsidiaries and product/consumer brands. Use this only to decide which list entries to include; do not copy this array into matchingCompanyNames."
- Step 3: "For each name in the provided list, if it is the parent or matches any entry in inferredBrands (including with legal suffix LLC, Inc, Co), add that exact list string to matchingCompanyNames."

**Implementation:** Parse `inferredBrands` from the LLM response; do not send it to the client (or optionally surface later). API response shape unchanged.

**Durability:** Works for any parent (tech, retail, beverage, etc.). Exemplars in the prompt may use real company names not in the import list (e.g. P&G). Model knowledge of brands may be incomplete or stale; the plan does not rely on validating against real-world data—only on generic instructions plus exemplars.

---

## Option B: Richer mock `search_web` response (generic)

**Idea:** When the agent calls `search_web`, the mock returns generic instructions that reinforce including all brands from the list.

**Change:** Expand the mock return string with a sentence that reinforces including all brands from the list. Real-world exemplars are allowed (e.g. "for a parent like Procter & Gamble, include list entries such as Tide LLC or Pampers Inc if they appear in the list"). Do not use any company or brand from the import list.

**Durability:** Same exemplar rule as constraints: only companies not in the import list. Optionally vary the mock wording over time (while keeping the rule) to avoid the model becoming desensitized to a static prompt.

---

## Option C: Explicit "scan the list" instruction

**Idea:** Tell the model to consider each list entry in turn.

**Change:** In Step 3 add: "Scan the provided list line by line. For each line, decide: is this the parent, a subsidiary, a product/consumer brand of the parent, or a misspelling (including with LLC/Inc/Co)? If yes, add that exact string to matchingCompanyNames. Entries like 'X LLC' or 'X Inc' are often that brand; if the brand belongs to the parent, include the entry." Placeholders (X, brand) are fine; optionally add a real-world exemplar from a company not in the import list (e.g. P&G) for consistency with the rest of the prompts.

**Durability:** Generic; applies to any list and any parent. Same exemplar rule as constraints if a real name is used.

---

## Option D: Two-phase agent

**Idea:** First call returns parent + inferredBrands; second call returns matchingCompanyNames given that context. More cost and complexity; consider only if A–C are insufficient.

---

## Risks and mitigations

- **Batching:** The server sends unique company names in batches (e.g. 400 per request). Each batch is processed independently; results are merged. Ensure the same prompt and `inferredBrands` logic apply to every batch so product-brand list entries are included whether they appear in batch 1 or later. If list size or token limits grow, document or adjust batch size; do not rely on all names being in one batch for correct behavior.
- **Model compliance:** The model may not always populate `inferredBrands` or follow the match-from-list rule. Parsing must tolerate missing or malformed `inferredBrands` (treat as empty and still produce `matchingCompanyNames` from the rest of the response). Optionally log or monitor when `inferredBrands` is empty so compliance can be reviewed.
- **Backward compatibility:** API response shape (e.g. `matchingCompanyNames`, `parentCompany`, `reasoningSteps`) must remain unchanged. New fields such as `inferredBrands` are server-side only and not sent to the client. Test that existing clients and flows still work after implementation.

---

## Suggestions

- **Model knowledge:** Consider periodically updating or supplementing how the model sees brand data (e.g. prompt wording, few-shot examples, or future use of external brand lists) to mitigate incomplete or stale brand knowledge.
- **Batch size:** Experiment with batch sizes (e.g. 200, 400, 500) to balance performance and token limits; document the chosen value and when to revisit it.
- **Mock response variation:** Vary the mock `search_web` response wording over time (while keeping the rule and exemplar policy) to reduce desensitization and keep the reminder effective.
- **Testing:** Run thorough tests for edge cases: unusual suffixes, similar names across unrelated parents, list entries that are substrings of brand names; confirm matching uses exact list strings only.
- **Logging and monitoring:** Log when `inferredBrands` is missing or empty, and log/monitor `matchingCompanyNames` length and parse failures so issues can be detected quickly.

---

## Recommendation

1. Implement **Option A** (inferredBrands) so the model must enumerate brands before matching.
2. Add **Option B** (mock search reminder) with the generic sentence above.
3. If needed, add **Option C** (scan line-by-line) to Step 3.

---

## Implementation checklist

- [ ] All new or changed prompt and mock text uses generic terms, placeholders (e.g. "brand", "X LLC"), or exemplar companies not in the import list (e.g. Procter & Gamble, Johnson & Johnson)—never companies or brands from the import list.
- [ ] No companies (or their brands) from the import/demo list in prompts or mock search. Exemplars may use other real-world companies (e.g. Procter & Gamble) only.
- [ ] Parsing accepts `inferredBrands` but does not require it in the client-facing API. If `inferredBrands` is missing or not an array, treat as empty and do not fail; still parse `matchingCompanyNames` and return a valid response.
- [ ] Error handling: when LLM response is invalid or missing `matchingCompanyNames`, return a safe fallback (e.g. empty array) and do not throw; log for debugging.
- [ ] Verify with a search that list entries that are product brands (with or without LLC/Inc/Co) are now included when they belong to the parent.
- [ ] Edge cases: test or document behavior for unusual suffixes, very similar names across unrelated parents, and list entries that are substrings of brand names; ensure matching uses exact list strings only.
- [ ] Backward compatibility: confirm existing API contract and client behavior unchanged; run a quick smoke test for the current AI Search flow after changes.
- [ ] Batch size: document chosen batch size and when to revisit (e.g. if list or token limits grow).
- [ ] Mock variation: plan or implement variation of mock search response wording over time (same rule, different phrasing).
- [ ] Logging: log when `inferredBrands` is missing/empty and log parse failures or empty `matchingCompanyNames` for monitoring.

---

## Files

- [server/index.js](server/index.js): prompts, mock search string, and parsing.
