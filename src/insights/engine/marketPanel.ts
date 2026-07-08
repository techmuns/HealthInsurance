// ---------------------------------------------------------------------------
//  Insight Engine — the WIDE market panel.
//
//  One typed, deduplicated, cadence-complete view of every committed dataset the
//  dashboard holds: discrete QUARTERS (derived honestly from printed GIC
//  cumulatives), single MONTHS, fiscal YEARS, plus financials, dual-basis
//  profitability, ownership flows, analyst notes, daily prices, valuation and
//  channel mix. The detector battery (detect.ts) reads ONLY this panel, so every
//  finding traces to a committed snapshot and the same data always produces the
//  same findings.
//
//  Honesty invariants (enforced here, not left to callers):
//   • missing ≠ zero — absent components stay null; a 0-total edition artifact
//     never beats a printed value from the sibling edition.
//   • a discrete quarter is derived ONLY when both printed cumulative legs exist
//     on the same edition basis; each segment column derives independently.
//   • negative derivations (restatement artifacts) become null, never a fake 0.
//   • IGAAP and IFRS never cross-fill — they surface as separate series.
// ---------------------------------------------------------------------------

import gicQuarterly from '@/data/snapshots/gic-health-quarterly.json'
import gicMonthly from '@/data/snapshots/gic-health-monthly.json'
import gicPortfolio from '@/data/snapshots/gic-health-portfolio.json'
import annualSnapshot from '@/data/snapshots/insurer-annual-snapshot.json'
import quarterlyFin from '@/data/snapshots/insurer-quarterly-financials.json'
import ownershipTrends from '@/data/snapshots/ownership-trends.json'
import analystCoverage from '@/data/snapshots/analyst-coverage-snapshot.json'
import priceHistory from '@/data/snapshots/price-history-snapshot.json'
import valuationSnapshot from '@/data/snapshots/valuation-snapshot.json'
import ifrsMultiples from '@/data/snapshots/ifrs-valuation-multiples.json'
import channelMix from '@/data/snapshots/distribution-channel-mix.json'
import industryPremium from '@/data/snapshots/industry-segment-premium.json'
import companyMaster from '@/data/snapshots/company-master.json'

// ── shared value helpers ─────────────────────────────────────────────────────

export const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

// ── period labels ────────────────────────────────────────────────────────────
//
//  Canonical labels the engine emits (the UI ranks them via periodRank):
//   fiscal year  →  'FY26'
//   quarter      →  'Q2 FY26'
//   month        →  'Nov FY26'   (fiscal-year framing, Apr = month 1)

export const FISCAL_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'] as const

export const fyLabel = (fy: number) => `FY${fy}`
export const quarterLabel = (fy: number, q: number) => `Q${q} FY${fy}`
export const monthLabel = (fy: number, m: number) => `${FISCAL_MONTHS[m - 1]} FY${fy}`

/** Chronological key: FY26 full year > Q4 FY26 > Mar FY26 > … > Q1 FY26 > Apr FY26. */
export function periodKey(p: { fy: number; q?: number; m?: number }): number {
  if (p.m != null) return p.fy - 0.5 + p.m / 31
  if (p.q != null) return p.fy - 0.5 + p.q / 10
  return p.fy
}

// ── segment premium row (GIC health business) ───────────────────────────────

export interface SegRow {
  retail: number | null
  group: number | null
  govt: number | null
  total: number | null
}

export interface QuarterPoint extends SegRow {
  period: string // 'Q2 FY26'
  fy: number
  q: number // 1..4
  /** true when the engine derived it from two printed cumulatives */
  derived: boolean
  basisNote: string
}

export interface CumulativePoint extends SegRow {
  period: string // 'Q1FY26' | 'H1FY26' | '9MFY26' (as printed)
  fy: number
  monthsCovered: 3 | 6 | 9
}

export interface MonthPoint extends SegRow {
  period: string // 'Nov FY26'
  fy: number
  m: number // 1 = Apr … 12 = Mar
}

