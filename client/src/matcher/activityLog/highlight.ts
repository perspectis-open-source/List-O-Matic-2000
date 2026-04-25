/**
 * @file highlight.ts
 * @description Parse and color company-match activity lines (e.g. `Batch i/t:` prefixes).
 */

export type ParsedBatchPrefix = {
  batchIndex: number
  batchTotal: number
  /** Text after `Batch i/t: ` */
  tail: string
}

/**
 * Match `Batch 3/6: rest of line` as produced by match-companies logging.
 */
export function parseBatchLinePrefix(rest: string): ParsedBatchPrefix | null {
  const m = rest.match(/^Batch (\d+)\/(\d+): (.*)$/)
  if (!m) return null
  return {
    batchIndex: Number.parseInt(m[1], 10),
    batchTotal: Number.parseInt(m[2], 10),
    tail: m[3],
  }
}

function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim()
  if (h.length !== 6) return [0, 0, 0]
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ]
}

/**
 * Progressive blue for `Batch i`: light at i=1, lerping to `tokensColor` at i=batchTotal.
 */
export function batchProgressBlue(
  batchIndex: number,
  batchTotal: number,
  tokensColor: string,
  mode: 'light' | 'dark',
): string {
  const ratio = batchTotal <= 1 ? 0 : (batchIndex - 1) / (batchTotal - 1)
  const startHex = mode === 'light' ? '#38bdf8' : '#0ea5e9'
  const start = parseHexColor(startHex)
  const end = parseHexColor(tokensColor)
  const r = Math.round(start[0] + (end[0] - start[0]) * ratio)
  const g = Math.round(start[1] + (end[1] - start[1]) * ratio)
  const b = Math.round(start[2] + (end[2] - start[2]) * ratio)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
