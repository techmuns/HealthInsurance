// Executive Brief — a one-glance intelligence workspace in ONE unified card:
//   • LEFT  (~30%) a compact navy brief — greeting, 2–3 line narrative, AI
//     confidence, sources, last updated.
//   • CENTER  the one thing to read + the top-3 Highest-Conviction ideas
//     (compact rows; details expand on click).
//   • RIGHT  Since Yesterday · Events Ahead · Action for Today (pills).
//   • FOOTER  source confidence.
// Everything sits above the fold. Subtle motion only; all real, source-derived
// data (see ./derive). Colour is used as signal, never decoration.

import { useEffect, useState } from 'react'
import {
  Sparkles,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
  BookOpen,
  Zap,
  ShieldCheck,
  Users,
  Globe,
  Radar,
  Clock3,
  Scale,
  CalendarClock,
  Landmark,
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
  type PulseAction,
  type ActionIcon,
} from './derive'
import { GOLD, GOLD_ON_NAVY } from './parts'
import { ConvictionOverlay } from './ConvictionPages'
import { SS, readSS, writeSS, clearSS } from './pulseState'

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

      <h2 className="mt-2 font-display text-[18px] font-semibold leading-tight" style={{ color: '#E9C46C' }}>
        {isToday ? `${brief.greeting}.` : `${brief.greeting} · ${dateLabel}`}
      </h2>

      {/* the message — a sharp note, in the Insights editorial serif */}
      <div className="mt-1.5 animate-fade-in space-y-2">
        {message.nothing ? (
          <p className="font-editorial text-[13px] leading-snug text-white/85">No major new insight dropped today. The existing thesis remains live.</p>
        ) : (
          <>
            <p className="font-editorial text-[13px] leading-snug text-white/90">{message.since}</p>
            {message.keyThing && (
              <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(228,198,124,0.08)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.18)' }}>
                <p className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: GOLD_ON_NAVY }}>The one thing you can&rsquo;t miss</p>
                <p className="mt-0.5 font-editorial text-[13px] leading-snug text-white">{message.keyThing}</p>
              </div>
            )}
            <p className="font-editorial text-[12.5px] leading-snug text-white/75">{message.why}</p>
            <p className="font-editorial text-[12.5px] leading-snug text-white/75">
              <span className="align-[1px] text-[8px] font-sans font-bold uppercase not-italic tracking-[0.12em]" style={{ color: GOLD_ON_NAVY }}>Watch next&nbsp;·&nbsp;</span>
              {message.watch}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ── CENTER · one thing + conviction ───────────────────────────────────────────

const clampPage = (s: string | null): number => {
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 && n <= 2 ? n : 0
}

const CAT_LABEL: Record<string, string> = {
  'Analyst Action': 'Analyst view',
  'Sector Catalyst': 'Sector',
  Regulatory: 'Regulatory',
  Management: 'Management',
  Filing: 'Filing',
  'Data Movement': 'Market move',
}