export interface FyPoint extends SegRow {
  period: string // 'FY26'
  fy: number
}

export interface EntitySeries {
  id: string
  label: string
  carrier: 'sahi' | 'general' | 'aggregate'
  quarters: QuarterPoint[] // ascending, discrete quarters only
  cumulatives: CumulativePoint[] // ascending, as printed
  months: MonthPoint[] // ascending, single months
  years: FyPoint[] // ascending, full fiscal years
}

// ── financials ───────────────────────────────────────────────────────────────

export interface AnnualFin {
  fy: number
  period: string
  gwp: number | null
  pat: number | null
  combinedRatio: number | null
  claimsRatio: number | null
  expenseRatio: number | null
  solvencyRatio: number | null
  roe: number | null
}

export interface QuarterFin {
  fy: number
  q: number
  period: string // 'Q3 FY25'
  gwp: number | null
  pat: number | null
  combinedRatio: number | null
  solvencyRatio: number | null
}

export interface OwnershipDelta {
  companyId: string
  period: string // 'Q3 FY26' (already spaced in the snapshot)
  periodType: 'quarterly' | 'yearly'
  holderGroup: 'Promoters' | 'FIIs' | 'DIIs' | 'Public'
  current: number | null
  previous: number | null
  changePp: number | null
}

export interface AnalystNote {
  companyId: string
  broker: string
  reportDate: string // ISO
  rating: string | null
  targetPrice: number | null
  priceAtReco: number | null
}

export interface PricePoint {
  date: string // ISO
  close: number
}

export interface ValuationRow {
  companyId: string
  asOfDate: string | null
  price: number | null
  marketCap: number | null
  pb: number | null // IFRS-basis P/B when available (canonical), else quote P/B
  pe: number | null
  pGwp: number | null
  /** basis of the pb figure specifically (never mixed with pe's) */
  pbBasis: 'ifrs' | 'quote'
  peBasis: 'ifrs' | 'quote'
}

export interface ChannelPeriodRow {
  companyId: string
  period: string // as printed: 'FY25' | '9MFY26' …
  fy: number
  monthsCovered: 3 | 6 | 9 | 12
  banca: number | null
  broker: number | null
  agent: number | null
  corporateAgent: number | null
  direct: number | null
  others: number | null
}

export interface IndustryFyRow {
  fy: number
  period: string
  health: number | null
  motor: number | null
  totalGi: number | null
  healthShare: number | null
}

export interface MarketPanel {
  /** Latest fully-derivable discrete quarter across the panel, e.g. 'Q1 FY27'. */
  asOf: string
  entities: EntitySeries[]
  entity: (id: string) => EntitySeries | undefined
  annualFin: Map<string, AnnualFin[]>
  quarterFin: Map<string, QuarterFin[]>
  ownership: OwnershipDelta[]
  analystNotes: AnalystNote[] // ascending by reportDate
  prices: Map<string, PricePoint[]> // ascending by date
  valuation: ValuationRow[]
  channel: ChannelPeriodRow[]
  industryFy: IndustryFyRow[] // ascending
  listed: Set<string>
  label: (id: string) => string
}

// ── raw row shapes ───────────────────────────────────────────────────────────

interface GicSegFields {
  entity: string
  carrier_group: string
  health_retail: number | null
  health_group: number | null
  health_govt: number | null
  health_total: number | null
  basis?: string
  source_basis?: string
}
interface RawGicRow extends GicSegFields {
  period: string
  [k: string]: unknown
}
interface RawGicFyRow extends GicSegFields {
  fiscal_year: string
  [k: string]: unknown
}

const AGGREGATES = new Set(['INDUSTRY', 'SAHI', 'GENERAL', 'PSUs', 'Private', 'Others'])
const AGGREGATE_LABEL: Record<string, string> = {
  INDUSTRY: 'Industry', SAHI: 'SAHIs (all)', GENERAL: 'General insurers', PSUs: 'PSU insurers', Private: 'Private insurers', Others: 'Other insurers',
}

