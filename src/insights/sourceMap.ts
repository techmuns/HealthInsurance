// ---------------------------------------------------------------------------
//  Insights — SOURCE MAP & FRESHNESS (display-only, deterministic).
//
//  This module makes every insight *auditable from the card*: it answers
//  "where in the dashboard does this number live?" and "how fresh is it?" —
//  purely from fields already present on the committed insight (category,
//  evidence metrics, periods, provenance layers).
//
//  It NEVER fabricates a value or a period. It only:
//    • maps an insight to the dashboard tab/table it was drawn from, so the
//      card can offer a real "Go to source data" jump (section-level when a
//      finer cell anchor isn't wired — and it says so honestly), and
//    • reads the *actual* latest period the insight uses and labels it (FY26
//      when the insight genuinely uses FY26; FY25 when FY25 is the latest
//      source-backed value it has — never silently upgraded).
//
//  No scraper, generation, signal or audit-table logic is touched here.
// ---------------------------------------------------------------------------

import type { Insight, InsightCategory, ProvenanceLayer } from './types'
import { buildFocus, priorFyLabel, type InsightFocus } from './insightFocus'

/** The dashboard's top-level pages (mirrors HeaderSwitcher's TopPage, kept local
 *  so this display map doesn't import a component). */
export type NavPage = 'industry' | 'sahi' | 'audit' | 'insights'

/** How precisely an insight maps onto the Data Audit verification layer. */
export type AuditMappingStatus = 'exact_cell' | 'audit_row' | 'chart_fallback' | 'pending'

/** A Data-Audit landing target — the company/metric/year cell to verify against. */
export interface AuditFocus {
  company?: string // audit company id
  companyLabel?: string
  metricKey?: string // AUDIT_METRICS key
  metricLabel?: string // audit metric label
  year?: string // FY label (audit column)
  valueLabel?: string // formatted value used by the insight
  status: AuditMappingStatus
  /** Preferred Data Audit tab (sheet) to land on when a metric lives on more than
   *  one — so the tag's label and its click destination always agree. */
  preferSheet?: string
  /** Non-intrusive note shown on arrival — e.g. the "nearest section" fallback. */
  note?: string
}

/** Where the "Go to source" button should land the reader. Data-Audit first
 *  (the real verification layer); the chart is only the fallback. */
export interface NavTarget {
  page: NavPage
  /** SAHI sub-tab id when page === 'sahi' (e.g. 'profitability'). */
  sahiTab?: string
  /** Company id to highlight on arrival, so the row reads pre-selected. */
  company?: string
  /** Data-Audit focus when page === 'audit'. */
  audit?: AuditFocus
  /** Insight-linked chart context — when present, the destination section shows a
   *  premium highlight (spotlight + connector + delta pill + pinned callout) that
   *  visually explains the exact comparison the insight referenced. */
  focus?: InsightFocus
}

/** A compact, pre-navigation read of the data behind an insight. */
export interface SourcePreview {
  metric: string
  companyLabel: string
  period: string
  valueLabel: string
  sourceType: string // 'Annual Report' / 'IRDAI filing' / 'Broker report' / …
  confidence: 'High' | 'Medium' | 'Low' | 'Pending'
  auditStatus: AuditMappingStatus
  auditStatusLabel: string // 'Exact audit cell available' / 'Audit row available' / …
}

/** A resolved location for one insight — what the audit view shows + jumps to. */
export interface SourceLocation {
  /** Human breadcrumb, e.g. ['Data Audit', 'Combined ratio', 'FY25']. */
  breadcrumb: string[]
  /** The tab/area leaf, e.g. 'Data Audit' or 'Profitability'. */
  area: string
  /** The specific table/section within the area. */
  table: string
  /** Where the jump button navigates. */
  target: NavTarget
  /** How precisely we can point. */
  precision: 'cell' | 'table' | 'section'
  /** Honest one-liner about cell-level mapping (never faked). */
  cellStatus: string
  /** Plain-English provenance, e.g. 'IRDAI statutory filings & annual reports'. */
  provenance: string
  /** The action label — 'Go to Data Audit' when audit-mapped, else 'Go to Chart'. */
  buttonLabel: string
  /** The audit-mapping status (drives the preview + button). */
  auditStatus: AuditMappingStatus
  /** The compact data read shown before navigation. */
  preview: SourcePreview
}

