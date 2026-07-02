// InsightFocusBanner — the standard section-level header a destination renders
// when it was opened from an insight: the "Opened from Pulse" context chip and,
// when a comparison resolved from the section's own data, the pinned callout.
// Sections drop this in at the top and instrument their specific chart/table
// beneath it, so the behaviour reads as one system everywhere.

import { InsightContextChip } from './InsightContextChip'
import { InsightCallout } from './InsightCallout'
import type { InsightFocus, ResolvedComparison } from '@/insights/insightFocus'

export function InsightFocusBanner({
  focus,
  resolved,
  className = '',
}: {
  focus: InsightFocus
  resolved?: ResolvedComparison | null
  className?: string
}) {
  return (
    <div className={`grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start ${className}`}>
      <InsightContextChip focus={focus} />
      {resolved && resolved.currentValue != null && (
        <InsightCallout focus={focus} resolved={resolved} className="sm:w-[17.5rem]" />
      )}
    </div>
  )
}
