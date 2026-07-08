import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import generated from '@/data/insights.generated.json'
import type { Insight, InsightsFile } from '@/insights/types'
import {
  resolveSource,
  freshnessOf,
  latestPeriodOf,
  latestPeriodAcross,
  periodRank,
  type Freshness,
  type SourceLocation,
  type NavTarget,
} from '@/insights/sourceMap'
import { InsightCard, pretty, type Priority } from '@/components/InsightCard'

const FILE = generated as unknown as InsightsFile
const PANEL_LATEST = latestPeriodAcross(FILE.insights)

// Landing period: the newest period that carries a real cluster of insights
// (≥3), so the page opens on a substantive read rather than a lone monthly
// footnote. The rail still badges the absolute newest period as "Latest".
function defaultPeriodOf(rows: { period: string }[]): string {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.period, (counts.get(r.period) ?? 0) + 1)
  const ordered = [...counts.keys()].sort((a, b) => periodRank(b) - periodRank(a))
  return ordered.find((p) => (counts.get(p) ?? 0) >= 3) ?? ordered[0] ?? PANEL_LATEST
}

const NAVY = 'linear-gradient(168deg, #1C3A6E 0%, #15294C 60%, #102140 100%)'
const GOLD_ON_NAVY = '#E4C67C'

// ── Section taxonomy ─────────────────────────────────────────────────────────
// Each insight lands in one plain-English section (shown as the card's tag).
type Section = 'Market' | 'Growth' | 'Profitability' | 'Valuation' | 'Governance' | 'Ownership' | 'Distribution'

const primaryMetricOf = (ins: Insight): string =>
  (ins.evidence.find((e) => e.value != null) ?? ins.evidence[0])?.metric ?? ''

function sectionOf(ins: Insight): Section {
  const metric = primaryMetricOf(ins).toLowerCase()
  if (ins.category !== 'growth' && /retail|group|channel|agency|bancass|distribution|\bmix\b/.test(metric)) return 'Distribution'
  if (/ownership|stake|holding|promoter|pledge|sharehold/.test(metric)) return 'Ownership'
  switch (ins.category) {
    case 'growth': return 'Growth'
    case 'valuation': return 'Valuation'
    case 'capital':
    case 'earnings_quality':
    case 'quality': return 'Profitability'
    case 'management': return 'Governance'
    case 'regulatory':
    case 'market_structure': return 'Market'
  }
}

// ── Priority triage ──────────────────────────────────────────────────────────
// High = act on it (high conviction or a goldmine-grade edge). Normal = context
// only (low conviction / context tier). Watch = everything else to keep an eye on.
function priorityOf(ins: Insight): Priority {
  if (ins.conviction === 'high' || ins.tier === 'goldmine') return 'high'
  if (ins.conviction === 'low' || ins.tier === 'context') return 'normal'
  return 'watch'
}
// Auto-sort order: highest priority first, watch next, context last (no manual control).
const PRIORITY_RANK: Record<Priority, number> = { high: 0, watch: 1, normal: 2 }

interface Row {
  ins: Insight
  section: Section
  priority: Priority
  freshness: Freshness
  source: SourceLocation
  period: string // the reporting period the insight actually leans on (never invented)
}

