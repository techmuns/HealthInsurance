// ===========================================================================
//  Pulse — derivation layer (pure, deterministic, source-disciplined).
//
//  The Pulse view is a daily read for ONE company. This module turns the already
//  normalized `InvestorPulse` object (built in @/insights/investorPulse from the
//  real, wired snapshots) into the exact slices the redesigned cards render:
//  today's read, top picks, upcoming events, previous reads, the timeline, the
//  "important today" strip, the action pills and the market read.
//
//  Honesty (see CLAUDE.md): NOTHING here fabricates. Every list is a reshaping of
//  real, source-backed items. A company with no items yields empty arrays and the
//  UI shows a clean empty state — never invented filler, never a fake "today".
// ===========================================================================

import { insurers } from '@/data/mockData'
import {
  selectManagementEvents,
  readForSignals,
  IMPACT_META,
  type InvestorPulse,
  type PulseSignal,
  type SignalCategory,
  type SignalImpact,
  type LensKey,
  type TodayRead,
  type Confidence,
} from '@/insights/investorPulse'
import type { NavTarget } from '@/insights/sourceMap'
import { buildFocus, type InsightFocus } from '@/insights/insightFocus'
import intelSnapshot from '@/data/snapshots/market-intelligence-snapshot.json'

// Feed freshness — read straight off the intelligence snapshot's own metadata
// (never a fabricated "last updated"). Powers the AI Morning Brief timestamp.
const FEED_META = (intelSnapshot as { _meta?: { last_updated?: string; last_successful_run?: string } })._meta ?? {}

// ── Status vocabulary (the four pill states in the brief) ────────────────────

export type PulseStatus = 'Constructive' | 'Neutral' | 'Watch' | 'Risk'

const STATUS_BY_IMPACT: Record<SignalImpact, PulseStatus> = {
  Positive: 'Constructive',
  Neutral: 'Neutral',
  Watch: 'Watch',
  Risk: 'Risk',
}
export function statusOf(impact: SignalImpact): PulseStatus {
  return STATUS_BY_IMPACT[impact]
}

export const STATUS_COLOR: Record<PulseStatus, { fg: string; dot: string; bg: string }> = {
  Constructive: { fg: IMPACT_META.Positive.fg, dot: IMPACT_META.Positive.dot, bg: IMPACT_META.Positive.bg },
  Neutral: { fg: IMPACT_META.Neutral.fg, dot: IMPACT_META.Neutral.dot, bg: IMPACT_META.Neutral.bg },
  Watch: { fg: IMPACT_META.Watch.fg, dot: IMPACT_META.Watch.dot, bg: IMPACT_META.Watch.bg },
  Risk: { fg: IMPACT_META.Risk.fg, dot: IMPACT_META.Risk.dot, bg: IMPACT_META.Risk.bg },
}

// ── Company display ──────────────────────────────────────────────────────────

const NAME_BY_ID = new Map((insurers as { id: string; shortName: string }[]).map((i) => [i.id, i.shortName]))
export function companyLabel(id: string, fallback = 'Sector'): string {
  return NAME_BY_ID.get(id) ?? fallback
}

// ── Small text helpers ───────────────────────────────────────────────────────

function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : s).trim()
}
function clamp(s: string, n: number): string {
  const t = (s ?? '').trim()
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}
// Copy guard for the Pulse surface: strip the words the brief bans from any
// free-text that flows in from the analysis layer. The composed lines never use
// them; this only protects lens-derived prose.
export function scrubCopy(s: string): string {
  return (s ?? '')
    .replace(/\binvestors?\b/gi, 'the market')
    .replace(/\bAI[-\s]generated\b/gi, 'gathered')
    .replace(/\bsentiment analysis\b/gi, 'signal read')
    .trim()
}

const IMPACT_RANK: Record<SignalImpact, number> = { Risk: 0, Positive: 1, Watch: 2, Neutral: 3 }
const byImpact = (a: { impact: SignalImpact }, b: { impact: SignalImpact }) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact]

// ── Filters ──────────────────────────────────────────────────────────────────

export type PulseFilter =
  | 'relevant'
  | 'fresh'
  | 'correlation'
  | 'management'
  | 'events'
  | 'sector'
  | 'regulatory'

export const FILTERS: { id: PulseFilter; label: string }[] = [
  { id: 'relevant', label: 'Most relevant' },
  { id: 'fresh', label: 'Fresh today' },
  { id: 'correlation', label: 'Correlation' },
  { id: 'management', label: 'Management' },
  { id: 'events', label: 'Events' },
  { id: 'sector', label: 'Sector' },
  { id: 'regulatory', label: 'Regulatory' },
]

// Maps a signal category to the analytical lens that carries its correlation data.
const CATEGORY_LENS: Record<SignalCategory, Exclude<LensKey, 'overviewPulse'>> = {
  'Analyst Action': 'competitivePositioning',
  'Sector Catalyst': 'riskRegulatoryChanges',
  Regulatory: 'riskRegulatoryChanges',
  Management: 'forwardLookingStrategy',
  Filing: 'forwardLookingStrategy',
  'Data Movement': 'growthLevers',
}

const isRecent = (s: PulseSignal) => s.horizon !== 'upcoming'
const isFreshToday = (s: PulseSignal) => isRecent(s) && (s.daysAgo ?? 999) <= 2

/** True when a signal has real, wired correlation data behind it (a live lens). */
export function signalHasCorrelation(s: PulseSignal, pulse: InvestorPulse): boolean {
  const lens = pulse.lenses[CATEGORY_LENS[s.category]]
  return !!lens && lens.available && (lens.metrics.length > 0 || lens.insightIds.length > 0)
}

function matchesFilter(s: PulseSignal, f: PulseFilter, pulse: InvestorPulse): boolean {
  switch (f) {
    case 'relevant':
      return true
    case 'fresh':
      return isFreshToday(s)
    case 'correlation':
      return signalHasCorrelation(s, pulse)
    case 'management':
      return s.category === 'Management'
    case 'events':
      return s.horizon === 'upcoming'
    case 'sector':
      return s.scope === 'sector'
    case 'regulatory':
      return s.category === 'Regulatory'
  }
}

/** Which chips actually have data — so the strip can hide dead filters (subtle). */
export function availableFilters(pulse: InvestorPulse): Set<PulseFilter> {
  const set = new Set<PulseFilter>(['relevant'])
  for (const s of pulse.signals) {
    if (isFreshToday(s)) set.add('fresh')
    if (signalHasCorrelation(s, pulse)) set.add('correlation')
    if (s.category === 'Management') set.add('management')
    if (s.horizon === 'upcoming') set.add('events')
    if (s.scope === 'sector') set.add('sector')
    if (s.category === 'Regulatory') set.add('regulatory')
  }
  if (selectManagementEvents(pulse.companyId, { recentOnly: true }).length) set.add('management')
  return set
}

// ── Scope (filter × date) ────────────────────────────────────────────────────

/** The signal slice for the active filter and selected timeline date. 'today' is
 *  the live view; a past date narrows to that day's items only. */
