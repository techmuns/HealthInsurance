// InsightCallout — the pinned "mini insight box" that spells out the comparison
// so the reader never has to compute it: current value, the comparable previous
// value, the absolute change, the % change with its comparison tag, and a short
// plain-language reading. Honest fallback when there's no comparable prior period.
//
//   FY26 Gross Written Premium
//   ₹8,586 Cr
//   vs FY25  ₹6,505 Cr
//   +₹2,081 Cr   +32.0% YoY
//   "Growth remains strong versus last year."

import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from 'lucide-react'
import {
  focusPalette,
  formatDeltaTag,
  formatFocusChange,
  formatFocusValue,
  interpretComparison,
  type InsightFocus,
  type ResolvedComparison,
} from '@/insights/insightFocus'

export function InsightCallout({
  focus,
  resolved,
  className = '',
}: {
  focus: InsightFocus
  resolved: ResolvedComparison
  className?: string
}) {
  const pal = focusPalette(focus.tone)
  const period = resolved.currentPeriod || focus.currentPeriod || ''
  // Arrow shows the DIRECTION of the move; colour (tone) shows whether that move
  // is good or bad for this metric.
  const change = resolved.absChange ?? 0
  const Arrow = change === 0 ? ArrowRight : change > 0 ? ArrowUpRight : ArrowDownRight
  const isRatio = focus.unit === '%' || focus.unit === 'pp'
  const deltaTag = formatDeltaTag(resolved, focus.comparisonType, focus.unit)

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white/95 shadow-soft ${className}`}
      style={{ borderColor: pal.ring }}
    >
      {/* tone-coded top rule */}
      <div className="h-[3px] w-full" style={{ background: pal.accent }} />
      <div className="px-3.5 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: pal.text }}>
          {period ? `${period} · ` : ''}
          {focus.metricLabel}
          {focus.companyLabel ? ` · ${focus.companyLabel}` : ''}
        </p>

        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[22px] font-bold leading-none tracking-tight text-navy-deep tabular-nums">
            {formatFocusValue(resolved.currentValue, focus.unit)}
          </span>
        </div>

        {resolved.hasComparison ? (
          <>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-secondary">
              <span className="font-semibold uppercase tracking-[0.06em] text-ink-secondary/80">
                vs {resolved.comparisonPeriod}
              </span>
              <span className="font-semibold tabular-nums text-navy-deep">
                {formatFocusValue(resolved.previousValue, focus.unit)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {!isRatio && (
                <span
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-bold tabular-nums"
                  style={{ color: pal.text, background: pal.soft, boxShadow: `inset 0 0 0 1px ${pal.ring}` }}
                >
                  {formatFocusChange(resolved.absChange, focus.unit)}
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-bold text-white tabular-nums"
                style={{ background: pal.accent }}
              >
                <Arrow className="h-3 w-3" strokeWidth={2.6} />
                {deltaTag}
              </span>
            </div>

            <p className="mt-2 text-[11.5px] italic leading-snug text-ink-secondary">
              &ldquo;{interpretComparison(focus, resolved)}&rdquo;
            </p>
          </>
        ) : (
          <div className="mt-2 flex items-start gap-1.5 rounded-md border border-soft-border bg-ice/60 px-2.5 py-1.5 text-[11px] leading-snug text-ink-secondary">
            <Info className="mt-px h-3.5 w-3.5 shrink-0 text-ink-secondary/70" strokeWidth={2} />
            <span>Previous comparable period not available — showing the latest reported value without a comparison.</span>
          </div>
        )}
      </div>
    </div>
  )
}