// Collapsed conviction card — compact, no stars/%: a category dot, the topic, a
// one-line read, source count + category, and an "Open note" affordance. Clicking
// opens the single insight-note overlay (never an inline expansion).
function ConvictionCard({ idea, active, onOpen }: { idea: ConvictionIdea; active: boolean; onOpen: () => void }) {
  const accent = accentFor(idea)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={`group flex w-full items-start gap-2 rounded-lg border bg-white px-2.5 py-2 text-left shadow-soft transition-all ${active ? 'border-champagne shadow-card' : 'border-soft-border hover:border-champagne/60 hover:shadow-card'} ${idea.isNew ? 'glow-new' : ''}`}
    >
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 0 3px ${accent}1f` }} title={idea.category === 'Regulatory' ? 'Regulatory' : idea.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-bold text-navy-deep">{idea.entity}</span>
          {idea.isBreaking && (
            <span className="inline-flex items-center gap-1 rounded-full px-1 text-[7.5px] font-bold uppercase tracking-wide text-coral" style={{ background: 'rgba(192,88,79,0.10)' }}>
              <span className="pulse-live h-1 w-1 rounded-full" style={{ background: '#C0584F' }} /> Live
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-ink-secondary">{idea.reasoning[0]}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[9px] font-semibold text-ink-secondary">
          <span>
            {idea.evidenceCount} source{idea.evidenceCount === 1 ? '' : 's'}
          </span>
          <span className="h-2.5 w-px bg-soft-border" />
          <span className="uppercase tracking-[0.06em]">{CAT_LABEL[idea.category] ?? 'Signal'}</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-[0.08em] text-champagne-deep">
            Open note <BookOpen className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
          </span>
        </div>
      </div>
    </button>
  )
}

function ConvictionList({ ideas, companyId, onNavigate }: { ideas: ConvictionIdea[]; companyId: string; onNavigate?: (t: NavTarget, id: string) => void }) {
  const top = ideas.slice(0, 3)

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
        <div className="space-y-1.5">
          {top.map((idea) => (
            <ConvictionCard key={idea.id} idea={idea} active={idea.id === openId} onOpen={() => open(idea.id)} />
          ))}
        </div>
      )}
      {openIdea && (
        <ConvictionOverlay idea={openIdea} companyId={companyId} page={page} onPage={changePage} onClose={close} onNavigate={onNavigate} />
      )}
    </div>
  )
}

// ── RIGHT · since yesterday + events + actions ────────────────────────────────

function SinceYesterdayBlock({ deltas, onNavigate }: { deltas: SinceDelta[]; onNavigate?: (t: NavTarget, id: string) => void }) {
  if (deltas.length === 0) return null
  return (
    <div className="px-4 py-3">
      <SectionHead icon={RefreshCw} label="Since Yesterday" note="view in dashboard" />
      <div className="space-y-0.5">
        {deltas.map((d) => {
          const tone = IMPACT_META[d.tone]
          const Icon = d.direction === 'down' ? ArrowDown : d.direction === 'flat' ? Minus : ArrowUp
          return (
            <button
              key={d.id}
              type="button"
              disabled={!onNavigate}
              onClick={() => onNavigate?.(d.target, `pulse-since-${d.id}`)}
              title={onNavigate ? 'View in dashboard' : undefined}
              className={`group flex w-full items-baseline gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors ${onNavigate ? 'cursor-pointer hover:bg-ice/70' : 'cursor-default'}`}
            >
              <Icon className="h-3 w-3 shrink-0 self-center" strokeWidth={2.4} style={{ color: tone.fg }} />
              <span className="text-[12.5px] font-bold text-navy-deep">{d.value}</span>
              <span className="text-[10.5px] text-ink-secondary">{d.label}</span>
              {onNavigate && (
                <span className="ml-auto flex shrink-0 items-center gap-0.5 self-center text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ink-secondary/45 transition-colors group-hover:text-champagne-deep">
                  <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-[36px] group-hover:opacity-100">View</span>
                  <ArrowUpRight className="h-3 w-3" strokeWidth={2.2} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EventsBlock({ events }: { events: PulseEvent[] }) {
  return (
    <div className="px-4 py-3">
      <SectionHead icon={Clock3} label="Events Ahead" note={`${events.length}`} />
      <div className="space-y-1">
        {events.slice(0, 3).map((e) => {
          const inner = (
            <>
              <div className="flex h-7 w-8 shrink-0 flex-col items-center justify-center rounded-md border border-soft-border bg-surface-tint">
                <span className="text-[6.5px] font-bold uppercase text-champagne-deep">{e.month}</span>
                <span className="text-[11px] font-bold leading-none text-navy-deep">{e.day}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10.5px] font-semibold text-navy-deep">{e.kindLabel}</p>
                <p className="text-[9px] font-semibold" style={{ color: e.isFirm ? '#2F855A' : '#9C7430' }}>{e.whenLabel}</p>
              </div>
            </>
          )
          const cls = 'flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors'
          return e.url ? (
            <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className={`${cls} hover:bg-ice/70`} title={`Open source — ${e.title}`}>{inner}</a>
          ) : (
            <div key={e.id} className={cls} title={e.title}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}

const ACTION_ICON: Record<ActionIcon, LucideIcon> = { ownership: Users, margins: Scale, source: ShieldCheck, agm: CalendarClock, regulation: Landmark }

function ActionsBlock({ actions, onRun }: { actions: PulseAction[]; onRun: (a: PulseAction) => void }) {
  return (
    <div className="px-4 py-3">
      <SectionHead icon={Zap} label="Action for Today" />
      <div className="grid grid-cols-2 gap-1.5">
        {actions.map((a) => {
          const Icon = ACTION_ICON[a.icon]
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onRun(a)}
              className="group flex items-center gap-1.5 rounded-lg border border-soft-border bg-white px-2 py-1.5 text-left shadow-soft transition-colors hover:border-champagne hover:bg-champagne-soft/40"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={{ background: 'rgba(182,139,58,0.10)', boxShadow: 'inset 0 0 0 1px rgba(182,139,58,0.22)' }}>
                <Icon className="h-3 w-3" strokeWidth={2} style={{ color: GOLD }} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold text-navy-deep">{a.label}</span>
              <ArrowUpRight className="h-3 w-3 shrink-0 text-ink-secondary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={a.href ? { color: GOLD } : undefined} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── FOOTER · source confidence ────────────────────────────────────────────────

const CONF_COLOR: Record<string, string> = { High: '#0E6F6D', Medium: '#9C7430', Low: '#8C7A55' }

function Footer({ brief, pulse }: { brief: MorningBrief; pulse: InvestorPulse }) {
  const conf = pulse.confidence
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-soft-border bg-surface-tint/60 px-4 py-2">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-ink-secondary">
        <Globe className="h-3 w-3" strokeWidth={2.1} style={{ color: GOLD }} />
        {brief.developmentsCount} developments · {brief.sourcesCount} source-backed · {brief.domainsCount} distinct
      </span>
      <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: CONF_COLOR[conf], background: `${CONF_COLOR[conf]}14` }}>
        <ShieldCheck className="h-3 w-3" strokeWidth={2.2} />
        {conf} source confidence
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
  actions,
  isToday,
  dateLabel,
  onRun,
  onNavigate,
}: {
  pulse: InvestorPulse
  brief: MorningBrief
  message: BriefMessage
  sinceDeltas: SinceDelta[]
  ideas: ConvictionIdea[]
  events: PulseEvent[]
  actions: PulseAction[]
  isToday: boolean
  dateLabel: string
  onRun: (a: PulseAction) => void
  onNavigate?: (t: NavTarget, id: string) => void
}) {
  return (
    <section className="premium-panel overflow-hidden rounded-2xl">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.34fr)_minmax(0,0.92fr)]">
        {/* LEFT — the message brief */}
        <CompactBrief brief={brief} message={message} isToday={isToday} dateLabel={dateLabel} />

        {/* CENTER — Highest Conviction Ideas */}
        <div className="min-w-0 border-t border-soft-border lg:border-l lg:border-t-0">
          <ConvictionList ideas={ideas} companyId={pulse.companyId} onNavigate={onNavigate} />
        </div>

        {/* RIGHT — since yesterday · events · actions */}
        <div className="min-w-0 divide-y divide-soft-border/70 border-t border-soft-border lg:border-l lg:border-t-0">
          <SinceYesterdayBlock deltas={sinceDeltas} onNavigate={onNavigate} />
          {isToday && events.length > 0 && <EventsBlock events={events} />}
          {isToday && actions.length > 0 && <ActionsBlock actions={actions} onRun={onRun} />}
        </div>
      </div>
      <Footer brief={brief} pulse={pulse} />
    </section>
  )
}
