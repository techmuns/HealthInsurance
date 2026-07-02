// Pulse — the AI-first Market Pulse workspace. The left date timeline and the
// filter chips sit OUTSIDE and drive an Executive Brief on a soft blue field: an
// AI Morning Brief, the one thing to read, a since-yesterday delta strip, and
// Highest-Conviction ideas (each with a "why should I care?" + a next action).
// Every filter/date re-composes the brief over its slice. All real, source-backed.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import type { InvestorPulse } from '@/insights/investorPulse'
import type { NavTarget } from '@/insights/sourceMap'
import { downloadDailyBrief } from '@/lib/pulseBriefPdf'
import {
  actionsForBrief,
  availableFilters,
  briefMessage,
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

// Pulse remembers the reader's filter + selected date per company, so a jump out
// to the dashboard ("View in dashboard") and back lands on the same read. Kept in
// sessionStorage (survives PulseView unmount without leaking across a page reload).
const SS_FILTER = 'pulse:filter'
const SS_DATE = 'pulse:date'
function readSS(key: string, company: string): string | null {
  try {
    return sessionStorage.getItem(`${key}:${company}`)
  } catch {
    return null
  }
}
function writeSS(key: string, company: string, val: string): void {
  try {
    sessionStorage.setItem(`${key}:${company}`, val)
  } catch {
    /* storage unavailable — restoration simply falls back to defaults */
  }
}

export function PulseView({
  pulse,
  onGoToSource,
}: {
  pulse: InvestorPulse
  onGoToSource?: (target: NavTarget, insightId: string) => void
}) {
  const [filter, setFilter] = useState<PulseFilter>(() => (readSS(SS_FILTER, pulse.companyId) as PulseFilter) ?? 'relevant')
  const [dateKey, setDateKey] = useState(() => readSS(SS_DATE, pulse.companyId) ?? 'today')

  // Reset to defaults only on a genuine company change — NOT on first mount, so a
  // restored filter/date survives returning from a "View in dashboard" jump.
  const prevCompany = useRef(pulse.companyId)
  useEffect(() => {
    if (prevCompany.current !== pulse.companyId) {
      prevCompany.current = pulse.companyId
      setFilter('relevant')
      setDateKey('today')
    }
  }, [pulse.companyId])

  const available = useMemo(() => availableFilters(pulse), [pulse])
  const effFilter = available.has(filter) ? filter : 'relevant'
  const days = useMemo(() => timelineDays(pulse), [pulse])
  const isToday = dateKey === 'today'

  // Persist the reader's current filter + date for the round-trip restore.
  useEffect(() => writeSS(SS_FILTER, pulse.companyId, effFilter), [effFilter, pulse.companyId])
  useEffect(() => writeSS(SS_DATE, pulse.companyId, dateKey), [dateKey, pulse.companyId])

  const selectedDay = days.find((d) => d.key === dateKey) ?? days[0]
  const dateLabel = selectedDay ? `${selectedDay.dayNum} ${selectedDay.monthLabel} · ${selectedDay.weekday}` : ''

  const scoped = useMemo(() => scopeSignals(pulse, effFilter, dateKey), [pulse, effFilter, dateKey])
  const ideas = useMemo(() => convictionIdeas(scoped, pulse), [scoped, pulse])
  const brief = useMemo(() => morningBrief(pulse, ideas, scoped, isToday, dateLabel), [pulse, ideas, scoped, isToday, dateLabel])
  const one = useMemo(() => oneThing(scoped, ideas, pulse), [scoped, ideas, pulse])
  const message = useMemo(() => briefMessage(pulse, scoped, one, isToday, dateLabel), [pulse, scoped, one, isToday, dateLabel])
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

  const handleDownload = () => {
    downloadDailyBrief({
      company: pulse.company,
      dateLabel,
      isToday,
      brief,
      message,
      one,
      sinceDeltas,
      ideas,
      events,
      actions,
      confidence: pulse.confidence,
    })
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
        <PulseTimeline days={days} selectedKey={dateKey} onSelect={setDateKey} />

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <PulseFilterChips active={effFilter} available={available} onSelect={setFilter} />
            <button
              type="button"
              onClick={handleDownload}
              title="Download this brief as a clean PDF (opens your print dialog — choose “Save as PDF”)"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E4CE93] px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-soft transition-transform hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg, #1E4079 0%, #14294C 100%)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.4), 0 4px 12px rgba(20,48,88,0.18)' }}
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2} style={{ color: '#E4C67C' }} /> Download Daily Brief
            </button>
          </div>
          <ExecutiveBrief
            pulse={pulse}
            brief={brief}
            message={message}
            sinceDeltas={sinceDeltas}
            ideas={ideas}
            events={events}
            actions={actions}
            isToday={isToday}
            dateLabel={dateLabel}
            onRun={runAction}
            onNavigate={onGoToSource}
          />
        </div>
      </div>
    </div>
  )
}