interface MasterRow { company_id: string; short_name: string; listed_status: string; segment?: string }
const MASTER = (companyMaster as { data?: MasterRow[] }).data ?? (companyMaster as unknown as MasterRow[])

const labelOf = (id: string): string =>
  AGGREGATE_LABEL[id] ?? MASTER.find((m) => m.company_id === id)?.short_name ?? id

const seg = (r: GicSegFields): SegRow => ({
  retail: numOrNull(r.health_retail),
  group: numOrNull(r.health_group),
  govt: numOrNull(r.health_govt),
  total: numOrNull(r.health_total),
})

/** How many segment fields carry a real value — dedup informativeness score. */
const filled = (s: SegRow) => [s.retail, s.group, s.govt, s.total].filter((v) => v != null).length

/**
 * Dedup rule for duplicate (entity, period) rows across GIC editions: a
 * current-year row with a real total STRICTLY outranks a prior-year
 * comparative (whatever its field count), but a 0/None-total current row —
 * an edition artifact — never beats a printed comparative with a real total
 * (missing ≠ zero). Rows from DISTINCT insurer names on one entity id
 * (pre-merger predecessors, e.g. Apollo Munich under hdfc-ergo) prefer the
 * surviving brand's own print — history stays the surviving licence's, never
 * a silent pro-forma blend.
 */
function dedupe(rows: (RawGicRow & { insurer_name?: string })[]): RawGicRow {
  if (rows.length === 1) return rows[0]
  const names = new Set(rows.map((r) => String(r.insurer_name ?? '')))
  const score = (r: RawGicRow & { insurer_name?: string }) => {
    const s = seg(r)
    const real = s.total != null && s.total > 0 ? 1 : 0
    const current = r.source_basis !== 'prior-year comparative columns' ? 1 : 0
    const brand = names.size > 1 && /hdfc/i.test(String(r.insurer_name ?? '')) ? 1 : 0
    return brand * 100 + real * 20 + current * 10 + filled(s) * 2
  }
  return [...rows].sort((a, b) => score(b) - score(a))[0]
}

// ── cumulative → discrete quarter derivation ────────────────────────────────

const CUM_RE = /^(Q1|H1|9M|Q[2-4])FY(\d{2})$/

/** months covered by a printed cumulative label (Q1=3, H1=6, 9M=9). */
const CUM_MONTHS: Record<string, 3 | 6 | 9> = { Q1: 3, H1: 6, '9M': 9 }

/** Subtract two SegRows component-wise; a component derives only when both legs
 *  exist; negative results (restatement artifacts) become null, never a fake 0. */
function segDiff(later: SegRow, earlier: SegRow): SegRow {
  const one = (a: number | null, b: number | null): number | null => {
    if (a == null || b == null) return null
    const d = r2(a - b)
    return d < 0 ? null : d
  }
  return { retail: one(later.retail, earlier.retail), group: one(later.group, earlier.group), govt: one(later.govt, earlier.govt), total: one(later.total, earlier.total) }
}

