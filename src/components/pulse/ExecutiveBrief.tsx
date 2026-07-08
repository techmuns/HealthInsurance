// Executive Brief — a one-glance intelligence workspace in ONE unified card:
//   • LEFT  (~30%) a compact navy brief — greeting, 2–3 line narrative, AI
//     confidence, sources, last updated.
//   • CENTER  the one thing to read + the top-3 Highest-Conviction ideas
//     (compact rows; details expand on click).
//   • RIGHT  Since Yesterday · Events Ahead · Action for Today (pills).
//   • FOOTER  source confidence.
// Everything sits above the fold. Subtle motion only; all real, source-derived
// data (see ./derive). Colour is used as signal, never decoration.

import { useEffect, useState, type ReactNode } from 'react'
import {
  Sparkles,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
  BookOpen,
  Globe,
  Radar,
  Clock3,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react'
import { IMPACT_META, type InvestorPulse } from '@/insights/investorPulse'
import type { NavTarget } from '@/insights/sourceMap'
import {
  STATUS_COLOR,
  type MorningBrief,
  type BriefMessage,
  type SinceDelta,
  type ConvictionIdea,
  type PulseEvent,
} from './derive'
import { GOLD, GOLD_ON_NAVY, PeStatusPill, ExposureChip, PeActionChip } from './parts'
import { ConvictionOverlay } from './ConvictionPages'
import { toPeBriefItem, type PeBriefItem } from '@/lib/peBrief'
import { SS, readSS, writeSS, clearSS } from './pulseState'
import { insurers } from '@/data/mockData'

// ── auto-emphasis — bold the numbers, insurer names and key metric terms inside a
// card's summary, so the eye lands on what matters without reading every word. Kept
// tight (metrics + events + money), never so broad that everything bolds. ─────────
const EMPH_KEYWORDS = [
  'competitive intensity', 'market share', 'combined ratio', 'claims ratio', 'expense ratio',
  'commissions', 'commission', 'solvency', 'persistency', 're-rating', 'valuation',
  'capital', 'pricing', 'distribution', 'IPO', 'M&A', 'FDI',
]
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const EMPH_NAMES = (insurers as { shortName: string }[]).map((i) => i.shortName).filter(Boolean).sort((a, b) => b.length - a.length)
const EMPH_RE = new RegExp(
  '(' +
    [
      '₹\\s?[\\d,]+(?:\\.\\d+)?(?:\\s?(?:cr|crore|lakh|bn|mn|billion|million))?',
      '\\d+(?:\\.\\d+)?\\s?%',
      '\\d+(?:\\.\\d+)?\\s?(?:bps|ppt|pp|x)\\b',
      ...EMPH_NAMES.map(escapeRe),
      ...EMPH_KEYWORDS.map(escapeRe),
    ].join('|') +
    ')',
  'gi',
)
function emphasize(text: string): ReactNode[] {
  if (!text) return [text]
  return text.split(EMPH_RE).map((part, i) => (i % 2 === 1 ? <strong key={i} className="font-bold text-navy-deep">{part}</strong> : part))
}

// Colour-psychology signal: regulatory = orange (caution); otherwise the status
// colour (green constructive / gold watch / red risk / slate neutral).
const ORANGE = '#C2703D'
function accentFor(idea: ConvictionIdea): string {
  return idea.category === 'Regulatory' ? ORANGE : STATUS_COLOR[idea.status].dot
}


function SectionHead({ icon: Icon, label, note }: { icon: LucideIcon; label: string; note?: string }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} style={{ color: GOLD }} />
      <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-navy-deep">{label}</span>
      <span className="gold-rule h-px flex-1 rounded-full opacity-70" />
      {note && <span className="text-[9px] font-semibold text-ink-secondary">{note}</span>}
    </div>
  )
}

// ── LEFT · compact Executive Brief (navy) ─────────────────────────────────────