export function scopeSignals(pulse: InvestorPulse, filter: PulseFilter, dateKey: string): PulseSignal[] {
  let base =
    filter === 'relevant'
      ? pulse.signals.filter(isRecent)
      : pulse.signals.filter((s) => matchesFilter(s, filter, pulse))
  if (dateKey !== 'today') base = base.filter((s) => s.date === dateKey)
  return base
}

// A focus word for the headline so a filtered read is visibly its own read — even
// when two slices share the same net tone. Honest: it IS that slice's read.
const FOCUS_LABEL: Record<PulseFilter, string> = {
  relevant: '',
  fresh: 'Fresh-today',
  correlation: 'Correlation',
  management: 'Management',
  events: 'Events',
  sector: 'Sector',
  regulatory: 'Regulatory',
}

/** The Read for the active filter + date. EVERY filter (and every date) yields a
 *  freshly-composed read; 'relevant' + 'today' returns the canonical read. A
 *  non-default filter re-labels the headline to its focus so the update is
 *  unmistakable, and the Changed/Matters/Watch/source lines recompute over the
 *  slice. */
export function readFor(pulse: InvestorPulse, filter: PulseFilter, dateKey: string): TodayRead | null {
  if (filter === 'relevant' && dateKey === 'today') return pulse.todayRead
  const scoped = scopeSignals(pulse, filter, dateKey)
  const mgmt = dateKey === 'today' && (filter === 'relevant' || filter === 'management') ? pulse.managementEvents : []
  const read = readForSignals(pulse.companyId, scoped, mgmt)
  if (read && filter !== 'relevant') {
    const focus = FOCUS_LABEL[filter]
    return { ...read, headline: read.headline.replace(/^Net read\b/, `${focus} read`) }
  }
  return read
}

// ── Top Picks ────────────────────────────────────────────────────────────────

export type EvidenceKind = 'Filing' | 'News' | 'Interview' | 'Market data' | 'Regulatory' | 'Analyst report'

const EVIDENCE_BY_CATEGORY: Record<SignalCategory, EvidenceKind> = {
  'Analyst Action': 'Analyst report',
  'Sector Catalyst': 'News',
  Regulatory: 'Regulatory',
  Management: 'Filing',
  Filing: 'Filing',
  'Data Movement': 'Market data',
}

// A short, plain topic label for a sector-wide item (a company item shows the name).
const SECTOR_TOPIC: Record<SignalCategory, string> = {
  'Analyst Action': 'Analyst View',
  'Sector Catalyst': 'Sector Signal',
  Regulatory: 'Regulatory Update',
  Management: 'Management',
  Filing: 'Filing Update',
  'Data Movement': 'Market Move',
}

export type PickTag = 'High priority' | 'Regulatory' | 'Sector' | 'Fresh today' | 'Source-backed' | 'Correlation'

export interface TopPick {
  id: string
  rank: number
  entity: string
  category: SignalCategory
  impact: SignalImpact
  status: PulseStatus
  whatHappened: string
  whyItMatters: string
  whatToWatch: string
  tags: PickTag[]
  dateLabel: string
  daysAgo: number | null
  scope: 'company' | 'sector'
  evidence: { kind: EvidenceKind; name: string; url: string }
}

// Concrete "what to watch" fallbacks by category — used only when the mapped lens
// has no watch item (kept plain, non-technical, per the copy rules).
const CATEGORY_WATCH_FALLBACK: Record<SignalCategory, string> = {
  'Analyst Action': 'Whether the next results confirm the rating and the price target.',
  'Sector Catalyst': 'Whether the sector move feeds through to premium growth and pricing.',
  Regulatory: 'The impact on claims cost, expense ratio and pricing as rules tighten.',
  Management: 'Execution and continuity after the leadership change.',
  Filing: 'The next disclosure for confirmation of the trend.',
  'Data Movement': 'Whether the underlying data confirms the reported move.',
}

function watchFor(s: PulseSignal, pulse: InvestorPulse): string {
  const lens = pulse.lenses[CATEGORY_LENS[s.category]]
  const fromLens = lens?.watchNext?.[0]
  const base = fromLens || CATEGORY_WATCH_FALLBACK[s.category]
  return clamp(scrubCopy(firstSentence(base)), 104)
}

function whyFor(s: PulseSignal): string {
  const why = firstSentence(s.whyItMatters || '')
  if (why) return clamp(scrubCopy(why), 128)
  return clamp(`Feeds the near-term read for ${s.scope === 'company' ? 'the company' : 'the sector'}.`, 128)
}

function tagsFor(s: PulseSignal, rank: number, pulse: InvestorPulse): PickTag[] {
  const tags: PickTag[] = []
  if (rank === 1 || (s.scope === 'company' && s.impact !== 'Neutral')) tags.push('High priority')
  if (s.category === 'Regulatory') tags.push('Regulatory')
  if (s.scope === 'sector') tags.push('Sector')
  if ((s.daysAgo ?? 999) === 0 && isRecent(s)) tags.push('Fresh today')
  if (signalHasCorrelation(s, pulse)) tags.push('Correlation')
  if (s.sourceUrl) tags.push('Source-backed')
  return [...new Set(tags)].slice(0, 3)
}

function toPick(s: PulseSignal, rank: number, pulse: InvestorPulse): TopPick {
  return {
    id: s.id,
    rank,
    entity: s.scope === 'company' ? pulse.company : SECTOR_TOPIC[s.category],
    category: s.category,
    impact: s.impact,
    status: statusOf(s.impact),
    whatHappened: clamp(s.title, 120),
    whyItMatters: whyFor(s),
    whatToWatch: watchFor(s, pulse),
    tags: tagsFor(s, rank, pulse),
    dateLabel: s.dateLabel,
    daysAgo: s.daysAgo,
    scope: s.scope,
    evidence: { kind: EVIDENCE_BY_CATEGORY[s.category], name: s.sourceName, url: s.sourceUrl },
  }
}

// A genuinely high-relevance 4th item: company-specific, source-backed, directional.
function isHighRelevanceFourth(s: PulseSignal): boolean {
  return s.scope === 'company' && !!s.sourceUrl && s.impact !== 'Neutral'
}

/** Ranked picks from an already-scoped signal list — top 3 (a 4th only when it is
 *  genuinely high-relevance). */
export function topPicksFrom(signals: PulseSignal[], pulse: InvestorPulse): TopPick[] {
  const fourth = signals[3]
  const chosen = fourth && isHighRelevanceFourth(fourth) ? signals.slice(0, 4) : signals.slice(0, 3)
  return chosen.map((s, i) => toPick(s, i + 1, pulse))
}

// ── Upcoming Events ──────────────────────────────────────────────────────────

export interface PulseEvent {
  id: string
  day: string
  month: string
  dateLabel: string
  kindLabel: string
  title: string
  context: string
  url: string
  whenLabel: string
  isFirm: boolean
  impact: SignalImpact
}

