/** Coerce unknown to trimmed string (empty if null/undefined). */
export function coerceTrimmed(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

export function isNonEmptyCoercedTrimmed(value: unknown): boolean {
  return coerceTrimmed(value) !== ''
}
