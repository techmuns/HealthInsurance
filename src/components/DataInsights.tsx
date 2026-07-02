import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react'
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

// ── Filter chip ──────────────────────────────────────────────────────────────
const ACTIVE_CHIP: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1E4079 0%, #14294C 100%)',
  boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.45), 0 3px 9px rgba(20,48,88,0.20)',
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-all duration-normal ease-premium',
        on ? 'text-white' : 'border border-soft-border bg-white text-navy-deep hover:bg-ice',
      ].join(' ')}
      style={on ? ACTIVE_CHIP : undefined}
    >
      {children}
    </button>
  )
}

function FilterRow<T extends string>({ label, options, value, onChange }: {
  label: string
  options: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  if (options.length <= 1) return null
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
      <span className="w-[64px] shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-ink-secondary">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o.id} on={o.id === value} onClick={() => onChange(o.id)}>{o.label}</Chip>
        ))}
      </div>
    </div>
  )
}

// Data Insights — a clean, source-backed flip-card view. The tab holds only two
// things: a filter bar and a grid of insight cards. Each card's FRONT is one
// sharp read (headline · plain-English take · company · section · period); a tap
// flips it to the BACK — the full basis (derivation, formula, source data,
// framework, interpretation, what to watch, and a jump to the exact source).
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
      {/* ── Filter bar — always visible; controls the cards shown ─────────────── */}
      <div className="rounded-2xl border border-soft-border bg-surface-tint/70 p-3.5 shadow-soft backdrop-blur-sm">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-champagne-deep">
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.2} /> Filters
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-medium text-ink-secondary">
              {shown.length} insight{shown.length === 1 ? '' : 's'}
            </span>
            {anyFilter && (
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-full border border-soft-border bg-white px-2 py-0.5 text-[10.5px] font-semibold text-ink-secondary transition-colors hover:bg-ice hover:text-navy-deep">
                <RotateCcw className="h-3 w-3" strokeWidth={2.2} /> Reset
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <FilterRow label="Company" options={companyOptions} value={company} onChange={setCompany} />
          <FilterRow label="Section" options={sectionOptions} value={section} onChange={setSection} />
          <FilterRow label="Period" options={periodOptions} value={period} onChange={setPeriod} />
          <FilterRow label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />
        </div>
      </div>

      {/* ── The insight grid — clean flip cards, nothing else ─────────────────── */}
      {shown.length > 0 ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
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