function buildEntitySeries(): EntitySeries[] {
  const qRows = (gicQuarterly as { data: RawGicRow[] }).data
  const mRows = (gicMonthly as { data: RawGicRow[] }).data
  const fyRows = (gicPortfolio as unknown as { data: RawGicFyRow[] }).data

  const ids = [...new Set([...qRows, ...mRows].map((r) => r.entity))]
  return ids.map((id) => {
    // fiscal years (portfolio is keyed by fiscal_year, already one row per FY)
    const years: FyPoint[] = fyRows
      .filter((r) => r.entity === id)
      .map((r) => ({ ...seg(r), fy: Number(String(r.fiscal_year).replace('FY', '')), period: String(r.fiscal_year) }))
      .filter((p) => Number.isFinite(p.fy))
      .sort((a, b) => a.fy - b.fy)
    const yearByFy = new Map(years.map((y) => [y.fy, y]))

    // deduped quarterly rows for this entity
    const byPeriod = new Map<string, RawGicRow[]>()
    for (const r of qRows) if (r.entity === id) byPeriod.set(r.period, [...(byPeriod.get(r.period) ?? []), r])
    const deduped = new Map<string, RawGicRow>([...byPeriod.entries()].map(([p, rs]) => [p, dedupe(rs)]))

    const cumulatives: CumulativePoint[] = []
    const quarters: QuarterPoint[] = []

    // pass 1 — as-stored rows: Q1 prints are both a cumulative and the discrete Q1;
    // Q2/Q4 rows are the pipeline's own printed-cumulative derivations.
    for (const [p, row] of deduped) {
      const m = p.match(CUM_RE)
      if (!m) continue
      const fy = Number(m[2])
      const kind = m[1]
      const s = seg(row)
      if (filled(s) === 0) continue // an all-null row carries nothing and must not block derivation
      // an ALL-ZERO comparative row is a pre-licence placeholder (the insurer
      // did not exist yet) — missing ≠ zero, so it never enters the series.
      if ([s.retail, s.group, s.govt, s.total].every((x) => x === 0)) continue
      if (kind === 'Q1' || kind === 'H1' || kind === '9M') {
        cumulatives.push({ ...s, period: p, fy, monthsCovered: CUM_MONTHS[kind] })
      }
      if (kind === 'Q1') quarters.push({ ...s, period: quarterLabel(fy, 1), fy, q: 1, derived: false, basisNote: 'as printed (Q1 cumulative = the quarter itself)' })
      if (kind === 'Q2' || kind === 'Q3' || kind === 'Q4') {
        const q = Number(kind[1]) as 2 | 3 | 4
        quarters.push({ ...s, period: quarterLabel(fy, q), fy, q, derived: true, basisNote: String(row.basis ?? 'standalone quarter from printed cumulatives') })
      }
    }

    // pass 2 — fill missing discrete quarters from printed cumulative legs:
    //   Q2 = H1 − Q1 · Q3 = 9M − H1 · Q4 = FY − 9M  (component-wise, both legs required)
    const has = (fy: number, q: number) => quarters.some((x) => x.fy === fy && x.q === q)
    const cum = (fy: number, months: number) => cumulatives.find((c) => c.fy === fy && c.monthsCovered === months)
    const fys = [...new Set([...cumulatives.map((c) => c.fy), ...years.map((y) => y.fy)])]
    for (const fy of fys) {
      const q1 = cum(fy, 3), h1 = cum(fy, 6), m9 = cum(fy, 9), full = yearByFy.get(fy)
      const derive = (q: 2 | 3 | 4, later: SegRow | undefined, earlier: SegRow | undefined, note: string) => {
        if (has(fy, q) || !later || !earlier) return
        const d = segDiff(later, earlier)
        if (d.total == null && d.retail == null && d.group == null && d.govt == null) return
        quarters.push({ ...d, period: quarterLabel(fy, q), fy, q, derived: true, basisNote: note })
      }
      derive(2, h1, q1, 'derived: standalone Q2 = printed H1 cumulative − printed Q1')
      derive(3, m9, h1, 'derived: standalone Q3 = printed 9M cumulative − printed H1')
      derive(4, full, m9, 'derived: standalone Q4 = printed full-year − printed 9M cumulative')
    }
    quarters.sort((a, b) => periodKey(a) - periodKey(b))
    cumulatives.sort((a, b) => a.fy * 12 + a.monthsCovered - (b.fy * 12 + b.monthsCovered))

    // months — single-month rows ('Apr-FY19' labels), deduped by informativeness
    const mByPeriod = new Map<string, RawGicRow[]>()
    for (const r of mRows) if (r.entity === id) mByPeriod.set(r.period, [...(mByPeriod.get(r.period) ?? []), r])
    const months: MonthPoint[] = [...mByPeriod.entries()]
      .map(([p, rs]) => ({ p, row: dedupe(rs) }))
      .map(({ p, row }) => {
        const m = p.match(/^([A-Z][a-z]{2})-FY(\d{2})$/)
        if (!m) return null
        const mi = FISCAL_MONTHS.indexOf(m[1] as (typeof FISCAL_MONTHS)[number]) + 1
        if (mi <= 0) return null
        const fy = Number(m[2])
        const s = seg(row)
        if ([s.retail, s.group, s.govt, s.total].every((x) => x === 0)) return null // pre-licence placeholder
        return { ...s, period: monthLabel(fy, mi), fy, m: mi }
      })
      .filter((x): x is MonthPoint => x != null)
      .sort((a, b) => periodKey(a) - periodKey(b))

    const carrierRaw = qRows.find((r) => r.entity === id)?.carrier_group ?? mRows.find((r) => r.entity === id)?.carrier_group ?? ''
    const carrier: EntitySeries['carrier'] = AGGREGATES.has(id) ? 'aggregate' : carrierRaw === 'sahi' ? 'sahi' : 'general'
    return { id, label: labelOf(id), carrier, quarters, cumulatives, months, years }
  })
}

