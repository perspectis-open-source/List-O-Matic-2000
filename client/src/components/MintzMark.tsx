/**
 * @file MintzMark.tsx
 * @description Demo monogram for Mintz co-branding — not the firm’s official logo.
 * @module List-O-Matic-2000/client
 */

const MARK_BG = '#006855'

type Props = {
  size?: number
}

export function MintzMark({ size = 32 }: Props) {
  const fs = Math.max(9, Math.round(size * 0.38))
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill={MARK_BG} />
      <text
        x="50%"
        y="52%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize={fs}
        fontWeight="700"
      >
        M
      </text>
    </svg>
  )
}
