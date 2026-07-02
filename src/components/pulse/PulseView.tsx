// Pulse — the daily intelligence briefing for one company, as ONE unified card on
// a soft blue-tinted field. The left date timeline and the filter chips sit
// OUTSIDE the card and drive it: the card shows a single date's read at a time,
// and every filter re-composes the whole read (headline included) over its slice.
// All data is real and source-backed (see ./derive); missing → honest empty state.

import { useEffect, useMemo, useState } from 'react'
import type { InvestorPulse } from '@/insights/investorPulse'
import type { NavTarget } from '@/insights/sourceMap'
import {
  actionsFor,
  availableFilters,
  importantFrom,
  marketReadLines,
  readFor,
  scopeSignals,
  timelineDays,
  topPicksFrom,
  upcomingEvents,
  type PulseAction,
  type PulseFilter,
} from './derive'
import { PulseTimeline } from './PulseTimeline'
import { PulseFilterChips } from './PulseFilterChips'
import { TodaysIntelligenceCard } from './TodaysIntelligenceCard'

export function PulseView({
  pulse,
  onGoToSource,
}: {
  pulse: InvestorPulse
  onGoToSource?: (target: NavTarget, insightId: string) => void
}) {
  const [filter, setFilter] = useState<PulseFilter>('relevant')
  const [dateKey, setDateKey] = useState('today')

  // Reset per-company view state when the selected company changes.
  useEffect(() => {
    setFilter('relevant')
    setDateKey('today')
  }, [pulse.companyId])

  const available = useMemo(() => availableFilters(pulse), [pulse])
  const effFilter = available.has(filter) ? filter : 'relevant'
  const days = useMemo(() => timelineDays(pulse), [pulse])
  const isToday = dateKey === 'today'

  const scoped = useMemo(() => scopeSignals(pulse, effFilter, dateKey), [pulse, effFilter, dateKey])
  const read = useMemo(() => readFor(pulse, effFilter, dateKey), [pulse, effFilter, dateKey])
  const picks = useMemo(() => topPicksFrom(scoped, pulse), [scoped, pulse])
  const important = useMemo(() => importantFrom(scoped, pulse, isToday), [scoped, pulse, isToday])
  const events = useMemo(() => (isToday ? upcomingEvents(pulse) : []), [pulse, isToday])
  const actions = useMemo(() => (isToday ? actionsFor(pulse, picks) : []), [pulse, picks, isToday])
  const marketRead = useMemo(() => (isToday ? marketReadLines(pulse) : []), [pulse, isToday])

  const selectedDay = days.find((d) => d.key === dateKey) ?? days[0]
  const dateLabel = selectedDay
    ? isToday
      ? `Today · ${selectedDay.dayNum} ${selectedDay.monthLabel} · ${selectedDay.weekday}`
      : `${selectedDay.dayNum} ${selectedDay.monthLabel} · ${selectedDay.weekday}`
    : ''

  const runAction = (a: PulseAction) => {
    if (a.href) {
      window.open(a.href, '_blank', 'noopener,noreferrer')
      return
    }
    if (a.target) onGoToSource?.(a.target, `pulse-action-${a.id}`)
  }

  if (pulse.isEmpty) {
    return (
      <div className="rounded-2xl border border-dashed border-soft-border bg-ice/40 px-4 py-10 text-center text-[12.5px] text-ink-secondary">
        No source-backed signal on file for {pulse.company} yet. New filings, news and events appear here automatically as they are ingested.
      </div>
    )
  }

  return (
    <div
      className="rounded-3xl p-3 sm:p-4"
      style={{ background: 'linear-gradient(162deg, #E8F0FB 0%, #DAE6F7 55%, #E4EDF9 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px rgba(23,43,77,0.05)' }}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[152px_minmax(0,1fr)]">
        <PulseTimeline
          days={days}
          selectedKey={dateKey}
          onSelect={setDateKey}
          hasEvents={isToday && events.length > 0}
          onViewCalendar={() => document.getElementById('tir-events')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />

        <div className="min-w-0 space-y-3">
          <PulseFilterChips active={effFilter} available={available} onSelect={setFilter} />
          <TodaysIntelligenceCard
            pulse={pulse}
            read={read}
            picks={picks}
            events={events}
            actions={actions}
            marketRead={marketRead}
            important={important}
            dateLabel={dateLabel}
            isToday={isToday}
            onRun={runAction}
          />
        </div>
      </div>
    </div>
  )
}
