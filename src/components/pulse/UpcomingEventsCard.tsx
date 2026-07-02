// Upcoming Events — genuinely relevant dated events only (AGM, board, results,
// investor meet, regulatory). Each row: date block · event name · context · a
// small calendar icon. Firm future dates lead; still-active catalysts follow.
// Empty → one clean line ("No relevant events today.").

import { CalendarDays, CalendarClock, ExternalLink } from 'lucide-react'
import type { InvestorPulse } from '@/insights/investorPulse'
import { upcomingEvents, type PulseEvent } from './derive'
import { GOLD } from './parts'

function EventRow({ e }: { e: PulseEvent }) {
  const body = (
    <>
      {/* date tile */}
      <div className="relative flex h-11 w-11 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-soft-border bg-surface-tint">
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: 'linear-gradient(90deg, rgba(182,139,58,0.85), rgba(182,139,58,0.35))' }} />
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-champagne-deep">{e.month}</span>
        <span className="text-[15px] font-bold leading-none text-navy-deep">{e.day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[12.5px] font-semibold text-navy-deep">{e.kindLabel}</p>
          <span
            className="shrink-0 rounded-full px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wide"
            style={{ color: e.isFirm ? '#2F855A' : '#9C7430', background: e.isFirm ? 'rgba(47,133,90,0.10)' : 'rgba(156,116,48,0.12)' }}
          >
            {e.whenLabel}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-ink-secondary">{e.context}</p>
      </div>
      {/* calendar icon — only for these real dated events */}
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-soft-border bg-white text-champagne-deep">
        {e.url ? <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} /> : <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />}
      </span>
    </>
  )
  const cls = 'flex items-center gap-3 rounded-xl px-2 py-2 transition-colors'
  return e.url ? (
    <a href={e.url} target="_blank" rel="noreferrer" title={`Open source — ${e.title}`} className={`${cls} hover:bg-ice/70`}>
      {body}
    </a>
  ) : (
    <div className={cls} title={e.title}>
      {body}
    </div>
  )
}

export function UpcomingEventsCard({ pulse }: { pulse: InvestorPulse }) {
  const events = upcomingEvents(pulse)
  return (
    <section id="pulse-events" className="premium-panel flex flex-col overflow-hidden rounded-2xl scroll-mt-24">
      <div className="flex items-center gap-2 border-b border-soft-border/70 px-4 py-2.5">
        <span className="icon-ring-gold grid h-6 w-6 place-items-center rounded-md" style={{ background: 'rgba(182,139,58,0.12)' }}>
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={2.1} style={{ color: GOLD }} />
        </span>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-navy-deep">Upcoming Events</h3>
        {events.length > 0 && <span className="ml-auto shrink-0 text-[9.5px] font-semibold text-ink-secondary">{events.length} dated</span>}
      </div>
      {events.length === 0 ? (
        <div className="px-4 py-8 text-center text-[11.5px] text-ink-secondary">No relevant events today.</div>
      ) : (
        <div className="flex flex-col gap-0.5 p-2">
          {events.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </div>
      )}
    </section>
  )
}