// ── period ranking & freshness ───────────────────────────────────────────────

/** Numeric recency rank for a period label. Higher = more recent.
 *  FY26 → 26 ; FY25 → 25 ; a Q4 FYxx print ranks just under the full FYxx year
 *  (the audited annual is the canonical full-year figure). Unknown → -1. */
export function periodRank(period: string): number {
  const fy = period.match(/FY\s?(\d{2})/i)
  if (!fy) return -1
  const year = Number(fy[1])
  const q = period.match(/Q\s?([1-4])/i)
  return q ? year - 0.5 + Number(q[1]) / 10 : year
}

/** The most recent period the insight actually uses (across its evidence). */
export function latestPeriodOf(ins: Insight): string {
  const periods = ins.evidence.map((e) => e.period).filter(Boolean)
  if (periods.length === 0) return ins.chart?.period ?? ''
  return periods.reduce((best, p) => (periodRank(p) > periodRank(best) ? p : best), periods[0])
}

/** The most recent period present anywhere across the supplied insights. */
export function latestPeriodAcross(insights: Insight[]): string {
  const periods = insights.map(latestPeriodOf).filter((p): p is string => Boolean(p))
  // Seed the reduce from the real periods only (not a hardcoded 'FY25'), so a
  // period that doesn't exist can never be reported as the latest. Fall back to
  // 'FY25' only when there are genuinely no dated insights at all.
  if (!periods.length) return 'FY25'
  return periods.reduce((best, p) => (periodRank(p) > periodRank(best) ? p : best))
}

export interface Freshness {
  /** The actual latest period the insight is built on (e.g. 'FY26' or 'FY25'). */
  period: string
  /** True when that equals the newest period available across the run. */
  isLatest: boolean
  /** Compact chip text for the card front, e.g. 'Based on FY26 data'. */
  shortLabel: string
  /** Honest, fuller sentence for the audit view. */
  detail: string
  tone: 'fresh' | 'older'
}

/**
 * Honest freshness read for one insight, compared against the run's newest
 * period. Never claims a newer figure exists for *this* metric — only states the
 * basis it actually uses and, when that trails the run, says so plainly.
 */
export function freshnessOf(ins: Insight, panelLatest: string): Freshness {
  const period = latestPeriodOf(ins)
  const isLatest = periodRank(period) >= periodRank(panelLatest)
  return {
    period,
    isLatest,
    shortLabel: `Based on ${period} data`,
    detail: isLatest
      ? `Built on ${period} — the latest period in this run.`
      : `Built on ${period}: the latest source-backed value for this metric. A newer period (${panelLatest}) exists elsewhere in the dashboard but isn't reflected in this insight yet.`,
    tone: isLatest ? 'fresh' : 'older',
  }
}

// ── provenance phrasing ──────────────────────────────────────────────────────

const LAYER_PHRASE: Record<ProvenanceLayer, string> = {
  statutory: 'IRDAI statutory filings',
  annual_report: 'annual reports',
  ifrs: 'IFRS accounts',
  broker: 'broker notes',
  aggregator: 'market aggregators',
  exchange: 'exchange data',
  derived: 'derived metrics',
  manual: 'curated filings',
}

