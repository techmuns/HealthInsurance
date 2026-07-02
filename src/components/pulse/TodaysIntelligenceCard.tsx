// Today's Intelligence Read — the ONE unified daily card. A navy read-head
// (headline + Changed/Matters/Watch) flows into a light body of clean, divider-
// separated sections: Top Picks, Upcoming Events, Action for Today, Market Read,
// Important Today, and a source-confidence footer. One connected surface, for one
// date at a time — never a scatter of floating widgets.

import { useState } from 'react'
import {
  PenLine,
  Globe,
  ChevronDown,
  CalendarClock,
  ExternalLink,
  Users,
  Scale,
  ShieldCheck,
  Landmark,
  ArrowUpRight,
  AlertCircle,
  LineChart,
  Zap,
  Activity,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import { IMPACT_META, type InvestorPulse, type TodayRead } from '@/insights/investorPulse'
import {
  statusOf,
  type TopPick,
  type PulseEvent,
  type PulseAction,
  type ImportantCategory,
  type ActionIcon,
} from './derive'
import { StatusPill, RelevanceTag, SourceChip, CATEGORY_ICON, READ_ICON, GOLD, GOLD_ON_NAVY } from './parts'

// ── shared internal section frame ────────────────────────────────────────────

function SectionHead({ label, note, id }: { label: string; note?: string; id?: string }) {
  return (
    <div id={id} className="mb-2.5 flex items-center gap-2 scroll-mt-24">
      <span className="h-3 w-[3px] rounded-full bg-champagne" />
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy-deep">{label}</span>
      <span className="gold-rule h-px w-7 rounded-full" />
      {note && <span className="ml-auto text-[9.5px] font-semibold text-ink-secondary">{note}</span>}
    </div>
  )
}

// ── navy read-head: sections 1 & 2 (headline + Changed/Matters/Watch) ─────────

function ReadRow({ icon: Icon, label, text, tint, fg }: { icon: LucideIcon; label: string; text: string; tint: string; fg: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 first:pt-0" style={{ borderTop: '1px solid rgba(228,198,124,0.12)' }}>
      <span className="icon-ring-gold-dark mt-px grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: tint }}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.1} style={{ color: fg }} />
      </span>
      <p className="w-[70px] shrink-0 pt-1 text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: GOLD_ON_NAVY }}>{label}</p>
      <p className="flex-1 pt-0.5 font-editorial text-[12.5px] leading-snug text-white/85">{text}</p>
    </div>
  )
}

function ReadHead({ read, dateLabel, isToday }: { read: TodayRead | null; dateLabel: string; isToday: boolean }) {
  return (
    <div className="relative isolate overflow-hidden px-5 py-4" style={{ background: 'linear-gradient(150deg, #1C3A6E 0%, #15294C 58%, #102140 100%)' }}>
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(circle at 92% 100%, rgba(214,178,98,0.30) 0%, transparent 46%),' +
            'radial-gradient(circle at 98% 4%, rgba(96,138,206,0.28) 0%, transparent 44%),' +
            'radial-gradient(circle at 3% 96%, rgba(44,80,146,0.46) 0%, transparent 52%),' +
            'radial-gradient(circle at 20% 10%, rgba(122,162,222,0.22) 0%, transparent 48%)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(228,198,124,0.45) 30%, rgba(228,198,124,0.45) 70%, transparent)' }} />

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="icon-ring-gold-dark grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: 'rgba(228,198,124,0.12)' }}>
            <PenLine className="h-4 w-4" style={{ color: GOLD_ON_NAVY }} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD_ON_NAVY }}>Today&apos;s Intelligence Read</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{dateLabel}</p>
          </div>
        </div>
        {read && <StatusPill status={statusOf(read.stance)} onNavy />}
      </div>

      {read ? (
        <>
          <h2 className="mt-2.5 font-display text-[20px] font-semibold leading-[1.2]" style={{ color: '#E9C46C' }}>{read.headline}</h2>
          <div className="mt-2">
            <ReadRow icon={READ_ICON.changed} label="Changed" text={read.changed} tint="rgba(228,198,124,0.14)" fg={GOLD_ON_NAVY} />
            <ReadRow icon={READ_ICON.matters} label="Matters" text={read.matters} tint="rgba(255,255,255,0.08)" fg="#CFE0F5" />
            <ReadRow icon={READ_ICON.watch} label="Watch Next" text={read.watchNext} tint="rgba(56,168,162,0.16)" fg="#6FD0CB" />
          </div>
        </>
      ) : (
        <p className="mt-3 font-editorial text-[13px] italic text-white/70">
          {isToday ? 'No source-backed read matches this filter today.' : 'No source-backed items for this date under this filter.'}
        </p>
      )}
    </div>
  )
}

// ── section 3: Top Picks table ────────────────────────────────────────────────

const COLS = 'lg:grid lg:grid-cols-[30px_minmax(0,1.3fr)_minmax(0,1.7fr)_minmax(0,1.7fr)_minmax(0,1.7fr)_24px] lg:items-start lg:gap-3'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[8.5px] font-bold uppercase tracking-[0.12em] text-ink-secondary lg:hidden">{label}</p>
      {children}
    </div>
  )
}

