// ---------------------------------------------------------------------------
//  Insight Engine — CHART SERIES resolver.
//
//  Binds the engine's chart keys to the same wide market panel the detectors
//  read, so a card's visual evidence always shows the exact series its numbers
//  came from. Key namespaces:
//    eq:*   discrete-quarter series   ('eq:total' | 'eq:retail' | 'eq:group'
//                                      | 'eq:share_retail' | 'eq:share_total')
//    em:*   single-month series       ('em:total' | 'em:retail')
//    ab:*   accounting-basis series   ('ab:cr_igaap' | 'ab:cr_ifrs'
//                                      | 'ab:pat_igaap' | 'ab:pat_ifrs' | 'ab:solvency')
//    own:*  holder-group series       ('own:FIIs' | 'own:DIIs' | 'own:Promoters' | 'own:Public')
//    ch:*   channel-mix series        ('ch:banca' | 'ch:broker' | 'ch:agent'
//                                      | 'ch:corporateAgent' | 'ch:direct')
//    ind:*  industry series           ('ind:health_share')
//    val:*  statutory valuation point ('val:pb' | 'val:roe' — scatter inputs)
//    an:targets_by_broker             (per-broker target ladder, one company)
//
//  Missing points stay null (charts skip them) — never a fake zero.
// ---------------------------------------------------------------------------

import { buildMarketPanel, quarterShare, exGovt, type SegRow } from './marketPanel'
import { getBasisProfit, getBasisSolvency, getStatutoryRoe, getNetWorth, ANNUAL_PERIODS } from '@/data/accountingBasis'

export interface SeriesPoint { fy: string; v: number | null }

const panel = () => buildMarketPanel()

export const isEngineKey = (key: string) => /^(eq|em|ab|own|ch|ind|an|val):/.test(key)

export const engineHas = (id: string): boolean => panel().entity(id) != null

export const engineLabel = (id: string): string => panel().label(id)

/** Trailing-window sizes keep the embedded charts readable. */
const Q_WINDOW = 9
const M_WINDOW = 14

