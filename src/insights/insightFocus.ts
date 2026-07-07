// ---------------------------------------------------------------------------
//  InsightFocus — the structured "what the insight was talking about" context
//  that travels from Pulse / an insight card INTO a dashboard section, so the
//  destination chart can visually explain the exact comparison the insight
//  referenced (spotlight the period, connect it to its comparison, and pin a
//  plain-language callout — "+32% YoY, vs FY25, growth remains strong").
//
//  Honesty (see CLAUDE.md): this model carries INTENT only — which metric, which
//  company, the current vs comparison period, the comparison type and the delta
//  the insight *stated*. The destination chart resolves the ACTUAL current /
//  previous values from its own source-backed data (never a number duplicated
//  here), so the pinned callout always matches the chart. If the comparable
//  period is missing, the callout says so honestly rather than inventing one.
// ---------------------------------------------------------------------------

/** How the insight frames its comparison. Drives the connector + the callout tag. */
export type ComparisonType = 'YoY' | 'QoQ' | 'sequential' | 'vs-peer' | 'margin-delta' | 'trend'

/** Colour-psychology direction for the highlight (green / amber-red / blue). */
export type FocusTone = 'positive' | 'negative' | 'neutral'

/** Formatting hint for the resolved values shown in the callout / tooltip. */
export type FocusUnit = 'cr' | '%' | 'x' | 'pp' | ''

/** Two ways an insight points into the dashboard:
 *  • 'comparison' — a metric with a current vs comparison period (spotlight +
 *    connector + pinned callout on the chart).
 *  • 'locator' — a count / event / development with no period maths (scroll to
 *    the exact section/element, blip it, and pop a small "here it is" note). */
export type FocusKind = 'comparison' | 'locator'

export interface InsightFocus {
  /** Stable id of the insight / idea / delta that opened this (dedupe + return). */
  id: string
  /** Comparison (metric spotlight) vs locator (point-at-this blip). Default comparison. */
  kind?: FocusKind
  /** For locator focuses — the semantic of what to point at ('events', 'regulatory', …). */
  locatorKind?: string
  /** Canonical metric key the destination chart matches on ('gwp', 'combined_ratio', …). */
  metricKey: string
  /** Human metric label ('Gross Written Premium'). */
  metricLabel: string
  /** Company id to focus, or undefined for a sector / panel read. */
  company?: string
  companyLabel?: string
  /** The period being read (e.g. 'FY26'). */
  currentPeriod?: string
  /** The comparison baseline period (e.g. 'FY25'). */
  comparisonPeriod?: string
  comparisonType: ComparisonType
  /** The delta the insight stated ('+32%', '+2.1pp') — display-only provenance. */
  deltaLabel?: string
  /** Colour-psychology direction. */
  tone: FocusTone
  /** The one-line insight label shown in the "Opened from…" chip. */
  insightLabel: string
  /** Value unit hint for the callout formatter. */
  unit: FocusUnit
  /** Whether "up is good" for this metric (GWP up = good; combined ratio up = bad). */
  higherIsBetter?: boolean
  /** SAHI sub-tab this targets (mirrors NavTarget for section matching). */
  sahiTab?: string
  /** Where it came from — drives the chip label + the return-button copy. */
  origin: 'pulse' | 'insight'

  // ── locator item target (regulatory / news) ──────────────────────────────
  //  When a locator focus points at a SPECIFIC feed item (not just the section),
  //  these let the destination open the item's collapsed month, scroll to it and
  //  blip the exact card — instead of landing on collapsed months.
  /** Stable id of the exact item to open + highlight (SectoralNewsItem.id / sn). */
  targetItemId?: string
  /** The item's month key (yyyy-mm) so its accordion can be opened before scroll. */
  targetMonth?: string
  /** Original date of the source/filing/event (provenance shown at the item). */
  sourceDate?: string
  /** When the dashboard first surfaced/detected it (provenance shown at the item). */
  surfacedAt?: string
  /** Plain-English reason this appears today (e.g. "older source, newly surfaced"). */
  reasonShownToday?: string
}

