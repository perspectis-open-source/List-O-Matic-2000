/** Build GET URL for matcher operational log handler (`?correlationId=`). */
export function buildEvidenceGetUrl(apiBase: string, routePath: string, correlationId: string): string {
  const base = apiBase.replace(/\/$/, '')
  const path = routePath.startsWith('/') ? routePath : `/${routePath}`
  const q = new URLSearchParams({ correlationId: correlationId.trim() }).toString()
  return `${base}${path}?${q}`
}