export function engineSeries(id: string, key: string): SeriesPoint[] | null {
  const p = panel()
  const [ns, metric] = key.split(':', 2) as [string, string]

  if (ns === 'eq') {
    const e = p.entity(id)
    if (!e) return []
    if (metric === 'exgovt') {
      return e.quarters
        .map((q) => ({ fy: q.period, v: exGovt(q) }))
        .filter((x) => x.v != null)
        .slice(-Q_WINDOW)
    }
    if (metric === 'share_retail' || metric === 'share_total') {
      const field: keyof SegRow = metric === 'share_retail' ? 'retail' : 'total'
      return e.quarters
        .map((q) => ({ fy: q.period, v: quarterShare(p, id, q.fy, q.q, field) }))
        .filter((x) => x.v != null)
        .slice(-Q_WINDOW)
    }
    const field = (['total', 'retail', 'group', 'govt'].includes(metric) ? metric : 'total') as keyof SegRow
    return e.quarters
      .map((q) => ({ fy: q.period, v: q[field] == null ? null : Math.round((q[field] as number) * 10) / 10 }))
      .filter((x) => x.v != null)
      .slice(-Q_WINDOW)
  }

  if (ns === 'em') {
    const e = p.entity(id)
    if (!e) return []
    if (metric === 'exgovt') {
      return e.months
        .map((m) => ({ fy: m.period, v: exGovt(m) }))
        .filter((x) => x.v != null)
        .slice(-M_WINDOW)
    }
    const field = (['total', 'retail', 'group', 'govt'].includes(metric) ? metric : 'total') as keyof SegRow
    return e.months
      .map((m) => ({ fy: m.period, v: m[field] == null ? null : Math.round((m[field] as number) * 10) / 10 }))
      .filter((x) => x.v != null)
      .slice(-M_WINDOW)
  }

  if (ns === 'ab') {
    if (metric === 'solvency') {
      return ANNUAL_PERIODS.map((bp) => ({ fy: bp, v: getBasisSolvency(id, bp) })).filter((x) => x.v != null)
    }
    const basis = metric.endsWith('ifrs') ? 'ifrs' as const : 'igaap' as const
    const field = metric.startsWith('cr') ? 'combinedRatio' as const : 'pat' as const
    return ANNUAL_PERIODS
      .map((bp) => ({ fy: bp, v: getBasisProfit(id, basis, bp)?.[field] ?? null }))
      .filter((x) => x.v != null)
  }

  if (ns === 'own') {
    return p.ownership
      .filter((r) => r.companyId === id && r.periodType === 'quarterly' && r.holderGroup === metric && r.current != null)
      .map((r) => ({ fy: r.period, v: r.current }))
  }

  if (ns === 'ch') {
    const field = metric as 'banca' | 'broker' | 'agent' | 'corporateAgent' | 'direct'
    // full-year mix only — mixing 3/6/9-month cumulatives on one line would
    // blend bases; the annual series is the honest trend line.
    return p.channel
      .filter((r) => r.companyId === id && r.monthsCovered === 12 && r[field] != null)
      .map((r) => ({ fy: r.period, v: Math.round((r[field] as number) * 10) / 10 }))
  }

  if (ns === 'val') {
    // one point per company: the statutory-basis valuation scatter inputs —
    // market cap over statutory net worth, statutory ROE on the same equity.
    for (const bp of [...ANNUAL_PERIODS].reverse()) {
      const roe = getStatutoryRoe(id, bp)
      const nw = getNetWorth(id, bp)
      const mcap = p.valuation.find((r) => r.companyId === id)?.marketCap ?? null
      if (roe != null && nw != null && nw > 0 && mcap != null) {
        if (metric === 'roe') return [{ fy: bp, v: Math.round(roe * 10) / 10 }]
        if (metric === 'pb') return [{ fy: bp, v: Math.round((mcap / nw) * 100) / 100 }]
      }
    }
    return []
  }

  if (ns === 'ind') {
    if (metric === 'health_share') {
      return p.industryFy.filter((r) => r.healthShare != null).map((r) => ({ fy: r.period, v: r.healthShare }))
    }
    return []
  }

  return null // not an engine key — the caller falls back to the legacy panel
}

export function engineLatest(id: string, key: string): number | null {
  const s = engineSeries(id, key)
  if (!s || !s.length) return null
  for (let i = s.length - 1; i >= 0; i--) if (s[i].v != null) return s[i].v
  return null
}

/** The per-broker target ladder for one company (latest note per broker). */
export function brokerTargets(companyId: string): { broker: string; target: number; rating: string | null }[] {
  const p = panel()
  const latest = new Map<string, { broker: string; target: number; rating: string | null; date: string }>()
  for (const n of p.analystNotes) {
    if (n.companyId !== companyId || n.targetPrice == null) continue
    const prev = latest.get(n.broker)
    if (!prev || n.reportDate > prev.date) latest.set(n.broker, { broker: n.broker, target: n.targetPrice, rating: n.rating, date: n.reportDate })
  }
  return [...latest.values()]
    .map(({ broker, target, rating }) => ({ broker, target, rating }))
    .sort((a, b) => b.target - a.target)
}

/** The exact retail/group split for one entity at one quarter (for the
 *  quarterly decomposition chart). Falls back to the latest complete quarter. */
export function quarterMix(id: string, period?: string): { period: string; retail: number | null; group: number | null } | null {
  const e = panel().entity(id)
  if (!e) return null
  const complete = e.quarters.filter((q) => q.retail != null || q.group != null)
  const at = (period && complete.find((q) => q.period === period)) || complete[complete.length - 1]
  if (!at) return null
  return { period: at.period, retail: at.retail, group: at.group }
}
