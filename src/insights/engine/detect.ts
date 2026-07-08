// ---------------------------------------------------------------------------
//  Insight Engine — the DETECTOR battery.
//
//  Fifteen pure detector families scan the wide market panel across every
//  cadence (discrete quarters, single months, fiscal years) and emit typed
//  FINDINGS whenever a statistically material condition fires. New data →
//  new findings, automatically: nothing here is keyed to a hand-written card.
//
//  Every finding carries:
//   • period — the reporting period where the condition BECAME OBSERVABLE
//     (a quarter or month label, never invented from annual data);
//   • values — every number the narration layer may later put into prose
//     (the grounding firewall passes by construction);
//   • method — "show the working" steps with recomputable statistics;
//   • materiality guards — small-base artifacts never fire (a ₹20 cr book
//     tripling is a footnote, not an insight).
//
//  Honesty: a missing leg (no prior-year quarter, no same-basis cumulative)
//  means NO finding — never a derived number from an incomplete basis.
// ---------------------------------------------------------------------------

import type { ChartSpec, InsightCategory, Lens, ProvenanceLayer } from '@/insights/types'
import {
  buildMarketPanel, quarterYoY, quarterYoYExGovt, exGovt, quarterShare, monthLabel, quarterLabel, periodKey,
  quarterYoYCrossesN, monthYoYCrossesN, MERGED_HISTORY_FLOOR,
  type MarketPanel,
} from './marketPanel'
import { getNetWorth } from '@/data/accountingBasis'
import {
  getBasisPatGrowth, getBasisProfit, getBasisSolvency, getStatutoryRoe, ANNUAL_PERIODS, Q4_PERIODS,
  type BasisPeriod,
} from '@/data/accountingBasis'
import { mean, stdev } from '@/insights/stats'
import { preferenceWeight } from './preferences'

// ── finding contract ─────────────────────────────────────────────────────────

export interface FindingEvidence {
  insurer: string
  metric: string
  value: number
  unit: string
  period: string
  layer: ProvenanceLayer
  context: string
}

/** One methodology step, pre-instantiated with this finding's numbers. The
 *  audit gate recomputes `statistic` from `inputs` for every recomputable key. */
export interface EngineMethod {
  key: string
  lens: Lens
  name: string
  refTag: string
  gloss: string
  formulaTeX: string
  instanceTeX: string
  inputs: { symbol: string; label: string; value: number; unit: string; insurer?: string; period: string; layer: ProvenanceLayer }[]
  statistic: { symbol: string; value: number; unit: string }
  threshold?: { rule: string; value: number; passed: boolean }
  robustness?: string
}

export interface Finding {
  detector: string
  id: string
  period: string // where it became obvious — 'Q3 FY26' | 'Nov FY26' | 'FY26'
  cadence: 'annual' | 'quarterly' | 'monthly'
  category: InsightCategory
  insurers: string[]
  /** named numeric slots the narrator may cite (every one is real data) */
  v: Record<string, number>
  /** named string slots (period labels, company labels — never numbers) */
  s: Record<string, string>
  direction: string // narrative variant selector
  evidence: FindingEvidence[]
  method: EngineMethod[]
  chart: ChartSpec
  sourceNote: string
  score: number
  baseCr: number // materiality anchor (₹ cr involved), for ranking
}

// ── shared helpers ───────────────────────────────────────────────────────────

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

const STAT: ProvenanceLayer = 'statutory'
const XCHG: ProvenanceLayer = 'exchange'
const BRKR: ProvenanceLayer = 'broker'
const AGGR: ProvenanceLayer = 'aggregator'
const AREP: ProvenanceLayer = 'annual_report'
const IFRS: ProvenanceLayer = 'ifrs'

/** The retail-health protagonists worth a card (aggregates handled separately). */
const RETAIL_PLAYERS = ['star-health', 'care-health', 'niva-bupa', 'aditya-birla', 'manipalcigna', 'hdfc-ergo', 'icici-lombard', 'bajaj-general', 'new-india'] as const

/** Recency window — findings older than this stay out of the feed (the rail is
 *  an insight surface, not an archive). */
const MIN_Q_KEY = periodKey({ fy: 25, q: 1 }) // Q1 FY25 onward
const MIN_M_KEY = periodKey({ fy: 26, m: 1 }) // Apr FY26 onward
const MIN_FY = 24

const gwpFmt = (n: number) => Math.round(n)

// method-step factories ------------------------------------------------------

function stepYoY(label: string, insurer: string, period: string, prevPeriod: string, cur: number, prev: number, layer: ProvenanceLayer, lens: Lens = 'fundamental', symbol = 'g'): EngineMethod {
  const g = r1((cur / prev - 1) * 100)
  return {
    key: 'yoy_growth', lens,
    name: 'Year-over-year growth', refTag: 'Same-period comparison',
    gloss: `${label} against the same period a year earlier — the seasonality-free growth read.`,
    formulaTeX: String.raw`g = \left(\frac{x_{1}}{x_{0}} - 1\right)\times 100`,
    instanceTeX: String.raw`g = \left(\frac{${gwpFmt(cur)}}{${gwpFmt(prev)}} - 1\right)\times 100 = ${g}\%`,
    inputs: [
      { symbol: 'x_1', label: `${label} (${period})`, value: r2(cur), unit: '₹ Cr', insurer, period, layer },
      { symbol: 'x_0', label: `${label} (${prevPeriod})`, value: r2(prev), unit: '₹ Cr', insurer, period: prevPeriod, layer },
    ],
    statistic: { symbol, value: g, unit: '%' },
  }
}

function stepPpDelta(name: string, label: string, insurer: string, period: string, prevPeriod: string, cur: number, prev: number, layer: ProvenanceLayer, threshold: number, lens: Lens = 'fundamental', symbol = '\\Delta'): EngineMethod {
  const d = r2(cur - prev)
  return {
    key: 'pp_delta', lens,
    name, refTag: 'Level shift (pp)',
    gloss: `${label}: the change in percentage points between the two prints.`,
    formulaTeX: String.raw`\Delta = a - b`,
    instanceTeX: String.raw`\Delta = ${r2(cur)} - ${r2(prev)} = ${d}\,\text{pp}`,
    inputs: [
      { symbol: 'a', label: `${label} (${period})`, value: r2(cur), unit: '%', insurer, period, layer },
      { symbol: 'b', label: `${label} (${prevPeriod})`, value: r2(prev), unit: '%', insurer, period: prevPeriod, layer },
    ],
    statistic: { symbol, value: d, unit: 'pp' },
    threshold: { rule: `|Δ| ≥ ${threshold}pp`, value: threshold, passed: Math.abs(d) >= threshold },
  }
}

function stepShareOf(name: string, insurer: string, period: string, part: number, whole: number, partLabel: string, wholeLabel: string, layer: ProvenanceLayer, lens: Lens = 'macro', symbol = 's', wholeInsurer?: string): EngineMethod {
  const s = r2((part / whole) * 100)
  return {
    key: 'share_of', lens,
    name, refTag: 'Share of printed total',
    gloss: `${partLabel} as a share of the printed ${wholeLabel} — numerator and denominator from the same report, never re-summed.`,
    formulaTeX: String.raw`s = \frac{p}{T}\times 100`,
    instanceTeX: String.raw`s = \frac{${gwpFmt(part)}}{${gwpFmt(whole)}}\times 100 = ${s}\%`,
    inputs: [
      { symbol: 'p', label: partLabel, value: r2(part), unit: '₹ Cr', insurer, period, layer },
      { symbol: 'T', label: wholeLabel, value: r2(whole), unit: '₹ Cr', insurer: wholeInsurer ?? 'INDUSTRY', period, layer },
    ],
    statistic: { symbol, value: s, unit: '%' },
  }
}

function stepZ(name: string, insurer: string, period: string, xi: number, mu: number, sd: number, gloss: string, layer: ProvenanceLayer, lens: Lens = 'fundamental'): EngineMethod {
  const z = r2((xi - mu) / sd)
  return {
    key: 'zscore', lens,
    name, refTag: 'Empirical-rule outlier',
    gloss,
    formulaTeX: String.raw`z = \frac{x_i - \mu}{\sigma}`,
    instanceTeX: String.raw`z = \frac{${r2(xi)} - ${r2(mu)}}{${r2(sd)}} = ${z}`,
    inputs: [
      { symbol: 'x_i', label: `observed (${period})`, value: r2(xi), unit: '%', insurer, period, layer },
      { symbol: '\\mu', label: 'own-history mean', value: r2(mu), unit: '%', insurer, period, layer: 'derived' },
      { symbol: '\\sigma', label: 'own-history stdev', value: r2(sd), unit: '%', insurer, period, layer: 'derived' },
    ],
    statistic: { symbol: 'z', value: z, unit: 'σ' },
    threshold: { rule: '|z| ≥ 1.6', value: 1.6, passed: Math.abs(z) >= 1.6 },
  }
}

const ev = (insurer: string, metric: string, value: number, unit: string, period: string, layer: ProvenanceLayer, context: string): FindingEvidence =>
  ({ insurer, metric, value: r2(value), unit, period, layer, context })

// ─────────────────────────────────────────────────────────────────────────────
//  1. QUARTERLY MARKET-SHARE SHIFTS — retail health share vs same quarter LY
// ─────────────────────────────────────────────────────────────────────────────

