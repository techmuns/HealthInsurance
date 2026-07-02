// Executive Brief — the AI-first Market Pulse. An analyst-prepared morning
// briefing: the one thing to read, an AI Morning Brief with a confidence ring +
// count-up stats, a "since yesterday" delta strip, and Highest-Conviction ideas
// where every idea answers What happened / Why it matters / Who's affected /
// History / Impact and a "what next" action. Subtle motion only. All real, source-
// derived data (see ./derive) — no fabricated counts, no invented sentiment.

import { useState } from 'react'
import {
  Sparkles,
  Clock3,
  BookOpen,
  Layers,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ChevronDown,
  Star,
  Zap,
  ShieldCheck,
  Users,
  History,
  TrendingUp,
  Globe,
  Radar,
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
} from './derive'
import { StatusPill, SourceChip, CATEGORY_ICON, GOLD, GOLD_ON_NAVY } from './parts'
import { useCountUp, useTypewriter } from './hooks'

// ── small shared bits ─────────────────────────────────────────────────────────

function CountVal({ value, suffix = '' }: { value: number; suffix?: string }) {
  const v = useCountUp(value, 900)
  return (
    <>
      {Math.round(v)}
      {suffix}
    </>
  )
}

function SectionHead({ icon: Icon, label, note }: { icon: LucideIcon; label: string; note?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="icon-ring-gold grid h-5 w-5 place-items-center rounded-md" style={{ background: 'rgba(182,139,58,0.12)' }}>
        <Icon className="h-3 w-3" strokeWidth={2.2} style={{ color: GOLD }} />
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy-deep">{label}</span>
      <span className="gold-rule h-px w-7 rounded-full" />
      {note && <span className="ml-auto text-[9.5px] font-semibold text-ink-secondary">{note}</span>}
    </div>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`${n} / 5 conviction`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className="h-3.5 w-3.5" strokeWidth={1.6} style={{ color: i <= n ? GOLD : 'rgba(39,69,126,0.20)', fill: i <= n ? GOLD : 'transparent' }} />
      ))}
    </span>
  )
}

function ConfidenceRing({ pct, tier }: { pct: number; tier: string }) {
  const v = useCountUp(pct, 1000)
  const r = 25
  const C = 2 * Math.PI * r
  const color = tier === 'High' ? '#3BB6A6' : tier === 'Medium' ? GOLD_ON_NAVY : '#B9A16A'
  return (
    <div className="relative grid h-[62px] w-[62px] shrink-0 place-items-center">
      <svg width="62" height="62" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="31" cy="31" r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="5" />
        <circle cx="31" cy="31" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} />
      </svg>
      <div className="absolute text-center leading-none">
        <div className="text-[15px] font-bold text-white">
          {Math.round(v)}
          <span className="text-[9px]">%</span>
        </div>
      </div>
    </div>
  )
}

// ── 1 · If you read only one thing today ──────────────────────────────────────

function OneThingCard({ one }: { one: OneThing }) {
  const c = STATUS_COLOR[one.status]
  return (
    <section className="relative overflow-hidden rounded-2xl border px-5 py-3.5 shadow-soft" style={{ background: 'linear-gradient(100deg, #FFFDF7 0%, #F5ECD6 100%)', borderColor: 'rgba(182,139,58,0.32)' }}>
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-full" style={{ background: 'linear-gradient(180deg, #E4C67C, #B68B3A)' }} />
      <div className="flex items-center gap-2 pl-2">
        <Sparkles className="h-3.5 w-3.5 text-champagne-deep" strokeWidth={2} />
        <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-champagne-deep">If you read only one thing today</span>
        <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      </div>
      <p className="mt-1 pl-2 font-editorial text-[16.5px] font-medium leading-snug text-navy-deep">&ldquo;{one.sentence}&rdquo;</p>
    </section>
  )
}

// ── 2 · AI Morning Brief ──────────────────────────────────────────────────────

