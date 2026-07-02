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
} from '@/insights/investorPulse'
import type { NavTarget } from '@/insights/sourceMap'

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
export function timelineDays(pulse: InvestorPulse): TimelineDay[] {
  const today = todayIso()
  const prev = previousReads(pulse, 'relevant')
  const todayCount = pulse.signals.filter(isFreshToday).length
  const days: TimelineDay[] = [
    {
      key: 'today',
      isToday: true,
      ...isoParts(today),
      status: pulse.todayRead ? statusOf(pulse.todayRead.stance) : null,
      count: todayCount,
    },
  ]
  for (const r of prev) {
    if (r.date === today) continue
    days.push({ key: r.date, isToday: false, ...isoParts(r.date), status: r.status, count: r.items.length })
  }
  return days
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

/** Up to 4 action pills, each tied to a real top pick / event (never generic). */
export function actionsFor(pulse: InvestorPulse, picks: TopPick[]): PulseAction[] {
  const cats = new Set(picks.map((p) => p.category))
  const companyId = pulse.companyId
  const analyst = cats.has('Analyst Action') || picks.some((p) => p.scope === 'company' && p.impact === 'Positive')
  const regulatory = cats.has('Regulatory')
  const agm = upcomingEvents(pulse).find((e) => /agm|annual general|investor/i.test(e.kindLabel + e.title))
  const out: PulseAction[] = []

  if (analyst || cats.has('Sector Catalyst'))
    out.push({ id: 'margins', label: 'Compare margins', icon: 'margins', target: { page: 'sahi', sahiTab: 'profitability', company: companyId } })
  if (analyst)
    out.push({ id: 'ownership', label: 'Review ownership', icon: 'ownership', target: { page: 'sahi', sahiTab: 'governance', company: companyId } })
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