// ── canonical metric metadata ────────────────────────────────────────────────
//
//  One place that maps a metric key to its label, unit, direction, the SAHI tab
//  it lives on, and its default comparison type. Both the Pulse builders and the
//  destination charts read from this so the focus, the chart and the callout all
//  agree on what a metric means and where it lives.

export interface MetricMeta {
  key: string
  label: string
  unit: FocusUnit
  higherIsBetter: boolean
  sahiTab: string
  comparisonType: ComparisonType
}

export const METRIC_META: Record<string, MetricMeta> = {
  gwp: { key: 'gwp', label: 'Gross Written Premium', unit: 'cr', higherIsBetter: true, sahiTab: 'distribution', comparisonType: 'YoY' },
  nwp: { key: 'nwp', label: 'Net Written Premium', unit: 'cr', higherIsBetter: true, sahiTab: 'distribution', comparisonType: 'YoY' },
  nep: { key: 'nep', label: 'Net Earned Premium', unit: 'cr', higherIsBetter: true, sahiTab: 'distribution', comparisonType: 'YoY' },
  market_share: { key: 'market_share', label: 'Health market share', unit: '%', higherIsBetter: true, sahiTab: 'companies', comparisonType: 'YoY' },
  combined_ratio: { key: 'combined_ratio', label: 'Combined ratio', unit: '%', higherIsBetter: false, sahiTab: 'profitability', comparisonType: 'YoY' },
  claims_ratio: { key: 'claims_ratio', label: 'Claims ratio', unit: '%', higherIsBetter: false, sahiTab: 'profitability', comparisonType: 'YoY' },
  expense_ratio: { key: 'expense_ratio', label: 'Expense ratio', unit: '%', higherIsBetter: false, sahiTab: 'profitability', comparisonType: 'YoY' },
  pat: { key: 'pat', label: 'Profit after tax', unit: 'cr', higherIsBetter: true, sahiTab: 'profitability', comparisonType: 'YoY' },
  solvency_ratio: { key: 'solvency_ratio', label: 'Solvency ratio', unit: 'x', higherIsBetter: true, sahiTab: 'profitability', comparisonType: 'YoY' },
  promoter_holding: { key: 'promoter_holding', label: 'Promoter holding', unit: '%', higherIsBetter: true, sahiTab: 'governance', comparisonType: 'sequential' },
  valuation: { key: 'valuation', label: 'Valuation', unit: 'x', higherIsBetter: false, sahiTab: 'valuation', comparisonType: 'vs-peer' },
}

// ── comparison resolution (over a chart's own data) ──────────────────────────

export interface ResolvedComparison {
  currentValue: number | null
  previousValue: number | null
  absChange: number | null
  pctChange: number | null
  currentPeriod: string
  comparisonPeriod: string | null
  /** True only when BOTH a current and a comparable previous value are present. */
  hasComparison: boolean
}

const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * Resolve the current + comparison values for a focus from a chart's own rows.
 * `rows` is the exact data the chart renders; `valueKey` is the series key. When
 * the focus names a `currentPeriod` / `comparisonPeriod` we honour it; otherwise
 * we fall back to the latest valued row and its nearest prior valued row. Never
 * fabricates: a missing comparable leaves `hasComparison=false`.
 */
