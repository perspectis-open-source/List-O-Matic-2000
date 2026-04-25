/**
 * @file body.tsx
 * @description Token / batch / USD highlights for company-match activity log rest text.
 */
import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import type { VendorActivityLogPalette } from '../../platform/local/shared/vendorActivityLog/types'
import { batchProgressBlue, parseBatchLinePrefix } from './highlight'

/**
 * Highlight per-batch token totals ("Tokens this request: …"), entire-run line
 * ("LLM tokens (entire matcher run): … total — … prompt + … completion."), and cost estimates ("Est. $…").
 * Left-to-right: whichever pattern appears first wins each step.
 */
function highlightCompanyMatchLogRest(text: string, tokensColor: string, usdColor: string): ReactNode {
  const tokenRe = /Tokens this request:\s*[\d,]+/
  const entireRunRe =
    /LLM tokens \(entire matcher run\): \d[\d,]* total — \d[\d,]* prompt \+ \d[\d,]* completion\./
  const usdRe = /Est\.\s*(\$[\d,]+(?:\.\d+)?)/

  const nodes: ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const tokenMatch = remaining.match(tokenRe)
    const entireRunMatch = remaining.match(entireRunRe)
    const usdMatch = remaining.match(usdRe)
    const tokenIdx = tokenMatch ? remaining.indexOf(tokenMatch[0]) : -1
    const entireRunIdx = entireRunMatch ? remaining.indexOf(entireRunMatch[0]) : -1
    const usdIdx = usdMatch ? remaining.indexOf(usdMatch[0]) : -1

    type Pick = 'token' | 'entireRun' | 'usd' | 'none'
    let pick: Pick = 'none'
    let bestIdx = Infinity
    if (tokenIdx !== -1 && tokenIdx < bestIdx) {
      pick = 'token'
      bestIdx = tokenIdx
    }
    if (entireRunIdx !== -1 && entireRunIdx < bestIdx) {
      pick = 'entireRun'
      bestIdx = entireRunIdx
    }
    if (usdIdx !== -1 && usdIdx < bestIdx) {
      pick = 'usd'
      bestIdx = usdIdx
    }

    if (pick === 'none') {
      nodes.push(remaining)
      break
    }

    if (pick === 'token') {
      nodes.push(remaining.slice(0, tokenIdx))
      nodes.push(
        <Box component="span" key={`tok-${key++}`} sx={{ color: tokensColor, fontWeight: 600 }}>
          {tokenMatch![0]}
        </Box>,
      )
      remaining = remaining.slice(tokenIdx + tokenMatch![0].length)
    } else if (pick === 'entireRun') {
      nodes.push(remaining.slice(0, entireRunIdx))
      nodes.push(
        <Box component="span" key={`run-${key++}`} sx={{ color: tokensColor, fontWeight: 600 }}>
          {entireRunMatch![0]}
        </Box>,
      )
      remaining = remaining.slice(entireRunIdx + entireRunMatch![0].length)
    } else {
      const full = usdMatch![0]
      nodes.push(remaining.slice(0, usdIdx))
      nodes.push(
        <Box component="span" key={`usd-${key++}`} sx={{ color: usdColor, fontWeight: 600 }}>
          {full}
        </Box>,
      )
      remaining = remaining.slice(usdIdx + full.length)
    }
  }

  if (nodes.length === 0) return text
  return nodes.length === 1 ? nodes[0] : <>{nodes}</>
}

export type RenderCompanyMatchActivityBodyOptions = {
  palette: VendorActivityLogPalette
  themeMode: 'light' | 'dark'
}

/** Renders company-match log “rest” after an optional bracketed timestamp (batch prefix + token/USD highlights). */
export function renderCompanyMatchActivityBody(
  body: string,
  { palette, themeMode }: RenderCompanyMatchActivityBodyOptions,
): ReactNode {
  const batch = parseBatchLinePrefix(body)
  if (batch) {
    const batchBlue = batchProgressBlue(
      batch.batchIndex,
      batch.batchTotal,
      palette.tokens,
      themeMode,
    )
    return (
      <>
        <Box component="span" sx={{ color: batchBlue, fontWeight: 600 }}>
          Batch {batch.batchIndex}
        </Box>
        <Box component="span" sx={{ color: palette.tokens, fontWeight: 600 }}>
          /{batch.batchTotal}:{' '}
        </Box>
        {highlightCompanyMatchLogRest(batch.tail, palette.tokens, palette.cost)}
      </>
    )
  }
  return highlightCompanyMatchLogRest(body, palette.tokens, palette.cost)
}
