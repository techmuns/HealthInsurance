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
  type Freshness,
} from '@/insights/investorPulse'
import type { NavTarget } from '@/insights/sourceMap'
import { buildFocus, buildLocator, type InsightFocus } from '@/insights/insightFocus'
import { recentRegulatory } from '@/insights/regulatoryFeed'
import intelSnapshot from '@/data/snapshots/market-intelligence-snapshot.json'
import pulseArchive from '@/data/snapshots/pulse-brief-archive.json'

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
  if (t.length <= n) return t
  // Break on a whole word, never mid-word — a truncated line should still read cleanly.
  const cut = t.slice(0, n - 1)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > n * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`
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

// An EVERGREEN reference page — an explainer / guide / FAQ / IR "watch this page"
// landing — NOT a dated development. An insurer's "what the new IRDAI rules mean"
// article, a broker's "IRDA rules for health insurance" guide, or an IR landing page
// carries no real publication date, so the feed stamps it with the day it was crawled.
// That is exactly what makes a months-old rule show up as a "since yesterday" change.
// Such an item stays in the fuller feed as background context, but it must NEVER be
// counted as a day-over-day change. (Honesty, CLAUDE.md: old rules must not be dressed
// up as new; a "since yesterday" delta shows only real, dated developments.)
const EVERGREEN_URL_RE =
  /health-insurance-articles|\/(blog|learn|guides?|knowledge|resources|faqs?)\/|what-is-|what-has-changed|rules-for-health|irda-rules|-guide(?:$|[-.?#/])|-explained|explainer|investor-relations|\.aspx(?:$|[?#])/i
export function isEvergreenReference(s: { sourceUrl?: string | null }): boolean {
  return !!s.sourceUrl && EVERGREEN_URL_RE.test(s.sourceUrl)
}
/** A genuinely NEW day-over-day development: the SOURCE was PUBLISHED/updated inside
 *  the daily window (freshness === 'fresh') — NOT merely discovered/crawled today, and
 *  not an evergreen explainer/landing page mis-stamped with the crawl date. This is the
 *  fix's core: "we found it today" no longer counts as "it happened since yesterday". */
const isNewDevelopment = (s: PulseSignal) => s.freshness === 'fresh' && !isEvergreenReference(s)
/** An older item (or one whose publication date we can't verify) that WE first surfaced
 *  inside the daily window — real, worth showing, but honestly "newly surfaced", not "fresh". */
const isNewlySurfaced = (s: PulseSignal) => s.freshness === 'newly-surfaced' && !isEvergreenReference(s)

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

export type PickTag = 'High priority' | 'Regulatory' | 'Sector' | 'Fresh today' | 'Newly surfaced' | 'Source-backed' | 'Correlation'

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
  /** Published vs discovered vs classified freshness — the honest per-card trail. */
  freshness: Freshness
  freshnessLabel: string
  publishedLabel: string
  discoveredLabel: string
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

// Distinctive topical tokens used to decide whether a lens watch-item actually
// belongs to a given signal — so a generic standing watch (e.g. "Solvency vs the 1.5x
// regulatory floor") is NOT stapled onto an unrelated analyst-rating or commission-rule
// card. ('regulatory'/'irdai' are deliberately excluded — too broad to be discriminating.)
const WATCH_TOPIC_RE = /solvency|capital|combined ratio|expense ratio|claims|commission|distribution|conduct|mis-selling|premium|growth|gwp|market share|rating|target price|pricing|cashless|underwrit|margin/gi

/** The lens watch-item most relevant to THIS signal (shares a topical token), or null
 *  when none genuinely relates — so the caller falls back to a category-appropriate
 *  watch line instead of reusing a standing metric watch on an unrelated card. (#5) */
function relevantWatch(s: PulseSignal, watchList?: string[]): string | null {
  if (!watchList?.length) return null
  const sTok = new Set(`${s.title} ${s.whyItMatters}`.toLowerCase().match(WATCH_TOPIC_RE) ?? [])
  if (!sTok.size) return null
  for (const w of watchList) {
    const wTok = w.toLowerCase().match(WATCH_TOPIC_RE) ?? []
    if (wTok.some((t) => sTok.has(t))) return w
  }
  return null
}

function watchFor(s: PulseSignal, pulse: InvestorPulse): string {
  const lens = pulse.lenses[CATEGORY_LENS[s.category]]
  const base = relevantWatch(s, lens?.watchNext) || CATEGORY_WATCH_FALLBACK[s.category]
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
  // Freshness tag by CLASSIFIED freshness (published-in-window), not a crawl-stamped date.
  if (s.freshness === 'fresh') tags.push('Fresh today')
  else if (s.freshness === 'newly-surfaced') tags.push('Newly surfaced')
  if (signalHasCorrelation(s, pulse)) tags.push('Correlation')
  if (s.sourceUrl) tags.push('Source-backed')
  return [...new Set(tags)].slice(0, 3)
}

function toPick(s: PulseSignal, rank: number, pulse: InvestorPulse): TopPick {
  return {
    id: s.id,
    rank,
    entity: s.scope === 'company' ? s.companyName ?? pulse.company : SECTOR_TOPIC[s.category],
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
    freshness: s.freshness,
    freshnessLabel: s.freshnessLabel,
    publishedLabel: shortDay(s.publishedAt),
    discoveredLabel: shortDay(s.discoveredAt),
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

// A genuinely dated event (one of the recognized kinds above) — as opposed to a
// news item or a "watch this page" placeholder that merely carries a future date.
// Only these belong in Events Ahead; the catch-all "Scheduled event" is where news
// leaks in, so an upcoming item must match a real kind to be shown.
const REAL_EVENT_RE = /\bagm\b|annual general|earnings|results|financial result|board meeting|board of directors|investor|analyst meet|institutional|irdai|pfrda|sebi|regulat/i

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
  const upcoming = pulse.signals
    .filter((s) => s.horizon === 'upcoming')
    // Relevant to THIS company: its own dated events, or a genuine sector-wide
    // regulatory catalyst. An item tagged 'sector' but really about another
    // insurer (a common mis-tag) is never surfaced under this company — that was
    // the source of "clicking an event opens an unrelated company's page".
    .filter((s) => s.scope === 'company' || s.category === 'Regulatory')
    // A real scheduled event, not a news item / "watch this page" placeholder that
    // merely carries a future date and links to an unrelated page.
    .filter((s) => REAL_EVENT_RE.test(s.title))
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

// Compact "29 Jun" day label (no year) for the per-card Published / Discovered lines.
// Returns '—' when there is no date on record — an honest blank, never a fake today.
function shortDay(iso?: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`
  const t = Date.parse(iso)
  if (isNaN(t)) return '—'
  const d = new Date(t)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export interface TimelineDay {
  key: string
  isToday: boolean
  /** Plain-English rail label: 'Today' | 'Yesterday' | '' (else the date shows). */
  label: string
  weekday: string
  dayNum: string
  monthLabel: string
  status: PulseStatus | null
  count: number
  /** True when this day carries real source-backed items (or a frozen brief). A
   *  false value is an honest "quiet day" marker — a calendar day with no news, shown
   *  so the rail reads as a continuous run rather than a set of jumped-over dates.
   *  Never a fabricated 0: a quiet day is explicitly labelled "no news", not counted. */
  hasNews: boolean
}

