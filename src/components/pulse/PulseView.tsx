// Pulse — the daily intelligence briefing for one company. A left date timeline,
// then: Today's Read + Upcoming Events, Top Picks + Action/Market Read, an
// Important Today strip and a Previous Reads log. Every card reads real,
// source-backed data (see ./derive); missing data hides a section or shows a
// clean empty state — never filler. Click-only, navy/gold theme.

import { useEffect, useMemo, useState } from 'react'
import type { InvestorPulse } from '@/insights/investorPulse'
import type { NavTarget } from '@/insights/sourceMap'
import {
  actionsFor,
  availableFilters,
  importantToday,
  marketReadLines,
  previousReads,
  timelineDays,
  topPicks,
  upcomingEvents,
  type PulseAction,
  type PulseFilter,
} from './derive'
import { PulseTimeline } from './PulseTimeline'
import { TodaysReadCard } from './TodaysReadCard'
import { UpcomingEventsCard } from './UpcomingEventsCard'
import { TopPicksTable } from './TopPicksTable'
import { ActionMarketReadCard } from './ActionMarketReadCard'
import { ImportantTodayStrip } from './ImportantTodayStrip'
import { PreviousReadsList } from './PreviousReadsList'
import { PulseFilterChips } from './PulseFilterChips'

const TWO_COL = 'grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]'

function scrollToId(id: string, block: ScrollLogicalPosition = 'start') {
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block }))
}

export function PulseView({
  pulse,
  onGoToSource,
}: {
  pulse: InvestorPulse
  onGoToSource?: (target: NavTarget, insightId: string) => void
}) {
  const [filter, setFilter] = useState<PulseFilter>('relevant')
  const [selectedDay, setSelectedDay] = useState('today')
  const [openPrevDate, setOpenPrevDate] = useState<string | null>(null)

  // Reset per-company view state when the selected company changes.
  useEffect(() => {
    setFilter('relevant')
    setSelectedDay('today')
    setOpenPrevDate(null)
  }, [pulse.companyId])

  const available = useMemo(() => availableFilters(pulse), [pulse])
  const effectiveFilter = available.has(filter) ? filter : 'relevant'

  const days = useMemo(() => timelineDays(pulse), [pulse])
  const events = useMemo(() => upcomingEvents(pulse), [pulse])
  const picks = useMemo(() => topPicks(pulse, effectiveFilter), [pulse, effectiveFilter])
  const important = useMemo(() => importantToday(pulse, effectiveFilter), [pulse, effectiveFilter])
  const reads = useMemo(() => previousReads(pulse, effectiveFilter), [pulse, effectiveFilter])
  const marketRead = useMemo(() => marketReadLines(pulse), [pulse])
  const actions = useMemo(() => actionsFor(pulse, picks), [pulse, picks])

  const selectDay = (key: string) => {
    setSelectedDay(key)
    if (key === 'today') {
      setOpenPrevDate(null)
      scrollToId('pulse-today')
    } else {
      setOpenPrevDate(key)
      scrollToId(`pulse-prev-${key}`, 'center')
    }
  }

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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[152px_minmax(0,1fr)]">
      <PulseTimeline
        days={days}
        selectedKey={selectedDay}
        onSelect={selectDay}
        hasEvents={events.length > 0}
        onViewCalendar={() => scrollToId('pulse-events')}
      />

      <div className="min-w-0 space-y-4">
        <PulseFilterChips active={effectiveFilter} available={available} onSelect={setFilter} />

        {/* Row 1 — Today's Read + Upcoming Events */}
        <div className={TWO_COL}>
          <TodaysReadCard pulse={pulse} />
          <UpcomingEventsCard pulse={pulse} />
        </div>

        {/* Row 2 — Top Picks + Action / Market Read */}
        <div className={TWO_COL}>
          <TopPicksTable picks={picks} />
          <ActionMarketReadCard actions={actions} marketRead={marketRead} onRun={runAction} />
        </div>

        <ImportantTodayStrip items={important} />

        <PreviousReadsList reads={reads} openDate={openPrevDate} />
      </div>
    </div>
  )
}