// Qualitative source-confidence, tuned to read on the navy field (no % — the
// number was dropped from the brief on purpose).
const CONF_ON_NAVY: Record<string, string> = { High: '#4FD1C5', Medium: '#E9C46C', Low: '#C4B487' }

function CompactBrief({ brief, message, isToday, dateLabel }: { brief: MorningBrief; message: BriefMessage; isToday: boolean; dateLabel: string }) {
  return (
    <div className="relative isolate flex min-w-0 flex-col overflow-hidden px-4 py-3.5" style={{ background: 'linear-gradient(160deg, #1C3A6E 0%, #15294C 60%, #102140 100%)' }}>
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(circle at 92% 100%, rgba(214,178,98,0.24) 0%, transparent 46%), radial-gradient(circle at 4% 4%, rgba(96,138,206,0.24) 0%, transparent 46%)' }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(228,198,124,0.45) 30%, rgba(228,198,124,0.45) 70%, transparent)' }} />

      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.14em]" style={{ color: GOLD_ON_NAVY, background: 'rgba(228,198,124,0.10)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.24)' }}>
          <Sparkles className="h-2.5 w-2.5" strokeWidth={2.2} /> Executive Brief
        </span>
        <span className="inline-flex items-center gap-1 text-[8.5px] font-semibold text-white/50">
          <RefreshCw className="h-2.5 w-2.5" strokeWidth={2} style={{ color: 'rgba(228,198,124,0.8)' }} /> {brief.lastUpdatedLabel}
        </span>
      </div>

      <h2 className="mt-2.5 font-display text-[20px] font-semibold leading-tight" style={{ color: '#E9C46C' }}>
        {isToday ? `${brief.greeting}.` : `${brief.greeting} · ${dateLabel}`}
      </h2>

      {/* the message — a sharp note, in the Insights editorial serif. Given a
          little more room to breathe now that the stats block has gone. */}
      <div className="mt-3.5 animate-fade-in space-y-4">
        {message.nothing ? (
          <p className="font-editorial text-[14px] leading-loose text-white/85">No major new insight dropped today. The existing thesis remains live.</p>
        ) : (
          <>
            <p className="font-editorial text-[14px] leading-loose text-white/90">{message.since}</p>
            {message.keyThing && (
              <div className="rounded-lg px-3.5 py-2.5" style={{ background: 'rgba(228,198,124,0.08)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.18)' }}>
                <p className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: GOLD_ON_NAVY }}>The one thing you can&rsquo;t miss</p>
                <p className="mt-1.5 font-editorial text-[14px] leading-loose text-white">{message.keyThing}</p>
              </div>
            )}
            <p className="font-editorial text-[13.5px] leading-loose text-white/75">{message.why}</p>
            <p className="font-editorial text-[13.5px] leading-loose text-white/75">
              <span className="align-[1px] text-[8px] font-sans font-bold uppercase not-italic tracking-[0.12em]" style={{ color: GOLD_ON_NAVY }}>Watch next&nbsp;·&nbsp;</span>
              {message.watch}
            </p>
          </>
        )}
      </div>

      {/* signature line — anchors the bottom of the note: qualitative source
          confidence (no %) + how long it reads. */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: 'rgba(228,198,124,0.16)' }}>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
          style={{ color: CONF_ON_NAVY[brief.confidenceTier], background: `${CONF_ON_NAVY[brief.confidenceTier]}22` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: CONF_ON_NAVY[brief.confidenceTier] }} />
          {brief.confidenceTier} source confidence
        </span>
        <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-white/55">
          <Clock3 className="h-3 w-3" strokeWidth={2} style={{ color: 'rgba(228,198,124,0.75)' }} />
          {brief.readingMins} min read
        </span>
      </div>
    </div>
  )
}

// ── CENTER · one thing + conviction ───────────────────────────────────────────

const clampPage = (s: string | null): number => {
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 && n <= 2 ? n : 0
}

// Confidence tone for the compact card's single confidence marker.
const CONF_TONE: Record<string, string> = { High: '#0E6F6D', Medium: '#9C7430', Low: '#8C7A55' }