function eventKind(title: string): string {
  const t = title.toLowerCase()
  if (/\bagm\b|annual general/.test(t)) return 'Annual General Meeting'
  if (/earnings|results|financial result/.test(t)) return 'Earnings / results'
  if (/board meeting|board of directors/.test(t)) return 'Board meeting'
  if (/investor|analyst meet|institutional/.test(t)) return 'Investor / analyst meet'
  if (/irdai|pfrda|sebi|regulat/.test(t)) return 'Regulatory'
  return 'Scheduled event'
}

const DAY_MS = 86_400_000
function isFutureIso(date: string): boolean {
  const t = Date.parse(date)
  return !isNaN(t) && t >= Date.now() - DAY_MS // today or later
}

// A specific downloadable document (vs a stable landing page). A not-yet-happened
// event that links to one of these is a stale-link trap: the file is historical
// (e.g. an old "14th AGM Notice.pdf" mis-tagged as an upcoming AGM), so a click
// would open an outdated document. We route such links to the IR / landing page.
const DOC_URL_RE = /\.(pdf|docx?|xlsx?|pptx?|csv)(?:$|[?#])/i
function hostRoot(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}/`
  } catch {
    return url
  }
}
function whenLabel(date: string): string {
  const t = Date.parse(date)
  if (isNaN(t)) return 'Date on record'
  const days = Math.round((t - Date.now()) / DAY_MS)
  if (days < -1) return 'Active catalyst'
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 7) return `In ${days} days`
  if (days <= 31) return `In ${Math.max(1, Math.round(days / 7))} weeks`
  const m = Math.round(days / 30)
  return `In ${m} month${m === 1 ? '' : 's'}`
}

/** Genuinely relevant dated events (AGM, board, results, investor meet, regulatory).
 *  Firm future dates lead; still-active flagged catalysts follow. */
export function upcomingEvents(pulse: InvestorPulse): PulseEvent[] {
  const upcoming = pulse.signals.filter((s) => s.horizon === 'upcoming')
  // The stable landing for a host — the cleanest non-document URL among these
  // events (typically the IR page), else the host root. Used to rescue future
  // events that point at a specific, possibly-stale document.
  const landingFor = (url: string): string => {
    if (!url) return ''
    try {
      const host = new URL(url).host
      const page = upcoming.find((s) => s.sourceUrl && !DOC_URL_RE.test(s.sourceUrl) && new URL(s.sourceUrl).host === host)
      if (page) return page.sourceUrl
    } catch {
      /* fall through to host root */
    }
    return hostRoot(url)
  }
  return upcoming
    .slice()
    .sort((a, b) => {
      const fa = isFutureIso(a.date) ? 0 : 1
      const fb = isFutureIso(b.date) ? 0 : 1
      if (fa !== fb) return fa - fb
      return fa === 0 ? (a.date < b.date ? -1 : 1) : a.date > b.date ? -1 : 1
    })
    .map((s) => {
      const [d, mon] = s.dateLabel.split(' ')
      // Future event + specific document link → route to the IR / landing page so
      // a click never opens a stale historical file (e.g. an old AGM-notice PDF).
      const url = s.sourceUrl && isFutureIso(s.date) && DOC_URL_RE.test(s.sourceUrl) ? landingFor(s.sourceUrl) : s.sourceUrl
      return {
        id: s.id,
        day: d ?? '',
        month: mon ?? '',
        dateLabel: s.dateLabel,
        kindLabel: eventKind(s.title),
        title: clamp(s.title, 96),
        context: clamp(scrubCopy(s.whyItMatters || s.sourceName), 84),
        url,
        whenLabel: whenLabel(s.date),
        isFirm: isFutureIso(s.date),
        impact: s.impact,
      }
    })
}

// ── Previous Reads ───────────────────────────────────────────────────────────

export interface PreviousReadItem {
  title: string
  impact: SignalImpact
  category: SignalCategory
  sourceName: string
  url: string
  dateLabel: string
}
export interface PreviousRead {
  date: string
  dateLabel: string
  status: PulseStatus
  summary: string
  items: PreviousReadItem[]
}

function dayStatus(items: { impact: SignalImpact }[]): PulseStatus {
  const c = { Positive: 0, Risk: 0, Watch: 0, Neutral: 0 }
  for (const i of items) c[i.impact]++
  if (c.Risk > c.Positive && c.Risk >= c.Watch) return 'Risk'
  if (c.Positive > c.Risk && c.Positive >= c.Watch) return 'Constructive'
  if (c.Watch >= c.Positive && c.Watch >= c.Risk && c.Watch > 0) return 'Watch'
  return 'Neutral'
}

/** One row per past date that carries real source-backed activity, newest first. */
export function previousReads(pulse: InvestorPulse, filter: PulseFilter): PreviousRead[] {
  const surfaced = pulse.signals.filter(isRecent)
  const pool = filter === 'relevant' ? surfaced : surfaced.filter((s) => matchesFilter(s, filter, pulse))
  const byDate = new Map<string, PulseSignal[]>()
  for (const s of pool) {
    if (!s.date) continue
    const arr = byDate.get(s.date) ?? []
    arr.push(s)
    byDate.set(s.date, arr)
  }
  return [...byDate.keys()]
    .sort((a, b) => (a < b ? 1 : -1))
    .map((date) => {
      const items = byDate.get(date)!.slice().sort(byImpact)
      return {
        date,
        dateLabel: items[0].dateLabel,
        status: dayStatus(items),
        summary: clamp(scrubCopy(items[0].title), 116),
        items: items.map((s) => ({
          title: clamp(s.title, 120),
          impact: s.impact,
          category: s.category,
          sourceName: s.sourceName,
          url: s.sourceUrl,
          dateLabel: s.dateLabel,
        })),
      }
    })
}

// ── Timeline ─────────────────────────────────────────────────────────────────

const WK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface TimelineDay {
  key: string
  isToday: boolean
  weekday: string
  dayNum: string
  monthLabel: string
  status: PulseStatus | null
  count: number
}

function isoParts(iso: string): { weekday: string; dayNum: string; monthLabel: string } {
  const t = new Date(`${iso}T00:00:00`)
  if (isNaN(t.getTime())) return { weekday: '', dayNum: '', monthLabel: '' }
  return { weekday: WK[t.getDay()], dayNum: String(t.getDate()), monthLabel: MONTHS[t.getMonth()] }
}
function todayIso(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/** Today (pinned) + each past read-date, newest first — the left rail. */
// The date the current brief was generated — the feed's own run date, not the
// wall clock, so "Today" never invents a date the data doesn't support.
function briefGenIso(): string {
  const d = FEED_META.last_updated
  return d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : todayIso()
}

/** Timeline from ACTUAL saved brief dates only. We do not persist a brief per day
 *  yet, so the only real brief is the current one (the feed-generated date). News-
 *  item dates are NOT briefs and are never shown as timeline entries — inventing
 *  "22 Jun / 18 Jun" reads would be dishonest. When there is no saved history the
 *  UI shows "No previous reads yet"; once daily briefs are persisted, earlier real
 *  dates append here. */
export function timelineDays(pulse: InvestorPulse): TimelineDay[] {
  const gen = briefGenIso()
  return [
    {
      key: 'today',
      isToday: gen === todayIso(),
      ...isoParts(gen),
      status: pulse.todayRead ? statusOf(pulse.todayRead.stance) : null,
      count: pulse.signals.filter(isRecent).length,
    },
  ]
}

// ── Important Today strip ────────────────────────────────────────────────────

export interface ImportantCategory {
  id: string
  label: string
  count: number
  detail: string
  tone: SignalImpact
}

const STRIP_CATEGORY: Record<SignalCategory, { id: string; label: string }> = {
  'Analyst Action': { id: 'analyst', label: 'Analyst View' },
  'Sector Catalyst': { id: 'sector', label: 'Sector Update' },
  Regulatory: { id: 'regulatory', label: 'Regulatory Watch' },
  Management: { id: 'management', label: 'Management Change' },
  Filing: { id: 'filing', label: 'Filing Update' },
  'Data Movement': { id: 'move', label: 'Unusual Move' },
}
const STRIP_ORDER = ['management', 'regulatory', 'analyst', 'sector', 'move', 'filing']

// A genuine reported market reaction (price / volume / deal) — NOT an analyst or
// business-growth catalyst. The shared category heuristic tags any prose that
// mentions "premium growth" as Data Movement; "Unusual Move" must be stricter so
// we never present a growth thesis as a market move (see the brief's rule that
// market reaction shows only when it is a real, significant price/volume event).
const MARKET_MOVE_RE =
  /\b(share price|stock price|price target|52[-\s]?week|block deal|bulk deal|spike|surge|surged|rall(y|ied|ies)|jump(s|ed)?|plunge[sd]?|tumble[sd]?|slump(s|ed)?|slid|delivery volume|trading volume|turnover)\b/i
function isMarketMove(title: string): boolean {
  return MARKET_MOVE_RE.test(title)
}

/** Only the categories genuinely detected in the scoped data (hide the rest).
 *  Management appears ONLY when `includeMgmt` and there is a real, recent change. */
export function importantFrom(signals: PulseSignal[], pulse: InvestorPulse, includeMgmt: boolean): ImportantCategory[] {
  const pool = signals.filter(isRecent)
  const groups = new Map<string, { label: string; items: PulseSignal[] }>()
  for (const s of pool) {
    // Only a real reported price/volume move earns "Unusual Move"; a growth /
    // analyst catalyst mis-tagged as Data Movement is folded into Sector Update.
    const meta =
      s.category === 'Data Movement' && !isMarketMove(s.title)
        ? STRIP_CATEGORY['Sector Catalyst']
        : STRIP_CATEGORY[s.category]
    const g = groups.get(meta.id) ?? { label: meta.label, items: [] }
    g.items.push(s)
    groups.set(meta.id, g)
  }
  const out: ImportantCategory[] = []
  for (const [id, g] of groups) {
    const top = g.items.slice().sort(byImpact)[0]
    out.push({ id, label: g.label, count: g.items.length, detail: clamp(scrubCopy(top.title), 66), tone: top.impact })
  }
  // Real, recent management change (only) — never a stale one.
  if (includeMgmt && !groups.has('management')) {
    const mgmt = selectManagementEvents(pulse.companyId, { recentOnly: true })
    if (mgmt.length) {
      const top = mgmt[0]
      out.push({
        id: 'management',
        label: 'Management Change',
        count: mgmt.length,
        detail: clamp(`${top.eventLabel}${top.person ? ` — ${top.person}` : ''}`, 66),
        tone: top.impact,
      })
    }
  }
  return out.sort((a, b) => STRIP_ORDER.indexOf(a.id) - STRIP_ORDER.indexOf(b.id))
}

// ── Action for Today ─────────────────────────────────────────────────────────

export type ActionIcon = 'ownership' | 'margins' | 'source' | 'agm' | 'regulation'

export interface PulseAction {
  id: string
  label: string
  icon: ActionIcon
  target?: NavTarget
  href?: string
}

const ACTION_ORDER = ['ownership', 'margins', 'source', 'agm', 'regulation']

// Insight-linked focus for the two metric-anchored action pills, so "Compare
// margins" / "Review ownership" land on the right chart with the real comparison
// spotlighted. The destination chart resolves the actual current/prior values
// from its own source data — these only name the metric, company and period.
function marginFocus(pulse: InvestorPulse): InsightFocus | undefined {
  // Periods unpinned → the profitability chart spotlights its latest reported
  // combined ratio vs the prior year.
  return (
    buildFocus({
      id: 'pulse-margins',
      metricKey: 'combined_ratio',
      company: pulse.companyId,
      companyLabel: pulse.company,
      comparisonType: 'YoY',
      insightLabel: 'Underwriting margin — combined ratio',
      origin: 'pulse',
    }) ?? undefined
  )
}
function ownershipFocus(pulse: InvestorPulse): InsightFocus | undefined {
  return (
    buildFocus({
      id: 'pulse-ownership',
      metricKey: 'promoter_holding',
      company: pulse.companyId,
      companyLabel: pulse.company,
      comparisonType: 'sequential',
      insightLabel: 'Ownership — promoter holding trend',
      origin: 'pulse',
    }) ?? undefined
  )
}

/** Up to 4 action pills, each tied to a real top pick / event (never generic). */
export function actionsFor(pulse: InvestorPulse, picks: TopPick[]): PulseAction[] {
  const cats = new Set(picks.map((p) => p.category))
  const companyId = pulse.companyId
  const analyst = cats.has('Analyst Action') || picks.some((p) => p.scope === 'company' && p.impact === 'Positive')
  const regulatory = cats.has('Regulatory')
  const agm = upcomingEvents(pulse).find((e) => /agm|annual general|investor/i.test(e.kindLabel + e.title))
  const out: PulseAction[] = []

  if (analyst || cats.has('Sector Catalyst'))
    out.push({ id: 'margins', label: 'Compare margins', icon: 'margins', target: { page: 'sahi', sahiTab: 'profitability', company: companyId, focus: marginFocus(pulse) } })
  if (analyst)
    out.push({ id: 'ownership', label: 'Review ownership', icon: 'ownership', target: { page: 'sahi', sahiTab: 'governance', company: companyId, focus: ownershipFocus(pulse) } })
  if (regulatory)
    out.push({ id: 'regulation', label: 'Track regulation', icon: 'regulation', target: { page: 'sahi', sahiTab: 'governance', company: companyId } })
  if (agm)
    out.push({ id: 'agm', label: /agm|annual general/i.test(agm.kindLabel) ? 'Watch AGM' : 'Watch meet', icon: 'agm', href: agm.url || undefined, target: agm.url ? undefined : { page: 'insights' } })
  if (picks.some((p) => p.evidence.url))
    out.push({ id: 'source', label: 'Verify source', icon: 'source', target: { page: 'audit', company: companyId } })

  return [...new Map(out.map((a) => [a.id, a])).values()]
    .sort((a, b) => ACTION_ORDER.indexOf(a.id) - ACTION_ORDER.indexOf(b.id))
    .slice(0, 4)
}

/** Up to 4 "Action for Today" pills derived straight from the scoped signals —
 *  each tied to what's actually on the board (never a generic checklist). */
export function actionsForBrief(pulse: InvestorPulse, scoped: PulseSignal[]): PulseAction[] {
  const cats = new Set(scoped.map((s) => s.category))
  const companyId = pulse.companyId
  const analyst = cats.has('Analyst Action') || scoped.some((s) => s.scope === 'company' && s.impact === 'Positive')
  const regulatory = cats.has('Regulatory')
  const agm = upcomingEvents(pulse).find((e) => /agm|annual general|investor/i.test(e.kindLabel + e.title))
  const out: PulseAction[] = []

  if (analyst || cats.has('Sector Catalyst'))
    out.push({ id: 'margins', label: 'Compare margins', icon: 'margins', target: { page: 'sahi', sahiTab: 'profitability', company: companyId, focus: marginFocus(pulse) } })
  if (analyst)
    out.push({ id: 'ownership', label: 'Review ownership', icon: 'ownership', target: { page: 'sahi', sahiTab: 'governance', company: companyId, focus: ownershipFocus(pulse) } })
  if (regulatory)
    out.push({ id: 'regulation', label: 'Track regulation', icon: 'regulation', target: { page: 'sahi', sahiTab: 'governance', company: companyId } })
  if (agm)
    out.push({ id: 'agm', label: /agm|annual general/i.test(agm.kindLabel) ? 'Watch AGM' : 'Watch meet', icon: 'agm', href: agm.url || undefined, target: agm.url ? undefined : { page: 'insights' } })
  if (scoped.some((s) => s.sourceUrl))
    out.push({ id: 'source', label: 'Verify source', icon: 'source', target: { page: 'audit', company: companyId } })

  return [...new Map(out.map((a) => [a.id, a])).values()]
    .sort((a, b) => ACTION_ORDER.indexOf(a.id) - ACTION_ORDER.indexOf(b.id))
    .slice(0, 4)
}

// ── Market Read ──────────────────────────────────────────────────────────────

/** 2–3 short lines explaining the overall daily read (lens-anchored, plain). */
export function marketReadLines(pulse: InvestorPulse): string[] {
  const lines: string[] = []
  const g = pulse.lenses.growthLevers
  const u = pulse.lenses.underwritingProfitability
  const r = pulse.lenses.riskRegulatoryChanges

  const lead = (g.available && g.oneLineRead) || (u.available && u.oneLineRead) || pulse.todayRead?.matters || ''
  if (lead) lines.push(clamp(scrubCopy(firstSentence(lead)), 150))

  const risk = r.watchNext[0] || u.watchNext[0] || pulse.todayRead?.watchNext || ''
  if (risk) lines.push(clamp(scrubCopy(`Key risks to watch: ${firstSentence(risk)}`), 150))

  return lines.filter(Boolean).slice(0, 3)
}

// ===========================================================================
//  AI briefing layer — the executive-briefing view (all real, source-derived).
//  Nothing here invents a metric: confidence comes from source quality, counts
//  from the real feed, "why should I care" from the wired analysis lenses.
// ===========================================================================

const CONF_SCORE: Record<Confidence, number> = { High: 3, Medium: 2, Low: 1 }
const wordCount = (s: string) => (s ? s.trim().split(/\s+/).filter(Boolean).length : 0)
const byNewestSignal = (a: PulseSignal, b: PulseSignal) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)

function greetingWord(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** Honest "last updated" straight from the feed's own run metadata. */
function feedUpdatedLabel(): string {
  const run = FEED_META.last_successful_run
  if (run) {
    const t = new Date(run)
    if (!isNaN(t.getTime())) {
      const sameDay = t.toDateString() === new Date().toDateString()
      const hh = t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      return sameDay ? `Today, ${hh}` : `${t.getDate()} ${MONTHS[t.getMonth()]}, ${hh}`
    }
  }
  return FEED_META.last_updated ?? '—'
}

// ── evidence + conviction (real source-backed signals) ───────────────────────

function domainOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** The distinct source-backed items that support a signal (its own source, its
 *  same-scope siblings, and the wired lens sources) — real, de-duped. */
function evidenceFor(s: PulseSignal, pulse: InvestorPulse): { kind: EvidenceKind; name: string; url: string }[] {
  const out: { kind: EvidenceKind; name: string; url: string }[] = []
  const seen = new Set<string>()
  const push = (kind: EvidenceKind, name: string, url: string) => {
    const key = `${name}|${url}`
    if (name && !seen.has(key)) {
      seen.add(key)
      out.push({ kind, name, url })
    }
  }
  push(EVIDENCE_BY_CATEGORY[s.category], s.sourceName, s.sourceUrl)
  for (const r of pulse.signals) {
    if (r.id !== s.id && r.category === s.category && r.scope === s.scope) push(EVIDENCE_BY_CATEGORY[r.category], r.sourceName, r.sourceUrl)
  }
  const lens = pulse.lenses[CATEGORY_LENS[s.category]]
  if (lens) for (const ref of lens.sourceRefs) if (ref.name) push('Market data', ref.name, ref.url)
  return out.slice(0, 5)
}

interface Conviction {
  score: number
  stars: number
  pct: number
  evidence: { kind: EvidenceKind; name: string; url: string }[]
}

/** A conviction score built ONLY from real attributes: company relevance,
 *  directionality, source confidence, whether wired correlation data backs it,
 *  and how many distinct sources support it. */
function convictionScore(s: PulseSignal, pulse: InvestorPulse): Conviction {
  const evidence = evidenceFor(s, pulse)
  let score = 0
  if (s.scope === 'company') score += 1.2
  score += s.impact === 'Positive' || s.impact === 'Risk' ? 1 : s.impact === 'Watch' ? 0.5 : 0.2
  score += { High: 1.7, Medium: 1.0, Low: 0.4 }[s.confidence]
  if (signalHasCorrelation(s, pulse)) score += 0.7
  score += Math.min(1, Math.max(0, evidence.length - 1) * 0.3)
  const stars = Math.max(1, Math.min(5, Math.round(score)))
  const pct = Math.round(Math.min(96, 44 + score * 10))
  return { score, stars, pct, evidence }
}

// ── "Why should I care?" — conversational, from real wired analysis ──────────

function whoAffected(s: PulseSignal, pulse: InvestorPulse): string {
  if (s.scope === 'company') {
    if (s.category === 'Analyst Action') return `${pulse.company} shareholders and anyone tracking its re-rating.`
    if (s.category === 'Management') return `${pulse.company}'s board, leadership continuity and its shareholders.`
    return `${pulse.company} directly — its premium growth, margins and shareholders.`
  }
  if (s.category === 'Regulatory') return 'Every standalone health insurer (SAHI) — pricing, product design and compliance cost.'
  if (s.category === 'Analyst Action') return 'The listed SAHI names and how the Street frames the sector.'
  return 'The broader health-insurance sector and its listed players.'
}