function shareShiftQ(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  for (const id of RETAIL_PLAYERS) {
    const e = p.entity(id)
    if (!e) continue
    for (const q of e.quarters) {
      if (periodKey(q) < MIN_Q_KEY || q.retail == null || q.retail < 100) continue
      const cur = quarterShare(p, id, q.fy, q.q, 'retail')
      const prev = quarterShare(p, id, q.fy - 1, q.q, 'retail')
      if (cur == null || prev == null) continue
      const d = r2(cur - prev)
      if (Math.abs(d) < 0.35) continue
      const indRetail = p.entity('INDUSTRY')!.quarters.find((x) => x.fy === q.fy && x.q === q.q)!.retail as number
      out.push({
        detector: 'share_shift_q',
        id: `share-shift-${id}-${q.period.replace(/\s/g, '').toLowerCase()}`,
        period: q.period, cadence: 'quarterly',
        category: 'market_structure',
        insurers: [id],
        v: { cur, prev, delta: d, retailCr: r1(q.retail) },
        s: { name: p.label(id), prevPeriod: quarterLabel(q.fy - 1, q.q) },
        direction: d > 0 ? 'gain' : 'loss',
        evidence: [
          ev(id, 'Retail health market share (quarter)', cur, '%', q.period, STAT, `${d > 0 ? '+' : ''}${d}pp vs ${quarterLabel(q.fy - 1, q.q)}`),
          ev(id, 'Retail health market share (quarter, prior year)', prev, '%', quarterLabel(q.fy - 1, q.q), STAT, 'same quarter a year earlier'),
          ev(id, 'Retail health GWP (quarter)', r1(q.retail), '₹ Cr', q.period, STAT, q.derived ? 'standalone quarter from printed cumulatives' : 'as printed'),
        ],
        method: [
          stepShareOf('Retail market share', id, q.period, q.retail, indRetail, `${p.label(id)} retail health GWP`, 'industry retail health GWP', STAT, 'macro', 's_{mkt}'),
          stepPpDelta('Share shift vs same quarter LY', 'Retail health market share', id, q.period, quarterLabel(q.fy - 1, q.q), cur, prev, STAT, 0.35, 'macro', '\\Delta_{mkt}'),
        ],
        chart: { type: 'timeseries', title: `Retail health market share — quarterly`, seriesKeys: ['eq:share_retail'], insurers: [id, 'star-health', 'care-health', 'niva-bupa'].filter((x, i, a) => a.indexOf(x) === i).slice(0, 4), period: q.period },
        sourceNote: `Shares are computed from the GI Council quarter-end segment prints: the insurer's retail health premium over the printed industry retail total for the same standalone quarter — both legs from the same report family, so the recognition basis cancels within each period.${quarterYoYCrossesN(q.fy, q.q) ? ' The year-earlier comparison spans the Oct-2024 1/n recognition change; shares are ratios within one print so the effect largely cancels, but mix differences across insurers can leave a residual.' : ''}`,
        score: 0, baseCr: q.retail,
      })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. QUARTERLY GROWTH INFLECTIONS — YoY vs the entity's own trailing norm
// ─────────────────────────────────────────────────────────────────────────────

function growthInflectionQ(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  for (const id of RETAIL_PLAYERS) {
    const e = p.entity(id)
    if (!e) continue
    const histFloor = MERGED_HISTORY_FLOOR[id] ?? 0
    for (const q of e.quarters) {
      const base = exGovt(q) // business premium: government schemes excluded
      if (periodKey(q) < MIN_Q_KEY || base == null || base < 150) continue
      if (quarterYoYCrossesN(q.fy, q.q)) continue // 1/n boundary — not a growth story
      const cur = quarterYoYExGovt(e, q.fy, q.q)
      if (cur == null) continue
      // trailing norm: median of up to 4 preceding SAME-BASIS quarterly YoYs
      const hist: number[] = []
      for (const past of e.quarters) {
        if (periodKey(past) >= periodKey(q) || past.fy - 1 < histFloor) continue
        if (quarterYoYCrossesN(past.fy, past.q)) continue
        const g = quarterYoYExGovt(e, past.fy, past.q)
        if (g != null) hist.push(g)
      }
      const trail = hist.slice(-4)
      if (trail.length < 3) continue
      const sortedTrail = trail.slice().sort((a, b) => a - b)
      const mid = sortedTrail.length / 2
      const norm = r1(sortedTrail.length % 2 ? sortedTrail[Math.floor(mid)] : (sortedTrail[mid - 1] + sortedTrail[mid]) / 2)
      const accel = r1(cur - norm)
      if (Math.abs(accel) < 12) continue
      const prevBase = exGovt(e.quarters.find((x) => x.fy === q.fy - 1 && x.q === q.q))
      if (prevBase == null) continue
      const direction = cur < 0 ? 'contraction' : accel > 0 ? 'acceleration' : 'deceleration'
      out.push({
        detector: 'growth_inflection_q',
        id: `growth-inflection-${id}-${q.period.replace(/\s/g, '').toLowerCase()}`,
        period: q.period, cadence: 'quarterly',
        category: 'growth',
        insurers: [id],
        v: { cur, norm, accel, totalCr: r1(base), prevCr: r1(prevBase) },
        s: { name: p.label(id), prevPeriod: quarterLabel(q.fy - 1, q.q) },
        direction,
        evidence: [
          ev(id, 'Health GWP growth YoY, ex-government (quarter)', cur, '%', q.period, STAT, `vs ~${norm}% trailing-quarter norm`),
          ev(id, 'Health GWP ex-government (quarter)', r1(base), '₹ Cr', q.period, STAT, q.derived ? 'standalone quarter from printed cumulatives, government schemes excluded' : 'as printed, government schemes excluded'),
          ev(id, 'Trailing-quarter growth norm', norm, '%', q.period, STAT, `median of the ${trail.length} preceding same-basis quarterly YoY prints`),
        ],
        method: [
          stepYoY('Health GWP ex-government', id, q.period, quarterLabel(q.fy - 1, q.q), base, prevBase, STAT, 'fundamental', 'g_{q}'),
          stepPpDelta('Growth vs own trailing norm', 'Quarterly YoY growth (ex-govt)', id, q.period, 'trailing norm', cur, norm, STAT, 12, 'fundamental', '\\Delta_{trend}'),
        ],
        chart: { type: 'timeseries', title: 'Quarterly health GWP ex-government — ₹ Cr', seriesKeys: ['eq:exgovt'], insurers: [id], period: q.period },
        sourceNote: 'Standalone-quarter premium from the GI Council quarter-end prints with government-scheme business excluded, so a scheme win or loss never reads as business momentum. Growth is same-quarter YoY on a like-for-like recognition basis (comparisons that cross the Oct-2024 1/n change are excluded).',
        score: 0, baseCr: base,
      })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. QUARTERLY MIX QUALITY — retail vs group composition of the quarter
// ─────────────────────────────────────────────────────────────────────────────

function mixShiftQ(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  for (const id of RETAIL_PLAYERS) {
    const e = p.entity(id)
    if (!e) continue
    for (const q of e.quarters) {
      if (periodKey(q) < MIN_Q_KEY || q.retail == null || q.group == null) continue
      const rg = q.retail + q.group
      if (rg < 75) continue
      const prev = e.quarters.find((x) => x.fy === q.fy - 1 && x.q === q.q)
      if (!prev || prev.retail == null || prev.group == null) continue
      const prg = prev.retail + prev.group
      if (prg <= 0) continue
      const mixCur = r2((q.retail / rg) * 100)
      const mixPrev = r2((prev.retail / prg) * 100)
      const d = r2(mixCur - mixPrev)
      if (Math.abs(d) < 3.5) continue
      const retailG = prev.retail > 0 ? r1((q.retail / prev.retail - 1) * 100) : null
      const groupG = prev.group > 0 ? r1((q.group / prev.group - 1) * 100) : null
      const vSlots: Record<string, number> = { mixCur, mixPrev, delta: d, retailCr: r1(q.retail), groupCr: r1(q.group) }
      if (retailG != null) vSlots.retailG = retailG
      if (groupG != null) vSlots.groupG = groupG
      // a retail-ward mix move on a SHRINKING retail book is denominator
      // collapse, not a quality upgrade — narrate it honestly.
      const direction = d > 0
        ? (retailG != null && retailG <= 0 ? 'retail_led_shrink' : 'retail_led')
        : 'group_led'
      out.push({
        detector: 'mix_shift_q',
        id: `mix-shift-${id}-${q.period.replace(/\s/g, '').toLowerCase()}`,
        period: q.period, cadence: 'quarterly',
        category: 'quality',
        insurers: [id],
        v: vSlots,
        s: { name: p.label(id), prevPeriod: quarterLabel(q.fy - 1, q.q) },
        direction,
        evidence: [
          ev(id, 'Retail share of retail+group health premium (quarter)', mixCur, '%', q.period, STAT, `${d > 0 ? '+' : ''}${d}pp vs ${quarterLabel(q.fy - 1, q.q)}`),
          ev(id, 'Retail share of retail+group health premium (quarter, prior year)', mixPrev, '%', quarterLabel(q.fy - 1, q.q), STAT, 'same quarter a year earlier'),
          ...(retailG != null ? [ev(id, 'Retail health premium growth YoY (quarter)', retailG, '%', q.period, STAT, 'retail leg')] : []),
          ...(groupG != null ? [ev(id, 'Group health premium growth YoY (quarter)', groupG, '%', q.period, STAT, 'group leg')] : []),
        ],
        method: [
          stepShareOf('Retail share of the quarter\'s book', id, q.period, q.retail, rg, 'retail health premium', 'retail + group premium', STAT, 'fundamental', 's_{mix}', id),
          stepPpDelta('Mix shift vs same quarter LY', 'Retail share of retail+group', id, q.period, quarterLabel(q.fy - 1, q.q), mixCur, mixPrev, STAT, 3.5, 'fundamental', '\\Delta_{mix}'),
        ],
        chart: { type: 'decomposition_stacked', title: 'Retail vs group — this quarter (₹ Cr)', seriesKeys: ['eq:retail', 'eq:group'], insurers: [id, 'star-health', 'care-health', 'niva-bupa', 'aditya-birla'].filter((x, i, a) => a.indexOf(x) === i).slice(0, 4), period: q.period },
        sourceNote: 'Retail and group legs from the GI Council standalone-quarter prints (government business excluded from the mix so a govt-scheme win never masquerades as retail quality).',
        score: 0, baseCr: rg,
      })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. SEASONAL SURPRISE — this quarter's YoY vs the entity's own same-quarter history
// ─────────────────────────────────────────────────────────────────────────────

function seasonalSurpriseQ(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  for (const id of RETAIL_PLAYERS) {
    const e = p.entity(id)
    if (!e) continue
    const histFloor = MERGED_HISTORY_FLOOR[id] ?? 0
    for (const q of e.quarters) {
      const base = exGovt(q)
      if (periodKey(q) < MIN_Q_KEY || base == null || base < 150) continue
      if (quarterYoYCrossesN(q.fy, q.q)) continue // the 1/n change IS the "surprise" — exclude
      const cur = quarterYoYExGovt(e, q.fy, q.q)
      if (cur == null) continue
      const hist: number[] = []
      for (let fy = q.fy - 1; fy >= q.fy - 6; fy--) {
        if (fy - 1 < histFloor || quarterYoYCrossesN(fy, q.q)) continue
        const g = quarterYoYExGovt(e, fy, q.q)
        if (g != null) hist.push(g)
      }
      if (hist.length < 3) continue
      const mu = r2(mean(hist))
      const sd = r2(stdev(hist))
      if (sd < 2) continue
      const z = r2((cur - mu) / sd)
      // |z| in (1.6, 6]: below is noise, above is almost always a basis/data
      // artifact a tiny-sample σ turns into statistical theater.
      if (Math.abs(z) < 1.6 || Math.abs(z) > 6) continue
      out.push({
        detector: 'seasonal_surprise_q',
        id: `seasonal-surprise-${id}-${q.period.replace(/\s/g, '').toLowerCase()}`,
        period: q.period, cadence: 'quarterly',
        category: 'growth',
        insurers: [id],
        v: { cur, mu, sd, z, n: hist.length, totalCr: r1(base) },
        s: { name: p.label(id), quarterName: `Q${q.q}` },
        direction: z > 0 ? 'hot' : 'cold',
        evidence: [
          ev(id, `Q${q.q} YoY growth (ex-government)`, cur, '%', q.period, STAT, `${z > 0 ? '+' : ''}${z}σ vs its own Q${q.q} record`),
          ev(id, `Own Q${q.q} growth record — mean`, mu, '%', q.period, STAT, `n=${hist.length} same-quarter prints (last available, same basis)`),
          ev(id, 'Health GWP ex-government (quarter)', r1(base), '₹ Cr', q.period, STAT, q.derived ? 'standalone quarter from printed cumulatives' : 'as printed'),
        ],
        method: [
          stepZ(`Same-quarter surprise (Q${q.q} vs own record)`, id, q.period, cur, mu, sd,
            'Compares this quarter\'s ex-government YoY growth against the SAME fiscal quarter\'s growth in prior years — seasonality-adjusted by construction, government schemes excluded.', STAT),
        ],
        chart: { type: 'timeseries', title: 'Quarterly health GWP ex-government — ₹ Cr', seriesKeys: ['eq:exgovt'], insurers: [id], period: q.period },
        sourceNote: 'Same-quarter YoY prints from GI Council standalone quarters, government schemes excluded; the surprise is measured against the insurer\'s own last available same-quarter prints on a like-for-like recognition basis (comparisons crossing the Oct-2024 1/n change are excluded).',
        score: 0, baseCr: base,
      })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  5. MONTHLY MOMENTUM — rolling 3-month YoY vs the prior 3-month window
// ─────────────────────────────────────────────────────────────────────────────

function monthlyMomentum(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  const targets = [...RETAIL_PLAYERS, 'SAHI', 'INDUSTRY']
  const AGG_NAME: Record<string, string> = { SAHI: 'The SAHI cohort', INDUSTRY: 'The industry' }
  for (const id of targets) {
    const e = p.entity(id)
    if (!e || e.months.length < 6) continue
    for (const m of e.months) {
      if (periodKey(m) < MIN_M_KEY || exGovt(m) == null) continue
      // quarter-end windows ARE the quarter — the quarterly detector owns them
      if (m.m % 3 === 0) continue
      const monthsOf = (fy: number, mm: number): { fy: number; m: number }[] => {
        const list: { fy: number; m: number }[] = []
        for (let k = 0; k < 3; k++) {
          let f = fy, mo = mm - k
          if (mo <= 0) { mo += 12; f -= 1 }
          list.push({ fy: f, m: mo })
        }
        return list
      }
      const windowOf = (fy: number, mm: number): number | null => {
        let sum = 0
        for (const pt of monthsOf(fy, mm)) {
          const v = exGovt(e.months.find((x) => x.fy === pt.fy && x.m === pt.m))
          if (v == null) return null
          sum += v
        }
        return sum
      }
      // like-for-like recognition basis: every month-pair in BOTH windows must
      // sit on one side of the Oct-2024 1/n change.
      const windowCrossesN = (fy: number, mm: number) => monthsOf(fy, mm).some((pt) => monthYoYCrossesN(pt.fy, pt.m))
      let pf = m.fy, pm = m.m - 3
      if (pm <= 0) { pm += 12; pf -= 1 }
      if (windowCrossesN(m.fy, m.m) || windowCrossesN(pf, pm)) continue
      const curW = windowOf(m.fy, m.m)
      const prevYW = windowOf(m.fy - 1, m.m)
      if (curW == null || prevYW == null || prevYW <= 0 || curW < 150) continue
      const curG = r1((curW / prevYW - 1) * 100)
      const prevW = windowOf(pf, pm)
      const prevWLy = windowOf(pf - 1, pm)
      if (prevW == null || prevWLy == null || prevWLy <= 0) continue
      const prevG = r1((prevW / prevWLy - 1) * 100)
      const shift = r1(curG - prevG)
      if (Math.abs(shift) < 8) continue
      // base-effect guard: a hyper-growth base normalising is not an inflection
      if (Math.abs(prevG) > 150 || Math.abs(curG) > 150) continue
      out.push({
        detector: 'monthly_momentum',
        id: `monthly-momentum-${id.toLowerCase()}-${m.period.replace(/\s/g, '').toLowerCase()}`,
        period: m.period, cadence: 'monthly',
        category: 'growth',
        insurers: AGG_NAME[id] ? [] : [id],
        v: { curG, prevG, shift, curW: r1(curW), prevYW: r1(prevYW) },
        s: { name: AGG_NAME[id] ?? p.label(id), windowEnd: m.period, prevWindowEnd: monthLabel(pf, pm) },
        direction: shift > 0 ? 'building' : prevG >= 60 ? 'normalizing' : 'fading',
        evidence: [
          ev(id, 'Trailing 3-month health GWP growth YoY (ex-government)', curG, '%', m.period, STAT, `window ending ${m.period}`),
          ev(id, 'Prior 3-month window growth YoY (ex-government)', prevG, '%', monthLabel(pf, pm), STAT, `window ending ${monthLabel(pf, pm)}`),
          ev(id, 'Trailing 3-month health GWP ex-government', r1(curW), '₹ Cr', m.period, STAT, 'sum of the three printed single months'),
        ],
        method: [
          stepYoY('Trailing 3-month health GWP ex-government', id, m.period, monthLabel(m.fy - 1, m.m), curW, prevYW, STAT, 'fundamental', 'g_{3m}'),
          stepPpDelta('Momentum shift between windows', 'Trailing 3-month YoY growth (ex-govt)', id, m.period, monthLabel(pf, pm), curG, prevG, STAT, 8, 'fundamental', '\\Delta_{mom}'),
        ],
        chart: { type: 'timeseries', title: 'Monthly health GWP ex-government — ₹ Cr', seriesKeys: ['em:exgovt'], insurers: [id], period: m.period },
        sourceNote: 'Single-month premium from the GI Council monthly flash with government-scheme business excluded (each month\'s own print, YTD differences where the source prints only cumulatives). A 3-month window smooths single-month lumpiness, and every comparison stays on one side of the Oct-2024 1/n recognition change.',
        score: 0, baseCr: curW,
      })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  6. MARKET STRUCTURE — SAHI share of industry health, carrier shifts, new entrants
// ─────────────────────────────────────────────────────────────────────────────

function sahiStructure(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  const ind = p.entity('INDUSTRY')
  const sahi = p.entity('SAHI')
  if (ind && sahi) {
    // SAHI share of industry TOTAL health, per quarter, streak detection
    const shares: { period: string; fy: number; q: number; share: number }[] = []
    for (const q of sahi.quarters) {
      const den = ind.quarters.find((x) => x.fy === q.fy && x.q === q.q)?.total
      if (q.total == null || den == null || den <= 0) continue
      shares.push({ period: q.period, fy: q.fy, q: q.q, share: r2((q.total / den) * 100) })
    }
    shares.sort((a, b) => periodKey(a) - periodKey(b))
    // YoY share compare per quarter, streaks of same-direction moves
    const moves: { period: string; fy: number; q: number; cur: number; prev: number; d: number }[] = []
    for (const s of shares) {
      const prev = shares.find((x) => x.fy === s.fy - 1 && x.q === s.q)
      if (!prev) continue
      moves.push({ period: s.period, fy: s.fy, q: s.q, cur: s.share, prev: prev.share, d: r2(s.share - prev.share) })
    }
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i]
      if (periodKey({ fy: m.fy, q: m.q }) < MIN_Q_KEY || Math.abs(m.d) < 0.4) continue
      // streak: CONSECUTIVE quarters only — a same-sign move on the far side of
      // a data gap never extends the run.
      let streak = 1
      for (let j = i - 1; j >= 0; j--) {
        const expected = moves[j + 1].q === 1 ? { fy: moves[j + 1].fy - 1, q: 4 } : { fy: moves[j + 1].fy, q: moves[j + 1].q - 1 }
        const adjacent = moves[j].fy === expected.fy && moves[j].q === expected.q
        if (adjacent && Math.sign(moves[j].d) === Math.sign(m.d) && Math.abs(moves[j].d) >= 0.1) streak++
        else break
      }
      const sahiCr = sahi.quarters.find((x) => x.fy === m.fy && x.q === m.q)?.total ?? 0
      out.push({
        detector: 'sahi_structure',
        id: `sahi-structure-${m.period.replace(/\s/g, '').toLowerCase()}`,
        period: m.period, cadence: 'quarterly',
        category: 'market_structure',
        insurers: [],
        v: { cur: m.cur, prev: m.prev, delta: m.d, streak, sahiCr: r1(sahiCr) },
        s: { prevPeriod: quarterLabel(m.fy - 1, m.q) },
        direction: m.d > 0 ? 'sahi_gaining' : 'sahi_ceding',
        evidence: [
          ev('SAHI', 'SAHI share of industry health premium (quarter)', m.cur, '%', m.period, STAT, `${m.d > 0 ? '+' : ''}${m.d}pp vs ${quarterLabel(m.fy - 1, m.q)}`),
          ev('SAHI', 'SAHI share of industry health premium (quarter, prior year)', m.prev, '%', quarterLabel(m.fy - 1, m.q), STAT, 'same quarter a year earlier'),
          ev('SAHI', 'SAHI health premium (quarter)', r1(sahiCr), '₹ Cr', m.period, STAT, 'printed SAHI aggregate'),
        ],
        method: [
          stepPpDelta('Carrier-type share shift', 'SAHI share of industry health', 'SAHI', m.period, quarterLabel(m.fy - 1, m.q), m.cur, m.prev, STAT, 0.4, 'macro', '\\Delta_{sahi}'),
        ],
        chart: { type: 'timeseries', title: 'SAHI share of industry health — quarterly %', seriesKeys: ['eq:share_total'], insurers: ['SAHI'], period: m.period },
        sourceNote: `Printed GI Council aggregates: the SAHI sub-total over the industry total for the same standalone quarter — both rows as printed, never re-summed from members.${quarterYoYCrossesN(m.fy, m.q) ? ' The year-earlier comparison spans the Oct-2024 1/n recognition change; carrier-type shares are ratios within one print so the effect largely cancels.' : ''}`,
        score: 0, baseCr: sahiCr,
      })
    }
  }
  // new-entrant ramp: youngest SAHIs crossing scale thresholds
  for (const id of ['galaxy-health', 'narayana-health']) {
    const e = p.entity(id)
    if (!e) continue
    for (const q of e.quarters) {
      if (periodKey(q) < MIN_Q_KEY || q.total == null) continue
      const prev = e.quarters.find((x) => x.fy === q.fy - 1 && x.q === q.q)
      if (!prev || prev.total == null || prev.total <= 0) continue
      if (q.total < 25 || q.total < prev.total * 1.8) continue // must have real scale AND still compounding
      const g = r1((q.total / prev.total - 1) * 100)
      out.push({
        detector: 'entrant_ramp',
        id: `entrant-ramp-${id}-${q.period.replace(/\s/g, '').toLowerCase()}`,
        period: q.period, cadence: 'quarterly',
        category: 'market_structure',
        insurers: [id],
        v: { totalCr: r1(q.total), prevCr: r1(prev.total), g },
        s: { name: p.label(id), prevPeriod: quarterLabel(q.fy - 1, q.q) },
        direction: 'ramp',
        evidence: [
          ev(id, 'Total health GWP (quarter)', r1(q.total), '₹ Cr', q.period, STAT, `vs ₹${gwpFmt(prev.total)} cr in ${quarterLabel(q.fy - 1, q.q)}`),
          ev(id, 'Total health GWP growth YoY (quarter)', g, '%', q.period, STAT, 'new-capacity ramp'),
        ],
        method: [stepYoY('Total health GWP', id, q.period, quarterLabel(q.fy - 1, q.q), q.total, prev.total, STAT, 'fundamental', 'g_{ramp}')],
        chart: { type: 'timeseries', title: 'Quarterly health GWP — ₹ Cr', seriesKeys: ['eq:total'], insurers: [id], period: q.period },
        sourceNote: 'GI Council standalone-quarter prints for the newest SAHI licences — the supply-side of the capital cycle.',
        score: 0, baseCr: q.total,
      })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  7. UNDERWRITING ECONOMICS — combined-ratio regime changes + decomposition
//     (per accounting basis, IGAAP and IFRS never cross-filled)
// ─────────────────────────────────────────────────────────────────────────────

// accountingBasis tables are keyed by company_id; `name` is display copy only.
const BASIS_COMPANIES: { id: string; name: string }[] = [
  { id: 'niva-bupa', name: 'Niva Bupa' }, { id: 'star-health', name: 'Star Health' }, { id: 'care-health', name: 'Care Health' },
]
const basisLayer: Record<'igaap' | 'ifrs', ProvenanceLayer> = { igaap: AREP, ifrs: IFRS }
const BASIS_TAG: Record<'igaap' | 'ifrs', string> = { igaap: 'IGAAP', ifrs: 'IFRS' }
const basisPeriodLabel = (bp: BasisPeriod): string => (bp.startsWith('Q4') ? `Q4 ${bp.slice(2)}` : bp)
const basisCadence = (bp: BasisPeriod): 'annual' | 'quarterly' => (bp.startsWith('Q4') ? 'quarterly' : 'annual')

function uwEconomics(): Finding[] {
  const out: Finding[] = []
  const periods: BasisPeriod[] = [...ANNUAL_PERIODS, ...Q4_PERIODS]
  const candidates = new Map<string, Finding[]>() // one story per (company, period)
  for (const { id, name } of BASIS_COMPANIES) {
    for (const basis of ['igaap', 'ifrs'] as const) {
      for (const bp of periods) {
        const fyNum = Number(bp.replace(/^Q4/, '').replace('FY', ''))
        if (fyNum < MIN_FY) continue
        const cur = getBasisProfit(id, basis, bp)
        if (!cur || cur.combinedRatio == null) continue
        const prevBp = (bp.startsWith('Q4') ? `Q4FY${fyNum - 1}` : `FY${fyNum - 1}`) as BasisPeriod
        const prev = getBasisProfit(id, basis, prevBp)
        if (!prev || prev.combinedRatio == null) continue
        const dCR = r1(cur.combinedRatio - prev.combinedRatio)
        const crossed = (cur.combinedRatio - 100) * (prev.combinedRatio - 100) < 0
        if (!crossed && Math.abs(dCR) < 2) continue
        const dClaims = cur.claimsRatio != null && prev.claimsRatio != null ? r1(cur.claimsRatio - prev.claimsRatio) : null
        const dExp = cur.expenseRatio != null && prev.expenseRatio != null ? r1(cur.expenseRatio - prev.expenseRatio) : null
        const period = basisPeriodLabel(bp)
        const prevPeriod = basisPeriodLabel(prevBp)
        const vSlots: Record<string, number> = { cur: cur.combinedRatio, prev: prev.combinedRatio, dCR }
        if (dClaims != null && cur.claimsRatio != null) { vSlots.dClaims = dClaims; vSlots.claims = cur.claimsRatio }
        if (dExp != null && cur.expenseRatio != null) { vSlots.dExp = dExp; vSlots.expense = cur.expenseRatio }
        if (cur.pat != null) vSlots.pat = cur.pat
        const direction = crossed
          ? cur.combinedRatio > 100 ? 'crossed_into_loss' : 'crossed_into_profit'
          : cur.combinedRatio > 100
            ? (dCR > 0 ? 'deteriorating' : 'improving') // loss regime
            : (dCR > 0 ? 'profit_narrowing' : 'profit_widening') // profitable regime
        const finding: Finding = {
          detector: 'uw_economics',
          id: `uw-economics-${id}-${basis}-${bp.toLowerCase()}`,
          period, cadence: basisCadence(bp),
          category: 'earnings_quality',
          insurers: [id],
          v: vSlots,
          s: { name, basis: BASIS_TAG[basis], prevPeriod },
          direction,
          evidence: [
            ev(id, `Combined ratio (${BASIS_TAG[basis]})`, cur.combinedRatio, '%', period, basisLayer[basis], `${dCR > 0 ? '+' : ''}${dCR}pp vs ${prevPeriod}`),
            ev(id, `Combined ratio (${BASIS_TAG[basis]}, prior period)`, prev.combinedRatio, '%', prevPeriod, basisLayer[basis], 'prior comparable period, same basis'),
            ...(dClaims != null && cur.claimsRatio != null ? [ev(id, `Claims ratio (${BASIS_TAG[basis]})`, cur.claimsRatio, '%', period, basisLayer[basis], `${dClaims > 0 ? '+' : ''}${dClaims}pp`)] : []),
            ...(dExp != null && cur.expenseRatio != null ? [ev(id, `Expense ratio (${BASIS_TAG[basis]})`, cur.expenseRatio, '%', period, basisLayer[basis], `${dExp > 0 ? '+' : ''}${dExp}pp`)] : []),
          ],
          method: [
            stepPpDelta(`Combined-ratio move (${BASIS_TAG[basis]})`, 'Combined ratio', id, period, prevPeriod, cur.combinedRatio, prev.combinedRatio, basisLayer[basis], 2, 'fundamental', '\\Delta_{CR}'),
            ...(dClaims != null && dExp != null && cur.claimsRatio != null && prev.claimsRatio != null
              ? [stepPpDelta('Claims-side attribution', 'Claims ratio', id, period, prevPeriod, cur.claimsRatio, prev.claimsRatio, basisLayer[basis], 0, 'fundamental', '\\Delta_{claims}')]
              : []),
          ],
          chart: { type: 'timeseries', title: `Combined ratio — ${BASIS_TAG[basis]} %`, seriesKeys: [basis === 'igaap' ? 'ab:cr_igaap' : 'ab:cr_ifrs'], insurers: BASIS_COMPANIES.map((c) => c.id), period },
          sourceNote: `Combined, claims and expense ratios on the ${BASIS_TAG[basis]} basis from the company's own disclosures — the two accounting bases are never mixed in one comparison.`,
          score: 0, baseCr: cur.pat != null ? Math.abs(cur.pat) : 100,
        }
        const k = `${id}|${bp}`
        candidates.set(k, [...(candidates.get(k) ?? []), finding])
      }
    }
  }
  // The same combined-ratio story on both bases is ONE insight: a crossing
  // outranks a drift; IGAAP (the statutory canon) breaks ties. A genuine
  // cross-basis disagreement is the basis-divergence detector's job.
  for (const cands of candidates.values()) {
    const pick = cands.sort((a, b) => {
      const cross = (f: Finding) => (f.direction.startsWith('crossed') ? 1 : 0)
      const igaap = (f: Finding) => (f.s.basis === 'IGAAP' ? 1 : 0)
      return cross(b) - cross(a) || igaap(b) - igaap(a)
    })[0]
    out.push(pick)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  8. ACCOUNTING-BASIS DIVERGENCE — IGAAP vs IFRS telling different stories
// ─────────────────────────────────────────────────────────────────────────────

function basisDivergence(): Finding[] {
  const out: Finding[] = []
  for (const { id, name } of BASIS_COMPANIES) {
    for (const bp of ANNUAL_PERIODS) {
      const fyNum = Number(bp.replace('FY', ''))
      if (fyNum < MIN_FY) continue
      const gI = getBasisPatGrowth(id, 'igaap', bp)
      const gF = getBasisPatGrowth(id, 'ifrs', bp)
      const patI = getBasisProfit(id, 'igaap', bp)?.pat ?? null
      const patF = getBasisProfit(id, 'ifrs', bp)?.pat ?? null
      if (gI == null || gF == null || patI == null || patF == null) continue
      const gap = r1(Math.abs(gI - gF))
      const signFlip = Math.sign(gI) !== Math.sign(gF)
      if (!signFlip && gap < 25) continue
      out.push({
        detector: 'basis_divergence',
        id: `basis-divergence-${id}-${bp.toLowerCase()}`,
        period: bp, cadence: 'annual',
        category: 'earnings_quality',
        insurers: [id],
        v: { gI: r1(gI), gF: r1(gF), gap, patI, patF },
        s: { name },
        direction: signFlip ? 'sign_flip' : 'wide_gap',
        evidence: [
          ev(id, 'PAT growth YoY (IGAAP)', r1(gI), '%', bp, AREP, `IGAAP PAT ₹${gwpFmt(patI)} cr`),
          ev(id, 'PAT growth YoY (IFRS)', r1(gF), '%', bp, IFRS, `IFRS PAT ₹${gwpFmt(patF)} cr`),
          ev(id, 'PAT (IGAAP)', patI, '₹ Cr', bp, AREP, 'statutory basis'),
          ev(id, 'PAT (IFRS)', patF, '₹ Cr', bp, IFRS, 'IFRS basis'),
        ],
        method: [
          stepPpDelta('Cross-basis growth divergence', 'PAT growth YoY (IGAAP − IFRS)', id, bp, bp, r1(gI), r1(gF), AREP, 25, 'fundamental', '\\Delta_{basis}'),
        ],
        chart: { type: 'timeseries', title: 'PAT by accounting basis — ₹ Cr', seriesKeys: ['ab:pat_igaap', 'ab:pat_ifrs'], insurers: [id], period: bp },
        sourceNote: 'IGAAP figures from statutory disclosures; IFRS from the company\'s IFRS accounts. The divergence itself is the datum — the two bases are shown side by side, never blended.',
        score: 0, baseCr: Math.max(Math.abs(patI), Math.abs(patF)),
      })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  9. SOLVENCY RUNWAY — headroom over the 1.5x floor, eroded at premium growth
// ─────────────────────────────────────────────────────────────────────────────

function solvencyRunway(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  const FLOOR = 1.5
  for (const { id, name } of BASIS_COMPANIES) {
    // newest solvency print: prefer the latest basis-period table, else annual snapshot
    let s: number | null = null
    let period = ''
    for (const bp of ['FY26', 'Q4FY26', 'FY25', 'Q4FY25', 'FY24', 'FY23'] as BasisPeriod[]) {
      const v = getBasisSolvency(id, bp)
      if (v != null) { s = v; period = basisPeriodLabel(bp); break }
    }
    if (s == null) {
      const fin = p.annualFin.get(id) ?? []
      const last = [...fin].reverse().find((x) => x.solvencyRatio != null)
      if (last) { s = last.solvencyRatio; period = last.period }
    }
    if (s == null) continue
    // trailing FY GWP growth from the entity's own years
    const e = p.entity(id)
    const yrs = (e?.years ?? []).filter((y) => y.total != null)
    if (yrs.length < 2) continue
    const g = r1(((yrs[yrs.length - 1].total as number) / (yrs[yrs.length - 2].total as number) - 1) * 100)
    if (g <= 0 || s <= FLOOR) continue
    const t = r1(Math.log(s / FLOOR) / Math.log(1 + g / 100))
    if (t > 3.5 && s > 1.8) continue // comfortable — not an insight
    out.push({
      detector: 'solvency_runway',
      id: `solvency-runway-${id}-${period.replace(/\s/g, '').toLowerCase()}`,
      period, cadence: /^Q/.test(period) ? 'quarterly' : 'annual',
      category: 'capital',
      insurers: [id],
      v: { s: r2(s), g, t, headroom: r2(s - FLOOR) },
      s: { name },
      direction: t <= 2 ? 'near' : 'watch',
      evidence: [
        ev(id, 'Solvency ratio', r2(s), 'x', period, STAT, `${r2(s - FLOOR)}x above the 1.5x floor`),
        ev(id, 'Health GWP growth YoY (FY)', g, '%', yrs[yrs.length - 1].period, STAT, 'the pace eroding the cushion'),
        ev(id, 'Runway to the floor (heuristic)', t, 'yrs', period, 'derived', 'headroom eroded at current premium growth'),
      ],
      method: [{
        key: 'solvency_runway', lens: 'fundamental',
        name: 'Solvency runway', refTag: 'Growth-adjusted headroom',
        gloss: 'Years until solvency drifts to the regulatory floor if premium keeps compounding at the current rate with no capital action.',
        formulaTeX: String.raw`t = \frac{\ln(S/\text{floor})}{\ln(1+g)}`,
        instanceTeX: String.raw`t = \frac{\ln(${r2(s)}/1.5)}{\ln(1+${g}\%)} = ${t}\,\text{yrs}`,
        inputs: [
          { symbol: 'S', label: 'solvency ratio', value: r2(s), unit: 'x', insurer: id, period, layer: STAT },
          { symbol: 'floor', label: 'regulatory floor', value: FLOOR, unit: 'x', insurer: id, period, layer: 'derived' },
          { symbol: 'g', label: 'trailing FY premium growth', value: g, unit: '%', insurer: id, period: yrs[yrs.length - 1].period, layer: STAT },
        ],
        statistic: { symbol: 't', value: t, unit: 'yrs' },
        threshold: { rule: 'runway ≤ 3.5 yrs flags', value: 3.5, passed: t <= 3.5 },
      }],
      chart: { type: 'ranking_bar', title: 'Solvency ratio vs the 1.5x floor', seriesKeys: ['ab:solvency'], insurers: BASIS_COMPANIES.map((c) => c.id), period, annotations: [{ kind: 'threshold', label: 'Regulatory floor', value: 1.5 }] },
      sourceNote: 'Solvency from the newest statutory print on record; the runway is a derived heuristic (headroom eroded at the trailing premium-growth rate), not a company forecast.',
      score: 0, baseCr: 200,
    })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  10. VALUATION DISLOCATION — reverse the price on the listed names
// ─────────────────────────────────────────────────────────────────────────────

function valuationDislocation(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  const COE = 12, G_TERM = 8
  for (const row of p.valuation) {
    // ONE accounting basis end-to-end: market cap over STATUTORY net worth,
    // against the STATUTORY ROE — never an IFRS book with an IGAAP return.
    const tracked = BASIS_COMPANIES.some((c) => c.id === row.companyId)
    if (!tracked || row.marketCap == null) continue
    let roe: number | null = null
    let roePeriod = ''
    let netWorth: number | null = null
    for (const bp of [...ANNUAL_PERIODS].reverse()) {
      const v = getStatutoryRoe(row.companyId, bp)
      const nw = getNetWorth(row.companyId, bp)
      if (v != null && nw != null && nw > 0) { roe = r1(v); roePeriod = bp; netWorth = nw; break }
    }
    if (roe == null || netWorth == null) continue
    const pb = r2(row.marketCap / netWorth)
    const implied = r1(COE * pb - G_TERM * (pb - 1))
    const gapPp = r1(implied - roe)
    if (Math.abs(gapPp) < 8) continue
    const quoteLabel = row.asOfDate ? fiscalMonthOf(row.asOfDate).label : roePeriod
    out.push({
      detector: 'valuation_dislocation',
      id: `valuation-dislocation-${row.companyId}-${roePeriod.toLowerCase()}`,
      period: roePeriod, cadence: 'annual',
      category: 'valuation',
      insurers: [row.companyId],
      v: { pb, roe, implied, gapPp, marketCap: Math.round(row.marketCap), netWorth: Math.round(netWorth), ...(row.pb != null && row.pbBasis === 'ifrs' ? { pbIfrs: r2(row.pb) } : {}) },
      s: { name: p.label(row.companyId), basis: 'statutory book' },
      direction: gapPp > 0 ? 'priced_ahead' : 'priced_behind',
      evidence: [
        ev(row.companyId, 'P/B (statutory net worth)', pb, 'x', quoteLabel, XCHG, `market cap ₹${Math.round(row.marketCap)} cr over ₹${Math.round(netWorth)} cr ${roePeriod} net worth, as of ${row.asOfDate ?? 'latest quote'}`),
        ev(row.companyId, 'Delivered ROE (statutory)', roe, '%', roePeriod, STAT, 'statutory PAT over the same net worth — one basis end-to-end'),
        ev(row.companyId, 'Implied steady-state ROE (reverse Gordon)', implied, '%', roePeriod, 'derived', `at ${COE}% CoE and ${G_TERM}% terminal growth`),
        ...(row.pb != null && row.pbBasis === 'ifrs' ? [ev(row.companyId, 'P/B (IFRS net worth, secondary)', r2(row.pb), 'x', quoteLabel, XCHG, 'the dashboard\'s IFRS-basis multiple, shown for reference — never blended into the statutory read')] : []),
      ],
      method: [{
        key: 'implied_roe', lens: 'fundamental',
        name: 'Reverse the price (Gordon)', refTag: 'Expectations investing',
        gloss: 'Invert the statutory book multiple into the steady-state ROE the current price requires, then compare with the statutory ROE actually delivered — one accounting basis end-to-end.',
        formulaTeX: String.raw`ROE^{*} = CoE \cdot \frac{P}{B} - g\left(\frac{P}{B}-1\right)`,
        instanceTeX: String.raw`ROE^{*} = ${COE}\cdot ${pb} - ${G_TERM}(${pb}-1) = ${implied}\%`,
        inputs: [
          { symbol: 'P/B', label: 'market cap over statutory net worth', value: pb, unit: 'x', insurer: row.companyId, period: quoteLabel, layer: XCHG },
          { symbol: 'CoE', label: 'cost of equity (assumption)', value: COE, unit: '%', insurer: row.companyId, period: roePeriod, layer: 'derived' },
          { symbol: 'g', label: 'terminal growth (assumption)', value: G_TERM, unit: '%', insurer: row.companyId, period: roePeriod, layer: 'derived' },
          { symbol: 'ROE_{del}', label: 'delivered statutory ROE', value: roe, unit: '%', insurer: row.companyId, period: roePeriod, layer: STAT },
        ],
        statistic: { symbol: 'ROE^{*}', value: implied, unit: '%' },
        threshold: { rule: 'delivered ≥ implied ⇒ earned', value: implied, passed: roe >= implied },
        robustness: gapPp > 0 ? `The multiple front-runs returns: implied ${implied}% vs ${roe}% delivered — a ${gapPp}pp gap the book has not yet earned.` : `Delivered returns exceed what the multiple requires — the price trails the fundamentals by ${Math.abs(gapPp)}pp of ROE.`,
      }],
      chart: { type: 'scatter_dislocation', title: 'P/B (statutory) vs delivered ROE', seriesKeys: ['val:roe', 'val:pb'], insurers: BASIS_COMPANIES.map((c) => c.id), period: roePeriod },
      sourceNote: 'The book multiple is the daily market cap over the newest reported statutory net worth, and the ROE is statutory PAT over that same net worth — the numerator and denominator never mix accounting bases. The IFRS multiple, where published, is shown as separate reference evidence.',
      score: 0, baseCr: row.marketCap,
    })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  11. PRICE vs FUNDAMENTALS — the tape and the premium engine disagreeing
// ─────────────────────────────────────────────────────────────────────────────

/** price of the last trading day on or before an ISO date */
function priceAsOf(prices: { date: string; close: number }[], iso: string): number | null {
  let best: number | null = null
  for (const p of prices) {
    if (p.date <= iso) best = p.close
    else break
  }
  return best
}

/** price of the last trading day STRICTLY BEFORE an ISO date (period baseline). */
function priceBefore(prices: { date: string; close: number }[], iso: string): number | null {
  let best: number | null = null
  for (const p of prices) {
    if (p.date < iso) best = p.close
    else break
  }
  return best
}

/** fiscal quarter → calendar [startISO, endISO] */
function quarterWindow(fy: number, q: number): [string, string] {
  const calYearStart = 2000 + fy - 1
  const startMonth = 4 + (q - 1) * 3 // 4,7,10,13
  const y = startMonth > 12 ? calYearStart + 1 : calYearStart
  const m = startMonth > 12 ? startMonth - 12 : startMonth
  const endM = m + 2
  const endY = endM > 12 ? y + 1 : y
  const endMm = endM > 12 ? endM - 12 : endM
  const lastDay = new Date(Date.UTC(endY, endMm, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return [`${y}-${pad(m)}-01`, `${endY}-${pad(endMm)}-${pad(lastDay)}`]
}

const PRICE_PROXY: Record<string, string> = { 'care-health': 'religare-enterprises' }

function priceFundamentalsGap(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  for (const id of ['star-health', 'niva-bupa', 'care-health']) {
    const priceId = PRICE_PROXY[id] ?? id
    const prices = p.prices.get(priceId)
    const e = p.entity(id)
    if (!prices || prices.length < 40 || !e) continue
    for (const q of e.quarters) {
      if (periodKey(q) < MIN_Q_KEY || q.retail == null) continue
      const retailG = quarterYoY(e, q.fy, q.q, 'retail')
      if (retailG == null) continue
      if (quarterYoYCrossesN(q.fy, q.q)) continue // premium leg must be like-for-like
      const [start, end] = quarterWindow(q.fy, q.q)
      const p0 = priceBefore(prices, start) // the close the quarter OPENS from
      const p1 = priceAsOf(prices, end)
      if (p0 == null || p1 == null || p0 <= 0 || p1 === p0) continue
      // price history must cover the WHOLE window (history starts 2024-11)
      if (prices[0].date >= start) continue // baseline must predate the window
      if (prices[prices.length - 1].date < end) continue // stale feed — partial windows lie
      const ret = r1((p1 / p0 - 1) * 100)
      const diverges = (ret <= -10 && retailG >= 12) || (ret >= 10 && retailG <= -5)
      if (!diverges) continue
      out.push({
        detector: 'price_fundamentals_gap',
        id: `price-fundamentals-${id}-${q.period.replace(/\s/g, '').toLowerCase()}`,
        period: q.period, cadence: 'quarterly',
        category: 'valuation',
        insurers: [id],
        v: { ret, retailG, p0: r1(p0), p1: r1(p1), retailCr: r1(q.retail) },
        s: { name: p.label(id), proxy: priceId !== id ? p.label(priceId) : '' },
        direction: ret < 0 ? 'derating_despite_growth' : 'rerating_despite_weakness',
        evidence: [
          ev(id, 'Share-price move over the quarter', ret, '%', q.period, XCHG, `₹${r1(p0)} → ₹${r1(p1)}${priceId !== id ? ` (via ${p.label(priceId)})` : ''}`),
          ev(id, 'Retail health premium growth YoY (quarter)', retailG, '%', q.period, STAT, 'the fundamental print for the same window'),
          ev(id, 'Retail health GWP (quarter)', r1(q.retail), '₹ Cr', q.period, STAT, q.derived ? 'standalone quarter from printed cumulatives' : 'as printed'),
        ],
        method: [
          stepYoY('Retail health premium', id, q.period, quarterLabel(q.fy - 1, q.q), q.retail, (e.quarters.find((x) => x.fy === q.fy - 1 && x.q === q.q)?.retail as number), STAT, 'fundamental', 'g_{ret}'),
          {
            key: 'window_return', lens: 'technical',
            name: 'Price return over the fiscal quarter', refTag: 'Tape vs fundamentals',
            gloss: 'The share-price move across exactly the window the premium print covers — the tape\'s verdict on the same quarter.',
            formulaTeX: String.raw`r = \left(\frac{P_1}{P_0}-1\right)\times 100`,
            instanceTeX: String.raw`r = \left(\frac{${r1(p1)}}{${r1(p0)}}-1\right)\times 100 = ${ret}\%`,
            inputs: [
              { symbol: 'P_1', label: `close at quarter end${priceId !== id ? ` (${p.label(priceId)}, listed proxy)` : ''}`, value: r1(p1), unit: '₹', insurer: id, period: q.period, layer: XCHG },
              { symbol: 'P_0', label: `close entering the quarter${priceId !== id ? ` (${p.label(priceId)}, listed proxy)` : ''}`, value: r1(p0), unit: '₹', insurer: id, period: q.period, layer: XCHG },
            ],
            statistic: { symbol: 'r', value: ret, unit: '%' },
          },
        ],
        chart: { type: 'timeseries', title: 'Quarterly retail health GWP — ₹ Cr', seriesKeys: ['eq:retail'], insurers: [id], period: q.period },
        sourceNote: priceId !== id
          ? `Prices via ${p.label(priceId)} (the listed proxy for ${p.label(id)}); premium from GI Council standalone-quarter prints. The two series cover the same calendar window.`
          : 'Daily NSE closes against the GI Council standalone-quarter premium print for the same window.',
        score: 0, baseCr: q.retail,
      })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  12. OWNERSHIP ROTATION — who is entering and exiting the register
// ─────────────────────────────────────────────────────────────────────────────

function ownershipRotation(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  // group the quarter's four holder-group moves into ONE register story
  const byCoPeriod = new Map<string, typeof p.ownership>()
  for (const row of p.ownership) {
    if (row.periodType !== 'quarterly' || row.changePp == null || row.current == null) continue
    const k = `${row.companyId}|${row.period}`
    byCoPeriod.set(k, [...(byCoPeriod.get(k) ?? []), row])
  }
  // holder-group history for streaks
  const history = new Map<string, { period: string; d: number }[]>()
  for (const row of p.ownership) {
    if (row.periodType !== 'quarterly' || row.changePp == null) continue
    const k = `${row.companyId}|${row.holderGroup}`
    history.set(k, [...(history.get(k) ?? []), { period: row.period, d: row.changePp }])
  }
  for (const list of history.values()) list.sort((a, b) => periodRankLoose(a.period) - periodRankLoose(b.period))

  for (const [k, rows] of byCoPeriod) {
    const [companyId, period] = k.split('|')
    if (periodRankLoose(period) < 25.5) continue
    const lead = [...rows].sort((a, b) => Math.abs(b.changePp as number) - Math.abs(a.changePp as number))[0]
    const d = lead.changePp as number
    if (Math.abs(d) < 0.6) continue
    const counter = [...rows]
      .filter((r) => Math.sign(r.changePp as number) === -Math.sign(d) && Math.abs(r.changePp as number) >= 0.3)
      .sort((a, b) => Math.abs(b.changePp as number) - Math.abs(a.changePp as number))[0]
    // streak for the lead holder
    const hist = history.get(`${companyId}|${lead.holderGroup}`) ?? []
    const idx = hist.findIndex((h) => h.period === period)
    let streak = 1
    for (let j = idx - 1; j >= 0; j--) {
      // consecutive filings only — a same-sign move across a filing gap doesn't extend the run
      const gap = periodRankLoose(hist[j + 1].period) - periodRankLoose(hist[j].period)
      const adjacent = gap > 0 && gap < 0.75
      if (adjacent && Math.sign(hist[j].d) === Math.sign(d) && Math.abs(hist[j].d) >= 0.1) streak++
      else break
    }
    const leadPrev = lead.previous ?? (lead.current as number) - d
    const vSlots: Record<string, number> = { cur: r2(lead.current as number), prev: r2(leadPrev), delta: r2(d), streak }
    const sSlots: Record<string, string> = { name: p.label(companyId), holder: lead.holderGroup }
    const evRows = [
      ev(companyId, `${lead.holderGroup} holding`, r2(lead.current as number), '%', period, AGGR, `${d > 0 ? '+' : ''}${r2(d)}pp in the quarter`),
      ev(companyId, `${lead.holderGroup} holding (prior quarter)`, r2(leadPrev), '%', period, AGGR, 'previous filing'),
    ]
    const methods = [
      stepPpDelta(`${lead.holderGroup} register move`, `${lead.holderGroup} holding`, companyId, period, 'prior quarter', lead.current as number, leadPrev, AGGR, 0.6, 'sentiment', '\\Delta_{own}'),
    ]
    if (counter) {
      const cd = counter.changePp as number
      const cPrev = counter.previous ?? (counter.current as number) - cd
      vSlots.counterCur = r2(counter.current as number)
      vSlots.counterDelta = r2(cd)
      sSlots.counterHolder = counter.holderGroup
      evRows.push(ev(companyId, `${counter.holderGroup} holding`, r2(counter.current as number), '%', period, AGGR, `${cd > 0 ? '+' : ''}${r2(cd)}pp — the other side of the trade`))
      methods.push(stepPpDelta(`${counter.holderGroup} counter-move`, `${counter.holderGroup} holding`, companyId, period, 'prior quarter', counter.current as number, cPrev, AGGR, 0.3, 'sentiment', '\\Delta_{ownx}'))
    }
    out.push({
      detector: 'ownership_rotation',
      id: `ownership-${companyId}-${period.replace(/\s/g, '').toLowerCase()}`,
      period, cadence: 'quarterly',
      category: 'management',
      insurers: [companyId],
      v: vSlots,
      s: sSlots,
      direction: d > 0 ? 'accumulating' : 'exiting',
      evidence: evRows,
      method: methods,
      chart: { type: 'timeseries', title: `${lead.holderGroup} holding — %`, seriesKeys: [`own:${lead.holderGroup}`], insurers: [companyId], period },
      sourceNote: 'Quarterly shareholding pattern as filed with the exchanges (via the ownership snapshot); changes are filing-to-filing moves in each holder group\'s stake.',
      score: 0, baseCr: 150,
    })
  }
  return out
}

/** loose rank for 'Q3 FY26' / 'FY26' labels (ownership rows carry spaces). */
function periodRankLoose(period: string): number {
  const fy = period.match(/FY\s?(\d{2})/i)
  if (!fy) return -1
  const year = Number(fy[1])
  const q = period.match(/Q\s?([1-4])/i)
  return q ? year - 0.5 + Number(q[1]) / 10 : year
}

// ─────────────────────────────────────────────────────────────────────────────
//  13. ANALYST REPRICING — target moves, dispersion, stale coverage
// ─────────────────────────────────────────────────────────────────────────────

/** ISO date → fiscal month label, e.g. 2026-05-14 → 'May FY27'. */
function fiscalMonthOf(iso: string): { label: string; key: number } {
  const y = Number(iso.slice(0, 4))
  const mo = Number(iso.slice(5, 7))
  const fy = mo >= 4 ? (y + 1) % 100 : y % 100
  const m = mo >= 4 ? mo - 3 : mo + 9
  return { label: monthLabel(fy, m), key: periodKey({ fy, m }) }
}

function analystRepricing(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  const byCo = new Map<string, typeof p.analystNotes>()
  for (const n of p.analystNotes) byCo.set(n.companyId, [...(byCo.get(n.companyId) ?? []), n])
  for (const [companyId, notes] of byCo) {
    // per-broker consecutive target revisions, then grouped by fiscal month —
    // several desks moving in the same window is ONE repricing story.
    interface Revision { broker: string; date: string; curT: number; prevT: number; move: number; rating: string | null; monthLabel: string; monthKey: number }
    const revisions: Revision[] = []
    const byBroker = new Map<string, typeof notes>()
    for (const n of notes) byBroker.set(n.broker, [...(byBroker.get(n.broker) ?? []), n])
    for (const [broker, bn] of byBroker) {
      for (let i = 1; i < bn.length; i++) {
        const prev = bn[i - 1], cur = bn[i]
        if (prev.targetPrice == null || cur.targetPrice == null || prev.targetPrice <= 0) continue
        const move = r1((cur.targetPrice / prev.targetPrice - 1) * 100)
        if (Math.abs(move) < 8) continue
        const fm = fiscalMonthOf(cur.reportDate)
        if (fm.key < MIN_M_KEY) continue
        revisions.push({ broker, date: cur.reportDate, curT: r1(cur.targetPrice), prevT: r1(prev.targetPrice), move, rating: cur.rating ?? null, monthLabel: fm.label, monthKey: fm.key })
      }
    }
    const byMonth = new Map<string, Revision[]>()
    for (const r of revisions) byMonth.set(r.monthLabel, [...(byMonth.get(r.monthLabel) ?? []), r])
    for (const [month, revs] of byMonth) {
      const sorted = revs.sort((a, b) => Math.abs(b.move) - Math.abs(a.move)).slice(0, 3)
      const lead = sorted[0]
      const ups = sorted.filter((r) => r.move > 0).length
      const downs = sorted.length - ups
      const direction = sorted.length === 1
        ? (lead.move > 0 ? 'raised' : 'cut')
        : ups && downs ? 'split' : ups ? 'pack_up' : 'pack_down'
      const vSlots: Record<string, number> = { curT: lead.curT, prevT: lead.prevT, move: lead.move, n: sorted.length }
      const sSlots: Record<string, string> = { name: p.label(companyId), broker: lead.broker, rating: lead.rating ?? 'n/a', date: lead.date }
      if (sorted[1]) { vSlots.move2 = sorted[1].move; vSlots.curT2 = sorted[1].curT; sSlots.broker2 = sorted[1].broker }
      out.push({
        detector: 'analyst_reprice',
        id: `analyst-reprice-${companyId}-${month.replace(/\s/g, '').toLowerCase()}`,
        period: month, cadence: 'monthly',
        category: 'valuation',
        insurers: [companyId],
        v: vSlots,
        s: sSlots,
        direction,
        evidence: sorted.flatMap((r, i) => [
          ev(companyId, `${r.broker} target price`, r.curT, '₹', month, BRKR, `${r.rating ?? ''} · dated ${r.date}`.trim()),
          ev(companyId, `${r.broker} prior target price`, r.prevT, '₹', fiscalMonthOf(r.date).label, BRKR, `revision ${r.move > 0 ? '+' : ''}${r.move}%${i === 0 ? '' : ' · same window'}`),
        ]),
        method: sorted.map((r, i) => ({
          key: 'yoy_growth' as const, lens: 'sentiment' as const,
          name: `Same-broker target revision (${r.broker})`, refTag: 'Revision momentum',
          gloss: 'The percentage move between the same broker\'s consecutive published targets — revision direction, not level, is the signal.',
          formulaTeX: String.raw`g = \left(\frac{x_{1}}{x_{0}} - 1\right)\times 100`,
          instanceTeX: String.raw`g = \left(\frac{${r.curT}}{${r.prevT}} - 1\right)\times 100 = ${r.move}\%`,
          inputs: [
            { symbol: 'x_1', label: `new target (${r.broker})`, value: r.curT, unit: '₹', insurer: companyId, period: month, layer: BRKR },
            { symbol: 'x_0', label: `prior target (${r.broker})`, value: r.prevT, unit: '₹', insurer: companyId, period: month, layer: BRKR },
          ],
          statistic: { symbol: `g_{tgt${i + 1}}`, value: r.move, unit: '%' },
        })),
        chart: { type: 'ranking_bar', title: 'Live broker targets — the desk ladder (₹)', seriesKeys: ['an:targets_by_broker'], insurers: [companyId], period: month },
        sourceNote: 'Dated broker research from the coverage snapshot; each revision compares the same broker\'s consecutive notes, attributed as analyst opinion (never a house view).',
        score: 0, baseCr: 120,
      })
    }
    // dispersion of live targets (latest note per broker)
    const latest = [...byBroker.values()].map((bn) => bn[bn.length - 1]).filter((n) => n.targetPrice != null)
    if (latest.length >= 4) {
      const ts = latest.map((n) => n.targetPrice as number)
      const hi = Math.max(...ts), lo = Math.min(...ts)
      const mu = r1(mean(ts))
      const disp = r1(((hi - lo) / mu) * 100)
      const newest = latest.reduce((a, b) => (a.reportDate > b.reportDate ? a : b))
      const fm = fiscalMonthOf(newest.reportDate)
      if (disp >= 35 && fm.key >= MIN_M_KEY) {
        out.push({
          detector: 'analyst_dispersion',
          id: `analyst-dispersion-${companyId}-${newest.reportDate}`,
          period: fm.label, cadence: 'monthly',
          category: 'valuation',
          insurers: [companyId],
          v: { hi: r1(hi), lo: r1(lo), mu, disp, n: latest.length },
          s: { name: p.label(companyId) },
          direction: 'wide',
          evidence: [
            ev(companyId, 'Target dispersion (high−low over mean)', disp, '%', fm.label, BRKR, `${latest.length} live broker targets`),
            ev(companyId, 'Highest live target', r1(hi), '₹', fm.label, BRKR, 'most bullish desk'),
            ev(companyId, 'Lowest live target', r1(lo), '₹', fm.label, BRKR, 'most bearish desk'),
            ev(companyId, 'Mean live target', mu, '₹', fm.label, BRKR, `across ${latest.length} brokers`),
          ],
          method: [{
            key: 'dispersion_pct', lens: 'sentiment',
            name: 'Consensus dispersion', refTag: 'Disagreement gauge',
            gloss: 'The spread between the most bullish and most bearish live targets, scaled by the mean — wide dispersion means the Street has not settled the story.',
            formulaTeX: String.raw`D = \frac{T_{hi}-T_{lo}}{\bar{T}}\times 100`,
            instanceTeX: String.raw`D = \frac{${r1(hi)}-${r1(lo)}}{${mu}}\times 100 = ${disp}\%`,
            inputs: [
              { symbol: 'T_{hi}', label: 'highest target', value: r1(hi), unit: '₹', insurer: companyId, period: fm.label, layer: BRKR },
              { symbol: 'T_{lo}', label: 'lowest target', value: r1(lo), unit: '₹', insurer: companyId, period: fm.label, layer: BRKR },
              { symbol: '\\bar{T}', label: 'mean target', value: mu, unit: '₹', insurer: companyId, period: fm.label, layer: BRKR },
            ],
            statistic: { symbol: 'D', value: disp, unit: '%' },
            threshold: { rule: 'D ≥ 35% flags', value: 35, passed: disp >= 35 },
          }],
          chart: { type: 'ranking_bar', title: 'Live broker targets — the desk ladder (₹)', seriesKeys: ['an:targets_by_broker'], insurers: [companyId], period: fm.label },
          sourceNote: 'Latest note per covering broker from the dated coverage snapshot; dispersion uses only live targets, attributed as analyst opinion.',
          score: 0, baseCr: 120,
        })
      }
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  14. CHANNEL SHIFTS — distribution mix moving under the premium line
// ─────────────────────────────────────────────────────────────────────────────

const CHANNELS = [
  { key: 'banca' as const, label: 'Bancassurance' },
  { key: 'broker' as const, label: 'Brokers' },
  { key: 'agent' as const, label: 'Individual agents' },
  { key: 'corporateAgent' as const, label: 'Corporate agents (non-bank)' },
  { key: 'direct' as const, label: 'Direct business' },
]

/** cumulative label → the quarter-end period it becomes obvious at */
function channelPeriodLabel(row: { period: string; fy: number; monthsCovered: number }): { label: string; cadence: 'annual' | 'quarterly' } {
  if (row.monthsCovered === 12) return { label: `FY${row.fy}`, cadence: 'annual' }
  const q = row.monthsCovered / 3
  return { label: quarterLabel(row.fy, q as 1 | 2 | 3), cadence: 'quarterly' }
}

function channelShift(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  const byCo = new Map<string, typeof p.channel>()
  for (const r of p.channel) byCo.set(r.companyId, [...(byCo.get(r.companyId) ?? []), r])
  for (const [companyId, rows] of byCo) {
    for (const row of rows) {
      if (row.fy < 25) continue
      const prev = rows.find((x) => x.fy === row.fy - 1 && x.monthsCovered === row.monthsCovered)
      if (!prev) continue
      // all channels that moved — one rewiring story per disclosure window
      const movers = CHANNELS
        .map((ch) => {
          const cur = row[ch.key], was = prev[ch.key]
          if (cur == null || was == null) return null
          const d = r2(cur - was)
          return Math.abs(d) >= 2.5 ? { ch, cur: r2(cur), was: r2(was), d } : null
        })
        .filter((x): x is NonNullable<typeof x> => x != null)
        .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      if (!movers.length) continue
      const lead = movers[0]
      const second = movers.find((x) => Math.sign(x.d) === -Math.sign(lead.d)) // the true offset, if any
      const { label, cadence } = channelPeriodLabel(row)
      const basisNote = row.monthsCovered === 12 ? 'full-year mix' : `${row.monthsCovered}-month cumulative mix (${row.period})`
      const vSlots: Record<string, number> = { cur: lead.cur, prev: lead.was, delta: lead.d }
      const sSlots: Record<string, string> = { name: p.label(companyId), channel: lead.ch.label, basisNote, prevPeriod: prev.period }
      if (second) { vSlots.cur2 = second.cur; vSlots.delta2 = second.d; sSlots.channel2 = second.ch.label }
      out.push({
        detector: 'channel_shift',
        id: `channel-shift-${companyId}-${row.period.toLowerCase()}`,
        period: label, cadence,
        category: 'quality',
        insurers: [companyId],
        v: vSlots,
        s: sSlots,
        direction: lead.d > 0 ? 'rising' : 'falling',
        evidence: [
          ev(companyId, `${lead.ch.label} share of channel mix`, lead.cur, '%', label, STAT, `${lead.d > 0 ? '+' : ''}${lead.d}pp vs ${prev.period} · ${basisNote}`),
          ev(companyId, `${lead.ch.label} share (prior year, same basis)`, lead.was, '%', prev.period, STAT, prev.period),
          ...(second ? [ev(companyId, `${second.ch.label} share of channel mix`, second.cur, '%', label, STAT, `${second.d > 0 ? '+' : ''}${second.d}pp — the offsetting move`)] : []),
        ],
        method: [
          stepPpDelta(`${lead.ch.label} mix shift`, `${lead.ch.label} share of GWP`, companyId, label, prev.period, lead.cur, lead.was, STAT, 2.5, 'fundamental', '\\Delta_{ch}'),
          ...(second ? [stepPpDelta(`${second.ch.label} mix shift`, `${second.ch.label} share of GWP`, companyId, label, prev.period, second.cur, second.was, STAT, 2.5, 'fundamental', '\\Delta_{chx}')] : []),
        ],
        chart: { type: 'timeseries', title: `${lead.ch.label} share of GWP — full-year trend %`, seriesKeys: [`ch:${lead.ch.key}`], insurers: [companyId], period: label },
        sourceNote: `Channel mix from IRDAI business-acquisition disclosures (NL-36/NL-40); the comparison holds the basis fixed — ${basisNote} against the same window a year earlier.`,
        score: 0, baseCr: 300,
      })
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  15. INDUSTRY TIDE — health's share of general insurance keeps compounding
// ─────────────────────────────────────────────────────────────────────────────

function industryTide(p: MarketPanel): Finding[] {
  const out: Finding[] = []
  const rows = p.industryFy.filter((r) => r.healthShare != null)
  if (rows.length < 3) return out
  const last = rows[rows.length - 1]
  if (last.fy < MIN_FY) return out
  const prev = rows[rows.length - 2]
  const d = r2((last.healthShare as number) - (prev.healthShare as number))
  // streak = number of consecutive ADJACENT-year rises ending at the newest
  // print (a rise across a missing fiscal year never extends the run)
  let streak = 0
  for (let i = rows.length - 1; i > 0; i--) {
    const adjacent = rows[i].fy === rows[i - 1].fy + 1
    if (adjacent && (rows[i].healthShare as number) > (rows[i - 1].healthShare as number)) streak++
    else break
  }
  if (Math.abs(d) < 0.5 && streak < 4) return out
  if (streak < 1) return out
  const healthG = prev.health != null && prev.health > 0 && last.health != null ? r1((last.health / prev.health - 1) * 100) : null
  const motorG = prev.motor != null && prev.motor > 0 && last.motor != null ? r1((last.motor / prev.motor - 1) * 100) : null
  const vSlots: Record<string, number> = { cur: r2(last.healthShare as number), prev: r2(prev.healthShare as number), delta: d, streak }
  if (healthG != null) vSlots.healthG = healthG
  if (motorG != null) vSlots.motorG = motorG
  if (last.health != null) vSlots.healthCr = Math.round(last.health)
  out.push({
    detector: 'industry_tide',
    id: `industry-tide-${last.period.toLowerCase()}`,
    period: last.period, cadence: 'annual',
    category: 'market_structure',
    insurers: [],
    v: vSlots,
    s: { prevPeriod: prev.period },
    direction: d >= 0 ? 'health_rising' : 'health_stalling',
    evidence: [
      ev('INDUSTRY', 'Health share of GI premium', r2(last.healthShare as number), '%', last.period, STAT, `${d > 0 ? '+' : ''}${d}pp vs ${prev.period}`),
      ev('INDUSTRY', 'Health share of GI premium (prior year)', r2(prev.healthShare as number), '%', prev.period, STAT, 'prior fiscal year'),
      ...(healthG != null ? [ev('INDUSTRY', 'Industry health premium growth YoY', healthG, '%', last.period, STAT, 'health segment')] : []),
      ...(motorG != null ? [ev('INDUSTRY', 'Industry motor premium growth YoY', motorG, '%', last.period, STAT, 'motor segment')] : []),
    ],
    method: [
      stepPpDelta('Health share of GI premium', 'Health share of total GI premium', 'INDUSTRY', last.period, prev.period, last.healthShare as number, prev.healthShare as number, STAT, 0.5, 'macro', '\\Delta_{tide}'),
    ],
    chart: { type: 'timeseries', title: 'Health share of GI premium — %', seriesKeys: ['ind:health_share'], insurers: ['INDUSTRY'], period: last.period },
    sourceNote: 'Segment premium from the GI Council industry prints: health premium over total general-insurance premium, per fiscal year.',
    score: 0, baseCr: last.health ?? 1000,
  })
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  scoring + curation
// ─────────────────────────────────────────────────────────────────────────────

/** Family base scores — how much edge a detector's typical finding carries. */
const FAMILY_BASE: Record<string, number> = {
  basis_divergence: 74,
  price_fundamentals_gap: 72,
  valuation_dislocation: 70,
  seasonal_surprise_q: 62,
  share_shift_q: 58,
  mix_shift_q: 58,
  uw_economics: 60,
  solvency_runway: 62,
  monthly_momentum: 56,
  growth_inflection_q: 56,
  sahi_structure: 54,
  ownership_rotation: 52,
  analyst_reprice: 46,
  analyst_dispersion: 50,
  channel_shift: 52,
  entrant_ramp: 48,
  industry_tide: 50,
}

/** Magnitude bonus per family — normalized so one huge move ≈ +20. */
function magnitudeBonus(f: Finding): number {
  const v = f.v
  switch (f.detector) {
    case 'share_shift_q': return Math.min(Math.abs(v.delta) * 12, 20)
    case 'growth_inflection_q': return Math.min(Math.abs(v.accel) / 2.5, 20)
    case 'mix_shift_q': return Math.min(Math.abs(v.delta) * 2, 20)
    case 'seasonal_surprise_q': return Math.min(Math.abs(v.z) * 6, 20)
    case 'monthly_momentum': return Math.min(Math.abs(v.shift) / 1.5, 20)
    case 'sahi_structure': return Math.min(Math.abs(v.delta) * 10 + v.streak * 2, 22)
    case 'uw_economics': return Math.min(Math.abs(v.dCR) * 2 + (f.direction.startsWith('crossed') ? 10 : 0), 24)
    case 'basis_divergence': return Math.min(v.gap / 5 + (f.direction === 'sign_flip' ? 10 : 0), 24)
    case 'solvency_runway': return Math.min((3.5 - v.t) * 8, 22)
    case 'valuation_dislocation': return Math.min(Math.abs(v.gapPp), 22)
    case 'price_fundamentals_gap': return Math.min((Math.abs(v.ret) + Math.abs(v.retailG)) / 3, 22)
    case 'ownership_rotation': return Math.min(Math.abs(v.delta) * 6 + v.streak * 2, 20)
    case 'analyst_reprice': return Math.min(Math.abs(v.move) / 2, 16)
    case 'analyst_dispersion': return Math.min(v.disp / 5, 16)
    case 'channel_shift': return Math.min(Math.abs(v.delta) * 2, 18)
    case 'entrant_ramp': return Math.min(v.g / 25, 16)
    case 'industry_tide': return Math.min(Math.abs(v.delta) * 8 + v.streak, 18)
    default: return 0
  }
}

/** Materiality bonus: bigger books matter more (log scale, ≈+0 at ₹100cr, +12 at ₹10k cr). */
const materialityBonus = (baseCr: number) => Math.max(0, Math.min(Math.log10(Math.max(baseCr, 1) / 100) * 6, 12))

/** Recency bonus: the newest periods lead the feed. */
function recencyBonus(f: Finding, newestKey: number): number {
  const key = keyOfPeriod(f.period)
  if (key < 0) return 0
  const distance = Math.max(0, newestKey - key)
  return Math.max(0, 8 - distance * 8)
}

/** period label → chronological key (mirrors sourceMap.periodRank incl. months). */
export function keyOfPeriod(period: string): number {
  const fy = period.match(/FY\s?(\d{2})/i)
  if (!fy) return -1
  const year = Number(fy[1])
  const q = period.match(/Q\s?([1-4])/i)
  if (q) return year - 0.5 + Number(q[1]) / 10
  const mIdx = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].findIndex((m) => period.startsWith(m))
  if (mIdx >= 0) return year - 0.5 + (mIdx + 1) / 31
  return year
}

export interface RunOptions {
  /** max findings kept per period label (default 7) */
  perPeriodCap?: number
  /** max findings overall (default 64) */
  totalCap?: number
}

/** Per-family caps so one prolific detector never crowds the feed. */
const FAMILY_CAP: Record<string, number> = {
  monthly_momentum: 6, growth_inflection_q: 8, share_shift_q: 8, mix_shift_q: 6,
  seasonal_surprise_q: 6, uw_economics: 8, ownership_rotation: 5, analyst_reprice: 4,
  analyst_dispersion: 2, basis_divergence: 4, channel_shift: 5, sahi_structure: 4,
  entrant_ramp: 2, solvency_runway: 3, valuation_dislocation: 3, price_fundamentals_gap: 4,
  industry_tide: 2,
}

export function runDetectors(panel?: MarketPanel, opts: RunOptions = {}): Finding[] {
  const p = panel ?? buildMarketPanel()
  const perPeriodCap = opts.perPeriodCap ?? 7
  const totalCap = opts.totalCap ?? 64

  const all: Finding[] = [
    ...shareShiftQ(p), ...growthInflectionQ(p), ...mixShiftQ(p), ...seasonalSurpriseQ(p),
    ...monthlyMomentum(p), ...sahiStructure(p), ...uwEconomics(), ...basisDivergence(),
    ...solvencyRunway(p), ...valuationDislocation(p), ...priceFundamentalsGap(p),
    ...ownershipRotation(p), ...analystRepricing(p), ...channelShift(p), ...industryTide(p),
  ]

  const newestKey = Math.max(...all.map((f) => keyOfPeriod(f.period)), 0)
  for (const f of all) {
    const raw = (FAMILY_BASE[f.detector] ?? 50) + magnitudeBonus(f) + materialityBonus(f.baseCr) + recencyBonus(f, newestKey)
    // Relevance preference (specialist feedback, committed): >1 surfaces a
    // pattern more, <1 less. Neutral (1.0) until real ratings are folded in.
    f.score = Math.round(raw * preferenceWeight(f.detector, f.insurers))
  }

  // per (detector, insurer): keep the strongest finding per fiscal year so one
  // persistent condition doesn't flood the rail with near-identical cards.
  const byThread = new Map<string, Finding[]>()
  for (const f of all) {
    const fy = (f.period.match(/FY\s?(\d{2})/i) ?? [])[1] ?? 'x'
    const k = `${f.detector}|${f.insurers.join(',')}|${f.evidence[0]?.insurer ?? ''}|${fy}|${f.s.holder ?? ''}|${f.s.channel ?? ''}|${f.s.basis ?? ''}`
    byThread.set(k, [...(byThread.get(k) ?? []), f])
  }
  let kept: Finding[] = []
  for (const thread of byThread.values()) {
    const sorted = thread.sort((a, b) => b.score - a.score)
    // overlapping monthly windows are ONE story — a single print per FY; other
    // detectors may track a story across at most two prints per FY.
    const cap = sorted[0]?.detector === 'monthly_momentum' ? 1 : 2
    kept.push(...sorted.slice(0, cap))
  }

  // per-family cap — strongest first
  const byFamily = new Map<string, Finding[]>()
  for (const f of kept) byFamily.set(f.detector, [...(byFamily.get(f.detector) ?? []), f])
  kept = [...byFamily.entries()].flatMap(([det, list]) =>
    list.sort((a, b) => b.score - a.score).slice(0, FAMILY_CAP[det] ?? 6))

  // per-period cap, then global cap — highest score wins, stable order after.
  const byPeriod = new Map<string, Finding[]>()
  for (const f of kept) byPeriod.set(f.period, [...(byPeriod.get(f.period) ?? []), f])
  kept = [...byPeriod.values()].flatMap((list) => list.sort((a, b) => b.score - a.score).slice(0, perPeriodCap))
  kept.sort((a, b) => keyOfPeriod(b.period) - keyOfPeriod(a.period) || b.score - a.score)
  return kept.slice(0, totalCap)
}