const ROWS: Row[] = FILE.insights
  .map((ins): Row => ({
    ins,
    section: sectionOf(ins),
    priority: priorityOf(ins),
    freshness: freshnessOf(ins, PANEL_LATEST),
    source: resolveSource(ins),
    period: latestPeriodOf(ins),
  }))
  .sort((a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || (a.ins.rank - b.ins.rank))

// ── Left reporting-period rail ────────────────────────────────────────────────
// Mirrors the Pulse timeline (navy rail, gold accents) but steps through fiscal
// PERIODS instead of dates — now grouped by fiscal year, with the quarters and
// months where insights became observable nested under each year. Newest sits
// at the top, badged "Latest". Only real periods that carry insight data appear
// — quarters and months are never invented. Each node shows how many insights
// exist in that period for the current company.

/** How a period label reads on the rail: the big text + a plain-English kind. */
function railFace(p: string): { big: string; kind: string } {
  if (/^FY\d{2}$/.test(p)) return { big: 'Full year', kind: 'annual' }
  const q = p.match(/^(Q[1-4])\s?FY\d{2}$/)
  if (q) return { big: q[1], kind: 'quarter' }
  const m = p.match(/^([A-Z][a-z]{2})\s?FY\d{2}$/)
  if (m) return { big: m[1], kind: 'month' }
  return { big: p, kind: 'period' }
}
const fyOf = (p: string): string => (p.match(/FY\s?\d{2}/)?.[0] ?? p).replace(/\s/g, '')

function PeriodRail({ periods, counts, selected, onSelect }: {
  periods: string[] // newest first
  counts: Record<string, number>
  selected: string
  onSelect: (p: string) => void
}) {
  // group by fiscal year, preserving the newest-first order inside and across groups
  const groups: { fy: string; items: string[] }[] = []
  for (const p of periods) {
    const fy = fyOf(p)
    const g = groups[groups.length - 1]
    if (g && g.fy === fy) g.items.push(p)
    else groups.push({ fy, items: [p] })
  }
  return (
    <aside
      className="relative isolate overflow-hidden rounded-2xl px-3 py-3.5 shadow-card lg:sticky lg:top-2 lg:h-fit lg:w-[172px] lg:shrink-0"
      style={{ background: NAVY }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(228,198,124,0.4) 30%, rgba(228,198,124,0.4) 70%, transparent)' }} />
      <p className="mb-3 px-1 text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD_ON_NAVY }}>
        Reporting periods
      </p>

      {/* vertical rail (lg+) */}
      <div className="hidden lg:block">
        {groups.map((g, gi) => (
          <div key={g.fy} className={gi > 0 ? 'mt-2.5' : ''}>
            <p className="flex items-center gap-2 px-1 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: gi === 0 ? GOLD_ON_NAVY : 'rgba(233,241,251,0.55)' }}>{g.fy}</span>
              <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(228,198,124,0.28), transparent)' }} />
            </p>
            <ol className="relative">
              <span className="absolute bottom-2 left-[10px] top-1 w-px" style={{ background: 'linear-gradient(180deg, rgba(228,198,124,0.35), rgba(228,198,124,0.06))' }} />
              {g.items.map((p) => {
                const on = p === selected
                const isLatest = gi === 0 && p === groups[0].items[0]
                const face = railFace(p)
                return (
                  <li key={p} className="relative">
                    <button
                      type="button"
                      onClick={() => onSelect(p)}
                      className="group flex w-full items-center gap-2.5 rounded-lg py-1.5 pr-1 text-left transition-colors hover:bg-white/5"
                    >
                      <span
                        className="relative z-[1] grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full"
                        style={{ background: '#15294C', boxShadow: on ? `inset 0 0 0 1px ${GOLD_ON_NAVY}` : 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full transition-transform"
                          style={{ background: isLatest ? GOLD_ON_NAVY : 'rgba(255,255,255,0.42)', boxShadow: isLatest ? '0 0 0 3px rgba(228,198,124,0.18)' : undefined, transform: on ? 'scale(1.05)' : 'scale(0.86)' }}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-[12px] font-bold" style={{ color: isLatest ? GOLD_ON_NAVY : on ? '#EAF1FB' : 'rgba(233,241,251,0.78)' }}>
                            {face.big}
                          </span>
                          {counts[p] > 0 && (
                            <span className="rounded-full px-1 text-[8px] font-bold text-white/70" style={{ background: 'rgba(255,255,255,0.10)' }}>{counts[p]}</span>
                          )}
                        </span>
                        <span className="block text-[8.5px] font-semibold uppercase tracking-[0.12em] text-white/40">
                          {isLatest ? 'Latest reported' : face.kind}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </div>

      {/* horizontal strip (< lg) */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar lg:hidden">
        {periods.map((p, i) => {
          const on = p === selected
          const isLatest = i === 0
          const face = railFace(p)
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelect(p)}
              className="flex min-w-[62px] shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors"
              style={{ background: on ? 'rgba(255,255,255,0.08)' : 'transparent', boxShadow: on ? `inset 0 0 0 1px ${GOLD_ON_NAVY}55` : undefined }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: isLatest ? GOLD_ON_NAVY : 'rgba(255,255,255,0.42)' }} />
              <span className="text-[11px] font-bold" style={{ color: isLatest ? GOLD_ON_NAVY : 'rgba(233,241,251,0.82)' }}>{face.big === 'Full year' ? fyOf(p) : face.big}</span>
              <span className="text-[8px] font-semibold uppercase tracking-wide text-white/45">{face.big === 'Full year' ? 'Year' : fyOf(p)}</span>
            </button>
          )
        })}
      </div>

      {periods.length <= 1 && (
        <p className="mt-2 px-1 text-[10px] italic leading-snug text-white/45">No earlier periods on record yet.</p>
      )}
    </aside>
  )
}

// Data Insights — a clean quarterly/yearly insight reading page (not a dashboard).
// Left: a reporting-period rail (real periods only). The company scope comes from
// the shared Insights selector in the tab header ("All" = combined). Main: a
// full-width stack of flip cards, auto-sorted highest-priority first. Each card's
// FRONT is one sharp read (section · priority · headline · take · company); a tap
// flips it to the BACK — the full basis (derivation, formula, framework, source,
// what to watch, and a jump to the exact source).
export function DataInsights({
  company,
  onGoToSource,
  reopenInsightId,
}: {
  /** The shared Insights company scope — 'all' shows the combined set. */
  company: string
  onGoToSource: (target: NavTarget, insightId: string) => void
  reopenInsightId?: string | null
}) {
  // Returning from "Go to source → Back to Insight" opens on that insight's period.
  const reopenRow = reopenInsightId ? ROWS.find((r) => r.ins.id === reopenInsightId) : undefined
  const [period, setPeriod] = useState<string>(reopenRow?.period ?? defaultPeriodOf(ROWS))

  // Flip the reopened card exactly once — never re-flip when the reader later
  // changes company/period.
  const reopenConsumed = useRef(false)
  useEffect(() => { reopenConsumed.current = true }, [])

  const companyRows = useMemo(
    () => (company === 'all' ? ROWS : ROWS.filter((r) => r.ins.affectedInsurers.includes(company))),
    [company],
  )

  // Only real periods that carry data for this company, newest first.
  const availablePeriods = useMemo(
    () => [...new Set(companyRows.map((r) => r.period))].sort((a, b) => periodRank(b) - periodRank(a)),
    [companyRows],
  )
  const periodCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of companyRows) c[r.period] = (c[r.period] ?? 0) + 1
    return c
  }, [companyRows])

  // Keep the selection if it still holds data for this company, else snap to newest.
  const effPeriod = availablePeriods.includes(period) ? period : (availablePeriods[0] ?? '')

  // Cards for the current company + period, highest priority first.
  const shown = companyRows
    .filter((r) => r.period === effPeriod)
    .sort((a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || (a.ins.rank - b.ins.rank))

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
      {/* Left: reporting-period timeline */}
      <PeriodRail periods={availablePeriods} counts={periodCounts} selected={effPeriod} onSelect={setPeriod} />

      {/* Main: the full-width flip-card stack (company scope is the shared header
          selector; the period rail is on the left). */}
      <div className="min-w-0 flex-1 space-y-4">
        {shown.length > 0 ? (
          <div className="flex flex-col gap-4">
            {shown.map((r) => (
              <InsightCard
                key={r.ins.id}
                ins={r.ins}
                section={r.section}
                priority={r.priority}
                source={r.source}
                freshness={r.freshness}
                onGoToSource={() => onGoToSource(r.source.target, r.ins.id)}
                initialFlipped={!reopenConsumed.current && r.ins.id === reopenInsightId}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-soft-border bg-ice/40 px-4 py-12 text-center">
            <Sparkles className="mx-auto h-5 w-5 text-champagne-deep" strokeWidth={1.8} />
            <p className="mt-2 font-editorial text-[15px] font-semibold text-navy-deep">No insights for {company === 'all' ? 'this period' : `${pretty(company)} in ${effPeriod || 'this period'}`} yet.</p>
            <p className="mt-1 text-[12px] text-ink-secondary">Every card is real, source-backed data — pick another company or period.</p>
          </div>
        )}
      </div>
    </div>
  )
}