function historicalContext(s: PulseSignal, pulse: InvestorPulse): string | null {
  const lens = pulse.lenses[CATEGORY_LENS[s.category]]
  if (!lens || !lens.available) return null
  const line = lens.oneLineRead || lens.keyInsights[0] || ''
  return line ? clamp(scrubCopy(firstSentence(line)), 190) : null
}

// A concrete line reads as number/term-anchored, not a vague framing — used to
// prefer the sharpest available sentence for "potential impact" and "one thing".
const SPECIFIC_RE = /\d|%|IRDAI|PFRDA|SEBI|GWP|ratio|premium|solvency|combined|margin|pricing|circular|draft|rights issue/i

// Consequence — what this could mean (investorImplication-led; else a clean
// category consequence). Distinct from "what to watch" below.
function potentialImpact(s: PulseSignal, pulse: InvestorPulse): string | null {
  const lens = pulse.lenses[CATEGORY_LENS[s.category]]
  const cands = [lens?.investorImplication, lens?.watchNext?.[0], CATEGORY_WATCH_FALLBACK[s.category]].filter(Boolean) as string[]
  const pick = cands.find((c) => SPECIFIC_RE.test(c)) ?? cands[cands.length - 1]
  return pick ? clamp(scrubCopy(firstSentence(pick)), 190) : null
}