export function resolveComparison(
  rows: ReadonlyArray<Record<string, unknown>>,
  opts: { valueKey: string; labelKey?: string; currentPeriod?: string; comparisonPeriod?: string },
): ResolvedComparison {
  const labelKey = opts.labelKey ?? 'label'
  const labelAt = (i: number) => String(rows[i]?.[labelKey] ?? '')
  const valueAt = (i: number) => asNum(rows[i]?.[opts.valueKey])
  const idxOf = (period?: string) => (period ? rows.findIndex((r) => String(r[labelKey]) === period) : -1)

  // Current = the named period, else the last row that actually carries a value.
  let ci = idxOf(opts.currentPeriod)
  if (ci < 0 || valueAt(ci) == null) {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (valueAt(i) != null) { ci = i; break }
    }
  }
  const currentValue = ci >= 0 ? valueAt(ci) : null
  const currentPeriod = ci >= 0 ? labelAt(ci) : opts.currentPeriod ?? ''

  // Comparison = the named period, else the nearest prior row that carries a value.
  let pi = idxOf(opts.comparisonPeriod)
  if ((pi < 0 || valueAt(pi) == null) && ci > 0) {
    for (let i = ci - 1; i >= 0; i--) {
      if (valueAt(i) != null) { pi = i; break }
    }
  }
  const previousValue = pi >= 0 ? valueAt(pi) : null
  const comparisonPeriod = pi >= 0 ? labelAt(pi) : opts.comparisonPeriod ?? null

  const absChange = currentValue != null && previousValue != null ? currentValue - previousValue : null
  const pctChange =
    absChange != null && previousValue != null && previousValue !== 0 ? (absChange / Math.abs(previousValue)) * 100 : null

  return {
    currentValue,
    previousValue,
    absChange,
    pctChange,
    currentPeriod,
    comparisonPeriod,
    hasComparison: currentValue != null && previousValue != null,
  }
}

// ── formatting ───────────────────────────────────────────────────────────────

const round1 = (v: number) => Math.round(v * 10) / 10
const round2 = (v: number) => Math.round(v * 100) / 100

/** Format a resolved value for the callout / tooltip. */
export function formatFocusValue(v: number | null, unit: FocusUnit): string {
  if (v == null) return 'n/a'
  switch (unit) {
    case 'cr':
      return `₹${Math.round(v).toLocaleString('en-IN')} Cr`
    case '%':
      return `${round1(v)}%`
    case 'pp':
      return `${round1(v)} pp`
    case 'x':
      return `${round2(v)}x`
    default:
      return round1(v).toLocaleString('en-IN')
  }
}

/** Format a signed absolute change ('+₹2,081 Cr', '-1.4 pp'). */
export function formatFocusChange(v: number | null, unit: FocusUnit): string {
  if (v == null) return '—'
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  const mag = Math.abs(v)
  switch (unit) {
    case 'cr':
      return `${sign}₹${Math.round(mag).toLocaleString('en-IN')} Cr`
    case '%':
      return `${sign}${round1(mag)}%`
    case 'pp':
      return `${sign}${round1(mag)} pp`
    case 'x':
      return `${sign}${round2(mag)}x`
    default:
      return `${sign}${round1(mag).toLocaleString('en-IN')}`
  }
}

/** The percentage change, formatted with its comparison tag ('+32.0% YoY'). */
export function formatPctWithTag(r: ResolvedComparison, type: ComparisonType): string {
  if (r.pctChange == null) return '—'
  const sign = r.pctChange > 0 ? '+' : r.pctChange < 0 ? '−' : ''
  return `${sign}${round1(Math.abs(r.pctChange))}% ${COMPARISON_TAG[type]}`
}

/** The headline delta tag, unit-aware: ratio metrics (%/pp) move in percentage
 *  POINTS (a combined ratio 98.8→101.2 is +2.4 pp, not +2.4%); level metrics
 *  (₹ Cr / x) move in relative %. */
export function formatDeltaTag(r: ResolvedComparison, type: ComparisonType, unit: FocusUnit): string {
  const isRatio = unit === '%' || unit === 'pp'
  if (isRatio) {
    if (r.absChange == null) return '—'
    const s = r.absChange > 0 ? '+' : r.absChange < 0 ? '−' : ''
    return `${s}${round1(Math.abs(r.absChange))} pp ${COMPARISON_TAG[type]}`
  }
  if (r.pctChange == null) return '—'
  const s = r.pctChange > 0 ? '+' : r.pctChange < 0 ? '−' : ''
  return `${s}${round1(Math.abs(r.pctChange))}% ${COMPARISON_TAG[type]}`
}

