import type { ReactNode } from 'react'

// Every hard figure and period a reader scans for — currency, %, pp, ×-multiples,
// "N times", "N standard deviations", and fiscal labels (Q3 FY26, Apr FY27, FY26).
// Order matters: month/quarter-scoped labels precede the bare-year fallback.
const FIGURE_RE = /₹\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:cr|crore|lakh|bn))?|[−-]?\d+(?:\.\d+)?\s?(?:%|pp|σ)|\b\d+(?:\.\d+)?\s?(?:times|standard deviations)\b|\b\d+(?:\.\d+)?x\b|(?:Q[1-4]|H1|9M)\s?FY\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s?FY\d{2}|\bFY\d{2}\b/g

/** Split prose into text + <strong> figure runs so the numbers pop at a glance.
 *  Pure/deterministic; every number already passed the grounding firewall. */
export function highlightFigures(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(FIGURE_RE)) {
    const idx = m.index ?? 0
    if (idx > last) parts.push(text.slice(last, idx))
    parts.push(<strong key={i++} className="font-bold text-navy-deep">{m[0]}</strong>)
    last = idx + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