function StatTile({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'rgba(228,198,124,0.10)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.28)' }}>
        <Icon className="h-4 w-4" strokeWidth={2} style={{ color: GOLD_ON_NAVY }} />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-bold leading-none text-white">{children}</div>
        <div className="mt-1 text-[8.5px] font-bold uppercase tracking-[0.12em] text-white/50">{label}</div>
      </div>
    </div>
  )
}

function AiMorningBrief({ brief, isToday, dateLabel }: { brief: MorningBrief; isToday: boolean; dateLabel: string }) {
  const attention = brief.attentionCount
  const lead = isToday
    ? `${brief.line} Today, ${attention} ${attention === 1 ? 'development deserves' : 'developments deserve'} your attention.`
    : `Source-backed developments recorded for ${dateLabel}. ${attention} ${attention === 1 ? 'idea' : 'ideas'} on file.`
  const { shown, done } = useTypewriter(lead)
  return (
    <section className="relative isolate overflow-hidden rounded-2xl px-5 py-4 shadow-card" style={{ background: 'linear-gradient(150deg, #1C3A6E 0%, #15294C 58%, #102140 100%)' }}>
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(circle at 94% 100%, rgba(214,178,98,0.26) 0%, transparent 44%), radial-gradient(circle at 98% 4%, rgba(96,138,206,0.26) 0%, transparent 44%), radial-gradient(circle at 2% 96%, rgba(44,80,146,0.44) 0%, transparent 52%)' }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(228,198,124,0.45) 30%, rgba(228,198,124,0.45) 70%, transparent)' }} />

      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD_ON_NAVY, background: 'rgba(228,198,124,0.10)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.24)' }}>
          <Sparkles className="h-3 w-3" strokeWidth={2.2} /> Executive Brief · AI
        </span>
        <span className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold text-white/55">
          <RefreshCw className="h-3 w-3" strokeWidth={2} style={{ color: 'rgba(228,198,124,0.8)' }} /> {brief.lastUpdatedLabel}
        </span>
      </div>

      <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight" style={{ color: '#E9C46C' }}>
        {isToday ? `${brief.greeting}.` : brief.greeting}
      </h2>
      <p className="mt-1 min-h-[2.4em] max-w-3xl text-[13px] leading-snug text-white/85">
        {shown}
        {!done && <span className="type-caret" style={{ color: GOLD_ON_NAVY }} />}
      </p>

      {/* stat row */}
      <div className="mt-3.5 grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4" style={{ borderColor: 'rgba(228,198,124,0.16)' }}>
        <div className="flex items-center gap-2.5">
          <ConfidenceRing pct={brief.confidencePct} tier={brief.confidenceTier} />
          <div>
            <div className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-white/50">AI Confidence</div>
            <div className="text-[12px] font-bold text-white">{brief.confidenceTier}</div>
          </div>
        </div>
        <StatTile icon={BookOpen} label="Reading time">
          <CountVal value={brief.readingMins} /> min
        </StatTile>
        <StatTile icon={Layers} label="Sources analysed">
          <CountVal value={brief.sourcesCount} />
          <span className="text-[9.5px] font-semibold text-white/50"> · {brief.domainsCount} distinct</span>
        </StatTile>
        <StatTile icon={Clock3} label="Developments">
          <CountVal value={brief.developmentsCount} />
        </StatTile>
      </div>
    </section>
  )
}

// ── 3 · Since yesterday ───────────────────────────────────────────────────────

function SinceYesterdayStrip({ deltas }: { deltas: SinceDelta[] }) {
  if (deltas.length === 0) return null
  return (
    <section className="rounded-2xl border border-soft-border bg-white/70 px-4 py-3 shadow-soft">
      <SectionHead icon={RefreshCw} label="What Changed" note="latest refresh" />
      <div className="flex flex-wrap gap-x-6 gap-y-2.5">
        {deltas.map((d) => {
          const tone = IMPACT_META[d.tone]
          const Arrow = d.direction === 'down' ? ArrowDown : ArrowUp
          return (
            <span key={d.id} className="inline-flex items-baseline gap-1.5">
              <Arrow className="h-3.5 w-3.5 shrink-0 self-center" strokeWidth={2.4} style={{ color: tone.fg }} />
              <span className="text-[14px] font-bold text-navy-deep">{d.value}</span>
              <span className="text-[11px] text-ink-secondary">{d.label}</span>
            </span>
          )
        })}
      </div>
    </section>
  )
}