function PickRow({ pick }: { pick: TopPick }) {
  const [open, setOpen] = useState(false)
  const lead = pick.rank === 1
  const Icon = CATEGORY_ICON[pick.category]
  return (
    <div
      className={`relative rounded-xl px-2.5 py-2.5 transition-colors ${open ? 'bg-ice/60' : 'hover:bg-ice/50'}`}
      style={lead ? { background: 'linear-gradient(100deg, rgba(228,198,124,0.12), rgba(39,69,126,0.05) 60%, transparent)' } : undefined}
    >
      {lead && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full" style={{ background: 'linear-gradient(180deg, #E4C67C, #B68B3A)' }} />}
      <button type="button" onClick={() => setOpen((v) => !v)} className={`w-full text-left ${COLS}`}>
        <div className="mb-2 flex items-center gap-2 lg:mb-0">
          <span
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[12px] font-bold"
            style={lead
              ? { color: '#14294C', background: 'linear-gradient(135deg, #F0D89A, #D9B96A)', boxShadow: 'inset 0 0 0 1px rgba(182,139,58,0.5)' }
              : { color: '#27457E', background: 'rgba(39,69,126,0.08)', boxShadow: 'inset 0 0 0 1px rgba(39,69,126,0.16)' }}
          >
            {pick.rank}
          </span>
        </div>
        <Field label="Company / Topic">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} style={{ color: lead ? GOLD : '#27457E' }} />
            <span className="truncate text-[12px] font-bold text-navy-deep">{pick.entity}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <StatusPill status={pick.status} />
            {pick.tags.map((t) => (
              <RelevanceTag key={t} tag={t} />
            ))}
          </div>
        </Field>
        <Field label="What happened">
          <p className="text-[11.5px] font-semibold leading-snug text-navy-deep">{pick.whatHappened}</p>
          <p className="mt-0.5 text-[9.5px] font-medium text-ink-secondary">{pick.dateLabel}</p>
        </Field>
        <Field label="Why it matters">
          <p className="text-[11px] leading-snug text-ink-secondary">{pick.whyItMatters}</p>
        </Field>
        <Field label="What to watch">
          <p className="text-[11px] leading-snug text-ink-secondary">{pick.whatToWatch}</p>
        </Field>
        <span className="mt-2 hidden justify-self-end lg:mt-0.5 lg:flex">
          <ChevronDown className={`h-4 w-4 text-ink-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-soft-border/70 pt-2 lg:pl-[42px]">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-secondary">Evidence</span>
          <SourceChip kind={pick.evidence.kind} name={pick.evidence.name} url={pick.evidence.url} />
          <span className="truncate text-[10px] text-ink-secondary">{pick.evidence.name}</span>
        </div>
      )}
    </div>
  )
}

function PicksSection({ picks }: { picks: TopPick[] }) {
  return (
    <div id="tir-picks" className="px-5 py-4 scroll-mt-24">
      <SectionHead label="Top Picks of the Day" note="ranked · source-backed" />
      <div className={`hidden rounded-lg border-y border-soft-border bg-surface-tint/70 px-2.5 py-1.5 ${COLS}`} style={{ borderBottomColor: 'rgba(182,139,58,0.28)' }}>
        {['#', 'Company / Topic', 'What happened', 'Why it matters', 'What to watch', ''].map((h, i) => (
          <span key={i} className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-secondary">{h}</span>
        ))}
      </div>
      <div className="divide-y divide-soft-border/60">
        {picks.map((p) => (
          <PickRow key={p.id} pick={p} />
        ))}
      </div>
    </div>
  )
}

// ── section 4: Upcoming Events ────────────────────────────────────────────────

function EventRow({ e }: { e: PulseEvent }) {
  const body = (
    <>
      <div className="relative flex h-10 w-10 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-soft-border bg-surface-tint">
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: 'linear-gradient(90deg, rgba(182,139,58,0.85), rgba(182,139,58,0.35))' }} />
        <span className="text-[7.5px] font-bold uppercase tracking-wide text-champagne-deep">{e.month}</span>
        <span className="text-[14px] font-bold leading-none text-navy-deep">{e.day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[12px] font-semibold text-navy-deep">{e.kindLabel}</p>
          <span className="shrink-0 rounded-full px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wide" style={{ color: e.isFirm ? '#2F855A' : '#9C7430', background: e.isFirm ? 'rgba(47,133,90,0.10)' : 'rgba(156,116,48,0.12)' }}>{e.whenLabel}</span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[10.5px] leading-snug text-ink-secondary">{e.context}</p>
      </div>
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-soft-border bg-white text-champagne-deep">
        {e.url ? <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} /> : <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />}
      </span>
    </>
  )
  const cls = 'flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors'
  return e.url ? (
    <a href={e.url} target="_blank" rel="noreferrer" title={`Open source — ${e.title}`} className={`${cls} hover:bg-ice/70`}>{body}</a>
  ) : (
    <div className={cls} title={e.title}>{body}</div>
  )
}

function EventsSection({ events }: { events: PulseEvent[] }) {
  return (
    <div id="tir-events" className="px-5 py-4 scroll-mt-24">
      <SectionHead label="Upcoming Events" note={`${events.length} dated`} />
      <div className="flex flex-col gap-0.5">
        {events.map((e) => (
          <EventRow key={e.id} e={e} />
        ))}
      </div>
    </div>
  )
}

// ── section 5: Action for Today (pills) ───────────────────────────────────────

const ACTION_ICON: Record<ActionIcon, LucideIcon> = { ownership: Users, margins: Scale, source: ShieldCheck, agm: CalendarClock, regulation: Landmark }

function ActionsSection({ actions, onRun }: { actions: PulseAction[]; onRun: (a: PulseAction) => void }) {
  return (
    <div className="px-5 py-4">
      <SectionHead label="Action for Today" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => {
          const Icon = ACTION_ICON[a.icon]
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onRun(a)}
              className="group flex items-center gap-2 rounded-xl border border-soft-border bg-white px-3 py-2.5 text-left shadow-soft transition-colors hover:border-champagne hover:bg-champagne-soft/40"
            >
              <span className="icon-ring-gold grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'rgba(182,139,58,0.10)' }}>
                <Icon className="h-4 w-4" strokeWidth={2} style={{ color: GOLD }} />
              </span>
              <span className="min-w-0 flex-1 text-[12px] font-semibold leading-tight text-navy-deep">{a.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-secondary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={a.href ? { color: GOLD } : undefined} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── section 6: Market Read ────────────────────────────────────────────────────

function MarketReadSection({ lines }: { lines: string[] }) {
  return (
    <div className="px-5 py-4">
      <SectionHead label="Market Read" />
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <p key={i} className="text-[11.5px] leading-snug text-ink-secondary">{line}</p>
        ))}
      </div>
    </div>
  )
}

// ── section 7: Important Today (tags) ─────────────────────────────────────────

const IMPORTANT_ICON: Record<string, LucideIcon> = { management: Users, regulatory: Landmark, analyst: LineChart, sector: Zap, move: Activity, filing: FileText }

function ImportantSection({ items }: { items: ImportantCategory[] }) {
  return (
    <div className="px-5 py-4">
      <SectionHead label="Important Today" />
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const Icon = IMPORTANT_ICON[it.id] ?? AlertCircle
          const tone = IMPACT_META[it.tone]
          return (
            <span
              key={it.id}
              title={it.detail}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
              style={{ color: tone.fg, background: tone.bg, boxShadow: `inset 0 0 0 1px ${tone.dot}33` }}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.1} />
              {it.label}
              {it.count > 1 && <span className="rounded-full bg-white/70 px-1 text-[8.5px] font-bold">{it.count}</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── section 8: source-confidence footer ───────────────────────────────────────

const CONF_COLOR: Record<string, string> = { High: '#0E6F6D', Medium: '#9C7430', Low: '#8C7A55' }

function Footer({ read, pulse }: { read: TodayRead | null; pulse: InvestorPulse }) {
  const conf = pulse.confidence
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-surface-tint/60 px-5 py-3">
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-ink-secondary">
        <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: 'rgba(182,139,58,0.10)', boxShadow: 'inset 0 0 0 1px rgba(182,139,58,0.28)' }}>
          <Globe className="h-3 w-3" strokeWidth={2.1} style={{ color: GOLD }} />
        </span>
        {read?.sourceLine ?? 'No source-backed items in this view.'}
      </span>
      <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em]" style={{ color: CONF_COLOR[conf], background: `${CONF_COLOR[conf]}14` }}>
        <ShieldCheck className="h-3 w-3" strokeWidth={2.2} />
        {conf} source confidence
      </span>
    </div>
  )
}

// ── the unified card ──────────────────────────────────────────────────────────

export function TodaysIntelligenceCard({
  pulse,
  read,
  picks,
  events,
  actions,
  marketRead,
  important,
  dateLabel,
  isToday,
  onRun,
}: {
  pulse: InvestorPulse
  read: TodayRead | null
  picks: TopPick[]
  events: PulseEvent[]
  actions: PulseAction[]
  marketRead: string[]
  important: ImportantCategory[]
  dateLabel: string
  isToday: boolean
  onRun: (a: PulseAction) => void
}) {
  return (
    <section className="premium-panel overflow-hidden rounded-2xl shadow-card">
      <ReadHead read={read} dateLabel={dateLabel} isToday={isToday} />
      <div className="divide-y divide-soft-border/70">
        {picks.length > 0 && <PicksSection picks={picks} />}
        {isToday && events.length > 0 && <EventsSection events={events} />}
        {isToday && actions.length > 0 && <ActionsSection actions={actions} onRun={onRun} />}
        {isToday && marketRead.length > 0 && <MarketReadSection lines={marketRead} />}
        {important.length > 0 && <ImportantSection items={important} />}
        <Footer read={read} pulse={pulse} />
      </div>
    </section>
  )
}