export const COMPARISON_TAG: Record<ComparisonType, string> = {
  YoY: 'YoY',
  QoQ: 'QoQ',
  sequential: 'vs prior',
  'vs-peer': 'vs peer',
  'margin-delta': 'Δ',
  trend: 'trend',
}

const COMPARISON_NOUN: Record<ComparisonType, string> = {
  YoY: 'last year',
  QoQ: 'the prior quarter',
  sequential: 'the prior period',
  'vs-peer': 'the peer median',
  'margin-delta': 'the prior period',
  trend: 'the prior period',
}

/** A short noun for the comparison, preferring the real period when known. */
export function comparisonNoun(type: ComparisonType, period: string | null): string {
  if (type === 'YoY' && period) return `last year (${period})`
  if ((type === 'QoQ' || type === 'sequential') && period) return `${period}`
  return COMPARISON_NOUN[type]
}

// ── tone + palette ───────────────────────────────────────────────────────────

export interface FocusPalette {
  /** Primary accent — the connector line, arrow head, pill fill. */
  accent: string
  /** Translucent spotlight fill drawn behind the focused period. */
  soft: string
  /** Ring / border colour for the callout + spotlight edge. */
  ring: string
  /** Readable text colour on a light tinted surface. */
  text: string
  /** Text colour on the accent fill. */
  onAccent: string
}

/** Palette by tone — positive = emerald, negative = coral/amber, neutral = navy. */
export function focusPalette(tone: FocusTone): FocusPalette {
  switch (tone) {
    case 'positive':
      return { accent: '#2F855A', soft: 'rgba(47,133,90,0.12)', ring: 'rgba(47,133,90,0.38)', text: '#276749', onAccent: '#FFFFFF' }
    case 'negative':
      return { accent: '#C0584F', soft: 'rgba(192,88,79,0.12)', ring: 'rgba(192,88,79,0.34)', text: '#9B3E37', onAccent: '#FFFFFF' }
    default:
      return { accent: '#27457E', soft: 'rgba(39,69,126,0.10)', ring: 'rgba(39,69,126,0.32)', text: '#27457E', onAccent: '#FFFFFF' }
  }
}

/** Tone from a signed change + whether higher is better for the metric. */
export function toneFromChange(change: number | null | undefined, higherIsBetter = true): FocusTone {
  if (change == null || change === 0) return 'neutral'
  const up = change > 0
  return up === higherIsBetter ? 'positive' : 'negative'
}

/** Recolour a focus from the change the chart actually resolved, so the highlight
 *  is green/amber by what really happened — not by whatever the insight guessed.
 *  Leaves the focus untouched when there's no comparable prior period. */
export function focusWithResolvedTone(focus: InsightFocus, resolved: ResolvedComparison): InsightFocus {
  if (!resolved.hasComparison) return focus
  return { ...focus, tone: toneFromChange(resolved.absChange, focus.higherIsBetter ?? true) }
}

// ── plain-language interpretation ────────────────────────────────────────────

/**
 * A short, honest, plain-language reading of the comparison — the "so what" the
 * user should not have to compute. Falls back to an explicit "not available"
 * note when there is no comparable prior period (never a fake comparison).
 */
export function interpretComparison(f: InsightFocus, r: ResolvedComparison): string {
  if (!r.hasComparison) return 'Previous comparable period not available.'
  const up = (r.absChange ?? 0) >= 0
  const higherIsBetter = f.higherIsBetter ?? true
  const good = up === higherIsBetter
  const mag = r.pctChange == null ? 0 : Math.abs(r.pctChange)
  const cmp = comparisonNoun(f.comparisonType, r.comparisonPeriod)
  if (r.absChange === 0) return `Broadly flat versus ${cmp}.`
  if (good) {
    if (mag >= 20) return `Momentum is strong — well ahead of ${cmp}.`
    if (mag >= 8) return `A solid step up versus ${cmp}.`
    return `Holding up versus ${cmp}.`
  }
  if (mag >= 20) return `A sharp move against ${cmp} — worth watching.`
  if (mag >= 8) return `Softer than ${cmp} — worth watching.`
  return `Broadly steady versus ${cmp}.`
}

