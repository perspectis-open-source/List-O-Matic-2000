export function parseBracketedTimestampLine(line: string): { stamp: string; rest: string } | null {
  const m = line.match(/^(\[[^\]]+\])\s*(.*)$/)
  if (!m) return null
  return { stamp: m[1], rest: m[2] ?? '' }
}
