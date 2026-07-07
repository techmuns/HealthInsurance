// Pulse — the AI-first Market Pulse workspace. The left date timeline and the
// filter chips sit OUTSIDE and drive an Executive Brief on a soft blue field: an
// AI Morning Brief, the one thing to read, a since-yesterday delta strip, and
// Highest-Conviction ideas (each with a "why should I care?" + a next action).
// Every filter/date re-composes the brief over its slice. All real, source-backed.
//
// Pulse IS the curated market-intelligence page — there is no separate "curated"
// mode. The daily brief itself is the curation: it ranks by value, marks what is
// fresh today, and shows only source-backed items that matter.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import type { InvestorPulse } from '@/insights/investorPulse'
import type { NavTarget } from '@/insights/sourceMap'
import { downloadDailyBrief } from '@/lib/pulseBriefPdf'
import {
  availableFilters,
  resolveDailyBrief,
  timelineDays,
  type PulseAction,
  type PulseFilter,
} from './derive'
import { PulseTimeline } from './PulseTimeline'
import { PulseFilterChips } from './PulseFilterChips'
import { ExecutiveBrief } from './ExecutiveBrief'
import { SS, readSS, writeSS } from './pulseState'

export function PulseView({
  pulse,
  onGoToSource,
}: {
  pulse: InvestorPulse
  onGoToSource?: (target: NavTarget, insightId: string) => void
}) {
  const [filter, setFilter] = useState<PulseFilter>(() => (readSS(SS.filter, pulse.companyId) as PulseFilter) ?? 'relevant')
  // The page always opens on today; a restored date survives a "View in dashboard"
  // round-trip, but a genuine day-rollover (stored date no longer in the timeline)
  // falls back to today below.
  const [dateKey, setDateKey] = useState(() => readSS(SS.date, pulse.companyId) ?? 'today')

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

  // Daily rollover: if the persisted date is no longer a real saved brief date
  // (a new day has begun and yesterday scrolled into the archive), snap back to
  // today so the page never opens stuck on a stale day.
  const effDateKey = days.some((d) => d.key === dateKey) ? dateKey : 'today'
  const isToday = effDateKey === 'today'
  useEffect(() => {
    if (effDateKey !== dateKey) setDateKey(effDateKey)
  }, [effDateKey, dateKey])

  // Persist the reader's current filter + date for the round-trip restore.
  useEffect(() => writeSS(SS.filter, pulse.companyId, effFilter), [effFilter, pulse.companyId])
  useEffect(() => writeSS(SS.date, pulse.companyId, effDateKey), [effDateKey, pulse.companyId])

  const selectedDay = days.find((d) => d.key === effDateKey) ?? days[0]
  const dateLabel = selectedDay ? `${selectedDay.dayNum} ${selectedDay.monthLabel} · ${selectedDay.weekday}` : ''

  // One resolver returns the whole bundle: live for today (and filtered views), the
  // FROZEN archived record for a past date, or a live past-date fallback. Since-
  // Yesterday / Events / Actions come back empty for a live past date and populated
  // (as-of that day) for a frozen record.
  const { brief, message, one, ideas, sinceDeltas, events, actions } = useMemo(
    () => resolveDailyBrief(pulse, effFilter, effDateKey, dateLabel),
    [pulse, effFilter, effDateKey, dateLabel],
  )

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
      companyId: pulse.companyId,
      dateLabel,
      isToday,
      brief,
      message,
      one,
      // Already date-scoped by the resolver (empty for a live past date, frozen
      // as-of-that-day for an archived one).
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
        <PulseTimeline days={days} selectedKey={effDateKey} onSelect={setDateKey} />

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
