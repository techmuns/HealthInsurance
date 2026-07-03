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
  curatedDigest,
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
import { CuratedDigest } from './CuratedDigest'
import { SS, readSS, writeSS } from './pulseState'

type PulseMode = 'curated' | 'brief'

export function PulseView({
  pulse,
  onGoToSource,
}: {
  pulse: InvestorPulse
  onGoToSource?: (target: NavTarget, insightId: string) => void
}) {
  const [filter, setFilter] = useState<PulseFilter>(() => (readSS(SS.filter, pulse.companyId) as PulseFilter) ?? 'relevant')
  const [dateKey, setDateKey] = useState(() => readSS(SS.date, pulse.companyId) ?? 'today')
  // Curated (the premium editor's digest) is the lead view; the full analytical
  // Brief is one tap away. A pure view preference — persisted, but NOT reset on a
  // company change (unlike filter/date, which are data-scoped).
  const [mode, setMode] = useState<PulseMode>(() => (readSS(SS.mode, pulse.companyId) as PulseMode) ?? 'curated')

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

  // Persist the reader's current filter + date + view mode for the round-trip restore.
  useEffect(() => writeSS(SS.filter, pulse.companyId, effFilter), [effFilter, pulse.companyId])
  useEffect(() => writeSS(SS.date, pulse.companyId, dateKey), [dateKey, pulse.companyId])
  useEffect(() => writeSS(SS.mode, pulse.companyId, mode), [mode, pulse.companyId])

  const selectedDay = days.find((d) => d.key === dateKey) ?? days[0]
  const dateLabel = selectedDay ? `${selectedDay.dayNum} ${selectedDay.monthLabel} · ${selectedDay.weekday}` : ''

  const scoped = useMemo(() => scopeSignals(pulse, effFilter, dateKey), [pulse, effFilter, dateKey])
  const ideas = useMemo(() => convictionIdeas(scoped, pulse), [scoped, pulse])
  const brief = useMemo(() => morningBrief(pulse, ideas, scoped, isToday, dateLabel), [pulse, ideas, scoped, isToday, dateLabel])
  const curated = useMemo(() => curatedDigest(ideas, brief), [ideas, brief])
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
            <div className="flex shrink-0 items-center gap-2">
              {/* Curated (the editor's digest) ⇄ Brief (the full analytical read).
                  Both read the same filtered, source-backed slice. */}
              <div className="inline-flex rounded-lg border border-soft-border bg-white p-0.5 shadow-soft" role="tablist" aria-label="Pulse view">
                {(['curated', 'brief'] as PulseMode[]).map((m) => {
                  const on = m === mode
                  return (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setMode(m)}
                      title={m === 'curated' ? 'Curated — the day’s highest-value moves, ranked and reasoned' : 'Brief — the full analytical read'}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${on ? 'text-white' : 'text-navy-deep hover:bg-ice'}`}
                      style={on ? { background: 'linear-gradient(135deg, #1E4079 0%, #14294C 100%)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.4)' } : undefined}
                    >
                      {m === 'curated' ? 'Curated' : 'Brief'}
                    </button>
                  )
                })}
              </div>
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
          </div>
          {mode === 'curated' ? (
            <CuratedDigest pulse={pulse} digest={curated} isToday={isToday} dateLabel={dateLabel} onNavigate={onGoToSource} />
          ) : (
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
          )}
        </div>
      </div>
    </div>
  )
}