// ── 4 · Highest Conviction Ideas ──────────────────────────────────────────────

function WhyRow({ icon: Icon, label, text }: { icon: LucideIcon; label: string; text: string }) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-primary" strokeWidth={2} />
      <div className="min-w-0">
        <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-secondary">{label}</p>
        <p className="text-[11px] leading-snug text-ink-primary">{text}</p>
      </div>
    </div>
  )
}

function WhyCarePanel({ idea, onRun }: { idea: ConvictionIdea; onRun: (a: PulseAction) => void }) {
  const w = idea.why
  return (
    <div className="mt-2 space-y-2.5 rounded-xl border border-soft-border bg-surface-tint/50 p-3">
      <WhyRow icon={Zap} label="What happened" text={w.whatHappened} />
      <WhyRow icon={ShieldCheck} label="Why it matters" text={w.whyItMatters} />
      <WhyRow icon={Users} label="Who is affected" text={w.whoAffected} />
      {w.historicalContext && <WhyRow icon={History} label="Historical context" text={w.historicalContext} />}
      {w.potentialImpact && <WhyRow icon={TrendingUp} label="Potential impact" text={w.potentialImpact} />}
      {idea.sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-soft-border/70 pt-2">
          <span className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-secondary">Evidence · {idea.evidenceCount}</span>
          {idea.sources.map((s, i) => (
            <SourceChip key={i} kind={s.kind} name={s.name} url={s.url} />
          ))}
        </div>
      )}
      {idea.action && (
        <div className="border-t border-soft-border/70 pt-2">
          <button
            type="button"
            onClick={() => idea.action && onRun(idea.action)}
            className="group inline-flex items-center gap-1.5 rounded-lg border border-champagne/50 bg-champagne-soft/50 px-2.5 py-1.5 text-[11px] font-semibold text-champagne-deep transition-colors hover:bg-champagne-soft"
          >
            <span className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-champagne-deep/70">Do next</span>
            {idea.action.label}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </div>
  )
}

function ConvictionIdeaCard({ idea, onRun }: { idea: ConvictionIdea; onRun: (a: PulseAction) => void }) {
  const [open, setOpen] = useState(false)
  const Icon = CATEGORY_ICON[idea.category]
  return (
    <div className={`rounded-xl border border-soft-border bg-white p-3 ${idea.isNew ? 'glow-new' : 'shadow-soft'}`}>
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'rgba(39,69,126,0.06)', boxShadow: 'inset 0 0 0 1px rgba(39,69,126,0.12)' }}>
          <Icon className="h-4 w-4" strokeWidth={2} style={{ color: '#27457E' }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[13px] font-bold text-navy-deep">{idea.entity}</span>
            {idea.isBreaking && (
              <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wide text-coral" style={{ background: 'rgba(192,88,79,0.10)' }}>
                <span className="pulse-live h-1.5 w-1.5 rounded-full" style={{ background: '#C0584F' }} /> Live
              </span>
            )}
            <StatusPill status={idea.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Stars n={idea.stars} />
            <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-secondary">Conviction</span>
            <span className="text-[10px] text-ink-secondary">· {idea.confidencePct}% confidence · {idea.evidenceCount} source{idea.evidenceCount === 1 ? '' : 's'}</span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-snug text-ink-secondary">{idea.reasoning}</p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-champagne-deep transition-colors hover:text-navy-deep"
          >
            Why should I care?
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && <WhyCarePanel idea={idea} onRun={onRun} />}
        </div>
      </div>
    </div>
  )
}