// ── financial adapters ───────────────────────────────────────────────────────

interface RawAnnualFin { company_id: string; fiscal_year: string; [k: string]: unknown }

function buildAnnualFin(): Map<string, AnnualFin[]> {
  const rows = (annualSnapshot as { data: RawAnnualFin[] }).data
  const out = new Map<string, AnnualFin[]>()
  for (const r of rows) {
    const fy = Number(String(r.fiscal_year).replace('FY', ''))
    if (!Number.isFinite(fy)) continue
    const list = out.get(r.company_id) ?? []
    list.push({
      fy, period: fyLabel(fy),
      gwp: numOrNull(r.gwp), pat: numOrNull(r.pat),
      combinedRatio: numOrNull(r.combined_ratio), claimsRatio: numOrNull(r.claims_ratio),
      expenseRatio: numOrNull(r.expense_ratio), solvencyRatio: numOrNull(r.solvency_ratio), roe: numOrNull(r.roe),
    })
    out.set(r.company_id, list)
  }
  for (const list of out.values()) list.sort((a, b) => a.fy - b.fy)
  return out
}

interface RawQFin { company_id: string; quarter: string; fiscal_year: string; [k: string]: unknown }

function buildQuarterFin(): Map<string, QuarterFin[]> {
  const rows = (quarterlyFin as { data: RawQFin[] }).data
  const out = new Map<string, QuarterFin[]>()
  for (const r of rows) {
    const fy = Number(String(r.fiscal_year).replace('FY', ''))
    const q = Number(String(r.quarter).replace('Q', ''))
    if (!Number.isFinite(fy) || !(q >= 1 && q <= 4)) continue
    const list = out.get(r.company_id) ?? []
    list.push({ fy, q, period: quarterLabel(fy, q), gwp: numOrNull(r.gwp), pat: numOrNull(r.pat), combinedRatio: numOrNull(r.combined_ratio), solvencyRatio: numOrNull(r.solvency_ratio) })
    out.set(r.company_id, list)
  }
  for (const list of out.values()) list.sort((a, b) => a.fy * 4 + a.q - (b.fy * 4 + b.q))
  return out
}

// ── ownership / analyst / price / valuation / channel / industry ────────────

interface RawOwn { company_id: string; period_type: string; current_period: string; holder_group: string; current_holding_pct: number | null; previous_holding_pct: number | null; change_pp: number | null }

