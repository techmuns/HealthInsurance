// Pulse — the AI-first Market Pulse workspace. The left date timeline and the
// filter chips sit OUTSIDE and drive an Executive Brief on a soft blue field: an
// AI Morning Brief, the one thing to read, a since-yesterday delta strip, and
// Highest-Conviction ideas (each with a "why should I care?" + a next action).
// Every filter/date re-composes the brief over its slice. All real, source-backed.

import { useEffect, useMemo, useState } from 'react'
import type { InvestorPulse } from '@/insights/investorPulse'
import type { NavTarget } from '@/insights/sourceMap'
import {
  actionsForBrief,
  availableFilters,
  convictionIdeas,
  morningBrief,
  oneThing,
  scopeSignals,
  sinceYesterday,
  timelineDays,
  upcomingEvents,
  type PulseAction,
  type PulseFilter,
} from './derive'
import { PulseTimeline } from './PulseTimeline'
import { PulseFilterChips } from './PulseFilterChips'
import { ExecutiveBrief } from './ExecutiveBrief'

export function PulseView({
  pulse,
  onGoToSource,
}: {
  pulse: InvestorPulse
  onGoToSource?: (target: NavTarget, insightId: string) => void
}) {
  const [filter, setFilter] = useState<PulseFilter>('relevant')
  const [dateKey, setDateKey] = useState('today')

  useEffect(() => {
    setFilter('relevant')
    setDateKey('today')
  }, [pulse.companyId])

  const available = useMemo(() => availableFilters(pulse), [pulse])
  const effFilter = available.has(filter) ? filter : 'relevant'
  const days = useMemo(() => timelineDays(pulse), [pulse])
  const isToday = dateKey === 'today'

  const selectedDay = days.find((d) => d.key === dateKey) ?? days[0]
  const dateLabel = selectedDay ? `${selectedDay.dayNum} ${selectedDay.monthLabel} · ${selectedDay.weekday}` : ''

  const scoped = useMemo(() => scopeSignals(pulse, effFilter, dateKey), [pulse, effFilter, dateKey])
  const ideas = useMemo(() => convictionIdeas(scoped, pulse), [scoped, pulse])
  const brief = useMemo(() => morningBrief(pulse, ideas, scoped, isToday, dateLabel), [pulse, ideas, scoped, isToday, dateLabel])
  const one = useMemo(() => oneThing(scoped, ideas, pulse), [scoped, ideas, pulse])
  const sinceDeltas = useMemo(() => sinceYesterday(pulse), [pulse])
  const events = useMemo(() => (isToday ? upcomingEvents(pulse) : []), [pulse, isToday])
  const actions = useMemo(() => (isToday ? actionsForBrief(pulse, scoped) : []), [pulse, scoped, isToday])

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
          onViewCalendar={() => document.getElementById('brief-events')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />

        <div className="min-w-0">
          <div className="mb-3">
            <PulseFilterChips active={effFilter} available={available} onSelect={setFilter} />
          </div>
          <ExecutiveBrief
            pulse={pulse}
            brief={brief}
            one={one}
            sinceDeltas={sinceDeltas}
            ideas={ideas}
            events={events}
            actions={actions}
            isToday={isToday}
            dateLabel={dateLabel}
            onRun={runAction}
          />
        </div>
      </div>
    </div>
  )
}