// What to monitor next — the concrete watch item (lens watch-list first).
function whatToWatchFor(s: PulseSignal, pulse: InvestorPulse): string {
  const lens = pulse.lenses[CATEGORY_LENS[s.category]]
  const w = lens?.watchNext?.[0] || CATEGORY_WATCH_FALLBACK[s.category]
  return clamp(scrubCopy(firstSentence(w)), 150)
}

export interface WhyCare {
  whatHappened: string
  whyItMatters: string
  whoAffected: string
  historicalContext: string | null
  potentialImpact: string | null
  whatToWatch: string
}

function whyCareFor(s: PulseSignal, pulse: InvestorPulse): WhyCare {
  const lens = pulse.lenses[CATEGORY_LENS[s.category]]
  return {
    whatHappened: clamp(scrubCopy(s.title), 150),
    whyItMatters: clamp(scrubCopy(firstSentence(s.whyItMatters || lens?.oneLineRead || '')), 200) || 'Adds to the near-term picture for the name and the sector.',
    whoAffected: whoAffected(s, pulse),
    historicalContext: historicalContext(s, pulse),
    potentialImpact: potentialImpact(s, pulse),
    whatToWatch: whatToWatchFor(s, pulse),
  }
}

// AI reasoning in up to two short, distinct lines — the "what" then the analytical
// "so what", both source-derived.
function reasoningLines(s: PulseSignal, pulse: InvestorPulse): string[] {
  const lens = pulse.lenses[CATEGORY_LENS[s.category]]
  const l1 = clamp(scrubCopy(firstSentence(s.whyItMatters || s.title)), 118)
  const l2raw = lens?.oneLineRead || lens?.investorImplication || whatToWatchFor(s, pulse)
  const l2 = clamp(scrubCopy(firstSentence(l2raw)), 118)
  return [l1, l2].filter((x, i, a) => x.length > 0 && a.indexOf(x) === i)
}