// Collapsed conviction card — compact: a category dot, the topic, the PE tags
// (Status · Exposure · Action) that the PDF brief also shows, a one-line read, a
// single confidence + source count, and an "Open note" affordance. Clicking opens
// the single insight-note overlay (never an inline expansion).
function ConvictionCard({ idea, pe, active, onOpen }: { idea: ConvictionIdea; pe: PeBriefItem; active: boolean; onOpen: () => void }) {
  const accent = accentFor(idea)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={`group flex w-full items-start gap-2.5 rounded-xl border bg-white px-3.5 py-3 text-left shadow-soft transition-all ${active ? 'border-champagne shadow-card' : 'border-soft-border hover:border-champagne/60 hover:shadow-card'} ${idea.isNew ? 'glow-new' : ''}`}
    >
      <span className="mt-[6px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 0 3px ${accent}22` }} title={idea.category === 'Regulatory' ? 'Regulatory' : idea.status} />
      <div className="min-w-0 flex-1">
        {/* headline — full and bold: the thing the eye should land on first */}
        <h4 className="text-[14.5px] font-bold leading-snug text-navy-deep">
          {idea.entity}
          {idea.isBreaking && (
            <span className="ml-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] align-middle text-[8px] font-bold uppercase tracking-wide text-coral" style={{ background: 'rgba(192,88,79,0.12)' }}>
              <span className="pulse-live h-1 w-1 rounded-full" style={{ background: '#C0584F' }} /> Live
            </span>
          )}
        </h4>
        {/* summary — the full read in darker, heavier text with key terms auto-bolded,
            so the card alone tells you what happened and why it matters. One strong,
            specific line (the deeper story + impact live one tap away in the note). */}
        {idea.reasoning[0] && (
          <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-ink-primary">{emphasize(idea.reasoning[0])}</p>
        )}
        {/* signal row — status · freshness · exposure · next action */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <PeStatusPill status={pe.status} hint={pe.statusHint} />
          {idea.freshLabel && (
            <span
              className="inline-flex shrink-0 items-center rounded-full px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wide"
              style={
                idea.freshness === 'fresh'
                  ? { color: '#2F855A', background: 'rgba(47,133,90,0.10)', boxShadow: 'inset 0 0 0 1px rgba(47,133,90,0.22)' }
                  : { color: '#9C7430', background: 'rgba(156,116,48,0.12)', boxShadow: 'inset 0 0 0 1px rgba(156,116,48,0.24)' }
              }
              title={idea.freshness === 'fresh' ? 'Source published within the daily window' : 'Older item — first surfaced today, not newly published'}
            >
              {idea.freshLabel}
            </span>
          )}
          <ExposureChip level={pe.exposure.level} basis={pe.exposure.basis} />
          <PeActionChip verb={pe.action.verb} label={pe.action.label} />
        </div>
        {/* footer — one confidence · sources · open for depth */}
        <div className="mt-2 flex items-center gap-2 text-[9.5px] font-semibold text-ink-secondary">
          <span className="inline-flex items-center gap-1" title={pe.confidenceWhy}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: CONF_TONE[pe.confidence] }} />
            {pe.confidence} confidence
          </span>
          <span className="h-2.5 w-px bg-soft-border" />
          <span title={pe.sourceLabel}>
            {idea.evidenceCount} source{idea.evidenceCount === 1 ? '' : 's'}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] text-champagne-deep">
            Open note <BookOpen className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
          </span>
        </div>
      </div>
    </button>
  )
}