function buildOwnership(): OwnershipDelta[] {
  return ((ownershipTrends as { data: RawOwn[] }).data)
    .filter((r) => ['Promoters', 'FIIs', 'DIIs', 'Public'].includes(r.holder_group))
    .map((r) => ({
      companyId: r.company_id,
      period: r.current_period,
      periodType: r.period_type === 'quarterly' ? 'quarterly' as const : 'yearly' as const,
      holderGroup: r.holder_group as OwnershipDelta['holderGroup'],
      current: numOrNull(r.current_holding_pct),
      previous: numOrNull(r.previous_holding_pct),
      changePp: numOrNull(r.change_pp),
    }))
}

interface RawNote { company_id: string; broker: string; report_date: string; rating: string | null; target_price: number | null; price_at_reco: number | null }

function buildAnalystNotes(): AnalystNote[] {
  return ((analystCoverage as { data: RawNote[] }).data)
    .filter((r) => r.report_date)
    .map((r) => ({ companyId: r.company_id, broker: r.broker, reportDate: r.report_date, rating: r.rating ?? null, targetPrice: numOrNull(r.target_price), priceAtReco: numOrNull(r.price_at_reco) }))
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate))
}

interface RawPrice { company_id: string; date: string; close: number | null }

function buildPrices(): Map<string, PricePoint[]> {
  const out = new Map<string, PricePoint[]>()
  for (const r of (priceHistory as { data: RawPrice[] }).data) {
    const close = numOrNull(r.close)
    if (close == null || !r.date) continue
    const list = out.get(r.company_id) ?? []
    list.push({ date: r.date, close })
    out.set(r.company_id, list)
  }
  for (const list of out.values()) list.sort((a, b) => a.date.localeCompare(b.date))
  return out
}

interface RawVal { company_id: string; date?: string; share_price?: number | null; market_cap?: number | null; price_to_book?: number | null; price_to_earnings?: number | null; price_to_gwp?: number | null }
interface RawIfrsMult { company_id: string; pe?: number | null; pb?: number | null }

function buildValuation(): ValuationRow[] {
  const quotes = (valuationSnapshot as { data: RawVal[] }).data
  // ifrs-valuation-multiples.json: { data: { 'niva-bupa': { pe, pb }, … } }
  const ifrsData = (ifrsMultiples as { data?: Record<string, { pe?: number | null; pb?: number | null }> }).data ?? {}
  const ifrsRows: RawIfrsMult[] = Object.entries(ifrsData).map(([k, v]) => ({ company_id: k, pe: v?.pe ?? null, pb: v?.pb ?? null }))
  return quotes.map((r) => {
    const ifrs = ifrsRows.find((x) => x.company_id === r.company_id)
    const pbIfrs = numOrNull(ifrs?.pb)
    const peIfrs = numOrNull(ifrs?.pe)
    return {
      companyId: r.company_id,
      asOfDate: r.date ?? null,
      price: numOrNull(r.share_price),
      marketCap: numOrNull(r.market_cap),
      pb: pbIfrs ?? numOrNull(r.price_to_book),
      pe: peIfrs ?? numOrNull(r.price_to_earnings),
      pGwp: numOrNull(r.price_to_gwp),
      pbBasis: pbIfrs != null ? 'ifrs' as const : 'quote' as const,
      peBasis: peIfrs != null ? 'ifrs' as const : 'quote' as const,
    }
  })
}

interface RawChannel { company_id: string; period: string; fiscal_year: string; banca_share: number | null; broker_share: number | null; agent_share: number | null; corporate_agent_share: number | null; direct_share: number | null; others_share: number | null }