// The single "what should I do next" for one idea — tied to its category.
function actionForSignal(s: PulseSignal, pulse: InvestorPulse): PulseAction | null {
  const company = pulse.companyId
  switch (s.category) {
    case 'Analyst Action':
    case 'Sector Catalyst':
    case 'Data Movement':
      return { id: 'margins', label: 'Compare margins', icon: 'margins', target: { page: 'sahi', sahiTab: 'profitability', company, focus: marginFocus(pulse) } }
    case 'Regulatory':
      return { id: 'regulation', label: 'Track regulation', icon: 'regulation', target: { page: 'sahi', sahiTab: 'governance', company } }
    case 'Management':
      return { id: 'ownership', label: 'Review ownership', icon: 'ownership', target: { page: 'sahi', sahiTab: 'governance', company, focus: ownershipFocus(pulse) } }
    case 'Filing':
      return { id: 'source', label: 'Verify source', icon: 'source', target: { page: 'audit', company } }
  }
}

export interface ConvictionIdea {
  id: string
  entity: string
  stars: number
  reasoning: string[]
  whatToWatch: string
  confidencePct: number
  evidenceCount: number
  status: PulseStatus
  category: SignalCategory
  why: WhyCare
  action: PulseAction | null
  isBreaking: boolean
  isNew: boolean
  sources: { kind: EvidenceKind; name: string; url: string }[]
}

/** Highest-conviction ideas from a scoped signal set — ranked by conviction (not
 *  just freshness), each with 2-line AI reasoning, a confidence %, evidence, a
 *  what-to-watch and a full why. Market intelligence, not a stock call. */
export function convictionIdeas(signals: PulseSignal[], pulse: InvestorPulse): ConvictionIdea[] {
  const freshestId = signals.slice().sort(byNewestSignal)[0]?.id
  return signals
    .map((s) => ({ s, c: convictionScore(s, pulse) }))
    .sort((a, b) => b.c.score - a.c.score)
    .slice(0, 4)
    .map(({ s, c }) => ({
      id: s.id,
      entity: s.scope === 'company' ? pulse.company : SECTOR_TOPIC[s.category],
      stars: c.stars,
      reasoning: reasoningLines(s, pulse),
      whatToWatch: whatToWatchFor(s, pulse),
      confidencePct: c.pct,
      evidenceCount: c.evidence.length,
      status: statusOf(s.impact),
      category: s.category,
      why: whyCareFor(s, pulse),
      action: actionForSignal(s, pulse),
      isBreaking: s.id === freshestId && (s.daysAgo ?? 99) <= 2,
      isNew: (s.daysAgo ?? 99) === 0,
      sources: c.evidence,
    }))
}

/** The exact dashboard section a conviction idea should open — resolved from the
 *  idea's category AND its text, so a premium-growth idea lands on Premium &
 *  Distribution, a margin idea on Profitability, an ownership/management/regulatory
 *  idea on the right Governance/Sector surface, and a re-rating idea on Valuation.
 *  Falls back to the idea's own action target, then the peer scoreboard. */
export function dashboardTargetFor(idea: ConvictionIdea, companyId: string): NavTarget {
  const text = `${idea.entity} ${idea.reasoning.join(' ')} ${idea.why.whatHappened} ${idea.whatToWatch}`.toLowerCase()
  const to = (sahiTab: string): NavTarget => ({ page: 'sahi', sahiTab, company: companyId })
  if (idea.category === 'Regulatory' || /irdai|regulat|policy|reform|composite licen/.test(text)) return to('sector-news')
  if (idea.category === 'Management' || /\bceo\b|\bcfo\b|appoint|resign|steps? down|leadership|managing director|\bmd\b|board of/.test(text)) return to('governance')
  if (/ownership|stake|shareholding|holding|promoter|pledge|block deal|bulk deal/.test(text)) return to('governance')
  if (/valuation|\bp\/b\b|\bp\/e\b|\broe\b|target price|re-rat|multiple|price target|market cap/.test(text)) return to('valuation')
  if (/claim|margin|combined ratio|expense ratio|loss ratio|underwrit|\bpat\b|profitab|solvency/.test(text)) return to('profitability')
  if (/premium|\bgwp\b|\bnwp\b|\bnep\b|growth|retail|group health|channel|distribution|agency|bancass/.test(text)) return to('distribution')
  return idea.action?.target ?? to('companies')
}

