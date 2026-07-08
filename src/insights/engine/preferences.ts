// ---------------------------------------------------------------------------
//  Insight Engine — RELEVANCE PREFERENCES (the training layer).
//
//  Sector-specialist thumbs-up / thumbs-down feedback, folded into a per-pattern
//  weight the scorer multiplies into each finding's score. The key is
//  period-independent — '<detector>::<companyIds>' — so a rating on this month's
//  card trains every future card of the same kind, which is exactly what makes
//  the feed surface better "as new data is added".
//
//  Two application points share this one weight shape:
//    • generation-time (here → detect.ts scoring): the committed weights bias
//      which patterns survive the caps and how they rank in the built feed.
//    • runtime (src/lib/insightFeedback.ts): the reader's own localStorage votes
//      re-rank their feed instantly, before any regeneration.
//
//  Seeded empty → every weight 1.0 → the feed is unchanged until real feedback
//  is folded in (scripts/insights/learn-from-feedback.ts).
// ---------------------------------------------------------------------------

import prefs from '@/data/insight-preferences.json'

interface PrefsFile {
  _meta?: { clamp?: number[] }
  weights?: Record<string, number>
}

const FILE = prefs as PrefsFile
const WEIGHTS = FILE.weights ?? {}
const clamp = FILE._meta?.clamp
const LO = clamp?.[0] ?? 0.2
const HI = clamp?.[1] ?? 2.5

/** Stable, period-independent feedback key for a detector + its subject company
 *  set. Aggregates ('panel', 'SAHI', 'INDUSTRY') fall back to 'panel'. */
export function preferenceKey(detector: string, insurers: string[]): string {
  const co = [...insurers].filter(Boolean).sort().join(',') || 'panel'
  return `${detector}::${co}`
}

/** The relevance multiplier for a finding: the most specific weight wins
 *  (company-specific → family-wide '*' → neutral 1.0), clamped to the file's
 *  range so one strong signal can't fully bury or pin a pattern. */
export function preferenceWeight(detector: string, insurers: string[]): number {
  const specific = WEIGHTS[preferenceKey(detector, insurers)]
  const family = WEIGHTS[`${detector}::*`]
  const w = specific ?? family ?? 1
  return Math.max(LO, Math.min(HI, w))
}
