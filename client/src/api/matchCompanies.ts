const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type MatchCompaniesResponse = { mapping: Record<string, string> }

/** Sends only company name strings to the backend (no PII). contactCompanyNames = unique company names from contact list; crmCompanyNames = CRM company names only. */
export async function postMatchCompanies(
  contactCompanyNames: string[],
  crmCompanyNames: string[]
): Promise<MatchCompaniesResponse> {
  const res = await fetch(`${API_BASE}/api/match-companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactCompanyNames, crmCompanyNames }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<MatchCompaniesResponse>
}