// ── AI Morning Brief ─────────────────────────────────────────────────────────

export interface MorningBrief {
  greeting: string
  narrative: string
  attentionCount: number
  developmentsCount: number
  sourcesCount: number
  domainsCount: number
  confidencePct: number
  confidenceTier: Confidence
  readingMins: number
  lastUpdatedLabel: string
}

function briefConfidence(signals: PulseSignal[]): { pct: number; tier: Confidence } {
  if (!signals.length) return { pct: 0, tier: 'Low' }
  const avg = signals.reduce((n, s) => n + CONF_SCORE[s.confidence], 0) / signals.length // 1..3
  const sourced = signals.filter((s) => s.sourceUrl).length / signals.length
  const base = 50 + ((avg - 1) / 2) * 40
  const pct = Math.round(Math.min(97, base + sourced * 6))
  const tier: Confidence = pct >= 82 ? 'High' : pct >= 66 ? 'Medium' : 'Low'
  return { pct, tier }
}

// Clean forward phrase for the nearest scheduled catalyst.
const EVENT_PHRASE: Record<string, string> = {
  'Annual General Meeting': 'the AGM',
  'Earnings / results': 'the next results',
  'Board meeting': 'the next board meeting',
  'Investor / analyst meet': 'upcoming disclosures',
  Regulatory: 'regulatory deadlines',
  'Scheduled event': 'upcoming events',
}

/** The Executive Brief narrative — a prepared-analyst note (not "AI scanned …"):
 *  what changed, why it matters, who's affected and what to watch. Composed
 *  deterministically from the real, scoped signal mix for the selected company. */
function briefNarrative(pulse: InvestorPulse, scoped: PulseSignal[], ideas: ConvictionIdea[], isToday: boolean, dateLabel: string): string {
  const recent = scoped.filter(isRecent)
  if (!recent.length && !ideas.length) {
    return isToday ? 'No source-backed developments are on the board for this view right now.' : `No source-backed developments were recorded for ${dateLabel}.`
  }
  const when = isToday ? 'today' : `on ${dateLabel}`
  const reg = recent.filter((s) => s.category === 'Regulatory').length
  const pos = recent.filter((s) => s.impact === 'Positive').length
  const risk = recent.filter((s) => s.impact === 'Risk').length
  const watch = recent.filter((s) => s.impact === 'Watch').length

  let theme: string
  if (reg > 0) theme = `Regulatory pressure is the main watch item for health insurers ${when}`
  else if (risk > pos) theme = `Margin and claims-cost pressure is the dominant theme across health insurers ${when}`
  else if (pos > 0) theme = `Premium momentum is keeping the tone constructive across health insurers ${when}`
  else theme = `Signals are mixed across health insurers ${when}, with no single dominant driver`

  const company = pulse.company
  const supported = pos >= risk + watch ? 'remains supported by' : 'is under pressure on'
  const strength = pos > 0 ? 'premium growth and demand' : 'its market position'
  const watchLead = reg > 0 ? 'claims-cost and conduct scrutiny' : risk > pos ? 'margin and solvency pressure' : 'how margins hold as the book grows'
  const evs = upcomingEvents(pulse)
  const ev = evs.find((e) => /Earnings|Annual General|Board/i.test(e.kindLabel)) ?? evs[0]
  const catalyst = ev ? ` and ${EVENT_PHRASE[ev.kindLabel] ?? 'upcoming disclosures'}` : ''
  const s2 = `${company} ${supported} ${strength}, but ${watchLead}${catalyst} will decide whether the strength is sustainable.`
  return `${theme}. ${s2}`
}

export function morningBrief(pulse: InvestorPulse, ideas: ConvictionIdea[], scoped: PulseSignal[], isToday: boolean, dateLabel: string): MorningBrief {
  const sourced = pulse.signals.filter((s) => s.sourceUrl)
  const domains = new Set(sourced.map((s) => domainOf(s.sourceUrl) || s.sourceName))
  const mgmtRecent = selectManagementEvents(pulse.companyId, { recentOnly: true })
  const { pct, tier } = briefConfidence(scoped.length ? scoped : pulse.signals)
  const words = ideas.reduce(
    (n, i) => n + wordCount(i.reasoning.join(' ')) + wordCount(i.why.whyItMatters) + wordCount(i.why.historicalContext ?? '') + wordCount(i.why.potentialImpact ?? '') + wordCount(i.whatToWatch),
    0,
  )
  return {
    greeting: isToday ? greetingWord() : 'Executive Brief',
    narrative: briefNarrative(pulse, scoped, ideas, isToday, dateLabel),
    attentionCount: ideas.length,
    developmentsCount: pulse.signals.length + mgmtRecent.length,
    sourcesCount: sourced.length,
    domainsCount: domains.size,
    confidencePct: pct,
    confidenceTier: tier,
    readingMins: Math.max(1, Math.round(words / 200)),
    lastUpdatedLabel: feedUpdatedLabel(),
  }
}

// ── "If you read only one thing today" ───────────────────────────────────────

export interface OneThing {
  sentence: string
  status: PulseStatus
}

/** One strong sentence from today's HIGHEST-IMPACT development. A regulatory /
 *  risk / watch item outranks a positive print, because it can change the
 *  trajectory — that is the thing worth reading if you read only one. */
export function oneThing(scoped: PulseSignal[], ideas: ConvictionIdea[], pulse: InvestorPulse): OneThing | null {
  const pool = scoped.filter(isRecent)
  const lead = pool.find((s) => s.category === 'Regulatory') ?? pool.find((s) => s.impact === 'Risk') ?? pool.find((s) => s.impact === 'Watch') ?? null
  // Prefer a COMPLETE sentence (the development's own reasoning) over a terse
  // lens fragment; then a number/term-anchored line; then the headline.
  const pickFrom = (cands: string[], status: PulseStatus): OneThing | null => {
    const c = cands.map((x) => firstSentence(x)).filter(Boolean)
    if (!c.length) return null
    const pick = c.find((x) => x.length >= 45) ?? c.find((x) => SPECIFIC_RE.test(x)) ?? c[0]
    return { sentence: clamp(scrubCopy(pick), 180), status }
  }
  if (lead) return pickFrom([lead.whyItMatters, lead.title, potentialImpact(lead, pulse) ?? '', whatToWatchFor(lead, pulse)], statusOf(lead.impact))
  if (!ideas.length) return null
  const top = ideas[0]
  return pickFrom([...top.reasoning, top.why.whyItMatters, top.why.potentialImpact ?? ''], top.status)
}

// ── Executive Brief message — a sharp note from an analyst colleague ──────────

const NUM_WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const numWord = (n: number) => (n >= 0 && n < NUM_WORD.length ? NUM_WORD[n] : String(n))
function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]}, and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

