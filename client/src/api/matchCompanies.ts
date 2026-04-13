/**
 * @file matchCompanies.ts
 * @description Client API: POST /api/match-companies — LLM assist for contact company → canonical Name mapping.
 */
import { MATCH_API_BATCH_SIZE } from '../constants/companyMatch'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type MatchCompanyItem = { raw: string; topCandidates: string[] }

export type MatchCompanyResult = { raw: string; match: string | null; alternates?: string[] }

export type MatchCompaniesResponse = { results: MatchCompanyResult[] }

export async function postMatchCompanies(
  canonicalNames: string[],
  items: MatchCompanyItem[]
): Promise<MatchCompaniesResponse> {
  const res = await fetch(`${API_BASE}/api/match-companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canonicalNames, items }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<MatchCompaniesResponse>
}

/** Split items into batches of at most MATCH_API_BATCH_SIZE; run sequentially to avoid huge payloads. */
export async function postMatchCompaniesBatched(
  canonicalNames: string[],
  items: MatchCompanyItem[]
): Promise<MatchCompanyResult[]> {
  if (items.length === 0) return []
  const all: MatchCompanyResult[] = []
  for (let i = 0; i < items.length; i += MATCH_API_BATCH_SIZE) {
    const chunk = items.slice(i, i + MATCH_API_BATCH_SIZE)
    const { results } = await postMatchCompanies(canonicalNames, chunk)
    all.push(...results)
  }
  return all
}