function isoParts(iso: string): { weekday: string; dayNum: string; monthLabel: string } {
  const t = new Date(`${iso}T00:00:00`)
  if (isNaN(t.getTime())) return { weekday: '', dayNum: '', monthLabel: '' }
  return { weekday: WK[t.getDay()], dayNum: String(t.getDate()), monthLabel: MONTHS[t.getMonth()] }
}
// Wall-clock day in IST (the dashboard's timezone) — used for Today / Yesterday and
// the today↔past boundary, so it lines up with the IST-keyed daily-brief archive and
// rolls over at IST midnight (not UTC midnight) for every viewer.
function istDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}
function todayIso(): string {
  return istDay(0)
}
function yesterdayIso(): string {
  return istDay(-1)
}

// How many calendar days back from today the rail fills CONTINUOUSLY (every day,
// quiet ones marked). Beyond this window the rail keeps only the days that carry
// real activity — so the recent stretch reads as a proper calendar while the rail
// can never grow without bound. A month of continuous history covers the daily read.
const TIMELINE_WINDOW_DAYS = 31

/** Timeline as a CONTINUOUS calendar: Today (wall-clock, pinned) then EVERY calendar
 *  day back through the recent window down to the oldest day that carries real activity.
 *  Days with real source-backed items (or a frozen archived brief) show their status +
 *  count; the quiet days in between appear as explicit "no news" markers (`hasNews:
 *  false`, `count: 0`) rather than being skipped — so the rail reads as an unbroken run
 *  and the gaps are visibly intentional, never a fabricated 0 and never an invented
 *  development. The continuous fill is bounded by real data (it never runs before the
 *  first real day) and by `TIMELINE_WINDOW_DAYS`; any activity days older than the
 *  window are still kept (as their own rows) so no real day is ever dropped. "Today" is
 *  the wall clock; the feed's own last-run time is shown honestly elsewhere via
 *  `feedUpdatedLabel()`. When the frozen daily-brief archive is present it supplies a
 *  day's status + count; otherwise the live feed's own item dates do. */
