import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, RotateCcw, Sparkles } from 'lucide-react'
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

// ── Section taxonomy ─────────────────────────────────────────────────────────
// Each insight lands in one plain-English section. Category is the primary
// signal; a couple of metric-aware overrides route mix/channel reads to
// Distribution and holding reads to Ownership so those sections light up when —
// and only when — real data supports them.
type Section = 'Market' | 'Growth' | 'Profitability' | 'Valuation' | 'Governance' | 'Ownership' | 'Distribution'
const SECTION_ORDER: Section[] = ['Market', 'Growth', 'Profitability', 'Valuation', 'Governance', 'Ownership', 'Distribution']

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
// only (low conviction / context tier). Watch = everything to keep an eye on.
function priorityOf(ins: Insight): Priority {
  if (ins.conviction === 'high' || ins.tier === 'goldmine') return 'high'
  if (ins.conviction === 'low' || ins.tier === 'context') return 'normal'
  return 'watch'
}
const PRIORITY_ORDER: Priority[] = ['high', 'watch', 'normal']
const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', watch: 'Watch', normal: 'Normal' }

// Company ordering — Niva Bupa & Star Health lead, then the rest of the panel.
const COMPANY_ORDER = ['niva-bupa', 'star-health', 'care-health', 'aditya-birla', 'manipalcigna']

type PeriodKey = 'all' | 'latest' | 'annual' | 'quarterly'
const PERIOD_OPTIONS: { id: PeriodKey; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'latest', label: 'Latest' },
  { id: 'annual', label: 'Annual' },
  { id: 'quarterly', label: 'Quarterly' },
]

interface Row {
  ins: Insight
  section: Section
  priority: Priority
  freshness: Freshness
  source: SourceLocation
  isQuarter: boolean
  isLatest: boolean
}

const ROWS: Row[] = FILE.insights
  .map((ins): Row => {
    const period = latestPeriodOf(ins)
    return {
      ins,
      section: sectionOf(ins),
      priority: priorityOf(ins),
      freshness: freshnessOf(ins, PANEL_LATEST),
      source: resolveSource(ins),
      isQuarter: /Q\s?[1-4]/i.test(period),
      isLatest: periodRank(period) >= periodRank(PANEL_LATEST),
    }
  })
  .sort((a, b) => a.ins.rank - b.ins.rank)

const matchesPeriod = (r: Row, p: PeriodKey): boolean =>
  p === 'all' ? true : p === 'latest' ? r.isLatest : p === 'quarterly' ? r.isQuarter : !r.isQuarter

// ── Slim filter control ──────────────────────────────────────────────────────
// A bordered pill wrapping a native <select>, so the whole filter set fits on one
// compact horizontal line — no stacked chip rows, no panel, no vertical bulk. A
// filter that only offers "All" is hidden entirely (never a dead control).
function FilterSelect<T extends string>({ label, options, value, onChange }: {
  label: string
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  if (options.length <= 1) return null
  return (
    <label className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-soft-border bg-white px-2.5 py-1.5 shadow-soft transition-colors hover:border-muted-blue">
      <span className="text-[8.5px] font-bold uppercase tracking-[0.09em] text-ink-secondary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="appearance-none bg-transparent pr-1 text-[12px] font-semibold text-navy-deep outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="h-3 w-3 shrink-0 text-ink-secondary transition-colors group-hover:text-muted-blue" />
    </label>
  )
}

// Data Insights — a clean, source-backed flip-card view. The tab holds only two
// things: one compact horizontal filter row and a full-width stack of insight
// cards. Each card's FRONT is one sharp read (headline · plain-English take ·
// company · section · period); a tap flips it to the BACK — the full basis
// (derivation, formula, source data, framework, interpretation, what to watch,
// and a jump to the exact source).
export function DataInsights({
  onGoToSource,
  reopenInsightId,
}: {
  onGoToSource: (target: NavTarget, insightId: string) => void
  reopenInsightId?: string | null
}) {
  const [company, setCompany] = useState<string>('all')
  const [section, setSection] = useState<Section | 'all'>('all')
  const [period, setPeriod] = useState<PeriodKey>('all')
  const [priority, setPriority] = useState<Priority | 'all'>('all')

  // Reopen (returning from "Go to source → Back to Insight") should flip its card
  // exactly once — never re-flip when the reader later changes a filter.
  const reopenConsumed = useRef(false)
  useEffect(() => { reopenConsumed.current = true }, [])

  // Filter options — derived from the real data so empty sections/companies/
  // periods never show as dead chips (honest availability, never a fake NA).
  const { companyOptions, sectionOptions, periodOptions, priorityOptions } = useMemo(() => {
    const companyIds = [...new Set(ROWS.flatMap((r) => r.ins.affectedInsurers).filter((id) => id !== 'panel'))]
      .sort((a, b) => {
        const ia = COMPANY_ORDER.indexOf(a), ib = COMPANY_ORDER.indexOf(b)
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
      })
    return {
      companyOptions: [{ id: 'all', label: 'All' }, ...companyIds.map((id) => ({ id, label: pretty(id) }))],
      sectionOptions: [{ id: 'all' as const, label: 'All' }, ...SECTION_ORDER.filter((s) => ROWS.some((r) => r.section === s)).map((s) => ({ id: s, label: s }))],
      periodOptions: PERIOD_OPTIONS.filter((p) => p.id === 'all' || ROWS.some((r) => matchesPeriod(r, p.id))),
      priorityOptions: [{ id: 'all' as const, label: 'All' }, ...PRIORITY_ORDER.filter((p) => ROWS.some((r) => r.priority === p)).map((p) => ({ id: p, label: PRIORITY_LABEL[p] }))],
    }
  }, [])

  const shown = ROWS.filter((r) =>
    (company === 'all' || r.ins.affectedInsurers.includes(company)) &&
    (section === 'all' || r.section === section) &&
    matchesPeriod(r, period) &&
    (priority === 'all' || r.priority === priority),
  )

  const anyFilter = company !== 'all' || section !== 'all' || period !== 'all' || priority !== 'all'
  const reset = () => { setCompany('all'); setSection('all'); setPeriod('all'); setPriority('all') }

  return (
    <div className="space-y-4">
      {/* ── Compact filter row — Company · Section · Period · Priority · Reset.
           Slim dropdowns on one horizontal line; no panel, no vertical bulk. ──── */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Company" options={companyOptions} value={company} onChange={setCompany} />
        <FilterSelect label="Section" options={sectionOptions} value={section} onChange={setSection} />
        <FilterSelect label="Period" options={periodOptions} value={period} onChange={setPeriod} />
        <FilterSelect label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />
        <button
          type="button"
          onClick={reset}
          disabled={!anyFilter}
          title="Clear all filters"
          className="inline-flex items-center gap-1 rounded-lg border border-soft-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary shadow-soft transition-colors hover:border-muted-blue hover:text-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.2} /> Reset
        </button>
        <span className="ml-auto text-[10.5px] font-medium tabular-nums text-ink-secondary">
          {shown.length} insight{shown.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* ── Full-width stack of flip cards — one wide card per insight ─────────── */}
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
          <p className="mt-2 font-editorial text-[15px] font-semibold text-navy-deep">No insights match these filters.</p>
          <p className="mt-1 text-[12px] text-ink-secondary">Try a broader company, section or period — every card is real, source-backed data, so empty just means none qualify yet.</p>
          <button type="button" onClick={reset} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-soft-border bg-white px-3 py-1.5 text-[11.5px] font-semibold text-navy-deep shadow-soft transition-colors hover:bg-ice">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.2} /> Show all insights
          </button>
        </div>
      )}
    </div>
  )
}
