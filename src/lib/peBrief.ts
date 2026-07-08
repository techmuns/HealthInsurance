// ---------------------------------------------------------------------------
//  PE-impact layer — turns a deduped conviction idea into a compact PE-useful
//  brief item:  Event → Status → Impact metric → Company exposure → Action.
//
//  This is the "daily PE alert layer", not a diligence memo: fewer words, more
//  value. Every field is derived from the real, source-backed signal — status
//  from the source/wording (a media report is never a "confirmed" rule), impact
//  from an insurance-metric map, exposure from the wired channel-mix / retail-mix
//  data (or an honest "Needs data"), confidence a SINGLE tier (no conflicting
//  numbers; syndicated echoes are not counted as independent). Nothing is
//  fabricated and precision is never invented (see CLAUDE.md).
//
//  It reads a ConvictionIdea (already deduped into one story per card by
//  derive.ts) so BOTH the PDF brief and the Pulse can share one logic.
// ---------------------------------------------------------------------------

import { isEvergreenReference, type ConvictionIdea } from '@/components/pulse/derive'
import type { Confidence, SignalImpact } from '@/insights/investorPulse'
import { getCompanyDistributionData } from '@/lib/distributionEngine'
import { insurers } from '@/data/mockData'

// A ConvictionIdea with the PE-layer fields guaranteed present (see `normalize`),
// so the derivation functions below never have to guard an optional field.
type PeIdea = ConvictionIdea & {
  impact: SignalImpact
  scope: 'company' | 'sector'
  companyId: string | null
  sourceUrl: string
  sourceConfidence: Confidence
  clusterSize: number
  clusterSources: NonNullable<ConvictionIdea['clusterSources']>
  independentSources: number
}

// ── Vocabulary ───────────────────────────────────────────────────────────────

export type PeStatus = 'Confirmed' | 'Final rule' | 'Draft expected' | 'Reported' | 'Low confidence' | 'Stale'
export type PeExposureLevel = 'High' | 'Medium' | 'Low' | 'Needs data'
// Practical next steps — the industry-briefing verb set.
export type PeActionVerb =
  | 'Verify official source'
  | 'Watch commission ratio' | 'Watch expense ratio' | 'Watch claims' | 'Watch pricing' | 'Watch distribution'
  | 'Track launch' | 'Check market share' | 'Check solvency' | 'Track management change'
  | 'Ignore'

export interface PeExposure { level: PeExposureLevel; basis: string }
export interface PeAction { verb: PeActionVerb; label: string }

export interface PeBriefItem {
  id: string
  headline: string
  entity: string
  /** The classified topic driving this item's metrics / exposure / action. */
  topic: Topic
  status: PeStatus
  statusHint: string
  /** Insurance metrics the event maps to — the "Impact:" chip list. */
  metrics: string[]
  /** One metric-linked impact sentence (replaces the generic "why it matters"). */
  impactLine: string
  exposure: PeExposure
  /** One PE read — near-term vs longer-term, in a single line. */
  peRead: string
  action: PeAction
  /** Event-matched things to watch next (distinct per event, never reused). */
  watchNext: string[]
  /** The grouped source cluster (deduped outlets for this one story). */
  sources: { name: string; url: string }[]
  /** "3 links · 2 independent sources" — flags syndication honestly. */
  sourceLabel: string
  /** ONE confidence per item (no conflicting numbers). */
  confidence: Confidence
  confidenceWhy: string
}

// ── small helpers ─────────────────────────────────────────────────────────────