function ConvictionIdeasSection({ ideas, onRun }: { ideas: ConvictionIdea[]; onRun: (a: PulseAction) => void }) {
  return (
    <section className="rounded-2xl border border-soft-border bg-white/70 p-4 shadow-soft">
      <SectionHead icon={Radar} label="Highest Conviction Ideas" note="AI-ranked · source-backed" />
      {ideas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-soft-border bg-ice/40 px-3 py-5 text-center text-[11.5px] text-ink-secondary">Nothing meets the conviction bar under this filter.</p>
      ) : (
        <div className="space-y-2.5">
          {ideas.map((idea) => (
            <ConvictionIdeaCard key={idea.id} idea={idea} onRun={onRun} />
          ))}
        </div>
      )}
    </section>
  )
}

// ── 5 · Upcoming Events (compact) + footer ────────────────────────────────────

function EventsSection({ events }: { events: PulseEvent[] }) {
  return (
    <section id="brief-events" className="scroll-mt-24 rounded-2xl border border-soft-border bg-white/70 p-4 shadow-soft">
      <SectionHead icon={Clock3} label="On the Calendar" note={`${events.length} dated`} />
      <div className="flex flex-col gap-0.5">
        {events.map((e) => {
          const body = (
            <>
              <div className="relative flex h-9 w-9 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-soft-border bg-surface-tint">
                <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: 'linear-gradient(90deg, rgba(182,139,58,0.85), rgba(182,139,58,0.35))' }} />
                <span className="text-[7px] font-bold uppercase tracking-wide text-champagne-deep">{e.month}</span>
                <span className="text-[13px] font-bold leading-none text-navy-deep">{e.day}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[12px] font-semibold text-navy-deep">{e.kindLabel}</p>
                  <span className="shrink-0 rounded-full px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wide" style={{ color: e.isFirm ? '#2F855A' : '#9C7430', background: e.isFirm ? 'rgba(47,133,90,0.10)' : 'rgba(156,116,48,0.12)' }}>{e.whenLabel}</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-[10.5px] leading-snug text-ink-secondary">{e.context}</p>
              </div>
            </>
          )
          const cls = 'flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors'
          return e.url ? (
            <a key={e.id} href={e.url} target="_blank" rel="noreferrer" className={`${cls} hover:bg-ice/70`} title={`Open source — ${e.title}`}>{body}</a>
          ) : (
            <div key={e.id} className={cls} title={e.title}>{body}</div>
          )
        })}
      </div>
    </section>
  )
}

const CONF_COLOR: Record<string, string> = { High: '#0E6F6D', Medium: '#9C7430', Low: '#8C7A55' }

function Footer({ brief, pulse }: { brief: MorningBrief; pulse: InvestorPulse }) {
  const conf = pulse.confidence
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-soft-border bg-surface-tint/60 px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-ink-secondary">
        <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: 'rgba(182,139,58,0.10)', boxShadow: 'inset 0 0 0 1px rgba(182,139,58,0.28)' }}>
          <Globe className="h-3 w-3" strokeWidth={2.1} style={{ color: GOLD }} />
        </span>
        {brief.developmentsCount} developments · {brief.sourcesCount} source-backed · {brief.domainsCount} distinct sources
      </span>
      <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em]" style={{ color: CONF_COLOR[conf], background: `${CONF_COLOR[conf]}14` }}>
        <ShieldCheck className="h-3 w-3" strokeWidth={2.2} />
        {conf} source confidence
      </span>
    </div>
  )
}

// ── composition ───────────────────────────────────────────────────────────────

export function ExecutiveBrief({
  pulse,
  brief,
  one,
  sinceDeltas,
  ideas,
  events,
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
  isToday: boolean
  dateLabel: string
  onRun: (a: PulseAction) => void
}) {
  return (
    <div className="space-y-3">
      {one && <OneThingCard one={one} />}
      <AiMorningBrief brief={brief} isToday={isToday} dateLabel={dateLabel} />
      {isToday && <SinceYesterdayStrip deltas={sinceDeltas} />}
      <ConvictionIdeasSection ideas={ideas} onRun={onRun} />
      {isToday && events.length > 0 && <EventsSection events={events} />}
      <Footer brief={brief} pulse={pulse} />
    </div>
  )
}
