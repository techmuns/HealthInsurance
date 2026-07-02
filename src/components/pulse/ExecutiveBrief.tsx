// Executive Brief — a one-glance intelligence workspace in ONE unified card:
//   • LEFT  (~30%) a compact navy brief — greeting, 2–3 line narrative, AI
//     confidence, sources, last updated.
//   • CENTER  the one thing to read + the top-3 Highest-Conviction ideas
//     (compact rows; details expand on click).
//   • RIGHT  Since Yesterday · Events Ahead · Action for Today (pills).
//   • FOOTER  source confidence.
// Everything sits above the fold. Subtle motion only; all real, source-derived
// data (see ./derive). Colour is used as signal, never decoration.

import { useState } from 'react'
import {
  Sparkles,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronDown,
  Star,
  Zap,
  ShieldCheck,
  Users,
  History,
  TrendingUp,
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
import {
  STATUS_COLOR,
  type MorningBrief,
  type OneThing,
  type SinceDelta,
  type ConvictionIdea,
  type PulseEvent,
  type PulseAction,
  type ActionIcon,
} from './derive'
import { SourceChip, GOLD, GOLD_ON_NAVY } from './parts'
import { useCountUp, useTypewriter } from './hooks'

// Colour-psychology signal: regulatory = orange (caution); otherwise the status
// colour (green constructive / gold watch / red risk / slate neutral).
const ORANGE = '#C2703D'
function accentFor(idea: ConvictionIdea): string {
  return idea.category === 'Regulatory' ? ORANGE : STATUS_COLOR[idea.status].dot
}

function CountVal({ value, suffix = '' }: { value: number; suffix?: string }) {
  const v = useCountUp(value, 850)
  return (
    <>
      {Math.round(v)}
      {suffix}
    </>
  )
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

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-[1px]" title={`${n} / 5 conviction`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className="h-3 w-3" strokeWidth={1.6} style={{ color: i <= n ? GOLD : 'rgba(39,69,126,0.20)', fill: i <= n ? GOLD : 'transparent' }} />
      ))}
    </span>
  )
}

function ConfidenceRing({ pct, tier, size = 54 }: { pct: number; tier: string; size?: number }) {
  const v = useCountUp(pct, 1000)
  const r = size / 2 - 4
  const C = 2 * Math.PI * r
  const color = tier === 'High' ? '#3BB6A6' : tier === 'Medium' ? GOLD_ON_NAVY : '#B9A16A'
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} />
      </svg>
      <div className="absolute text-[13px] font-bold leading-none text-white">
        {Math.round(v)}
        <span className="text-[8px]">%</span>
      </div>
    </div>
  )
}

// ── LEFT · compact Executive Brief (navy) ─────────────────────────────────────