// ── builder ──────────────────────────────────────────────────────────────────

/**
 * Build an InsightFocus from a metric key + the raw fields a Pulse item carries.
 * Pulls label / unit / direction / tab / default comparison from METRIC_META so
 * callers only supply what the insight actually knows (period, delta, label).
 */
export function buildFocus(args: {
  id: string
  metricKey: string
  company?: string
  companyLabel?: string
  currentPeriod?: string
  comparisonPeriod?: string
  comparisonType?: ComparisonType
  deltaLabel?: string
  deltaValue?: number | null
  insightLabel: string
  origin?: 'pulse' | 'insight'
}): InsightFocus | null {
  const meta = METRIC_META[args.metricKey]
  if (!meta) return null
  const tone = toneFromChange(args.deltaValue ?? null, meta.higherIsBetter)
  return {
    id: args.id,
    metricKey: meta.key,
    metricLabel: meta.label,
    company: args.company,
    companyLabel: args.companyLabel,
    currentPeriod: args.currentPeriod,
    comparisonPeriod: args.comparisonPeriod,
    comparisonType: args.comparisonType ?? meta.comparisonType,
    deltaLabel: args.deltaLabel,
    tone,
    insightLabel: args.insightLabel,
    unit: meta.unit,
    higherIsBetter: meta.higherIsBetter,
    sahiTab: meta.sahiTab,
    origin: args.origin ?? 'pulse',
  }
}

// ── locator focuses (point-at-this, no period maths) ─────────────────────────

export interface LocatorMeta {
  sahiTab: string
  label: string
}

/** Where each non-metric "since yesterday" change lives, and its plain label. */
export const LOCATOR_META: Record<string, LocatorMeta> = {
  regulatory: { sahiTab: 'sector-news', label: 'Regulatory updates' },
  company: { sahiTab: 'companies', label: 'Company update' },
  management: { sahiTab: 'governance', label: 'Management change' },
  events: { sahiTab: 'governance', label: 'Events ahead' },
  market_move: { sahiTab: 'valuation', label: 'Market moves' },
}

/** Build a locator focus — a "point at the exact place this lives" context that
 *  scrolls to and blips the destination, with the insight label as its popup. */
export function buildLocator(args: {
  id: string
  locatorKind: string
  company?: string
  companyLabel?: string
  insightLabel: string
  tone?: FocusTone
  sahiTab?: string
  /** Deep-link the locator to a SPECIFIC feed item (open its month, scroll, blip). */
  targetItemId?: string
  targetMonth?: string
  sourceDate?: string
  surfacedAt?: string
  reasonShownToday?: string
}): InsightFocus {
  const meta = LOCATOR_META[args.locatorKind]
  return {
    id: args.id,
    kind: 'locator',
    locatorKind: args.locatorKind,
    metricKey: args.locatorKind,
    metricLabel: meta?.label ?? args.insightLabel,
    company: args.company,
    companyLabel: args.companyLabel,
    comparisonType: 'trend',
    tone: args.tone ?? 'neutral',
    insightLabel: args.insightLabel,
    unit: '',
    sahiTab: args.sahiTab ?? meta?.sahiTab,
    origin: 'pulse',
    targetItemId: args.targetItemId,
    targetMonth: args.targetMonth,
    sourceDate: args.sourceDate,
    surfacedAt: args.surfacedAt,
    reasonShownToday: args.reasonShownToday,
  }
}

/** The prior fiscal-year label for a 'FYnn' period ('FY26' → 'FY25'). */
export function priorFyLabel(period?: string): string | undefined {
  const m = period?.match(/^FY\s?(\d{2})$/i)
  if (!m) return undefined
  const n = Number(m[1])
  return n > 0 ? `FY${String(n - 1).padStart(2, '0')}` : undefined
}