function buildChannel(): ChannelPeriodRow[] {
  const monthsOf = (p: string): 3 | 6 | 9 | 12 | null =>
    /^Q1FY/.test(p) ? 3 : /^H1FY/.test(p) ? 6 : /^9MFY/.test(p) ? 9 : /^FY\d{2}$/.test(p) ? 12 : null
  return ((channelMix as { data: RawChannel[] }).data)
    .map((r) => {
      const m = monthsOf(r.period)
      const fy = Number(String(r.fiscal_year).replace('FY', ''))
      if (m == null || !Number.isFinite(fy)) return null
      return {
        companyId: r.company_id, period: r.period, fy, monthsCovered: m,
        banca: numOrNull(r.banca_share), broker: numOrNull(r.broker_share), agent: numOrNull(r.agent_share),
        corporateAgent: numOrNull(r.corporate_agent_share), direct: numOrNull(r.direct_share), others: numOrNull(r.others_share),
      }
    })
    .filter((x): x is ChannelPeriodRow => x != null)
    .sort((a, b) => a.fy * 13 + a.monthsCovered - (b.fy * 13 + b.monthsCovered))
}

interface RawIndustry { period: string; period_type: string; health_premium: number | null; motor_premium: number | null; total_gi_premium: number | null; health_share: number | null }

function buildIndustryFy(): IndustryFyRow[] {
  return ((industryPremium as { data: RawIndustry[] }).data)
    .filter((r) => r.period_type === 'annual' && /^FY\d{2}$/.test(r.period))
    .map((r) => ({
      fy: Number(r.period.replace('FY', '')),
      period: r.period,
      health: numOrNull(r.health_premium),
      motor: numOrNull(r.motor_premium),
      totalGi: numOrNull(r.total_gi_premium),
      healthShare: numOrNull(r.health_share) === 0 ? null : numOrNull(r.health_share), // 0 share = not computed for that FY, not a real zero
    }))
    .sort((a, b) => a.fy - b.fy)
}

// ── panel assembly (memoised — same run, same object) ────────────────────────

let CACHED: MarketPanel | null = null

export function buildMarketPanel(): MarketPanel {
  if (CACHED) return CACHED
  const entities = buildEntitySeries()
  const byId = new Map(entities.map((e) => [e.id, e]))
  const listed = new Set(MASTER.filter((m) => m.listed_status === 'listed').map((m) => m.company_id))

  // asOf = the latest discrete quarter the INDUSTRY aggregate can stand behind.
  const industry = byId.get('INDUSTRY')
  const lastQ = industry?.quarters.filter((q) => q.total != null).at(-1)
  const asOf = lastQ?.period ?? 'FY26'

  CACHED = {
    asOf,
    entities,
    entity: (id: string) => byId.get(id),
    annualFin: buildAnnualFin(),
    quarterFin: buildQuarterFin(),
    ownership: buildOwnership(),
    analystNotes: buildAnalystNotes(),
    prices: buildPrices(),
    valuation: buildValuation(),
    channel: buildChannel(),
    industryFy: buildIndustryFy(),
    listed,
    label: labelOf,
  }
  return CACHED
}

// ── premium-recognition basis boundary (the Oct-2024 “1/n” rule) ─────────────
//
//  IRDAI's 1/n change (effective 1 Oct 2024) altered how long-duration premium
//  is recognised, so a growth comparison whose two legs sit on opposite sides
//  of that date compares different accounting bases — the industry's own
//  monthly series shows the discontinuity. Detectors must not narrate that
//  arithmetic as demand (CLAUDE.md: 1/n vs ex-1/n is never a “mismatch” to
//  cross-fill, and never a growth story).

/** Is fiscal month (fy, m) on the post-change (1/n) basis? Oct FY25 onward. */
export const monthPostN = (fy: number, m: number): boolean => fy > 25 || (fy === 25 && m >= 7)
/** Is fiscal quarter (fy, q) ENTIRELY on the post-change basis? Q3 FY25 onward. */
export const quarterPostN = (fy: number, q: number): boolean => fy > 25 || (fy === 25 && q >= 3)
/** Is the quarter entirely on the pre-change basis? (ends before Oct 2024) */
export const quarterPreN = (fy: number, q: number): boolean => fy < 25 || (fy === 25 && q <= 2)