function CompactBrief({ brief, isToday, dateLabel }: { brief: MorningBrief; isToday: boolean; dateLabel: string }) {
  const { shown, done } = useTypewriter(brief.narrative)
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

      <h2 className="mt-2 font-display text-[17px] font-semibold leading-tight" style={{ color: '#E9C46C' }}>
        {isToday ? `${brief.greeting}.` : `${brief.greeting} · ${dateLabel}`}
      </h2>
      <p className="mt-1 min-h-[3.6em] text-[11.5px] leading-snug text-white/85">
        {shown}
        {!done && <span className="type-caret" style={{ color: GOLD_ON_NAVY }} />}
      </p>

      <div className="mt-auto space-y-3 border-t pt-3" style={{ borderColor: 'rgba(228,198,124,0.16)' }}>
        <div className="flex items-center gap-2.5">
          <ConfidenceRing pct={brief.confidencePct} tier={brief.confidenceTier} />
          <div className="min-w-0">
            <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/45">AI confidence</div>
            <div className="text-[13px] font-bold text-white">{brief.confidenceTier}</div>
            <div className="text-[9px] font-medium text-white/45">source quality · freshness</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-2.5" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/45">Sources analysed</div>
            <div className="text-[11.5px] font-bold text-white">
              <CountVal value={brief.sourcesCount} />
              <span className="text-[9px] font-semibold text-white/50"> · {brief.domainsCount} distinct</span>
            </div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/45">Reading time</div>
            <div className="text-[11.5px] font-bold text-white">
              <CountVal value={brief.readingMins} /> min
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/45">Last updated</div>
            <div className="text-[11.5px] font-bold text-white">{brief.lastUpdatedLabel}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CENTER · one thing + conviction ───────────────────────────────────────────

function OneThingRow({ one }: { one: OneThing | null }) {
  if (!one) return null
  const c = STATUS_COLOR[one.status]
  return (
    <div className="relative overflow-hidden px-4 py-3" style={{ background: 'linear-gradient(100deg, rgba(228,198,124,0.10), transparent 70%)' }}>
      <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-full" style={{ background: 'linear-gradient(180deg, #E4C67C, #B68B3A)' }} />
      <div className="flex items-center gap-1.5 pl-1.5">
        <Sparkles className="h-3 w-3 text-champagne-deep" strokeWidth={2} />
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-champagne-deep">If you read only one thing today</span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      </div>
      <p className="mt-1 pl-1.5 font-editorial text-[14px] font-medium leading-snug text-navy-deep">&ldquo;{one.sentence}&rdquo;</p>
    </div>
  )
}

function ExpandRow({ icon: Icon, label, text }: { icon: LucideIcon; label: string; text: string }) {
  return (
    <div className="flex gap-1.5">
      <Icon className="mt-0.5 h-3 w-3 shrink-0 text-navy-primary" strokeWidth={2} />
      <div className="min-w-0">
        <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-ink-secondary">{label}: </span>
        <span className="text-[10.5px] leading-snug text-ink-primary">{text}</span>
      </div>
    </div>
  )
}

function ConvictionRow({ idea }: { idea: ConvictionIdea }) {
  const [open, setOpen] = useState(false)
  const accent = accentFor(idea)
  const w = idea.why
  return (
    <div className={`rounded-lg border border-soft-border bg-white ${idea.isNew ? 'glow-new' : ''}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={`flex w-full items-start gap-2 px-2.5 py-2 text-left transition-colors ${open ? 'bg-ice/50' : 'hover:bg-ice/40'}`}>
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 0 3px ${accent}1f` }} title={idea.category === 'Regulatory' ? 'Regulatory' : idea.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-bold text-navy-deep">{idea.entity}</span>
            {idea.isBreaking && (
              <span className="inline-flex items-center gap-1 rounded-full px-1 text-[7.5px] font-bold uppercase tracking-wide text-coral" style={{ background: 'rgba(192,88,79,0.10)' }}>
                <span className="pulse-live h-1 w-1 rounded-full" style={{ background: '#C0584F' }} /> Live
              </span>
            )}
            <span className="ml-auto shrink-0">
              <Stars n={idea.stars} />
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-ink-secondary">{idea.reasoning[0]}</p>
          <p className="mt-0.5 line-clamp-1 text-[10px] leading-snug">
            <span className="font-bold uppercase tracking-[0.05em] text-champagne-deep">Watch · </span>
            <span className="text-ink-secondary">{idea.whatToWatch}</span>
          </p>
        </div>
        <ChevronDown className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-soft-border/70 bg-surface-tint/40 px-2.5 py-2 pl-[18px]">
          <div className="flex items-center gap-1.5 text-[9px] font-semibold text-ink-secondary">
            <span>{idea.confidencePct}% confidence</span>
            <span>·</span>
            <span>{idea.evidenceCount} source{idea.evidenceCount === 1 ? '' : 's'}</span>
          </div>
          <ExpandRow icon={ShieldCheck} label="Why should I care" text={w.whyItMatters} />
          <ExpandRow icon={Users} label="Who is affected" text={w.whoAffected} />
          {w.historicalContext && <ExpandRow icon={History} label="Historical context" text={w.historicalContext} />}
          {w.potentialImpact && <ExpandRow icon={TrendingUp} label="Potential impact" text={w.potentialImpact} />}
          {idea.sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <Globe className="h-3 w-3 text-navy-primary" strokeWidth={2} />
              {idea.sources.slice(0, 3).map((s, i) => (
                <SourceChip key={i} kind={s.kind} name={s.name} url={s.url} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ConvictionList({ ideas }: { ideas: ConvictionIdea[] }) {
  return (
    <div className="px-4 py-3">
      <SectionHead icon={Radar} label="Highest Conviction Ideas" note="top 3" />
      {ideas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-soft-border bg-ice/40 px-3 py-4 text-center text-[11px] text-ink-secondary">Nothing meets the conviction bar under this filter.</p>
      ) : (
        <div className="space-y-1.5">
          {ideas.slice(0, 3).map((idea) => (
            <ConvictionRow key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── RIGHT · since yesterday + events + actions ────────────────────────────────

function SinceYesterdayBlock({ deltas }: { deltas: SinceDelta[] }) {
  if (deltas.length === 0) return null
  return (
    <div className="px-4 py-3">
      <SectionHead icon={RefreshCw} label="Since Yesterday" />
      <div className="space-y-1.5">
        {deltas.map((d) => {
          const tone = IMPACT_META[d.tone]
          const Icon = d.direction === 'down' ? ArrowDown : d.direction === 'flat' ? Minus : ArrowUp
          return (
            <div key={d.id} className="flex items-baseline gap-1.5">
              <Icon className="h-3 w-3 shrink-0 self-center" strokeWidth={2.4} style={{ color: tone.fg }} />
              <span className="text-[12.5px] font-bold text-navy-deep">{d.value}</span>
              <span className="text-[10.5px] text-ink-secondary">{d.label}</span>
            </div>
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
  one,
  sinceDeltas,
  ideas,
  events,
  actions,
  isToday,
  dateLabel,
  onRun,
}: {
  pulse: InvestorPulse
  brief: MorningBrief
  one: OneThing | null
  sinceDeltas: SinceDelta[]
  ideas: ConvictionIdea[]
  events: PulseEvent[]
  actions: PulseAction[]
  isToday: boolean
  dateLabel: string
  onRun: (a: PulseAction) => void
}) {
  return (
    <section className="premium-panel overflow-hidden rounded-2xl">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.34fr)_minmax(0,0.92fr)]">
        {/* LEFT — compact brief */}
        <CompactBrief brief={brief} isToday={isToday} dateLabel={dateLabel} />

        {/* CENTER — one thing + conviction */}
        <div className="min-w-0 divide-y divide-soft-border/70 border-t border-soft-border lg:border-l lg:border-t-0">
          <OneThingRow one={one} />
          <ConvictionList ideas={ideas} />
        </div>

        {/* RIGHT — since yesterday · events · actions */}
        <div className="min-w-0 divide-y divide-soft-border/70 border-t border-soft-border lg:border-l lg:border-t-0">
          <SinceYesterdayBlock deltas={sinceDeltas} />
          {isToday && events.length > 0 && <EventsBlock events={events} />}
          {isToday && actions.length > 0 && <ActionsBlock actions={actions} onRun={onRun} />}
        </div>
      </div>
      <Footer brief={brief} pulse={pulse} />
    </section>
  )
}