/** Plain-English provenance from the evidence layers (deduped, up to 3). */
export function provenancePhrase(ins: Insight): string {
  const words = [...new Set(ins.evidence.flatMap((e) => e.layers).map((l) => LAYER_PHRASE[l]))].filter(Boolean)
  if (words.length === 0) return 'dashboard data'
  const shown = words.slice(0, 3)
  return shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} & ${shown[shown.length - 1]}`
}

// ── the primary stat + plain labels ──────────────────────────────────────────

const COMPANY_LABEL: Record<string, string> = {
  'niva-bupa': 'Niva Bupa', 'star-health': 'Star Health', 'care-health': 'Care Health',
  'aditya-birla': 'Aditya Birla', 'manipalcigna': 'ManipalCigna', panel: 'Across the panel',
}
const pretty = (id?: string) => (id ? COMPANY_LABEL[id] ?? id : '—')
const fmtVal = (v: number | null | undefined, unit?: string): string =>
  v == null ? 'n/a' : unit === 'x' ? `${v}x` : unit === '%' || unit === 'pp' ? `${v}${unit}` : `${v} ${unit ?? ''}`.trim()

/** The evidence row the front leads with — the first with a value, else the first. */
function primaryStat(ins: Insight) {
  return ins.evidence.find((e) => e.value != null) ?? ins.evidence[0]
}
const primaryMetric = (ins: Insight): string => primaryStat(ins)?.metric ?? ''

const SOURCE_TYPE: Record<ProvenanceLayer, string> = {
  statutory: 'IRDAI filing', annual_report: 'Annual Report', ifrs: 'IFRS / Ind AS accounts',
  broker: 'Broker report', aggregator: 'Market aggregator', exchange: 'Exchange data',
  derived: 'Derived metric', manual: 'Curated filing',
}
const sourceTypeOf = (layers?: ProvenanceLayer[]): string => (layers && layers[0] ? SOURCE_TYPE[layers[0]] : 'Source pending')
const confidenceOf = (layers?: ProvenanceLayer[]): SourcePreview['confidence'] => {
  const l = layers?.[0]
  if (!l) return 'Pending'
  if (l === 'statutory' || l === 'annual_report' || l === 'ifrs' || l === 'exchange') return 'High'
  if (l === 'derived') return 'Low'
  return 'Medium'
}

// ── Data-Audit mapping ───────────────────────────────────────────────────────
//
//  Mirrors the Data Audit grid taxonomy (AUDIT_COMPANIES / AUDIT_YEARS /
//  AUDIT_METRICS in src/lib/auditGrid.ts) as light constants, so the insight tab
//  can route to the verification layer WITHOUT pulling the heavy audit index into
//  its bundle. Keep in sync if the audit metric set changes.

const AUDIT_COMPANY_IDS = new Set(['niva-bupa', 'star-health', 'care-health', 'aditya-birla', 'manipalcigna'])
const AUDIT_YEARS = new Set(['FY22', 'FY23', 'FY24', 'FY25', 'FY26'])
// Order matters — the first matching rule wins, so the most specific phrases come
// first. Each `key` is a REAL audit-grid metricId (see the extracted-data-audit
// index), so a resolved metric lands on an actual, pulseable cell.
const AUDIT_METRIC_RULES: { test: RegExp; key: string; label: string }[] = [
  { test: /combined ratio/i, key: 'combined_ratio_igaap', label: 'Combined ratio' },
  { test: /claims ratio/i, key: 'claims_ratio_igaap', label: 'Claims ratio' },
  { test: /commission ratio/i, key: 'commission_ratio_igaap', label: 'Commission ratio' },
  { test: /expense ratio|expense of management|\beom\b/i, key: 'expense_ratio_igaap', label: 'Expense ratio' },
  { test: /solvency/i, key: 'solvency_ratio', label: 'Solvency ratio' },
  { test: /\broe\b|return on equity/i, key: 'roe_igaap', label: 'Return on equity' },
  { test: /net worth/i, key: 'net_worth', label: 'Net worth' },
  { test: /\bpat\b|profit after tax|net profit/i, key: 'pat_igaap', label: 'PAT' },
  { test: /investment (aum|book|assets)|\baum\b/i, key: 'investment_aum', label: 'Investment AUM' },
  { test: /investment yield|\byield\b/i, key: 'investment_yield', label: 'Investment yield' },
  { test: /retail health (share|market share)|retail.*market share/i, key: 'retail_health_market_share', label: 'Retail health market share' },
  { test: /overall health (share|market share)|overall market share|share gain|market[- ]?share change/i, key: 'overall_health_market_share', label: 'Overall health market share' },
  { test: /segment share/i, key: 'sahi_segment_share', label: 'SAHI segment share' },
  { test: /retail health (gwp|premium)|retail premium|retail mix|retail[- ]?led|retail\s*\/\s*group|retail vs group|retail book/i, key: 'retail_health_gwp', label: 'Retail health GWP' },
  { test: /group (other )?(gwp|premium|mix)|group book/i, key: 'group_other_gwp', label: 'Group premium' },
  { test: /gi (council )?segment|premium pool|pool (shift|mix|share)|segment (premium|mix)|industry (premium|pool)|\bgdpi\b|non-life|general insurance/i, key: 'gi_segment_gross_premium', label: 'GI segment premium' },
  { test: /p\s*\/\s*gwp|price.?to.?gwp/i, key: 'price_to_gwp', label: 'Price / GWP' },
  { test: /p\s*\/\s*e\b|price.?to.?earnings|\bpe\b/i, key: 'pe_ifrs', label: 'Price / earnings' },
  { test: /p\s*\/\s*b\b|price.?to.?book|\bpb\b/i, key: 'pb_ifrs', label: 'Price / book' },
  { test: /market cap|market value|enterprise value|\bev\b/i, key: 'market_cap', label: 'Market cap' },
  { test: /\bnwp\b|net written/i, key: 'nwp', label: 'Net written premium (NWP)' },
  { test: /\bnep\b|net earned/i, key: 'nep', label: 'Net earned premium (NEP)' },
  { test: /channel|agency|bancass|distribution|\bagents?\b|individual agent/i, key: 'individual_agents_gwp', label: 'Agency / channel GWP' },
  // Analyst / broker research must land on the Analyst-coverage grid, NOT the
  // share-price row. Kept above the generic price rule so "consensus target" /
  // "price target" resolve here first.
  { test: /consensus|price target|target price|analyst|broker note|broker research|\bcoverage\b|rating|recommendation/i, key: 'analyst_target_price', label: 'Analyst coverage' },
  { test: /share price|stock price|\bprice\b|live quote|\bquote\b|\bcmp\b|52[- ]?week/i, key: 'close_price', label: 'Share price' },
  { test: /total gwp|gross written|gross direct|gwp growth|premium growth|written premium|premium engine|\bgwp\b|premium/i, key: 'total_gwp', label: 'Gross written premium' },
  { test: /settlement/i, key: 'settlement_ratio', label: 'Claim settlement ratio' },
  { test: /renewal/i, key: 'renewal_rate', label: 'Renewal rate' },
  { test: /retention/i, key: 'customer_retention', label: 'Customer retention' },
]

const AUDIT_STATUS_LABEL: Record<AuditMappingStatus, string> = {
  exact_cell: 'Exact audit cell available',
  audit_row: 'Audit row available',
  chart_fallback: 'Chart fallback only',
  pending: 'Source mapping pending',
}

// ── Data-Audit TAB naming (source tags name the tab, not the raw origin) ──────
//
//  A source tag on a chart should say WHERE in our own Data Audit the number can
//  be checked — e.g. "Industry Growth", "SAHIs comparison" — not the far-upstream
//  origin ("GI Council"). This maps each audited metric to its Data Audit tab (the
//  Excel sheet the AuditSpreadsheet mirrors) so the tag can (a) show the tab name
//  and (b) land the reader on that exact tab when clicked. The tab strings must
//  match the sheet names in the audit grid verbatim. Keep in sync if a sheet is
//  renamed or a metric moves tabs.

export const AUDIT_TAB_FOR_KEY: Record<string, string> = {
  gi_segment_gross_premium: 'Industry Growth',
  total_gwp: 'SAHIs comparison',
  retail_health_gwp: 'SAHIs comparison',
  group_other_gwp: 'SAHIs comparison',
  nwp: 'SAHIs comparison',
  nep: 'SAHIs comparison',
  pat_igaap: 'SAHIs comparison',
  combined_ratio_igaap: 'SAHIs comparison',
  claims_ratio_igaap: 'SAHIs comparison',
  expense_ratio_igaap: 'SAHIs comparison',
  commission_ratio_igaap: 'SAHIs comparison',
  solvency_ratio: 'SAHIs comparison',
  net_worth: 'SAHIs comparison',
  investment_aum: 'SAHIs comparison',
  investment_yield: 'SAHIs comparison',
  retail_health_market_share: 'SAHIs comparison',
  overall_health_market_share: 'SAHIs comparison',
  sahi_segment_share: 'SAHIs comparison',
  settlement_ratio: 'SAHIs comparison',
  renewal_rate: 'SAHIs comparison',
  customer_retention: 'SAHIs comparison',
  individual_agents_gwp: 'Channel Mix',
  roe_igaap: 'Comps',
  pe_ifrs: 'Comps',
  pb_ifrs: 'Comps',
  price_to_gwp: 'Comps',
  market_cap: 'Comps',
  analyst_target_price: 'Analyst coverage',
  close_price: 'Historical Stock Movement',
}

/** One short, plain-English line describing what each Data Audit tab holds — shown
 *  in the source-tag hover in place of a long provenance paragraph. */
export const AUDIT_TAB_BLURB: Record<string, string> = {
  'Industry Growth': "India's non-life premium by segment — the GI Council industry figures.",
  'SAHIs comparison': 'The standalone health insurers, financials side by side.',
  'FY26 GWP': "Each insurer's premium, quarter by quarter.",
  "Q1'26 GWP": "Each insurer's premium, month by month.",
  'Analyst coverage': 'Broker ratings and price targets for the stock.',
  Comps: 'Valuation multiples and market value across peers.',
  Captable: 'Who owns the company — the shareholding pattern.',
  'Channel Mix': "Premium split by how it's sold — agents, banks, direct.",
  'Historical Stock Movement': 'Daily share-price history from the exchange.',
}

export interface AuditTabInfo {
  /** The Data Audit tab (sheet) name, shown as the tag label. */
  tab: string
  /** Short, plain-English description of the tab, for the hover. */
  blurb?: string
}

/** Resolve a source tag's metric label to the Data Audit tab it verifies against.
 *  Returns undefined when the metric doesn't map onto an audited tab (e.g. a news
 *  feed), so the tag falls back to its plain source label. */
export function auditTabForMetric(metric?: string): AuditTabInfo | undefined {
  if (!metric) return undefined
  const rule = AUDIT_METRIC_RULES.find((r) => r.test.test(metric))
  if (!rule) return undefined
  const tab = AUDIT_TAB_FOR_KEY[rule.key]
  return tab ? { tab, blurb: AUDIT_TAB_BLURB[tab] } : undefined
}

/** Map an insight onto the Data Audit grid (company × metric × year). The richest
 *  precision wins: an exact cell when company + metric + year all resolve; an
 *  audit row when only the metric resolves; a chart fallback when the metric
 *  isn't in the audit set (valuation / analyst-coverage); pending when no data. */
export function resolveAuditTarget(ins: Insight): AuditFocus {
  const stat = primaryStat(ins)
  if (!stat) return { status: 'pending' }
  const rule = AUDIT_METRIC_RULES.find((r) => r.test.test(stat.metric))
  const company = AUDIT_COMPANY_IDS.has(stat.insurer) ? stat.insurer : undefined
  const year = AUDIT_YEARS.has(stat.period) ? stat.period : undefined
  const valueLabel = fmtVal(stat.value, stat.unit)
  if (!rule) return { status: 'chart_fallback', company, companyLabel: pretty(stat.insurer), valueLabel }
  const status: AuditMappingStatus = company && year ? 'exact_cell' : 'audit_row'
  return { status, company, companyLabel: pretty(stat.insurer), metricKey: rule.key, metricLabel: rule.label, year, valueLabel, preferSheet: AUDIT_TAB_FOR_KEY[rule.key] }
}

/**
 * Resolve a Data-Audit landing target from a dashboard SOURCE tag's own context
 * (company + metric + period) — used when a chart / table / KPI source tag routes
 * the reader into the audit layer. The richest precision wins: an exact cell when
 * company + metric + year all resolve; the metric row when only the metric maps;
 * a company-filtered section (with a note) when the metric isn't in the audit set.
 */
export function resolveAuditCell(args: { company?: string; metric?: string; year?: string; valueLabel?: string }): AuditFocus {
  const company = args.company && AUDIT_COMPANY_IDS.has(args.company) ? args.company : undefined
  const companyLabel = company ? pretty(company) : undefined
  const year = args.year && AUDIT_YEARS.has(args.year) ? args.year : undefined
  const rule = args.metric ? AUDIT_METRIC_RULES.find((r) => r.test.test(args.metric!)) : undefined
  if (!rule) {
    // No metric mapping — land on the nearest section (company-filtered when known).
    return {
      status: 'pending',
      company,
      companyLabel,
      valueLabel: args.valueLabel,
      note: 'Exact source mapping not found — showing the nearest Data Audit section.',
    }
  }
  const status: AuditMappingStatus = company && year ? 'exact_cell' : 'audit_row'
  return { status, company, companyLabel, metricKey: rule.key, metricLabel: rule.label, year, valueLabel: args.valueLabel, preferSheet: AUDIT_TAB_FOR_KEY[rule.key] }
}

/** The compact data read shown on the back BEFORE the user navigates. */
export function buildSourcePreview(ins: Insight): SourcePreview {
  const stat = primaryStat(ins)
  const audit = resolveAuditTarget(ins)
  return {
    metric: stat?.metric ?? '—',
    companyLabel: pretty(stat?.insurer),
    period: stat?.period ?? '—',
    valueLabel: fmtVal(stat?.value, stat?.unit),
    sourceType: sourceTypeOf(stat?.layers),
    confidence: confidenceOf(stat?.layers),
    auditStatus: audit.status,
    auditStatusLabel: AUDIT_STATUS_LABEL[audit.status],
  }
}

// ── chart fallback resolver (when the metric isn't in the Data Audit set) ──────

interface Dest { tab: string; area: string; table: string }

const TAB_LABEL: Record<string, string> = {
  companies: 'Companies',
  distribution: 'Premium & Distribution',
  profitability: 'Profitability',
  valuation: 'Valuation',
  'street-view': 'Street View',
  governance: 'Governance',
  'sector-news': 'Key Sectoral News',
}

const METRIC_RULES: { test: RegExp; dest: Dest }[] = [
  { test: /solvency|capital|raise[- ]?pressure|runway|headroom/i, dest: { tab: 'profitability', area: 'Profitability', table: 'Solvency & capital' } },
  { test: /combined ratio|underwriting|loss ratio|expense ratio/i, dest: { tab: 'profitability', area: 'Profitability', table: 'Combined ratio' } },
  { test: /p\/b|p\s?\/\s?gwp|warranted|\broe\b|cost of equity|\bcoe\b|valuation/i, dest: { tab: 'valuation', area: 'Valuation', table: 'P/B vs ROE' } },
  { test: /retail|group health|\bmix\b|channel|distribution|agency|bancass/i, dest: { tab: 'distribution', area: 'Premium & Distribution', table: 'Retail vs group mix' } },
  { test: /growth|\bgwp\b|premium|\bnwp\b|\bnep\b/i, dest: { tab: 'distribution', area: 'Premium & Distribution', table: 'Premium growth' } },
  { test: /guidance|consensus|target|analyst|coverage|dispersion/i, dest: { tab: 'street-view', area: 'Street View', table: 'Analyst targets & consensus' } },
  { test: /ownership|stake|holding|pledge|promoter|board|management/i, dest: { tab: 'governance', area: 'Governance', table: 'Ownership & management' } },
  { test: /regulat|irdai|policy|reform|sector/i, dest: { tab: 'sector-news', area: 'Key Sectoral News', table: 'Sector developments' } },
]

const CATEGORY_DEST: Record<InsightCategory, Dest> = {
  capital: { tab: 'profitability', area: 'Profitability', table: 'Solvency & capital' },
  earnings_quality: { tab: 'profitability', area: 'Profitability', table: 'Combined ratio' },
  valuation: { tab: 'valuation', area: 'Valuation', table: 'P/B vs ROE' },
  growth: { tab: 'distribution', area: 'Premium & Distribution', table: 'Premium growth' },
  quality: { tab: 'profitability', area: 'Profitability', table: 'Combined ratio' },
  management: { tab: 'street-view', area: 'Street View', table: 'Analyst targets & consensus' },
  regulatory: { tab: 'sector-news', area: 'Key Sectoral News', table: 'Sector developments' },
  market_structure: { tab: 'companies', area: 'Companies', table: 'Peer scoreboard' },
}

// Map an insight's primary metric to a canonical focus metric key, so a "Go to
// Chart" jump from an insight card also lands with the comparison spotlighted.
const FOCUS_METRIC_RULES: { test: RegExp; key: string }[] = [
  { test: /combined ratio/i, key: 'combined_ratio' },
  { test: /claims ratio/i, key: 'claims_ratio' },
  { test: /expense ratio/i, key: 'expense_ratio' },
  { test: /solvency/i, key: 'solvency_ratio' },
  { test: /\bpat\b|profit after tax/i, key: 'pat' },
  { test: /promoter|shareholding|ownership|\bholding\b/i, key: 'promoter_holding' },
  { test: /market share/i, key: 'market_share' },
  { test: /total gwp|gross written|\bgwp\b|premium growth|\bnwp\b|\bnep\b|premium/i, key: 'gwp' },
]

/** Build an InsightFocus for a chart-fallback jump — only when the insight's
 *  primary metric maps to a known chart metric AND that metric lives on the tab
 *  we're navigating to (so the highlight lands on the right chart). */
function focusForInsight(ins: Insight, destTab: string): InsightFocus | undefined {
  const stat = primaryStat(ins)
  if (!stat) return undefined
  const rule = FOCUS_METRIC_RULES.find((r) => r.test.test(stat.metric))
  if (!rule) return undefined
  const focus = buildFocus({
    id: `insight-${ins.id}`,
    metricKey: rule.key,
    company: AUDIT_COMPANY_IDS.has(stat.insurer) ? stat.insurer : undefined,
    companyLabel: pretty(stat.insurer),
    currentPeriod: /^FY\s?\d{2}$/i.test(stat.period) ? stat.period : undefined,
    comparisonPeriod: priorFyLabel(stat.period),
    insightLabel: ins.shortHeadline || ins.headline,
    origin: 'insight',
  })
  return focus && focus.sahiTab === destTab ? focus : undefined
}

/** Resolve where "Go to source" lands — Data Audit first (the verification
 *  layer), the dashboard chart only when the metric isn't audited. Deterministic;
 *  honest about exact-cell vs row vs fallback. */
export function resolveSource(ins: Insight): SourceLocation {
  const audit = resolveAuditTarget(ins)
  const preview = buildSourcePreview(ins)

  // Priority 1 & 2 — Data Audit (exact cell, else the metric row/section).
  if (audit.status === 'exact_cell' || audit.status === 'audit_row') {
    const exact = audit.status === 'exact_cell'
    return {
      breadcrumb: ['Data Audit', audit.metricLabel ?? 'Metric', audit.year ?? audit.companyLabel ?? ''].filter(Boolean) as string[],
      area: 'Data Audit',
      table: audit.metricLabel ?? 'Metric',
      target: { page: 'audit', company: audit.company, audit },
      precision: exact ? 'cell' : 'section',
      cellStatus: exact
        ? 'Exact audit cell available — opens Data Audit at this company, metric and year.'
        : 'Exact audit cell mapping pending — opens the Data Audit metric row to verify.',
      provenance: provenancePhrase(ins),
      buttonLabel: 'Go to Data Audit',
      auditStatus: audit.status,
      preview,
    }
  }

  // Priority 3 — the metric isn't in the Data Audit set; open the dashboard chart.
  const metric = primaryMetric(ins)
  const dest = METRIC_RULES.find((r) => r.test.test(metric))?.dest ?? CATEGORY_DEST[ins.category]
  const named = ins.affectedInsurers.filter((id) => id !== 'panel')
  return {
    breadcrumb: ['SAHI Analysis', TAB_LABEL[dest.tab] ?? dest.area, dest.table],
    area: dest.area,
    table: dest.table,
    target: { page: 'sahi', sahiTab: dest.tab, company: named[0], focus: focusForInsight(ins, dest.tab) },
    precision: 'table',
    cellStatus: 'Not in the Data Audit metric set — opens the dashboard chart for this metric.',
    provenance: provenancePhrase(ins),
    buttonLabel: 'Go to Chart',
    auditStatus: 'chart_fallback',
    preview,
  }
}
