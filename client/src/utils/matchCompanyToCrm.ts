/**
 * Match a contact's company name to the best-matching CRM company (fuzzy match).
 */

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array(m + 1)
  for (let i = 0; i <= m; i++) dp[i] = Array(n + 1).fill(0)
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[m][n]
}

/**
 * Find the CRM company that best matches the contact company name.
 * Returns the canonical CRM company string, or the original if no good match.
 */
export function matchCompanyToCrm(contactCompany: string, crmCompanies: string[]): string {
  const raw = String(contactCompany ?? '').trim()
  if (!raw || crmCompanies.length === 0) return raw
  const norm = normalize(raw)
  if (!norm) return raw

  let bestCrm = crmCompanies[0]
  let bestScore = Infinity

  for (const crm of crmCompanies) {
    const crmNorm = normalize(crm)
    if (crmNorm === norm) return crm
    const dist = levenshtein(norm, crmNorm)
    const maxLen = Math.max(norm.length, crmNorm.length, 1)
    const score = dist / maxLen
    if (score < bestScore) {
      bestScore = score
      bestCrm = crm
    }
  }

  return bestCrm
}

/**
 * Build a map from contact company name -> CRM company name for a list of unique contact companies.
 */
export function buildCompanyMatchMap(
  contactCompanyNames: string[],
  crmCompanies: string[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const name of contactCompanyNames) {
    map.set(name, matchCompanyToCrm(name, crmCompanies))
  }
  return map
}