/** True when a same-quarter YoY comparison (fy,q) vs (fy−1,q) crosses the
 *  1/n boundary — i.e. one leg pre-change, the other post-change. */
export const quarterYoYCrossesN = (fy: number, q: number): boolean =>
  quarterPostN(fy, q) && quarterPreN(fy - 1, q)

/** True when a same-month YoY comparison (fy,m) vs (fy−1,m) crosses the boundary. */
export const monthYoYCrossesN = (fy: number, m: number): boolean =>
  monthPostN(fy, m) && !monthPostN(fy - 1, m)

/** Entities whose GIC series merges a predecessor licence: YoY history before
 *  this fiscal year mixes pre/post-merger books and must not feed “own history”
 *  statistics (HDFC Ergo absorbed Apollo Munich in FY21). */
export const MERGED_HISTORY_FLOOR: Record<string, number> = { 'hdfc-ergo': 23 }

// ── series arithmetic used by detectors and charts ───────────────────────────

/** Year-over-year % growth between the same quarter of consecutive FYs.
 *  Null when either leg is missing or the base is ≤ 0 (missing ≠ zero). */
export function quarterYoY(e: EntitySeries, fy: number, q: number, field: keyof SegRow = 'total'): number | null {
  const cur = e.quarters.find((x) => x.fy === fy && x.q === q)?.[field]
  const prev = e.quarters.find((x) => x.fy === fy - 1 && x.q === q)?.[field]
  if (cur == null || prev == null || prev <= 0) return null
  return r1(((cur as number) / (prev as number) - 1) * 100)
}

/** Health premium excluding government schemes for one point (total − govt),
 *  derivable only when BOTH components exist — a govt-scheme booking must
 *  never be narrated as business momentum. */
export function exGovt(p: SegRow | undefined): number | null {
  if (!p || p.total == null || p.govt == null) return null
  const v = p.total - p.govt
  return v < 0 ? null : r2(v)
}

/** Same-quarter YoY growth on the ex-government basis. */
export function quarterYoYExGovt(e: EntitySeries, fy: number, q: number): number | null {
  const cur = exGovt(e.quarters.find((x) => x.fy === fy && x.q === q))
  const prev = exGovt(e.quarters.find((x) => x.fy === fy - 1 && x.q === q))
  if (cur == null || prev == null || prev <= 0) return null
  return r1((cur / prev - 1) * 100)
}

/** Year-over-year % growth for a single fiscal month. */
export function monthYoY(e: EntitySeries, fy: number, m: number, field: keyof SegRow = 'total'): number | null {
  const cur = e.months.find((x) => x.fy === fy && x.m === m)?.[field]
  const prev = e.months.find((x) => x.fy === fy - 1 && x.m === m)?.[field]
  if (cur == null || prev == null || prev <= 0) return null
  return r1(((cur as number) / (prev as number) - 1) * 100)
}

/** Market share of `id` inside the printed INDUSTRY aggregate for one discrete
 *  quarter (never re-summed from parts — the printed total is the denominator). */
export function quarterShare(panel: MarketPanel, id: string, fy: number, q: number, field: keyof SegRow = 'retail'): number | null {
  const num = panel.entity(id)?.quarters.find((x) => x.fy === fy && x.q === q)?.[field]
  const den = panel.entity('INDUSTRY')?.quarters.find((x) => x.fy === fy && x.q === q)?.[field]
  if (num == null || den == null || den <= 0) return null
  return r2(((num as number) / (den as number)) * 100)
}

/** Market share for a full fiscal year, printed INDUSTRY denominator. */
export function fyShare(panel: MarketPanel, id: string, fy: number, field: keyof SegRow = 'retail'): number | null {
  const num = panel.entity(id)?.years.find((x) => x.fy === fy)?.[field]
  const den = panel.entity('INDUSTRY')?.years.find((x) => x.fy === fy)?.[field]
  if (num == null || den == null || den <= 0) return null
  return r2(((num as number) / (den as number)) * 100)
}