export interface BriefMessage {
  since: string
  keyThing: string
  why: string
  watch: string
  nothing: boolean
}

function whyLine(recent: PulseSignal[], reg: number, companyPos: number): string {
  const risk = recent.filter((s) => s.impact === 'Risk').length
  if (companyPos > 0 && reg > 0) return 'Demand still looks strong, but the real question is whether claims and expenses start eating into that strength.'
  if (reg > 0) return 'The near-term read now turns on how the new rules land on pricing and cost.'
  if (companyPos > 0) return 'The momentum is real; the test is whether it holds as the book scales.'
  if (risk > 0) return 'The tone has softened a touch — worth watching before it hardens into a trend.'
  return 'The picture is steady rather than directional for now.'
}

function watchLine(pulse: InvestorPulse, reg: number): string {
  const items: string[] = []
  const ev = upcomingEvents(pulse).find((e) => /Earnings|result|AGM|Annual/i.test(e.kindLabel))
  if (ev) items.push(/AGM|Annual/i.test(ev.kindLabel) ? 'the AGM' : 'the next results and disclosures')
  if (reg > 0) items.push('any fresh IRDAI clarification')
  items.push('expense-ratio movement')
  return joinNatural([...new Set(items)].slice(0, 3))
}

/** The blue card's message: what changed since yesterday, the one thing you can't
 *  miss, why it matters, and what to watch — conversational, source-backed, and
 *  honest ("nothing" when nothing material moved). */
export function briefMessage(pulse: InvestorPulse, scoped: PulseSignal[], one: OneThing | null, isToday: boolean, dateLabel: string): BriefMessage {
  const recent = scoped.filter(isRecent)
  const reg = recent.filter((s) => s.category === 'Regulatory').length
  const companyPos = recent.filter((s) => s.scope === 'company' && s.impact === 'Positive').length
  const companyAny = recent.filter((s) => s.scope === 'company').length
  const mgmt = selectManagementEvents(pulse.companyId, { recentOnly: true }).length
  if (reg + companyAny + mgmt === 0 && !one) return { since: '', keyThing: '', why: '', watch: '', nothing: true }

  const bits: string[] = []
  if (reg > 0) bits.push(`${numWord(reg)} regulatory ${reg === 1 ? 'update' : 'updates'} moved into focus`)
  if (companyPos > 0) bits.push(`${pulse.company} is back in the news for premium growth`)
  else if (companyAny > 0) bits.push(`${pulse.company} picked up fresh coverage`)
  if (mgmt > 0 && bits.length < 2) bits.push(mgmt === 1 ? 'there was a leadership change to note' : 'there were leadership changes to note')

  const opener = isToday ? 'Since yesterday' : `On ${dateLabel}`
  const since = bits.length ? `${opener}, ${joinNatural(bits.slice(0, 2))}.` : `${opener}, the board has stayed quiet — nothing fresh has forced a rethink.`

  return {
    since,
    keyThing: one ? clamp(scrubCopy(one.sentence), 172) : '',
    why: clamp(scrubCopy(whyLine(recent, reg, companyPos)), 150),
    watch: clamp(scrubCopy(watchLine(pulse, reg)), 150),
    nothing: false,
  }
}

// ── "Since yesterday" — real, computable deltas only (no fabricated sentiment) ─

export interface SinceDelta {
  id: string
  label: string
  value: string
  direction: 'up' | 'down' | 'flat'
  tone: SignalImpact
  /** Where "View in dashboard" lands — the nearest real section for this change. */
  target: NavTarget
}

/** "Since Yesterday" — real, computable category counts vs the previous brief.
 *  Each item is hidden when it can't be computed / is zero, EXCEPT "unusual market
 *  moves", which shows a reassuring 0 when nothing significant moved. No raw
 *  metrics, no fabricated sentiment. Each item carries a NavTarget so the reader
 *  can jump straight to where that change lives on the dashboard. */
export function sinceYesterday(pulse: InvestorPulse): SinceDelta[] {
  const out: SinceDelta[] = []
  const recent = pulse.signals.filter(isRecent)
  const company = pulse.companyId
  const to = (sahiTab: string): NavTarget => ({ page: 'sahi', sahiTab, company })

  const reg = recent.filter((s) => s.category === 'Regulatory').length
  if (reg) out.push({ id: 'reg', label: reg === 1 ? 'new regulatory update' : 'new regulatory updates', value: String(reg), direction: 'up', tone: 'Watch', target: to('sector-news') })

  const disclosures = recent.filter((s) => s.scope === 'company').length
  if (disclosures) out.push({ id: 'co', label: disclosures === 1 ? 'fresh company update' : 'fresh company updates', value: String(disclosures), direction: 'up', tone: 'Positive', target: to('companies') })

  const mgmt = selectManagementEvents(pulse.companyId, { recentOnly: true }).length
  if (mgmt) out.push({ id: 'mgmt', label: mgmt === 1 ? 'management change' : 'management changes', value: String(mgmt), direction: 'up', tone: 'Neutral', target: to('governance') })

  // Premium growth (YoY) — a real, source-backed change when the growth lens has it.
  // Carries an InsightFocus so "View in dashboard" lands on the premium chart with
  // the FY-over-FY comparison spotlighted, connected and explained.
  const g = pulse.lenses.growthLevers.metrics.find((m) => m.label === 'GWP growth (YoY)')
  if (g) {
    const n = parseFloat(g.value)
    // Leave the periods unpinned so the premium chart spotlights its LATEST
    // reported year vs the prior one (e.g. FY26 vs FY25 — the jump the growth
    // headline is about), rather than the growth lens's older peer-comparison year.
    const gwpFocus =
      buildFocus({
        id: 'pulse-since-gwp',
        metricKey: 'gwp',
        company,
        companyLabel: pulse.company,
        comparisonType: 'YoY',
        deltaLabel: g.value,
        deltaValue: isNaN(n) ? null : n,
        // The chip describes the insight; the exact %, resolved on the chart's own
        // basis, lives in the pinned callout + pill (avoids two YoY figures that
        // differ only by premium basis reading as a contradiction).
        insightLabel: 'Premium growth · year on year',
        origin: 'pulse',
      }) ?? undefined
    out.push({ id: 'gwp', label: 'premium growth YoY', value: g.value, direction: !isNaN(n) && n < 0 ? 'down' : 'up', tone: g.tone, target: { ...to('distribution'), focus: gwpFocus } })
  }

  const events = pulse.signals.filter((s) => s.horizon === 'upcoming').length
  if (events) out.push({ id: 'events', label: events === 1 ? 'event ahead' : 'events ahead', value: String(events), direction: 'up', tone: 'Neutral', target: to('governance') })

  // Market reaction only when it is a genuine reported move; 0 shown as reassurance.
  const moves = recent.filter((s) => s.category === 'Data Movement' && isMarketMove(s.title)).length
  out.push({ id: 'moves', label: moves === 1 ? 'unusual market move' : 'unusual market moves', value: String(moves), direction: moves > 0 ? 'up' : 'flat', tone: moves > 0 ? 'Watch' : 'Positive', target: to('valuation') })

  return out
}
