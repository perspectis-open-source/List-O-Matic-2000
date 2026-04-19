/**
 * @file matcherMatchTooltip.ts
 * @description Copy for Contact Company Matcher match-column hover tooltips (parent vs CRM alignment).
 */

export type MatcherTooltipExplain = {
  source: 'ambiguous' | 'llm'
}

export type MatcherTooltipContext = {
  selection: Record<string, string>
  provenanceByRaw: Record<string, 'llm' | 'manual'>
  matchExplainByRaw?: Record<string, MatcherTooltipExplain>
  parentByRaw: Record<string, string>
  parentByCanon: Record<string, string>
}

const SKIP = ''

function parentsAlign(parentContact: string, parentCrm: string): boolean {
  return (
    parentContact.length > 0 &&
    parentCrm.length > 0 &&
    parentContact.trim().toLowerCase() === parentCrm.trim().toLowerCase()
  )
}

/**
 * Hover text for one import-side company string (`raw`) and the current grid context.
 */
export function buildMatcherMatchTooltipText(raw: string, ctx: MatcherTooltipContext): string {
  const stored = ctx.selection[raw]
  const provenance = ctx.provenanceByRaw[raw]
  const isExplicitSkip = stored === SKIP && provenance === 'manual'
  if (isExplicitSkip) {
    return 'This import string is set to Skip; it will not map to a companies-list name.'
  }

  const explain = ctx.matchExplainByRaw?.[raw]
  if (!explain) {
    return 'Run the matcher to see how this import string was classified.'
  }

  const rawDisplay = raw.trim() || '(empty)'
  const parentContact = (ctx.parentByRaw[raw] ?? '').trim()
  const firstPart = parentContact
    ? `Contact company of ${rawDisplay} mapped to Parent ${parentContact}.`
    : `Contact company of ${rawDisplay}.`

  const sel =
    stored === undefined || stored === SKIP ? '' : String(stored).trim()

  if (!sel) {
    return explain.source === 'ambiguous'
      ? `${firstPart} No confident list match yet — pick a CRM company or Skip.`
      : `${firstPart} Pick a companies-list name or Skip.`
  }

  const parentCrm = (ctx.parentByCanon[sel] ?? '').trim()

  if (parentsAlign(parentContact, parentCrm)) {
    if (parentContact && sel.toLowerCase() === parentContact.toLowerCase()) {
      return `${firstPart} CRM company is ${sel}, so it matched.`
    }
    return `${firstPart} CRM of ${sel} mapped to ${parentCrm}, so it matched.`
  }

  const tail = parentCrm ? ` That CRM row's parent is ${parentCrm}.` : ''
  return `${firstPart} CRM company is ${sel}.${tail}`
}
