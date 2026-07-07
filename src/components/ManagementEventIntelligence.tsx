import { useEffect, useState } from 'react'
import { CalendarClock, ExternalLink, Users, ChevronDown, ShieldCheck } from 'lucide-react'
import {
  selectManagementEvents,
  IMPACT_META,
  CONFIDENCE_META,
  type PulseManagementEvent,
} from '@/insights/investorPulse'

// One shared component, two presentations, ONE data path (selectManagementEvents):
//   • variant="full"    → the rich "Management & Event Intelligence" block shown
//                         inside Insights (every board / KMP / leadership change).
//   • variant="compact" → a lean governance-only callout shown inside Governance
//                         (board / KMP / auditor / leadership events only).
// No duplicate code, no fabricated rows — an absence renders an honest empty
// state, never a placeholder.

const EVENT_DOT: Record<string, string> = {
  appointment: '#168E8E',
  reappointment: '#168E8E',
  resignation: '#C0584F',
  termination: '#C0584F',
  kmp_change: '#27457E',
  board_change: '#27457E',
  auditor_change: '#6E5BA6',
  authorization: '#8C97A8',
  esop: '#B68B3A',
}

function ConfidencePill({ confidence }: { confidence: PulseManagementEvent['confidence'] }) {
  const c = CONFIDENCE_META[confidence]
  return (
    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em]" style={{ color: c.fg, background: c.bg }}>
      {confidence} confidence
    </span>
  )
}

function EventRow({ e, dense, targeted = false }: { e: PulseManagementEvent; dense: boolean; targeted?: boolean }) {
  const dot = EVENT_DOT[e.eventType] ?? '#27457E'
  const imp = IMPACT_META[e.impact]
  return (
    <li
      data-source-id={e.id}
      data-source-highlight={targeted ? '1' : undefined}
      className={`rounded-xl border p-3 transition-colors ${targeted ? 'insight-arrival border-navy-primary/60 bg-soft-blue/60' : 'border-soft-border bg-card hover:border-navy-primary/25'}`}
    >
      {targeted && (
        <div className="mb-2 rounded-lg border border-[#E4CE93] bg-[#FBF6EA] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-champagne-deep">
          Source for: Management change
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-secondary">
          <CalendarClock className="h-3.5 w-3.5 text-navy-primary" strokeWidth={2.2} />
          {e.dateLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-semibold" style={{ background: imp.bg, color: imp.fg }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
          {e.eventLabel}
        </span>
        {!dense && <ConfidencePill confidence={e.confidence} />}
      </div>
      {(e.person || e.designation) && (
        <p className="mt-1.5 text-[12.5px] font-semibold leading-snug text-navy-deep">
          {e.person}
          {e.person && e.designation ? ' · ' : ''}
          {e.designation && <span className="font-normal text-ink-secondary">{e.designation}</span>}
        </p>
      )}
      {!dense && e.summary && <p className="mt-0.5 text-[11.5px] leading-snug text-ink-secondary">{e.summary}</p>}
      {e.sourceUrl && (
        <a
          href={e.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-medium text-navy-primary hover:underline"
        >
          {e.sourceName}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </li>
  )
}

export function ManagementEventIntelligence({
  companyId,
  companyName,
  variant = 'full',
  governanceOnly = false,
  title,
  focusEventId = null,
}: {
  companyId: string
  companyName: string
  variant?: 'full' | 'compact'
  /** Filter to governance-relevant events only (Governance tab + Data Insights refs). */
  governanceOnly?: boolean
  /** Override the compact-header label (e.g. "Management & Events" in Pulse). */
  title?: string
  /** A source-tag / insight jump highlights this exact event (its id) — reveal it
   *  past the "show more" cap, scroll it to centre and blip it. */
  focusEventId?: string | null
}) {
  const dense = variant === 'compact'
  const events = selectManagementEvents(companyId, { governanceOnly })
  const [showAll, setShowAll] = useState(false)

  // Deep-link: reveal the targeted event (past the cap) and scroll it into view.
  useEffect(() => {
    if (!focusEventId || !events.some((e) => e.id === focusEventId)) return
    setShowAll(true)
    const t = window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(`[data-source-id="${focusEventId.replace(/(["\\])/g, '\\$1')}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 160)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusEventId])

  if (events.length === 0) {
    // Compact hides entirely on an empty set so the surface stays clean; the full
    // Insights view shows an honest "nothing on record" note.
    if (dense) return null
    return (
      <section className="card-surface p-5">
        <Header variant={variant} count={0} title={title} />
        <div className="mt-4 rounded-xl border border-dashed border-soft-border bg-ice/40 px-4 py-8 text-center text-[12px] text-ink-secondary">
          No board, KMP or leadership changes on record for {companyName}. New events appear here automatically as exchange / IR filings are ingested.
        </div>
      </section>
    )
  }

  const limit = showAll ? events.length : dense ? 3 : 6
  const shown = events.slice(0, limit)

  return (
    <section className={dense ? 'rounded-2xl border border-soft-border bg-card p-4 shadow-soft' : 'card-surface p-5'}>
      <Header variant={variant} count={events.length} title={title} />
      <ul className={dense ? 'mt-3 space-y-2' : 'mt-4 space-y-2.5'}>
        {shown.map((e) => (
          <EventRow key={e.id} e={e} dense={dense} targeted={!!focusEventId && e.id === focusEventId} />
        ))}
      </ul>
      {events.length > shown.length && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-navy-primary hover:underline"
        >
          Show {events.length - shown.length} more <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
    </section>
  )
}

function Header({ variant, count, title }: { variant: 'full' | 'compact'; count: number; title?: string }) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-navy-primary" strokeWidth={2.2} />
          <h3 className="text-[13px] font-bold text-navy-deep">{title ?? 'Governance events'}</h3>
        </div>
        {count > 0 && <span className="text-[10px] font-semibold text-ink-secondary">{count} on record</span>}
      </div>
    )
  }
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="h-3 w-[3px] rounded-full bg-champagne" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-champagne">Board · KMP · Leadership</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Users className="h-5 w-5 text-navy-deep" strokeWidth={2} />
          <h2 className="font-display text-[21px] leading-tight text-navy-deep">Management &amp; Event Intelligence</h2>
        </div>
        <p className="mt-1 max-w-2xl text-[11.5px] leading-snug text-ink-secondary">Leadership, board, governance and execution events that can affect the investment thesis.</p>
      </div>
      {count > 0 && <span className="shrink-0 text-[11px] text-ink-secondary">{count} source-backed event{count === 1 ? '' : 's'}</span>}
    </div>
  )
}