export function timelineDays(pulse: InvestorPulse): TimelineDay[] {
  const today = todayIso()
  const yday = yesterdayIso()
  const recent = pulse.signals.filter(isRecent)

  // Today — always pinned, wall-clock; its read is the rolling recent view.
  const days: TimelineDay[] = [
    {
      key: 'today',
      isToday: true,
      label: 'Today',
      ...isoParts(today),
      status: pulse.todayRead ? statusOf(pulse.todayRead.stance) : null,
      count: recent.length,
      hasNews: recent.length > 0,
    },
  ]

  // Real past activity: the union of (a) dates that still have live-feed items and
  // (b) FROZEN archived dates for this company — so a day stays on the rail even after
  // it ages out of the live window. A frozen record supplies the day's status + count;
  // otherwise the live items do.
  const byDate = new Map<string, PulseSignal[]>()
  for (const s of recent) {
    if (!s.date || s.date >= today) continue // today's / future items belong to the Today entry
    const arr = byDate.get(s.date) ?? []
    arr.push(s)
    byDate.set(s.date, arr)
  }
  const activityDates = new Set<string>([...byDate.keys(), ...archivedDatesFor(pulse.companyId).filter((d) => d < today)])
  if (!activityDates.size) return days

  // Build one rail row for a past date (news day or quiet day).
  const emit = (date: string): void => {
    const frozen = frozenBriefFor(pulse.companyId, date)
    const items = byDate.get(date)
    const count = frozen ? (frozen.itemCount ?? frozen.ideas.length) : items ? items.length : 0
    days.push({
      key: date,
      isToday: false,
      label: date === yday ? 'Yesterday' : '',
      ...isoParts(date),
      status: frozen ? frozen.status : items ? dayStatus(items) : null,
      count,
      hasNews: count > 0,
    })
  }

  // The floor of the continuous fill: back to the oldest activity day, but never more
  // than the window. (Both are real IST day-strings, so a string compare is a date
  // compare.) The window floor is a real calendar day-string so the boundary is exact.
  const windowFloor = istDay(-TIMELINE_WINDOW_DAYS)
  const oldestActivity = [...activityDates].sort()[0]
  const floor = oldestActivity > windowFloor ? oldestActivity : windowFloor

  // 1) The continuous recent calendar: EVERY day from yesterday back to the floor,
  //    emitting quiet days as explicit "no news" markers.
  for (let off = -1; off >= -TIMELINE_WINDOW_DAYS; off--) {
    const date = istDay(off)
    if (date < floor) break
    emit(date)
  }
  // 2) Any real activity days OLDER than the window — kept as their own rows (newest
  //    first) so history stays reachable and no real day is ever silently dropped.
  for (const date of [...activityDates].sort((a, b) => (a < b ? 1 : -1))) {
    if (date >= floor) continue // already emitted in the continuous window above
    emit(date)
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

// Insight-linked focus for the two metric-anchored action pills, so "Compare
// margins" / "Review ownership" land on the right chart with the real comparison
// spotlighted. The destination chart resolves the actual current/prior values
// from its own source data — these only name the metric, company and period.
// A real insurer is needed to spotlight a chart — the combined ("All") scope has
// no single company, so a focus is only built when a concrete company is named.
function marginFocus(pulse: InvestorPulse, companyId = pulse.companyId, companyLabel = pulse.company): InsightFocus | undefined {
  if (companyId === 'all') return undefined
  // Periods unpinned → the profitability chart spotlights its latest reported
  // combined ratio vs the prior year.
  return (
    buildFocus({
      id: 'pulse-margins',
      metricKey: 'combined_ratio',
      company: companyId,
      companyLabel,
      comparisonType: 'YoY',
      insightLabel: 'Underwriting margin — combined ratio',
      origin: 'pulse',
    }) ?? undefined
  )
}
function ownershipFocus(pulse: InvestorPulse, companyId = pulse.companyId, companyLabel = pulse.company): InsightFocus | undefined {
  if (companyId === 'all') return undefined
  return (
    buildFocus({
      id: 'pulse-ownership',
      metricKey: 'promoter_holding',
      company: companyId,
      companyLabel,
      comparisonType: 'sequential',
      insightLabel: 'Ownership — promoter holding trend',
      origin: 'pulse',
    }) ?? undefined
  )
}

// The label used in action pills / prose for the current scope. The combined
// ("All") view reads as "peers" so pills stay short and grammatical; a single
// company reads as its own name.
function scopeLabel(pulse: InvestorPulse): string {
  return pulse.companyId === 'all' ? 'peers' : pulse.company
}

// Specific, decision-grade action labels tied to the company / topic actually on
// the board — never a vague generic verb (#12). Consumed in a truncating pill, so
// kept short.
function actionLabel(id: string, company: string, agmKind?: string): string {
  switch (id) {
    case 'margins':
      return `Compare ${company} margin`
    case 'ownership':
      return `Review ${company} ownership`
    case 'regulation':
      return 'Check IRDAI on claims cost'
    case 'agm':
      return /agm|annual general/i.test(agmKind ?? '') ? `Watch ${company} AGM` : `Watch ${company} meet`
    case 'source':
      return `Verify ${company} sources`
    default:
      return company
  }
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
    out.push({ id: 'margins', label: actionLabel('margins', scopeLabel(pulse)), icon: 'margins', target: { page: 'sahi', sahiTab: 'profitability', company: companyId, focus: marginFocus(pulse) } })
  if (analyst)
    out.push({ id: 'ownership', label: actionLabel('ownership', scopeLabel(pulse)), icon: 'ownership', target: { page: 'sahi', sahiTab: 'governance', company: companyId, focus: ownershipFocus(pulse) } })
  if (regulatory)
    out.push({ id: 'regulation', label: actionLabel('regulation', scopeLabel(pulse)), icon: 'regulation', target: { page: 'sahi', sahiTab: 'governance', company: companyId } })
  if (agm)
    out.push({ id: 'agm', label: actionLabel('agm', scopeLabel(pulse), agm.kindLabel), icon: 'agm', href: agm.url || undefined, target: agm.url ? undefined : { page: 'insights' } })
  if (picks.some((p) => p.evidence.url))
    out.push({ id: 'source', label: actionLabel('source', scopeLabel(pulse)), icon: 'source', target: { page: 'audit', company: companyId } })

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
    out.push({ id: 'margins', label: actionLabel('margins', scopeLabel(pulse)), icon: 'margins', target: { page: 'sahi', sahiTab: 'profitability', company: companyId, focus: marginFocus(pulse) } })
  if (analyst)
    out.push({ id: 'ownership', label: actionLabel('ownership', scopeLabel(pulse)), icon: 'ownership', target: { page: 'sahi', sahiTab: 'governance', company: companyId, focus: ownershipFocus(pulse) } })
  if (regulatory)
    out.push({ id: 'regulation', label: actionLabel('regulation', scopeLabel(pulse)), icon: 'regulation', target: { page: 'sahi', sahiTab: 'governance', company: companyId } })
  if (agm)
    out.push({ id: 'agm', label: actionLabel('agm', scopeLabel(pulse), agm.kindLabel), icon: 'agm', href: agm.url || undefined, target: agm.url ? undefined : { page: 'insights' } })
  if (scoped.some((s) => s.sourceUrl))
    out.push({ id: 'source', label: actionLabel('source', scopeLabel(pulse)), icon: 'source', target: { page: 'audit', company: companyId } })

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

// Freshness weight — a daily read values what moved NOW. Fresh items are lifted;
// genuinely stale ones are actively demoted so a months-old filing never tops
// today's read (which is what let a January earnings item outrank live IRDAI news).
function recencyWeight(daysAgo: number | null): number {
  if (daysAgo == null) return 0
  if (daysAgo <= 2) return 1.0 // today / breaking
  if (daysAgo <= 7) return 0.6 // this week
  if (daysAgo <= 21) return 0.25
  if (daysAgo <= 45) return 0
  return -1.4 // stale — push it below anything current
}

// Structural weight by category — a sector-wide regulatory move is a high-value,
// market-moving event and must rival a company item's relevance bonus rather than
// being buried beneath routine company filings / IR-page housekeeping.
function categoryWeight(c: SignalCategory): number {
  if (c === 'Regulatory') return 1.2
  if (c === 'Analyst Action') return 0.4
  if (c === 'Management') return 0.4
  if (c === 'Data Movement') return 0.3
  if (c === 'Sector Catalyst') return 0.25
  return 0
}

// Health-industry relevance (#1 scope): a motor / crop / marine-only general-
// insurance item that never touches a health book is off-scope and is pushed below
// anything relevant, so the brief tracks HEALTH insurance — not general insurance.
const OFF_HEALTH_RE = /\bmotor\b|third[-\s]?party|two[-\s]?wheeler|\bcrop\b|\bmarine\b|fire insurance|\bauto\b/i
// HEALTH-SPECIFIC markers only — NOT generic words like "premium"/"insurer" that a
// motor item also carries, else an off-scope item would dodge the downrank.
const HEALTH_RELEVANT_RE = /health|medical|hospital|cashless|mediclaim|\bsahi\b|standalone health|retail health|group health|senior[-\s]?citizen/i
function healthRelevanceWeight(s: PulseSignal): number {
  const t = `${s.title} ${s.whyItMatters}`.toLowerCase()
  return OFF_HEALTH_RE.test(t) && !HEALTH_RELEVANT_RE.test(t) ? -2.5 : 0
}

/** A conviction score built ONLY from real attributes: company relevance,
 *  DIRECTIONALITY (a positive/risk move far outweighs a "watch"), HOW FRESH it is,
 *  the structural weight of its category, source confidence and how many distinct
 *  sources back it. Directionality + freshness + category are the primary drivers
 *  so the ranking surfaces the highest-value *recent* movement — not a trivial but
 *  fresh housekeeping note, nor a high-confidence but months-old filing. Source
 *  confidence/evidence are tie-breakers, never the headline. */
function convictionScore(s: PulseSignal, pulse: InvestorPulse): Conviction {
  const evidence = evidenceFor(s, pulse)
  let score = 0
  if (s.scope === 'company') score += 1.2
  // directionality — the primary value signal (wide gap so a real move beats noise)
  score += s.impact === 'Positive' || s.impact === 'Risk' ? 1.4 : s.impact === 'Watch' ? 0.4 : 0.1
  score += recencyWeight(s.daysAgo)
  score += categoryWeight(s.category)
  score += healthRelevanceWeight(s) // sink off-scope general-insurance items
  if (signalHasCorrelation(s, pulse)) score += 0.5
  // source quality — a tie-breaker (narrower spread than the value drivers above)
  score += { High: 1.1, Medium: 0.7, Low: 0.3 }[s.confidence]
  // Extra sources corroborate but must NOT dominate — a story echoed by many domains
  // is not "near-certain" on that basis alone (per the confidence-scoring rule).
  score += Math.min(0.45, Math.max(0, evidence.length - 1) * 0.15)
  const stars = Math.max(1, Math.min(5, Math.round(score)))
  // Confidence % is source-led. With honest per-signal confidence, High comes only
  // from a primary/official source; so a NON-primary item is capped well below
  // "near-certain" — harder still when its publication isn't even in the daily window.
  const primarySourced = s.confidence === 'High'
  let pct = Math.max(32, Math.round(Math.min(96, 44 + score * 10)))
  if (!primarySourced) pct = Math.min(pct, s.freshness === 'fresh' ? 88 : 78)
  return { score, stars, pct, evidence }
}

// ── "Why should I care?" — conversational, from real wired analysis ──────────

function whoAffected(s: PulseSignal, pulse: InvestorPulse): string {
  if (s.scope === 'company') {
    // In the combined view each company item names its own insurer, not "All".
    const co = s.companyName ?? pulse.company
    if (s.category === 'Analyst Action') return `${co} shareholders and anyone tracking its re-rating.`
    if (s.category === 'Management') return `${co}'s board, leadership continuity and its shareholders.`
    return `${co} directly — its premium growth, margins and shareholders.`
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
  // Prefer a lens watch-item that is genuinely about this signal; otherwise a
  // category-appropriate fallback — never a standing solvency watch on an unrelated card.
  const w = relevantWatch(s, lens?.watchNext) || CATEGORY_WATCH_FALLBACK[s.category]
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
  // Keep the WHOLE first sentence — these feed the note's "What changed" story, where a
  // sentence cut off at 118 chars ("…newly listed") reads as broken. The compact card
  // still shows one line (CSS line-clamp), so a fuller string costs it nothing.
  const l1 = clamp(scrubCopy(firstSentence(s.whyItMatters || s.title)), 220)
  const l2raw = lens?.oneLineRead || lens?.investorImplication || whatToWatchFor(s, pulse)
  const l2 = clamp(scrubCopy(firstSentence(l2raw)), 220)
  return [l1, l2].filter((x, i, a) => x.length > 0 && a.indexOf(x) === i)
}

// The single "what should I do next" for one idea — tied to its category.
function actionForSignal(s: PulseSignal, pulse: InvestorPulse): PulseAction | null {
  // In the combined view a company item acts on its own insurer; a sector item
  // (and every item in a single-company view) acts on the current scope.
  const company = s.scope === 'company' && s.companyId ? s.companyId : pulse.companyId
  const label = s.scope === 'company' && s.companyName ? s.companyName : scopeLabel(pulse)
  switch (s.category) {
    case 'Analyst Action':
    case 'Sector Catalyst':
    case 'Data Movement':
      return { id: 'margins', label: actionLabel('margins', label), icon: 'margins', target: { page: 'sahi', sahiTab: 'profitability', company, focus: marginFocus(pulse, company, label) } }
    case 'Regulatory':
      return { id: 'regulation', label: actionLabel('regulation', label), icon: 'regulation', target: { page: 'sahi', sahiTab: 'governance', company } }
    case 'Management':
      return { id: 'ownership', label: actionLabel('ownership', label), icon: 'ownership', target: { page: 'sahi', sahiTab: 'governance', company, focus: ownershipFocus(pulse, company, label) } }
    case 'Filing':
      return { id: 'source', label: actionLabel('source', label), icon: 'source', target: { page: 'audit', company } }
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
  /** Intraday freshness marker: "New at 3:30 PM" / "Fresh today" / "Newly surfaced". */
  freshLabel?: string
  /** Classified freshness of the lead item (fresh / newly-surfaced / existing / unknown). */
  freshness: Freshness
  /** Viewer-facing freshness label for the card ("Fresh update" / "Newly surfaced" / …). */
  freshnessLabel: string
  /** Lead source's real publication day ("29 Jun") or "—" when not on record. */
  publishedLabel: string
  /** When we first discovered the lead item ("3 Jul") or "—". */
  discoveredLabel: string
  sources: { kind: EvidenceKind; name: string; url: string }[]
  // ── PE-impact layer (dedup + exposure + honest confidence) ─────────────────
  //  These are OPTIONAL: live/new-archive ideas always carry them, but a brief
  //  frozen BEFORE this layer landed will not — so the PE builder falls back
  //  gracefully (see toPeBriefItem) rather than crashing a past-date download.
  /** The lead signal's raw impact + scope + owner — so the PE layer can map the
   *  event to metrics/exposure without re-deriving them from prose. */
  impact?: SignalImpact
  scope?: 'company' | 'sector'
  companyId?: string | null
  sourceUrl?: string
  /** The lead source's own confidence tier (drives the single PE confidence). */
  sourceConfidence?: Confidence
  /** How many articles were collapsed into this one story (1 = no duplicates). */
  clusterSize?: number
  /** The distinct outlets carrying this one story (deduped by domain) — grouped
   *  under the single card so many links can still be few independent voices. */
  clusterSources?: { kind: EvidenceKind; name: string; url: string }[]
  /** Distinct source domains across the cluster — the honest "independent" count
   *  (syndicated repeats of one wire do NOT inflate it). */
  independentSources?: number
}

// Honest intraday freshness marker for one signal, driven by CLASSIFIED freshness
// (published-vs-discovered), never by discovery alone:
//   • fresh (source published in-window) → "New at 3:30 PM" (when we have a real
//     capture time) or "Fresh today".
//   • newly-surfaced (older/undated item we just found) → "Newly surfaced" — NOT a
//     time, because "we found it now" is not "it happened now".
// Undefined for everything else. Never fabricates a time.
function freshLabelFor(s: PulseSignal): string | undefined {
  if (s.freshness === 'newly-surfaced') return 'Newly surfaced'
  if (s.freshness !== 'fresh') return undefined
  const t = s.capturedAt ? Date.parse(s.capturedAt) : NaN
  if (!isNaN(t)) {
    const capDay = new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    if (capDay === todayIso())
      return `New at ${new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}`
  }
  return 'Fresh today'
}

// ── Story clustering — collapse duplicate coverage into ONE item (#1) ─────────
//  Multiple outlets routinely carry the SAME development (a broker note echoed by
//  two sites; three articles on one IRDAI move). Rendering each as its own card
//  over-weights a single story and inflates the source count. We collapse genuine
//  duplicates into one cluster whose representative is the strongest framing, and
//  group the other outlets under it — WITHOUT merging distinct sub-topics
//  (commission norms vs cashless timelines stay separate). Deliberately
//  conservative: it merges only on strong title overlap, or a shared distinctive
//  anchor (a broker name, a specific entity, a topic keyword) at the same impact
//  sign within a week. Under-merging (two near-dups slip through) is preferred to
//  over-merging (two real stories wrongly fused) — honesty first.

const STORY_STOP = new Set(
  'the a an and or for to of in on at as is are be by with from into over under after ahead will would could may might set plans plan likely reported reportedly report reports said says over across its their this that these those health insurance insurer insurers india indian sector company companies share shares stock price amid'.split(
    ' ',
  ),
)
// Names too common to signal a shared STORY (every regulatory item names IRDAI).
const REGULATOR_ANCHORS = new Set(['irdai', 'irda', 'sebi', 'pfrda', 'rbi', 'gst', 'government', 'govt', 'centre', 'ministry', 'niti'])
const GENERIC_PROPER = new Set(['health', 'insurance', 'insurer', 'insurers', 'india', 'indian', 'new', 'fy', 'the', 'q1', 'q2', 'q3', 'q4', 'buy', 'sell', 'hold', 'board'])
// Curated topic keywords — a shared one is a strong same-story signal (commission
// ↔ commission), while different ones keep sub-topics apart (commission ↮ cashless).
const TOPIC_ANCHORS = [
  'commission', 'cashless', 'solvency', 'persistency', 'bancassurance', 'composite', 'surrender', 'claims', 'premium',
  'merger', 'acquisition', 'stake', 'ipo', 'dividend', 'rights', 'bonus', 'fraud', 'penalty', 'licence', 'license',
  'registration', 'delisting', 'expense', 'repricing', 'reinsurance',
]

function significantTokens(title: string): Set<string> {
  const out = new Set<string>()
  for (const raw of title.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (raw.length < 4 && !/^\d+$/.test(raw)) continue
    if (STORY_STOP.has(raw)) continue
    out.add(raw)
  }
  return out
}
// Distinctive anchors: proper nouns in the ORIGINAL title (not a regulator, generic
// word, or the company itself) PLUS any curated topic keyword present.
function storyAnchors(s: PulseSignal): Set<string> {
  const out = new Set<string>()
  const companyTokens = new Set((s.companyName ?? '').toLowerCase().match(/[a-z]+/g) ?? [])
  for (const m of s.title.match(/\b[A-Z][A-Za-z.&]{2,}\b/g) ?? []) {
    const t = m.toLowerCase().replace(/\./g, '')
    if (t.length < 3) continue
    if (REGULATOR_ANCHORS.has(t) || STORY_STOP.has(t) || GENERIC_PROPER.has(t) || companyTokens.has(t)) continue
    out.add(t)
  }
  const low = s.title.toLowerCase()
  for (const kw of TOPIC_ANCHORS) if (low.includes(kw)) out.add(kw)
  return out
}
function signBucket(i: SignalImpact): number {
  return i === 'Positive' ? 1 : i === 'Neutral' ? 0 : -1 // Risk & Watch share the "caution" bucket
}
function broadTopic(s: PulseSignal): string {
  const t = s.title.toLowerCase()
  if (s.category === 'Regulatory') return 'regulatory'
  if (s.category === 'Management' || /\bceo\b|\bcfo\b|appoint|resign|steps? down|managing director|\bmd\b/.test(t)) return 'management'
  if (s.category === 'Analyst Action' || /rating|\bbuy\b|\bsell\b|target|initiat|upgrade|downgrade|overweight|underweight|coverage|re-?rat/.test(t)) return 'analyst'
  if (/block deal|bulk deal|stake|promoter|pledge|shareholding/.test(t)) return 'ownership'
  if (/premium|\bgwp\b|\bnwp\b|\bnep\b|growth|retail health/.test(t)) return 'premium'
  return 'other'
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}
const daysApart = (a: string, b: string): number => {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  return isNaN(ta) || isNaN(tb) ? 999 : Math.abs(ta - tb) / DAY_MS
}
interface StoryFeatures { sig: Set<string>; anchors: Set<string>; topic: string }
function sameStory(a: PulseSignal, fa: StoryFeatures, b: PulseSignal, fb: StoryFeatures): boolean {
  const j = jaccard(fa.sig, fb.sig)
  // A near-verbatim headline is the SAME story even if two outlets tagged its tone
  // differently (one "watch", one "positive") — so identical coverage never splits
  // into two cards on a sign quirk. Guarded by a loose recency window.
  if (j >= 0.75 && (!a.date || !b.date || daysApart(a.date, b.date) <= 21)) return true
  if (signBucket(a.impact) !== signBucket(b.impact)) return false
  if (a.date && b.date && daysApart(a.date, b.date) > 7) return false
  if (j >= 0.5) return true
  let shared = 0
  for (const x of fa.anchors) if (fb.anchors.has(x)) shared++
  if (shared >= 2) return true
  if (shared >= 1 && (j >= 0.25 || (fa.topic === fb.topic && fa.topic !== 'other'))) return true
  return false
}

export interface SignalCluster { lead: PulseSignal; members: PulseSignal[] }

/** Collapse near-duplicate coverage into one story per cluster (single-link pass).
 *  The representative (lead) is the highest-conviction member; the rest group under
 *  it. Order-stable so the ranking downstream is deterministic. */
export function clusterSignals(signals: PulseSignal[], pulse: InvestorPulse): SignalCluster[] {
  const feats = new Map<string, StoryFeatures>()
  for (const s of signals) feats.set(s.id, { sig: significantTokens(s.title), anchors: storyAnchors(s), topic: broadTopic(s) })
  const clusters: PulseSignal[][] = []
  for (const s of signals) {
    const fs = feats.get(s.id)!
    const hit = clusters.find((c) => c.some((m) => sameStory(m, feats.get(m.id)!, s, fs)))
    if (hit) hit.push(s)
    else clusters.push([s])
  }
  return clusters.map((members) => ({
    lead: members.slice().sort((a, b) => convictionScore(b, pulse).score - convictionScore(a, pulse).score)[0],
    members,
  }))
}

/** The distinct outlets across a cluster (deduped by domain, else name). */
function clusterSourceList(members: PulseSignal[]): { kind: EvidenceKind; name: string; url: string }[] {
  const out: { kind: EvidenceKind; name: string; url: string }[] = []
  const seen = new Set<string>()
  for (const m of members) {
    if (!m.sourceName && !m.sourceUrl) continue
    const key = domainOf(m.sourceUrl) || m.sourceName
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ kind: EVIDENCE_BY_CATEGORY[m.category], name: m.sourceName, url: m.sourceUrl })
  }
  return out
}

/** Highest-conviction ideas from a scoped signal set — DEDUPED into stories, then
 *  ranked by conviction (not just freshness), each with 2-line AI reasoning, a
 *  single confidence, the grouped source cluster, a what-to-watch and a full why.
 *  Market intelligence, not a stock call. */
export function convictionIdeas(signals: PulseSignal[], pulse: InvestorPulse): ConvictionIdea[] {
  const clusters = clusterSignals(signals, pulse)
  const freshestId = clusters.map((c) => c.lead).slice().sort(byNewestSignal)[0]?.id
  return clusters
    .map((cl) => ({ cl, c: convictionScore(cl.lead, pulse) }))
    .sort((a, b) => b.c.score - a.c.score)
    .slice(0, 4)
    .map(({ cl, c }) => {
      const s = cl.lead
      const clusterSources = clusterSourceList(cl.members)
      const independentSources = new Set(cl.members.map((m) => domainOf(m.sourceUrl)).filter(Boolean)).size || (s.sourceUrl ? 1 : 0)
      return {
        id: s.id,
        entity: s.scope === 'company' ? s.companyName ?? pulse.company : SECTOR_TOPIC[s.category],
        stars: c.stars,
        reasoning: reasoningLines(s, pulse),
        whatToWatch: whatToWatchFor(s, pulse),
        confidencePct: c.pct,
        evidenceCount: c.evidence.length,
        status: statusOf(s.impact),
        category: s.category,
        why: whyCareFor(s, pulse),
        action: actionForSignal(s, pulse),
        // "Breaking / live" and "new" require GENUINE freshness (source published in the
        // window), not a crawl-stamped date — otherwise an older, just-discovered item
        // would flash as breaking news.
        isBreaking: s.id === freshestId && s.freshness === 'fresh',
        isNew: s.freshness === 'fresh',
        freshLabel: freshLabelFor(s),
        freshness: s.freshness,
        freshnessLabel: s.freshnessLabel,
        publishedLabel: shortDay(s.publishedAt),
        discoveredLabel: shortDay(s.discoveredAt),
        sources: c.evidence,
        impact: s.impact,
        scope: s.scope,
        companyId: s.companyId,
        sourceUrl: s.sourceUrl,
        sourceConfidence: s.confidence,
        clusterSize: cl.members.length,
        clusterSources,
        independentSources,
      }
    })
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
  let pct = Math.round(Math.min(97, base + sourced * 6))
  // A feed carried ONLY by secondary outlets with no verifiable recency can't read as
  // High confidence just because several domains echo it — needs a primary/official
  // source or a genuinely fresh (in-window published) item to clear the High bar.
  const anyPrimaryOrFresh = signals.some((s) => s.confidence === 'High' || s.freshness === 'fresh')
  if (!anyPrimaryOrFresh) pct = Math.min(pct, 79)
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

  // The combined view speaks about the whole pool, not one insurer.
  const company = pulse.companyId === 'all' ? 'The standalone-health pool' : pulse.company
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
  // Metric-linked reads only — no vague "demand looks strong" copy (the brief bans
  // unsupported demand claims; growth is only positive if claims/expense hold).
  if (companyPos > 0 && reg > 0) return 'Growth is only as good as the claims and expense ratios behind it — that is the real question now.'
  if (reg > 0) return 'The near-term read now turns on how the new rules land on pricing, commissions and cost.'
  if (companyPos > 0) return 'Premium momentum is real; the test is whether margins hold as the book scales.'
  if (risk > 0) return 'The tone has softened on margin and claims — worth watching before it hardens into a trend.'
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
  // All-recent counts drive the THEME (why / watch) and the "no data at all" guard.
  const reg = recent.filter((s) => s.category === 'Regulatory').length
  const companyPos = recent.filter((s) => s.scope === 'company' && s.impact === 'Positive').length
  const companyAny = recent.filter((s) => s.scope === 'company').length
  const mgmt = selectManagementEvents(pulse.companyId, { recentOnly: true }).length
  if (reg + companyAny + mgmt === 0 && !one) return { since: '', keyThing: '', why: '', watch: '', nothing: true }

  // In the combined ("all insurers") view the company subject reads as the pool with
  // plural agreement; a single company reads as its own name. (Preserved from the
  // combined-view work on main; folded into the freshness-fixed branches below.)
  const combined = pulse.companyId === 'all'
  const coSubj = combined ? 'the insurers' : pulse.company
  const isVerb = combined ? 'are' : 'is'

  const thesis = {
    keyThing: one ? clamp(scrubCopy(one.sentence), 172) : '',
    why: clamp(scrubCopy(whyLine(recent, reg, companyPos)), 150),
    watch: clamp(scrubCopy(watchLine(pulse, reg)), 150),
    nothing: false,
  }

  // A live PAST-date fallback describes that date's items plainly (the frozen archive
  // is the normal path). No fresh/surfaced split — freshness is measured vs *today*.
  if (!isToday) {
    const bits: string[] = []
    if (reg > 0) bits.push(`${numWord(reg)} regulatory ${reg === 1 ? 'update' : 'updates'} in focus`)
    if (companyPos > 0) bits.push(`${pulse.company} had positive coverage`)
    else if (companyAny > 0) bits.push(`${pulse.company} was in the news`)
    const since = bits.length ? `On ${dateLabel}, ${joinNatural(bits.slice(0, 2))}.` : `On ${dateLabel}, nothing company-specific was recorded.`
    return { since, ...thesis }
  }

  // TODAY — split what genuinely moved from what merely surfaced:
  //   • FRESH        = the source was published/updated in the daily window (real news).
  //   • NEWLY SURFACED = older / publication-unverified item we first found today.
  // The "since the last brief" claim uses FRESH only; newly-surfaced items are shown
  // with honest "recently surfaced" wording and never as a day-over-day development.
  const fresh = recent.filter(isNewDevelopment)
  const surfaced = recent.filter(isNewlySurfaced)
  const regNew = fresh.filter((s) => s.category === 'Regulatory').length
  const companyPosNew = fresh.filter((s) => s.scope === 'company' && s.impact === 'Positive').length
  const companyAnyNew = fresh.filter((s) => s.scope === 'company').length
  const mgmtNew = selectManagementEvents(pulse.companyId, { recentOnly: true }).filter((e) => (e.daysAgo ?? 99) <= 1).length
  const regSurfaced = surfaced.filter((s) => s.category === 'Regulatory').length
  const companyPosSurfaced = surfaced.filter((s) => s.scope === 'company' && s.impact === 'Positive').length
  const companyAnySurfaced = surfaced.filter((s) => s.scope === 'company').length

  // Did THIS company itself move — a company-specific item (fresh, newly surfaced, or
  // a leadership change)? Distinct from the shared sector/regulatory news that shows for
  // every insurer. When it didn't, we say so plainly and BY NAME, so switching the
  // company selector to a quiet name reads honestly instead of dressing sector news up
  // as that company's activity.
  const noCompanyMovement = companyAnyNew === 0 && companyAnySurfaced === 0 && mgmtNew === 0

  // Something was genuinely PUBLISHED in the window → the real "since the last brief".
  if (regNew + companyAnyNew + mgmtNew > 0) {
    // Only attribute "premium growth" when a FRESH positive company item is actually
    // about premium/growth — otherwise a rating/deal/margin item would be misframed.
    const aboutGrowth = fresh.some(
      (s) => s.scope === 'company' && s.impact === 'Positive' && /premium|growth|gwp|nwp|nep|retail health/i.test(`${s.title} ${s.whyItMatters}`),
    )
    const bits: string[] = []
    if (regNew > 0) bits.push(`${numWord(regNew)} regulatory ${regNew === 1 ? 'update' : 'updates'} moved into focus`)
    if (companyPosNew > 0) bits.push(aboutGrowth ? `${coSubj} ${isVerb} back in the news for premium growth` : `${coSubj} received fresh positive coverage`)
    else if (companyAnyNew > 0) bits.push(`${coSubj} received fresh coverage`)
    if (mgmtNew > 0 && bits.length < 2) bits.push(mgmtNew === 1 ? 'there was a leadership change to note' : 'there were leadership changes to note')
    // Fresh items exist but none is company-specific → name the absence, then the sector read.
    if (noCompanyMovement) return { since: `No ${pulse.company}-specific movement since the last brief; ${joinNatural(bits.slice(0, 2))} across the sector.`, ...thesis }
    return { since: `Since the last brief, ${joinNatural(bits.slice(0, 2))}.`, ...thesis }
  }

  // Nothing newly PUBLISHED. If the company itself had items surface, report them
  // honestly as "recently surfaced" (never "since yesterday").
  if (!noCompanyMovement) {
    const lead = companyPosSurfaced > 0
      ? `${coSubj} had recently surfaced positive analyst coverage`
      : `${coSubj} had recently surfaced relevant coverage`
    const regClause = regSurfaced > 0 ? ', alongside older regulatory items now in view' : ''
    return { since: `${lead}${regClause}. No fresh company-specific update was published since the last brief.`, ...thesis }
  }

  // No company-specific movement at all. Say so BY NAME. If there is shared sector /
  // regulatory news, point the reader to it as context that applies across the group;
  // otherwise it is a genuinely quiet day for this name.
  if (regSurfaced + reg > 0) {
    return { since: `No company-specific movement for ${pulse.company} since the last brief — the read below is sector & regulatory context that applies across standalone health insurers.`, ...thesis }
  }
  return { since: `No movement for ${pulse.company} since the last brief. The previous thesis remains live.`, ...thesis }
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
  /** The source article to OPEN for this change, instead of jumping to a dashboard
   *  section. The Pulse market-intelligence items don't live on the dashboard sections
   *  (those are built from other snapshots), so an in-app jump can only land on the
   *  right area, never on the item itself — so when we have a real source we open it,
   *  which always points at the actual update. */
  href?: string
}

/** "Since Yesterday" — real, computable category counts vs the previous brief.
 *  Each item is hidden when it can't be computed / is zero, EXCEPT "unusual market
 *  moves", which shows a reassuring 0 when nothing significant moved. No raw
 *  metrics, no fabricated sentiment. Each item carries a NavTarget so the reader
 *  can jump straight to where that change lives on the dashboard. */
export function sinceYesterday(pulse: InvestorPulse): SinceDelta[] {
  const out: SinceDelta[] = []
  const company = pulse.companyId
  const to = (sahiTab: string): NavTarget => ({ page: 'sahi', sahiTab, company })

  // A day-over-day change requires the SOURCE to have been PUBLISHED/updated inside the
  // window (freshness === 'fresh') — NOT merely discovered/crawled today. Older or
  // publication-unverified items we first found today are "newly surfaced": real, worth
  // a row, but labelled honestly and never counted as a "since yesterday" development.
  // (The feed's first daily run stamps everything captured-today, and evergreen explainer
  // pages carry no real date — both are excluded from "fresh" by construction.)
  const recentSignals = pulse.signals.filter(isRecent)
  const fresh = recentSignals.filter(isNewDevelopment)
  const surfaced = recentSignals.filter(isNewlySurfaced)

  // Each non-metric change carries a LOCATOR focus, so "View in dashboard" scrolls
  // to the exact section it lives in, blips it and pops a small "here it is" note.
  const locTarget = (sahiTab: string, id: string, locatorKind: string, label: string): NavTarget => ({
    ...to(sahiTab),
    focus: buildLocator({ id: `pulse-since-${id}`, locatorKind, company, companyLabel: pulse.company, insightLabel: label, sahiTab }),
  })
  // When a delta is a SINGLE item, its own source is the truest destination — the
  // dashboard sections are built from other snapshots and don't carry this item, so an
  // in-app jump can only reach the right area, not the update. One item → open its source.
  const soleHref = (items: PulseSignal[]): string | undefined => (items.length === 1 && items[0].sourceUrl ? items[0].sourceUrl : undefined)
  const freshestHref = (items: PulseSignal[]): string | undefined => items.filter((s) => s.sourceUrl).sort(byNewestSignal)[0]?.sourceUrl || undefined

  // Regulatory — sourced from the SAME curated feed the "Key Sectoral News"
  // (Regulatory) page shows, keyed the same way, so this row DEEP-LINKS to the
  // exact card. 'new' = the source was published in the window; else honestly
  // 'newly surfaced' (an older source we only just added). Items whose source AND
  // surfaced dates are both older than the window are already known → excluded, so
  // stale regulations no longer masquerade as "since yesterday" changes.
  const regItems = recentRegulatory(todayIso(), 1)
  if (regItems.length) {
    const n = regItems.length
    const top = regItems[0] // newest — the card the click opens + highlights
    const allNew = regItems.every((r) => r.surfacing === 'new')
    const noun = n === 1 ? 'update' : 'updates'
    const label = allNew ? `new regulatory ${noun}` : `newly surfaced regulatory ${noun}`
    out.push({
      id: 'reg',
      label,
      value: String(n),
      direction: 'up',
      tone: 'Watch',
      // In-app deep-link (Path 1) to the exact regulatory card; the card carries the
      // original article link as its secondary action, so no external `href` here.
      target: {
        ...to('sector-news'),
        focus: buildLocator({
          id: 'pulse-since-reg',
          locatorKind: 'regulatory',
          company,
          companyLabel: pulse.company,
          insightLabel: `${n} ${label}`,
          sahiTab: 'sector-news',
          targetItemId: top.itemId,
          targetMonth: top.month,
          sourceDate: top.sourceDate,
          surfacedAt: top.surfacedAt,
          reasonShownToday: top.reasonShownToday,
        }),
      },
    })
  }

  // Company — a "fresh update" ONLY when the source was published in the window; an
  // older/unverified item we merely found today is a "newly surfaced relevant update".
  // The row OPENS the actual article (the freshest one carrying a source), since the
  // dashboard's Companies tab is a financial scorecard, not a news feed. In the combined
  // ("all insurers") view the label reads "company" rather than a single name.
  const coLabel = pulse.companyId === 'all' ? 'company' : pulse.company
  const coFresh = fresh.filter((s) => s.scope === 'company')
  const coSurfaced = surfaced.filter((s) => s.scope === 'company')
  if (coFresh.length) {
    const n = coFresh.length
    out.push({ id: 'co', label: n === 1 ? 'fresh update' : 'fresh updates', value: String(n), direction: 'up', tone: 'Positive', target: locTarget('companies', 'co', 'company', `${n} fresh ${coLabel} ${n === 1 ? 'update' : 'updates'}`), href: freshestHref(coFresh) })
  } else if (coSurfaced.length) {
    const n = coSurfaced.length
    out.push({ id: 'co', label: n === 1 ? 'newly surfaced relevant update' : 'newly surfaced relevant updates', value: String(n), direction: 'up', tone: 'Neutral', target: locTarget('companies', 'co', 'company', `${n} newly surfaced ${coLabel} ${n === 1 ? 'update' : 'updates'}`), href: freshestHref(coSurfaced) })
  } else {
    // No company-specific movement at all — show an explicit, honest "0" (like the
    // market-moves row) so a quiet name reads clearly instead of just omitting the row.
    out.push({ id: 'co', label: 'company-specific updates', value: '0', direction: 'flat', tone: 'Neutral', target: locTarget('companies', 'co', 'company', `No ${coLabel}-specific updates`) })
  }

  // Management changes only when genuinely recent (last day) — not the full 18-month
  // governance window, which would read stale changes as "since yesterday".
  const mgmt = selectManagementEvents(pulse.companyId, { recentOnly: true }).filter((e) => (e.daysAgo ?? 99) <= 1).length
  if (mgmt) out.push({ id: 'mgmt', label: mgmt === 1 ? 'management change' : 'management changes', value: String(mgmt), direction: 'up', tone: 'Neutral', target: locTarget('governance', 'mgmt', 'management', `${mgmt} management ${mgmt === 1 ? 'change' : 'changes'}`) })

  // (Premium-growth YoY is intentionally NOT shown here — it is a standing metric,
  // not a change "since yesterday". It lives on the Premium & Distribution dashboard.
  // #10 honesty: this strip shows only real, computable day-over-day changes.)

  // "Events ahead" counts genuinely FUTURE events only (#7) — a past-dated "active
  // catalyst" is not an event ahead, so it never inflates this strip.
  const events = upcomingEvents(pulse).filter((e) => e.isFirm).length
  if (events) out.push({ id: 'events', label: events === 1 ? 'event ahead' : 'events ahead', value: String(events), direction: 'up', tone: 'Neutral', target: locTarget('governance', 'events', 'events', `${events} ${events === 1 ? 'event' : 'events'} ahead`) })

  // Market reaction only when it is a genuine reported move; 0 shown as reassurance.
  const moveItems = fresh.filter((s) => s.category === 'Data Movement' && isMarketMove(s.title))
  const moves = moveItems.length
  out.push({ id: 'moves', label: moves === 1 ? 'unusual market move' : 'unusual market moves', value: String(moves), direction: moves > 0 ? 'up' : 'flat', tone: moves > 0 ? 'Watch' : 'Positive', target: locTarget('valuation', 'moves', 'market_move', moves > 0 ? `${moves} unusual market ${moves === 1 ? 'move' : 'moves'}` : 'No unusual market moves'), href: soleHref(moveItems) })

  return out
}

// ===========================================================================
//  Frozen daily-brief archive — read side.
//
//  The ingestion writes an immutable brief record per calendar day per company
//  (scripts/ingest/build-pulse-archive.ts). Here we read it: the timeline lists
//  archived past dates (even after they age out of the live feed), and a selected
//  past date renders its FROZEN bundle — exactly what was shown that day, immune to
//  later recompute. Today always recomposes live.
// ===========================================================================

interface FrozenBrief {
  date: string
  status: PulseStatus
  itemCount?: number
  brief: MorningBrief
  message: BriefMessage
  one: OneThing | null
  ideas: ConvictionIdea[]
  sinceDeltas: SinceDelta[]
  events: PulseEvent[]
  actions: PulseAction[]
}

const PULSE_ARCHIVE = (pulseArchive as { briefs?: Record<string, Record<string, FrozenBrief>> }).briefs ?? {}

function frozenBriefFor(companyId: string, date: string): FrozenBrief | null {
  return PULSE_ARCHIVE[companyId]?.[date] ?? null
}
function archivedDatesFor(companyId: string): string[] {
  return Object.keys(PULSE_ARCHIVE[companyId] ?? {})
}

export interface ResolvedDailyBrief {
  brief: MorningBrief
  message: BriefMessage
  one: OneThing | null
  ideas: ConvictionIdea[]
  sinceDeltas: SinceDelta[]
  events: PulseEvent[]
  actions: PulseAction[]
  frozen: boolean
}

/** The brief bundle for the selected date. Today (and any filtered view) recomputes
 *  live; a PAST date on the default view renders its FROZEN archived record — exactly
 *  what was shown that day. A past date with no frozen record falls back to a live
 *  recompute of that date's items (Since-Yesterday / Events / Actions are today-only,
 *  so they are empty in that fallback). */
export function resolveDailyBrief(pulse: InvestorPulse, filter: PulseFilter, dateKey: string, dateLabel: string): ResolvedDailyBrief {
  const isToday = dateKey === 'today'
  if (!isToday && filter === 'relevant') {
    const rec = frozenBriefFor(pulse.companyId, dateKey)
    if (rec) return { brief: rec.brief, message: rec.message, one: rec.one, ideas: rec.ideas, sinceDeltas: rec.sinceDeltas, events: rec.events, actions: rec.actions, frozen: true }
  }
  const scoped = scopeSignals(pulse, filter, dateKey)
  const ideas = convictionIdeas(scoped, pulse)
  const brief = morningBrief(pulse, ideas, scoped, isToday, dateLabel)
  const one = oneThing(scoped, ideas, pulse)
  const message = briefMessage(pulse, scoped, one, isToday, dateLabel)
  // Since-Yesterday / Events / Actions are "today" constructs — a live past-date
  // fallback shows only its brief + conviction. (A frozen record carries the real
  // as-of-that-day values above.)
  const sinceDeltas = isToday ? sinceYesterday(pulse) : []
  const events = isToday ? upcomingEvents(pulse) : []
  const actions = isToday ? actionsForBrief(pulse, scoped) : []
  return { brief, message, one, ideas, sinceDeltas, events, actions, frozen: false }
}