const clampWords = (s: string, n: number): string => {
  const t = (s ?? '').trim()
  if (t.length <= n) return t
  const cut = t.slice(0, n - 1)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > n * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`
}
const firstSentence = (s: string): string => {
  const m = (s ?? '').match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : s ?? '').trim()
}
function domainOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, '') } catch { return '' }
}
const CONF_RANK: Record<Confidence, number> = { High: 3, Medium: 2, Low: 1 }
const capConfidence = (t: Confidence, max: Confidence): Confidence => (CONF_RANK[t] <= CONF_RANK[max] ? t : max)
const signOf = (i: SignalImpact): 'up' | 'down' | 'flat' => (i === 'Positive' ? 'up' : i === 'Neutral' ? 'flat' : 'down')

// Regulator / exchange / government primary hosts — the only sources that let a
// development read as officially "confirmed" or a "final rule".
function isOfficialSource(url: string): boolean {
  const h = domainOf(url)
  if (!h) return false
  return /(^|\.)irdai\.gov\.in$|(^|\.)sebi\.gov\.in$|pfrda|(^|\.)rbi\.org\.in$|\.gov\.in$|egazette|(^|\.)bseindia\.com$|(^|\.)nseindia\.com$/.test(h)
}

// ── Topic — the single classifier that drives metrics / exposure / read / action ─

export type Topic =
  | 'commission' | 'expense' | 'claims' | 'pricing' | 'solvency' | 'entry' | 'listing'
  | 'premium' | 'ownership' | 'management' | 'analyst' | 'market' | 'regulatory' | 'other'

// Scan the item's OWN headline + detail — NOT the lens-derived reasoning, which
// carries generic standing text (a solvency/combined-ratio line) that would
// otherwise mis-route a listings item to "claims" or an entry item to "pricing".
function itemText(idea: PeIdea): string {
  return `${idea.why.whatHappened} ${idea.why.whyItMatters}`.toLowerCase()
}

function topicOf(idea: PeIdea): Topic {
  const text = itemText(idea)
  const has = (re: RegExp) => re.test(text)
  // A new-insurer licence / registration is an ENTRY story first (competitive
  // intensity), even though the detail also mentions pricing or demand.
  if (has(/licen[cs]e|registration|new (standalone |player|entrant|insurer)|clears .* (entry|insurer|venture)|8th|eighth standalone/)) return 'entry'
  if (has(/\blisting\b|\bipo\b|go public|mandatory list|delist/)) return 'listing'
  if (idea.category === 'Regulatory') {
    if (has(/commission|intermediar|distributor|payout/)) return 'commission'
    if (has(/cashless|claim|hospital|\btpa\b|settlement/)) return 'claims'
    if (has(/expense|\beom\b|opex|cost ratio|management expense/)) return 'expense'
    if (has(/pricing|premium hike|repric|senior[-\s]?citizen|rate revision/)) return 'pricing'
    if (has(/solvency|capital adequacy|net worth/)) return 'solvency'
    return 'regulatory'
  }
  if (has(/block deal|bulk deal|\bstake\b|promoter|pledge|shareholding|open offer/)) return 'ownership'
  if (idea.category === 'Management') return 'management'
  if (idea.category === 'Analyst Action' || has(/rating|target price|initiat|upgrade|downgrade|coverage|re-?rat|valuation|\bp\/b\b|\bp\/e\b/)) return 'analyst'
  if (has(/premium|\bgwp\b|\bnwp\b|\bnep\b|growth|retail health|group health/)) return 'premium'
  if (idea.category === 'Data Movement') return 'market'
  return 'other'
}

// Health-industry relevance (#1 scope) — a motor / crop / marine-only general-
// insurance item that never touches a health book is off-scope and gets the
// "Ignore" action so it can be downranked, not dressed up as health news.
const OFF_HEALTH_RE = /\bmotor\b|third[-\s]?party|two[-\s]?wheeler|\bcrop\b|\bmarine\b|fire insurance|\bauto\b/i
// Health-SPECIFIC markers only (not "premium"/"insurer", which a motor item shares).
const HEALTH_RE = /health|medical|hospital|cashless|mediclaim|\bsahi\b|standalone health|retail health|group health|senior[-\s]?citizen/i
function isOffHealth(idea: PeIdea): boolean {
  const t = itemText(idea)
  return OFF_HEALTH_RE.test(t) && !HEALTH_RE.test(t)
}

// ── 1) Status (#2) — a media report is never a "confirmed" rule ────────────────

// A finalized / in-force artefact — the strongest completion signal.
const FINAL_RE =
  /\bnotified\b|final (rule|norm|regulation)|circular (issued|dated|no\.)|gazette|comes? into force|came into force|effective from|granted registration|received .{0,20}registration|registration (granted|approved)|board approved|approved by the board|cleared by/i
// A draft / consultation artefact actually exists (not mere speculation).
const DRAFT_RE = /\bdraft\b|exposure draft|consultation (paper|process)|proposed (norm|rule|regulation|amendment|framework|guideline)|proposes to|invites comments/i
// A completed non-rule corporate fact (results posted, appointment made, deal done).
const CONFIRM_RE = /\bannounced\b|\bdeclared\b|has (launched|appointed|acquired|completed|approved)|completes|posted? (a )?(profit|loss|\bq[1-4]\b|\bfy)|reported (its )?(\bq[1-4]\b|\bfy|results)/i
// Genuine speculation — the only thing that earns "Low confidence". A credible
// analyst note on a dead link is still a "Reported" item, never low-confidence.
const LOWCONF_RE = /rumou?r|speculat|unconfirmed|buzz|talk of|in talks|market chatter|could be|might be|said to be considering/i

function statusOfItem(idea: PeIdea): { status: PeStatus; hint: string } {
  const text = `${idea.why.whatHappened} ${idea.why.whyItMatters}`
  const official = isOfficialSource(idea.sourceUrl)
  const primaryish = official || idea.sourceConfidence === 'High'
  // A standing explainer / landing page discovered today is NOT news — it's stale
  // context, never a dated development (honesty: found-now ≠ happened-now).
  const evergreen = isEvergreenReference({ sourceUrl: idea.sourceUrl })
  let status: PeStatus
  if (FINAL_RE.test(text) && primaryish) status = idea.category === 'Regulatory' ? 'Final rule' : 'Confirmed'
  else if (DRAFT_RE.test(text)) status = 'Draft expected'
  else if (CONFIRM_RE.test(text) && (official || idea.sourceConfidence !== 'Low')) status = 'Confirmed'
  else if (evergreen && idea.freshness === 'existing') status = 'Stale'
  else if (LOWCONF_RE.test(text) || (idea.sourceConfidence === 'Low' && !idea.sourceUrl)) status = 'Low confidence'
  else status = 'Reported'

  const hint =
    status === 'Final rule' ? 'Notified / final — in force.'
    : status === 'Confirmed' ? (official ? 'Officially confirmed by a primary source.' : 'Reported as completed; not yet on the primary source.')
    : status === 'Draft expected' ? 'Draft / consultation stage — not yet final.'
    : status === 'Stale' ? 'Background / explainer page — discovered now, not new.'
    : status === 'Low confidence' ? 'Unverified / weak sourcing.'
    : 'Media report — not officially confirmed.'
  return { status, hint }
}

// ── 2) Metric map (#3) — event → insurance metrics ─────────────────────────────

const TOPIC_METRICS: Record<Topic, string[]> = {
  commission: ['Commission ratio', 'Expense ratio', 'Distribution mix'],
  expense: ['Expense ratio', 'Combined ratio'],
  claims: ['Claims ratio', 'Combined ratio'],
  pricing: ['Pricing', 'Claims ratio', 'Persistency'],
  solvency: ['Solvency', 'Capital'],
  entry: ['Market share', 'Distribution mix', 'Pricing'],
  listing: ['Valuation / re-rating', 'Capital', 'Free float'],
  premium: ['GWP growth', 'NWP / retention'],
  ownership: ['Ownership', 'Free float'],
  management: ['Execution risk'],
  analyst: ['Valuation / re-rating'],
  market: ['Share price', 'Valuation / re-rating'],
  regulatory: ['Compliance cost', 'Expense ratio'],
  other: [],
}
// Extra metrics mentioned explicitly in the text, even if off the topic default.
const METRIC_KEYWORDS: { re: RegExp; metric: string }[] = [
  { re: /commission/, metric: 'Commission ratio' },
  { re: /expense|\beom\b|opex/, metric: 'Expense ratio' },
  { re: /combined ratio/, metric: 'Combined ratio' },
  { re: /claim|cashless|loss ratio/, metric: 'Claims ratio' },
  { re: /solvency|capital adequacy/, metric: 'Solvency' },
  { re: /persistency|lapse|renewal|surrender/, metric: 'Persistency' },
  { re: /\bgwp\b|premium growth|top-?line/, metric: 'GWP growth' },
  { re: /\bnwp\b|retention|retained|reinsurance/, metric: 'NWP / retention' },
  { re: /\bnep\b|earned premium/, metric: 'NEP' },
  { re: /market share/, metric: 'Market share' },
  { re: /distribution|channel|banca|agenc|broker/, metric: 'Distribution mix' },
]
function metricsFor(idea: PeIdea, topic: Topic): string[] {
  const out: string[] = [...TOPIC_METRICS[topic]]
  const text = itemText(idea)
  for (const { re, metric } of METRIC_KEYWORDS) if (re.test(text) && !out.includes(metric)) out.push(metric)
  if (!out.length) out.push(idea.category === 'Regulatory' ? 'Compliance cost' : 'Valuation / re-rating')
  return out.slice(0, 4)
}

// ── 3) Impact line (#3) — metric-linked, never generic ─────────────────────────

function impactLineFor(idea: PeIdea, topic: Topic): string {
  const s = signOf(idea.impact)
  const M: Partial<Record<Topic, string>> = {
    commission: 'Lower payouts to agents and brokers squeeze what insurers spend to win business (the expense ratio). Claims costs are barely touched.',
    expense: 'Pushes running costs up, and with them the combined ratio — the number that shows whether the core business actually makes money.',
    claims: 'Changes how much insurers pay out on claims and how fast cashless approvals go through; the only offset is charging higher premiums.',
    pricing: 'Leaves less room to raise premiums, which feeds straight into claims cost, renewals and whether the core business is profitable.',
    solvency: 'Puts the spotlight on capital strength; how much the insurer can keep growing is the swing factor.',
    entry: 'A new rival means tougher competition — pressure on prices, on access to agents and branches, and on market share.',
    listing: 'This is about raising money and valuation, not day-to-day profit — it changes an insurer’s options to list or raise capital.',
    ownership: 'A change in who owns the shares — read it for a possible overhang or a vote of confidence, not for the fundamentals.',
    management: 'The real question is whether strategy and delivery stay on track under the new person; the numbers follow later.',
    market: 'A reported move in the share price or trading volume — check what caused it before reading anything into the business.',
    regulatory: 'Adds compliance work and cost for health insurers; how big it is depends on the final wording of the rules.',
  }
  if (topic === 'premium') return s === 'up' ? 'Helps premium growth and market share; the test is whether profit margins hold as the book gets bigger.' : 'Growth quality is in doubt — watch the premium mix, how much premium is kept after reinsurance, and margins.'
  if (topic === 'analyst') return s === 'up' ? 'Good for sentiment and the valuation; whether it lasts depends on actually delivering growth and margins.' : 'Analysts are turning more cautious; watch where their forecasts and price targets go next.'
  if (M[topic]) return M[topic]!
  // Fallback: prefer the source's own metric-anchored line over a generic phrase.
  const own = firstSentence(idea.why.potentialImpact || idea.why.whyItMatters || '')
  return clampWords(own || 'Feeds the near-term read; watch the next disclosure for confirmation.', 150)
}

// ── 4) Exposure (#4) — from wired channel-mix / retail-mix, else "Needs data" ───

const CHANNEL_TOPICS = new Set<Topic>(['commission', 'expense', 'entry'])
const RETAIL_TOPICS = new Set<Topic>(['pricing', 'claims'])

function intermediaryShare(companyId: string): { pct: number; period: string } | null {
  const dist = getCompanyDistributionData(companyId)
  if (!dist?.latest) return null
  const l = dist.latest
  return { pct: l.Banca + l.Brokers + l.Agents + l['Corporate Agents'], period: l.period }
}
// SAHIs whose channel mix IS wired — used to state sector exposure honestly.
function wiredIntermediary(): { label: string; pct: number; period: string }[] {
  const out: { label: string; pct: number; period: string }[] = []
  for (const ins of insurers as { id: string; shortName: string }[]) {
    const im = intermediaryShare(ins.id)
    if (im) out.push({ label: ins.shortName, pct: im.pct, period: im.period })
  }
  return out.sort((a, b) => b.pct - a.pct)
}
const retailMixOf = (companyId: string): number | null => {
  const ins = (insurers as { id: string; retailMix: number }[]).find((i) => i.id === companyId)
  return ins && ins.retailMix > 0 ? ins.retailMix : null
}

function exposureFor(idea: PeIdea, topic: Topic, companyId: string, companyLabel: string): PeExposure {
  const single = companyId !== 'all'
  const targetId = single ? companyId : idea.scope === 'company' ? idea.companyId : null
  const targetLabel = single ? companyLabel : idea.entity

  if (CHANNEL_TOPICS.has(topic)) {
    if (targetId) {
      const im = intermediaryShare(targetId)
      if (im) {
        const level: PeExposureLevel = im.pct >= 80 ? 'High' : im.pct >= 60 ? 'Medium' : 'Low'
        return { level, basis: `${Math.round(im.pct)}% of premium sold via agents & brokers (${im.period})` }
      }
      return { level: 'Needs data', basis: `Sales-channel data not available for ${targetLabel}` }
    }
    const wired = wiredIntermediary()
    if (wired.length) return { level: 'High', basis: `Hits agent/broker-heavy insurers most — e.g. ${wired[0].label} ${Math.round(wired[0].pct)}% (${wired[0].period})` }
    return { level: 'Needs data', basis: 'Sales-channel data not available' }
  }

  if (RETAIL_TOPICS.has(topic)) {
    if (targetId) {
      const rm = retailMixOf(targetId)
      if (rm != null) {
        const level: PeExposureLevel = rm >= 65 ? 'High' : rm >= 45 ? 'Medium' : 'Low'
        return { level, basis: `${Math.round(rm)}% individual (retail) health book` }
      }
      return { level: 'Needs data', basis: `Retail vs group split not available for ${targetLabel}` }
    }
    return { level: 'Needs data', basis: 'Depends on the retail vs group mix' }
  }

  // Management change — exposure by ROLE criticality (#6), not company mix.
  if (topic === 'management') {
    const t = itemText(idea)
    const level: PeExposureLevel =
      /\bceo\b|chief executive|\bcfo\b|chief financial|\bcro\b|chief risk|appointed actuary|managing director|\bmd\b/.test(t) ? 'High'
      : /\bcoo\b|chief (underwriting|distribution|sales|product|claims|operating)|head of (underwriting|distribution|sales|product|claims)/.test(t) ? 'Medium'
      : 'Low'
    const basis = level === 'High' ? 'Board or top management (CEO, CFO, Chief Risk, Actuary)' : level === 'Medium' ? 'Senior department head' : 'Non-critical role'
    return { level, basis }
  }

  // Company-direct news (analyst / company item about the target).
  if (idea.scope === 'company' && (companyId === 'all' || idea.companyId === companyId)) {
    return { level: 'High', basis: `Directly about ${idea.entity}` }
  }
  return { level: 'Needs data', basis: 'No exposure data for this item' }
}

// ── 5) PE read — near-term vs longer-term, one line ────────────────────────────

function peReadFor(idea: PeIdea, topic: Topic): string {
  const s = signOf(idea.impact)
  const R: Partial<Record<Topic, string>> = {
    commission: 'Near term: pressure on margins and costs. Longer term: a cleaner, more durable way of paying for sales.',
    expense: 'Near term: cost pressure. Over time: the most efficient insurers pull ahead.',
    claims: 'Near term: higher claims cost and service strain. Done well, it builds trust and keeps customers renewing.',
    pricing: 'Near term: less room to raise premiums. Longer term: demand and how many customers stay decide it.',
    solvency: 'Near term: a closer look at capital. Longer term: disciplined growth protects steady compounding.',
    entry: 'Little near-term profit impact; watch market share and access to agents and branches as the new rival grows.',
    listing: 'Changes an insurer’s options to list or raise money; little near-term profit impact.',
    management: 'Near term: does the business stay steady? Longer term: does the strategy change direction?',
    ownership: 'Near term: just a shift in who holds the shares. It only matters more if it keeps happening.',
    market: 'Treat it as noise until confirmed; a real cause would change the near-term picture.',
    regulatory: 'Near term: extra cost and compliance work. Longer term: a cleaner, more trusted market.',
  }
  if (topic === 'premium') return s === 'up' ? 'Growth looks good now; whether it lasts depends on margins holding as it scales.' : 'Growth looks strong on the surface; the real test is quality — mix, retention and margins.'
  if (topic === 'analyst') return s === 'up' ? 'Supports the valuation now; it needs real growth and margins to hold up.' : 'A near-term knock to sentiment; the actual results decide whether it recovers.'
  if (R[topic]) return R[topic]!
  return clampWords(firstSentence(idea.why.potentialImpact || idea.whatToWatch || ''), 150) || 'Watch the next disclosure to confirm the direction.'
}

// ── 6) PE action (#5) — one next step, specific ────────────────────────────────

function actionFor(idea: PeIdea, topic: Topic, status: PeStatus): PeAction {
  // Off-scope, low-value background, or a stale explainer → the honest "Ignore".
  if (isOffHealth(idea)) return { verb: 'Ignore', label: 'Not health-insurance material — ignore' }
  if (status === 'Stale' || (idea.impact === 'Neutral' && idea.freshness === 'existing' && idea.scope === 'sector' && topic === 'other')) {
    return { verb: 'Ignore', label: 'Background context — low priority' }
  }
  if (status === 'Low confidence') return { verb: 'Verify official source', label: 'Verify against the official source before acting' }
  switch (topic) {
    case 'commission':
      return { verb: 'Watch commission ratio', label: 'Watch commission ratio, expense ratio and channel mix' }
    case 'expense':
      return { verb: 'Watch expense ratio', label: 'Watch expense ratio and the combined ratio' }
    case 'claims':
      return { verb: 'Watch claims', label: 'Watch claims ratio, cashless TAT and combined ratio' }
    case 'pricing':
      return { verb: 'Watch pricing', label: 'Watch repricing quantum and persistency' }
    case 'entry':
      return { verb: 'Track launch', label: 'Track launch date, products, pricing and distribution partners' }
    case 'solvency':
      return { verb: 'Check solvency', label: 'Check the solvency ratio and any capital-raise need' }
    case 'listing':
      return { verb: 'Check solvency', label: 'Check capital-access and listing / IPO plans' }
    case 'premium':
      return idea.impact === 'Positive'
        ? { verb: 'Check market share', label: 'Check whether GWP growth is backed by NEP and renewal quality' }
        : { verb: 'Watch distribution', label: 'Watch the growth mix and channel economics' }
    case 'management':
      return { verb: 'Track management change', label: 'Track the change vs role criticality and timing' }
    case 'analyst':
      return { verb: 'Verify official source', label: 'Verify the call and price targets' }
    case 'ownership':
      return { verb: 'Verify official source', label: 'Verify deal size and counterparty' }
    case 'market':
      return { verb: 'Verify official source', label: 'Verify the price / volume trigger' }
    default:
      return { verb: 'Check market share', label: 'Track for confirmation' }
  }
}

// ── 7) Watch next (#8) — event-matched, never reused across events ─────────────

const TOPIC_WATCH: Record<Topic, string[]> = {
  commission: ['Commission ratio', 'Expense ratio', 'Channel mix', 'Persistency', 'Distributor pushback', 'Product pricing'],
  expense: ['Expense ratio', 'Combined ratio', 'Opex trajectory', 'Automation spend'],
  claims: ['Claims ratio', 'Cashless TAT', 'Combined ratio', 'Complaint ratios'],
  pricing: ['Repricing quantum', 'Persistency', 'Senior-citizen mix', 'Claims ratio'],
  solvency: ['Solvency ratio', 'Capital-raise plans', 'Growth capacity'],
  entry: ['Launch date', 'Product category', 'Pricing strategy', 'Distribution partners', 'Capital commitment', 'Target segment'],
  listing: ['Final listing norms', 'Capital-raise / IPO plans', 'Free float'],
  premium: ['GWP growth mix', 'Retail vs group', 'NWP retention', 'Margin trajectory'],
  ownership: ['Buyer / seller identity', 'Size vs free float', 'Follow-on activity'],
  management: ['Continuity of strategy', 'Key hires / exits', 'Board commentary'],
  analyst: ['Whether next results confirm the call', 'Target-price revisions', 'Consensus shift'],
  market: ['Confirmation of the move', 'Underlying trigger', 'Delivery volumes'],
  regulatory: ['Final text vs draft', 'Effective date', 'Compliance cost', 'Pricing / expense impact'],
  other: [],
}
function watchNextFor(idea: PeIdea, topic: Topic): string[] {
  const list = TOPIC_WATCH[topic]
  if (list.length) return list.slice(0, 4)
  const own = firstSentence(idea.whatToWatch || '')
  return own ? [clampWords(own, 90)] : []
}

// ── 8) Confidence (#6) — ONE tier per item; echoes ≠ independence ───────────────

function confidenceFor(idea: PeIdea, status: PeStatus): { tier: Confidence; why: string } {
  const official = isOfficialSource(idea.sourceUrl)
  const base = idea.sourceConfidence
  if (status === 'Low confidence') return { tier: 'Low', why: 'Unverified / weak sourcing.' }
  if (status === 'Stale') return { tier: 'Low', why: 'Background / explainer — not a dated development.' }
  if (status === 'Final rule' || (status === 'Confirmed' && official)) {
    return { tier: base === 'Low' ? 'Medium' : 'High', why: 'Official / primary source.' }
  }
  let tier = base
  if (idea.freshness !== 'fresh') tier = capConfidence(tier, 'Medium') // not published in-window
  if (!official) tier = capConfidence(tier, 'Medium') // secondary reporting alone can't read "High"
  // Echoes of one story are NOT independent confirmations — they never lift the tier.
  const n = idea.independentSources
  const why =
    idea.clusterSize > 1
      ? `${idea.clusterSize} articles across ${n} ${n === 1 ? 'outlet' : 'outlets'} — one story, not ${n} independent ${n === 1 ? 'confirmation' : 'confirmations'}.`
      : status === 'Confirmed'
        ? 'Reported as completed; not yet on the primary source.'
        : 'Single credible report; not officially confirmed.'
  return { tier, why }
}

// ── Source cluster label (#1, #6) ──────────────────────────────────────────────

function sourceLabelFor(idea: PeIdea): string {
  const articles = Math.max(idea.clusterSize, idea.clusterSources.length, idea.sourceUrl ? 1 : 0)
  const outlets = Math.max(idea.independentSources, articles > 0 ? 1 : 0)
  if (articles <= 1) return '1 source'
  return `${articles} articles · ${outlets} ${outlets === 1 ? 'outlet' : 'outlets'} · 1 story`
}

// ── Assemble one PE brief item ─────────────────────────────────────────────────

// The four PulseStatus tones → the raw impact sign, for briefs frozen before the
// PE layer stamped `impact` onto each idea.
const STATUS_IMPACT: Record<string, SignalImpact> = { Constructive: 'Positive', Neutral: 'Neutral', Watch: 'Watch', Risk: 'Risk' }

/** Fill the PE-layer fields for an idea that may predate them (a frozen archived
 *  brief). Live ideas already carry every field, so this is a no-op for them. */
function normalize(raw: ConvictionIdea): PeIdea {
  const clusterSources = raw.clusterSources ?? raw.sources ?? []
  const independentSources = raw.independentSources ?? (new Set(clusterSources.map((s) => domainOf(s.url)).filter(Boolean)).size || (clusterSources.length ? 1 : 0))
  return {
    ...raw,
    impact: raw.impact ?? STATUS_IMPACT[raw.status] ?? 'Neutral',
    scope: raw.scope ?? 'sector',
    companyId: raw.companyId ?? null,
    sourceUrl: raw.sourceUrl ?? clusterSources[0]?.url ?? '',
    sourceConfidence: raw.sourceConfidence ?? 'Medium',
    clusterSources,
    clusterSize: raw.clusterSize ?? clusterSources.length ?? 1,
    independentSources,
  }
}

export function toPeBriefItem(raw: ConvictionIdea, companyId: string, companyLabel: string): PeBriefItem {
  const idea = normalize(raw)
  const topic = topicOf(idea)
  const { status, hint } = statusOfItem(idea)
  const { tier, why } = confidenceFor(idea, status)
  const sources = idea.clusterSources && idea.clusterSources.length ? idea.clusterSources : idea.sources
  return {
    id: idea.id,
    headline: clampWords(idea.why.whatHappened, 128),
    entity: idea.entity,
    topic,
    status,
    statusHint: hint,
    metrics: metricsFor(idea, topic),
    impactLine: impactLineFor(idea, topic),
    exposure: exposureFor(idea, topic, companyId, companyLabel),
    peRead: peReadFor(idea, topic),
    action: actionFor(idea, topic, status),
    watchNext: watchNextFor(idea, topic),
    sources: sources.map((s) => ({ name: s.name, url: s.url })),
    sourceLabel: sourceLabelFor(idea),
    confidence: tier,
    confidenceWhy: why,
  }
}

export function toPeBriefItems(ideas: ConvictionIdea[], companyId: string, companyLabel: string): PeBriefItem[] {
  return ideas.map((i) => toPeBriefItem(i, companyId, companyLabel))
}

// ── Executive brief — exactly 3 lines (#exec) ──────────────────────────────────

export interface PeExecBrief {
  whatChanged: string
  whyItMatters: string
  watchToday: string
}

function joinNatural(items: string[]): string {
  const xs = items.filter(Boolean)
  if (xs.length <= 1) return xs[0] ?? ''
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`
  return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`
}
const stripTrailingDot = (s: string): string => s.replace(/[.\s]+$/, '')

// What each topic puts "in play" — the metric-linked stake for the why-line. Kept
// concrete and free of the banned soft phrases ("demand looks strong", etc.).
const TOPIC_STAKE: Record<Topic, string> = {
  commission: 'the cost of selling policies',
  expense: 'running costs',
  claims: 'claims cost',
  pricing: 'room to price',
  solvency: 'capital strength',
  entry: 'competition',
  listing: 'access to capital',
  premium: 'growth quality',
  ownership: 'who owns the shares',
  management: 'steady leadership',
  analyst: 'the valuation',
  market: 'the near-term share-price read',
  regulatory: 'compliance cost',
  other: 'the near-term read',
}
const capFirst = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** The 3-line executive read: What changed · Why it matters · What to do today.
 *  Composed from the top PE items so it is metric-linked and free of vague copy;
 *  `since` is the honesty-guarded fallback when there are no items. */
export function buildExecBrief(items: PeBriefItem[], since: string, _why?: string): PeExecBrief {
  const top = items.filter((i) => i.action.verb !== 'Ignore')
  // What changed: lead with the 1–2 highest-conviction headlines when we have them,
  // else fall back to the honesty-guarded "since the last brief" line.
  const heads = top.slice(0, 2).map((i) => stripTrailingDot(i.headline))
  const whatChanged = heads.length ? `${heads.join('; ')}.` : (since || 'No source-backed developments on the board.')
  // Why it matters: the distinct metric stakes across the top items — "X and Y may
  // shift for SAHIs." Never the generic "demand looks strong" copy the brief bans.
  const stakes: string[] = []
  for (const i of top.slice(0, 3)) {
    const s = TOPIC_STAKE[i.topic]
    if (s && !stakes.includes(s)) stakes.push(s)
    if (stakes.length >= 2) break
  }
  const whyItMatters = stakes.length ? `${capFirst(joinNatural(stakes))} may shift across health insurers.` : (top[0]?.impactLine || 'Adds to the near-term read for the sector.')
  // Watch today: the concrete metric triggers to monitor — drawn from the top items'
  // event-matched watch lists (not vague actions), deduped and capped.
  const triggers: string[] = []
  top.slice(0, 3).forEach((i, idx) => {
    for (const w of i.watchNext.slice(0, idx === 0 ? 3 : 1)) {
      const lw = w.toLowerCase()
      if (!triggers.includes(lw)) triggers.push(lw)
    }
  })
  const watchToday = triggers.length ? `${capFirst(joinNatural(triggers.slice(0, 4)))}.` : 'Nothing needs watching today; monitor the feed.'
  return { whatChanged, whyItMatters, watchToday }
}
