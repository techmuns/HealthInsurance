// Reusable Recharts overlay for insight-linked highlighting. Given the focus + a
// resolved comparison, `insightAnnotationLayer` returns a <Customized> layer that
// draws — in the chart's own coordinate system, so it aligns to the exact bars /
// points — a soft spotlight over the compared span, a connector from the
// comparison value to the current value, small anchor dots, and a floating "% pill".
//
// It works over ANY Recharts cartesian chart (bar or line): it only reads the
// x/y scales, so a section drops it in as the LAST child of its chart and the
// highlight lands on the right series without any pixel maths in the caller.

import type { ReactElement } from 'react'
import { Customized } from 'recharts'
import {
  focusPalette,
  formatDeltaTag,
  type FocusPalette,
  type InsightFocus,
  type ResolvedComparison,
} from '@/insights/insightFocus'

// Recharts' Customized passes the full internal chart context; it isn't typed in
// the public API, so we read the handful of fields we need defensively.
interface ChartCtx {
  xAxisMap?: Record<string, { scale: (v: unknown) => number | undefined }>
  yAxisMap?: Record<string, { scale: (v: number) => number | undefined }>
  offset?: { top: number; left: number; width: number; height: number }
}

const first = <T,>(m?: Record<string, T>): T | undefined => (m ? m[Object.keys(m)[0]] : undefined)

function FocusLayer(
  props: ChartCtx & { focus: InsightFocus; resolved: ResolvedComparison; palette: FocusPalette },
) {
  const { xAxisMap, yAxisMap, offset, focus, resolved, palette } = props
  const xAxis = first(xAxisMap)
  const yAxis = first(yAxisMap)
  if (!xAxis || !yAxis || !offset) return null

  const xScale = xAxis.scale as unknown as ((v: unknown) => number | undefined) & { bandwidth?: () => number }
  const yScale = yAxis.scale
  const bw = typeof xScale.bandwidth === 'function' ? xScale.bandwidth() : 0
  const half = bw > 0 ? bw / 2 : 14
  const centerX = (cat?: string | null): number | null => {
    if (cat == null) return null
    const b = xScale(cat)
    return typeof b === 'number' ? b + bw / 2 : null
  }
  const yOf = (v: number | null): number | null => {
    if (v == null) return null
    const y = yScale(v)
    return typeof y === 'number' ? y : null
  }

  const xCur = centerX(resolved.currentPeriod)
  const yCur = yOf(resolved.currentValue)
  if (xCur == null || yCur == null) return null

  const hasCmp = resolved.hasComparison
  const xCmp = centerX(resolved.comparisonPeriod)
  const yPrev = yOf(resolved.previousValue)

  const plotTop = offset.top
  const plotBottom = offset.top + offset.height
  const plotLeft = offset.left
  const plotRight = offset.left + offset.width

  // Spotlight band — spans the compared columns (or just the current column when
  // there is no comparable prior period). Subtle so the bars/line read through.
  const bandLeft = hasCmp && xCmp != null ? Math.min(xCmp, xCur) - half * 0.92 : xCur - half * 0.92
  const bandRight = hasCmp && xCmp != null ? Math.max(xCmp, xCur) + half * 0.92 : xCur + half * 0.92
  const sx = Math.max(plotLeft, bandLeft)
  const sw = Math.min(plotRight, bandRight) - sx

  // The % pill text — the change we resolved from the chart's OWN data, so the
  // pill and the pinned callout always agree. Only when the chart can't resolve a
  // change do we fall back to the delta the insight stated.
  const pillText = resolved.hasComparison ? formatDeltaTag(resolved, focus.comparisonType, focus.unit) : focus.deltaLabel ?? ''
  const pillW = Math.max(48, pillText.length * 6.9 + 18)
  const pillH = 21
  // Prefer above the current marker; drop below if it would clip the plot top.
  let pillCY = yCur - 26
  if (pillCY - pillH / 2 < plotTop + 2) pillCY = yCur + 24
  let pillCX = xCur
  pillCX = Math.max(plotLeft + pillW / 2 + 2, Math.min(plotRight - pillW / 2 - 2, pillCX))

  const showConnector = hasCmp && xCmp != null && yPrev != null

  return (
    <g pointerEvents="none">
      {/* Spotlight band */}
      <rect
        className="insight-spotlight"
        x={sx}
        y={plotTop}
        width={Math.max(0, sw)}
        height={offset.height}
        rx={6}
        fill={palette.soft}
      />
      {/* Vertical guide at the target period */}
      <line
        className="insight-spotlight"
        x1={xCur}
        y1={plotTop}
        x2={xCur}
        y2={plotBottom}
        stroke={palette.ring}
        strokeWidth={1}
        strokeDasharray="2 3"
        opacity={0.5}
      />
      {/* Connector from the comparison value to the current value */}
      {showConnector && (
        <>
          <line
            className="insight-connector"
            x1={xCmp!}
            y1={yPrev!}
            x2={xCur}
            y2={yCur}
            stroke={palette.accent}
            strokeWidth={1.8}
            strokeLinecap="round"
            pathLength={1}
          />
          <circle className="insight-anchor" cx={xCmp!} cy={yPrev!} r={3.4} fill="#FFFFFF" stroke={palette.accent} strokeWidth={1.6} />
        </>
      )}
      {/* Current value marker */}
      <circle className="insight-anchor" cx={xCur} cy={yCur} r={4} fill={palette.accent} stroke="#FFFFFF" strokeWidth={1.6} />
      {/* Floating % pill */}
      {pillText && (
        <g className="insight-pill">
          <rect x={pillCX - pillW / 2} y={pillCY - pillH / 2} width={pillW} height={pillH} rx={pillH / 2} fill={palette.accent} />
          <text x={pillCX} y={pillCY + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={700} fill={palette.onAccent}>
            {pillText}
          </text>
        </g>
      )}
    </g>
  )
}

/**
 * A <Customized> annotation layer for a Recharts cartesian chart. Place it as the
 * LAST child of the chart so it draws over the bars/line. Returns null when there
 * is nothing to resolve.
 */
export function insightAnnotationLayer(opts: {
  focus: InsightFocus
  resolved: ResolvedComparison
  key?: string
}): ReactElement | null {
  const { focus, resolved } = opts
  if (resolved.currentValue == null) return null
  const palette = focusPalette(focus.tone)
  return (
    <Customized
      key={opts.key ?? 'insight-annotation'}
      component={(ctx: ChartCtx) => <FocusLayer {...ctx} focus={focus} resolved={resolved} palette={palette} />}
    />
  )
}