function ConvictionList({ ideas, companyId, company, onNavigate }: { ideas: ConvictionIdea[]; companyId: string; company: string; onNavigate?: (t: NavTarget, id: string) => void }) {
  const top = ideas.slice(0, 6)
  const peOf = (idea: ConvictionIdea): PeBriefItem => toPeBriefItem(idea, companyId, company)

  // Single open note (only one at a time), restored after a dashboard round-trip.
  const restoredId = readSS(SS.openIdea, companyId)
  const initId = top.some((i) => i.id === restoredId) ? restoredId : null
  const [openId, setOpenId] = useState<string | null>(initId)
  const [page, setPage] = useState(() => (initId ? clampPage(readSS(SS.openPage, companyId)) : 0))
  const openIdea = top.find((i) => i.id === openId) ?? null

  const open = (id: string) => {
    setOpenId(id)
    setPage(0)
    writeSS(SS.openIdea, companyId, id)
    writeSS(SS.openPage, companyId, '0')
  }
  const close = () => {
    setOpenId(null)
    clearSS(SS.openIdea, companyId)
  }
  const changePage = (p: number) => {
    setPage(p)
    if (openId) {
      writeSS(SS.openIdea, companyId, openId)
      writeSS(SS.openPage, companyId, String(p))
    }
  }

  // Esc closes the note.
  useEffect(() => {
    if (!openId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenId(null)
        clearSS(SS.openIdea, companyId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, companyId])

  return (
    <div className="relative flex h-full flex-col px-4 py-3">
      <SectionHead icon={Radar} label="Highest Conviction Ideas" note="tap to open the note" />
      {top.length === 0 ? (
        <p className="rounded-lg border border-dashed border-soft-border bg-ice/40 px-3 py-4 text-center text-[11px] text-ink-secondary">Nothing meets the conviction bar under this filter.</p>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto scroll-thin pr-0.5">
          {top.map((idea) => (
            <ConvictionCard key={idea.id} idea={idea} pe={peOf(idea)} active={idea.id === openId} onOpen={() => open(idea.id)} />
          ))}
        </div>
      )}
      {openIdea && (
        <ConvictionOverlay idea={openIdea} pe={peOf(openIdea)} companyId={companyId} page={page} onPage={changePage} onClose={close} onNavigate={onNavigate} />
      )}
    </div>
  )
}

// ── RIGHT · since yesterday + events + actions ────────────────────────────────

// A compact, horizontal "since yesterday" strip for the full-width context band —
// a small label then each real, computable delta as an inline, tappable pill.
function SinceYesterdayBlock({ deltas, onNavigate }: { deltas: SinceDelta[]; onNavigate?: (t: NavTarget, id: string) => void }) {
  if (deltas.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-navy-deep">
        <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.2} style={{ color: GOLD }} />
        Since Yesterday
      </span>
      {deltas.map((d) => {
        const tone = IMPACT_META[d.tone]
        const Icon = d.direction === 'down' ? ArrowDown : d.direction === 'flat' ? Minus : ArrowUp
        // A delta with a source OPENS the real update; otherwise it jumps to the nearest
        // in-app section. A zero/flat row ("0 unusual moves") is informational, not tappable.
        const isLink = !!d.href
        const canNav = !isLink && !!onNavigate && d.direction !== 'flat'
        const inner = (
          <>
            <Icon className="h-3 w-3 shrink-0" strokeWidth={2.4} style={{ color: tone.fg }} />
            <span className="text-[12px] font-bold text-navy-deep">{d.value}</span>
            <span className="text-[10.5px] text-ink-secondary">{d.label}</span>
          </>
        )
        const chevron = <ArrowUpRight className="h-3 w-3 text-ink-secondary/45 transition-colors group-hover:text-champagne-deep" strokeWidth={2.2} />
        const base = 'group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors'
        if (isLink) {
          return (
            <a key={d.id} href={d.href} target="_blank" rel="noreferrer" title="Open the update" className={`${base} cursor-pointer hover:bg-ice/70`}>
              {inner}
              {chevron}
            </a>
          )
        }
        return (
          <button
            key={d.id}
            type="button"
            disabled={!canNav}
            onClick={() => canNav && onNavigate?.(d.target, `pulse-since-${d.id}`)}
            title={canNav ? 'View in dashboard' : undefined}
            className={`${base} ${canNav ? 'cursor-pointer hover:bg-ice/70' : 'cursor-default'}`}
          >
            {inner}
            {canNav && chevron}
          </button>
        )
      })}
    </div>
  )
}

// A compact, horizontal "events ahead" strip — future, firm-dated catalysts only.
function EventsBlock({ events }: { events: PulseEvent[] }) {
  const future = events.filter((e) => e.isFirm)
  if (future.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-navy-deep">
        <Clock3 className="h-3.5 w-3.5" strokeWidth={2.2} style={{ color: GOLD }} />
        Events Ahead
      </span>
      {future.slice(0, 3).map((e) => {
        const inner = (
          <>
            <span className="flex h-6 w-7 shrink-0 flex-col items-center justify-center rounded-md border border-soft-border bg-white">
              <span className="text-[6px] font-bold uppercase leading-none text-champagne-deep">{e.month}</span>
              <span className="text-[10px] font-bold leading-none text-navy-deep">{e.day}</span>
            </span>
            <span className="text-[10.5px] font-semibold text-navy-deep">{e.kindLabel}</span>
            <span className="text-[9px] font-semibold" style={{ color: e.isFirm ? '#2F855A' : '#9C7430' }}>{e.whenLabel}</span>
          </>
        )
        const cls = 'inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors'
        return e.url ? (
          <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className={`${cls} hover:bg-ice/70`} title={`Open source — ${e.title}`}>{inner}</a>
        ) : (
          <div key={e.id} className={cls} title={e.title}>{inner}</div>
        )
      })}
    </div>
  )
}

// ── FOOTER · evidence base (source confidence now lives in the brief signature) ──

function Footer({ brief }: { brief: MorningBrief }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-soft-border bg-surface-tint/60 px-4 py-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-ink-secondary">
        <Globe className="h-3 w-3" strokeWidth={2.1} style={{ color: GOLD }} />
        {brief.developmentsCount} developments · {brief.sourcesCount} source-backed · {brief.domainsCount} distinct
      </span>
      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-ink-secondary">
        <RefreshCw className="h-3 w-3" strokeWidth={2.1} style={{ color: GOLD }} />
        Updated {brief.lastUpdatedLabel}
      </span>
    </div>
  )
}

