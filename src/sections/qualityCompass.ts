import { insurers } from '@/data/mockData'
import type { Insurer } from '@/data/types'
import { clamp } from './valuationShared'

// ---------------------------------------------------------------------------
//  Operating-quality compass — relative scores on the four operating axes behind
//  the valuation multiple, vs the peer-group average. Extracted VERBATIM from the
//  Valuation view so the decision-layer Quality Lens card and the peer section's
//  Quality Lens read the SAME numbers for whichever company is selected. The
//  scoring formulae are unchanged — only relocated to be shared and generalised
//  from the focal name to any company.
// ---------------------------------------------------------------------------

export type QualityPosition = 'Above Average' | 'Weak vs peers' | 'Average'

export interface QualityAnalysis {
  /** Radar series: this company's score vs the peer-average score per axis. */
  compassData: { axis: string; self: number; peer: number }[]
  /** Per-axis gap vs peers (self − peer), for the score bars. */
  drivers: { axis: string; delta: number; ahead: boolean; self: number }[]
  position: QualityPosition
  /** Plain verdict label ("Above peer average" / …). */
  verdict: string
  tone: 'teal' | 'coral' | 'navy'
}

const AXES = ['Growth', 'Profitability', 'Market Share', 'Balance Sheet'] as const

/** Build the operating-quality compass for a company vs its peer group. */
export function buildQuality(company: Insurer): QualityAnalysis {
  const peers = insurers.filter((i) => i.peerGroup === company.peerGroup && i.id !== company.id)
  const avg = (f: (p: Insurer) => number) => (peers.length ? peers.reduce((s, p) => s + f(p), 0) / peers.length : 0)
  const sc = (g: number, mgn: number, ms: number, solv: number) => ({
    Growth: clamp(g * 2.4),
    Profitability: clamp(48 + mgn * 3 + 12),
    'Market Share': clamp(ms * 3.8),
    'Balance Sheet': clamp(solv * 22),
  })
  const selfScores = sc(company.growth, company.margin, company.marketShare, company.solvency)
  const peerScores = sc(avg((p) => p.growth), avg((p) => p.margin), avg((p) => p.marketShare), avg((p) => p.solvency))
  const compassData = AXES.map((axis) => ({ axis, self: Math.round(selfScores[axis]), peer: Math.round(peerScores[axis]) }))
  const delta =
    compassData.reduce((s, d) => s + d.self, 0) / AXES.length - compassData.reduce((s, d) => s + d.peer, 0) / AXES.length
  const position: QualityPosition = delta >= 8 ? 'Above Average' : delta <= -8 ? 'Weak vs peers' : 'Average'
  const drivers = compassData.map((d) => ({ axis: d.axis, delta: d.self - d.peer, ahead: d.self >= d.peer, self: d.self }))
  const verdict =
    position === 'Above Average' ? 'Above peer average' : position === 'Weak vs peers' ? 'Below peer average' : 'In line with peers'
  const tone: 'teal' | 'coral' | 'navy' = position === 'Above Average' ? 'teal' : position === 'Weak vs peers' ? 'coral' : 'navy'
  return { compassData, drivers, position, verdict, tone }
}

/** Look up the insurer behind a company id (for the selected-row → quality wiring). */
export function insurerById(id: string): Insurer | undefined {
  return insurers.find((i) => i.id === id)
}

/** The plain "what this means" read for a quality position. */
export function qualityReadText(position: QualityPosition): string {
  if (position === 'Above Average') return 'Operating quality screens above the peer average — supportive of a valuation premium.'
  if (position === 'Weak vs peers') return 'Operating quality screens below peers — a premium is harder to justify on fundamentals alone.'
  return 'Operating quality is broadly in line with peers.'
}