// ── composition — one unified card, three columns, one-glance ─────────────────

export function ExecutiveBrief({
  pulse,
  brief,
  message,
  sinceDeltas,
  ideas,
  events,
  isToday,
  dateLabel,
  onNavigate,
}: {
  pulse: InvestorPulse
  brief: MorningBrief
  message: BriefMessage
  sinceDeltas: SinceDelta[]
  ideas: ConvictionIdea[]
  events: PulseEvent[]
  isToday: boolean
  dateLabel: string
  onNavigate?: (t: NavTarget, id: string) => void
}) {
  return (
    <section className="premium-panel flex flex-col overflow-hidden rounded-2xl lg:min-h-[calc(100vh-232px)]">
      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)] lg:grid-rows-[minmax(0,1fr)]">
        {/* LEFT — the message brief */}
        <CompactBrief brief={brief} message={message} isToday={isToday} dateLabel={dateLabel} />

        {/* RIGHT — the day's insights, given full width to read */}
        <div className="flex min-w-0 flex-col border-t border-soft-border lg:min-h-0 lg:border-l lg:border-t-0">
          <ConvictionList ideas={ideas} companyId={pulse.companyId} company={pulse.company} onNavigate={onNavigate} />
        </div>
      </div>

      {/* CONTEXT BAND — since yesterday · events ahead, as a slim full-width strip.
          Presence-driven: today's live view populates it; a live past-date fallback
          passes them empty (hidden); a FROZEN record carries the real as-of-that-day
          values. */}
      {(sinceDeltas.length > 0 || events.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-soft-border bg-surface-tint/40 px-4 py-2.5">
          <SinceYesterdayBlock deltas={sinceDeltas} onNavigate={onNavigate} />
          {events.length > 0 && <EventsBlock events={events} />}
        </div>
      )}
      <Footer brief={brief} />
    </section>
  )
}
