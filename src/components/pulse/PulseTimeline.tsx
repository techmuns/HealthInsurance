// Pulse Timeline — the left navy date rail. Today is pinned + highlighted (gold);
// below it the rail is a CONTINUOUS calendar: every day back through the recent window
// is shown, so days with news (a coloured dot + item count, clickable) sit amongst the
// quiet days (a faint hollow dot + "No news", non-interactive). Nothing is jumped over,
// so a gap in the news reads as an intentional quiet day, not a missing/broken date.
// When there is no saved history at all, it shows "No previous reads yet".
// Vertical rail on laptop+, a compact horizontal date strip on narrow screens.
//
// The vertical rail is COLLAPSED by default so it never runs past the visible card:
// it shows only the most recent NEWS days (quiet "no news" days hidden) up to
// COLLAPSED_TIMELINE_COUNT, with a "See more" control at the card's bottom. Expanded,
// it reveals the full continuous calendar and scrolls INSIDE the card (bounded by a
// viewport-based max-height) rather than pushing the page downward.

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { STATUS_COLOR, type TimelineDay } from './derive'
import { GOLD_ON_NAVY } from './parts'

const NAVY = 'linear-gradient(168deg, #1C3A6E 0%, #15294C 60%, #102140 100%)'

// How many rail rows the collapsed default shows. Chosen so the recent stretch reads
// at a glance without the rail overflowing the visible left panel.
const COLLAPSED_TIMELINE_COUNT = 7

function dotColor(d: TimelineDay): string {
  if (d.isToday) return GOLD_ON_NAVY
  return d.status ? STATUS_COLOR[d.status].dot : 'rgba(255,255,255,0.35)'
}

export function PulseTimeline({
  days,
  selectedKey,
  onSelect,
}: {
  days: TimelineDay[]
  selectedKey: string
  onSelect: (key: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  // Collapsed: today + the days that actually carry news (newest first), capped —
  // quiet "no news" days stay hidden until expanded. Expanded: the full continuous
  // calendar exactly as derived (quiet days included).
  const newsDays = days.filter((d) => d.isToday || d.hasNews)
  const collapsedDays = newsDays.slice(0, COLLAPSED_TIMELINE_COUNT)
  const visibleDays = expanded ? days : collapsedDays
  // Only worth a control when collapsing actually hides rows.
  const canExpand = collapsedDays.length < days.length

  return (
    <aside
      // Collapsed the card is naturally short, so it needs no cap. Expanded, it is
      // bounded by a viewport-based max-height (the rail scrolls INSIDE the card
      // rather than running off the page). The 240px offset keeps the whole card —
      // "Show less" included — within the viewport from its resting top (~220px).
      className={`relative isolate overflow-hidden rounded-2xl px-3 py-3.5 shadow-card lg:sticky lg:top-2 lg:flex lg:flex-col lg:self-start${
        expanded ? ' lg:max-h-[calc(100vh-240px)]' : ''
      }`}
      style={{ background: NAVY }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(228,198,124,0.4) 30%, rgba(228,198,124,0.4) 70%, transparent)' }} />
      <p className="mb-3 shrink-0 px-1 text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: GOLD_ON_NAVY }}>
        Timeline
      </p>

      {/* vertical rail (lg+) — collapsed by default; expands + scrolls INSIDE the card */}
      <div className="hidden min-h-0 flex-1 flex-col lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <ol className="relative">
            <span className="absolute bottom-2 left-[10px] top-2 w-px" style={{ background: 'linear-gradient(180deg, rgba(228,198,124,0.4), rgba(228,198,124,0.08))' }} />
            {visibleDays.map((d) => {
              const on = d.key === selectedKey
              // A quiet day (no source-backed items): an honest, non-interactive "no news"
              // marker — faint hollow dot, dimmed date — so the rail reads as a continuous
              // calendar and the gap is visibly intentional, not a jumped-over date.
              if (!d.hasNews && !d.isToday) {
                return (
                  <li key={d.key} className="relative">
                    <div className="flex w-full items-center gap-2.5 rounded-lg py-[3px] pl-0 pr-1">
                      <span
                        className="relative z-[1] grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full"
                        style={{ background: '#15294C', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.38)' }} />
                      </span>
                      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
                          {d.dayNum} {d.monthLabel}
                        </span>
                        <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/25">· No news</span>
                      </span>
                    </div>
                  </li>
                )
              }
              return (
                <li key={d.key} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelect(d.key)}
                    className="group flex w-full items-center gap-2.5 rounded-lg py-1.5 pl-0 pr-1 text-left transition-colors hover:bg-white/5"
                  >
                    <span
                      className="relative z-[1] grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full"
                      style={{ background: '#15294C', boxShadow: on ? `inset 0 0 0 1px ${GOLD_ON_NAVY}` : 'inset 0 0 0 1px rgba(255,255,255,0.14)' }}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full transition-transform"
                        style={{ background: dotColor(d), boxShadow: d.isToday ? `0 0 0 3px rgba(228,198,124,0.18)` : undefined, transform: on ? 'scale(1.05)' : 'scale(0.86)' }}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span
                          className="text-[11px] font-bold uppercase tracking-[0.08em]"
                          style={{ color: d.isToday ? GOLD_ON_NAVY : on ? '#EAF1FB' : 'rgba(233,241,251,0.72)' }}
                        >
                          {d.label || `${d.dayNum} ${d.monthLabel}`}
                        </span>
                        {d.count > 0 && (
                          <span className="rounded-full px-1 text-[8px] font-bold text-white/70" style={{ background: 'rgba(255,255,255,0.10)' }}>
                            {d.count}
                          </span>
                        )}
                      </span>
                      <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                        {d.label ? `${d.dayNum} ${d.monthLabel} · ${d.weekday}` : d.weekday}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-2 flex shrink-0 w-full items-center justify-center gap-1 rounded-lg border-t border-white/10 pt-2 text-[9px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-white/5"
            style={{ color: GOLD_ON_NAVY }}
          >
            {expanded ? 'Show less' : 'See more'}
            <ChevronDown className="h-3 w-3 transition-transform" strokeWidth={2.4} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
          </button>
        )}
      </div>

      {/* horizontal strip (< lg) */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar lg:hidden">
        {days.map((d) => {
          const on = d.key === selectedKey
          // Quiet day — a dimmed, non-interactive "no news" marker (faint hollow dot),
          // so the horizontal strip also reads as an unbroken run of days.
          if (!d.hasNews && !d.isToday) {
            return (
              <div key={d.key} className="flex min-w-[46px] shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)' }} />
                <span className="text-[10px] font-bold uppercase text-white/45">{d.dayNum}</span>
                <span className="text-[8px] font-semibold uppercase tracking-wide text-white/30">{d.monthLabel}</span>
              </div>
            )
          }
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onSelect(d.key)}
              className="flex min-w-[58px] shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-colors"
              style={{ background: on ? 'rgba(255,255,255,0.08)' : 'transparent', boxShadow: on ? `inset 0 0 0 1px ${GOLD_ON_NAVY}55` : undefined }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: dotColor(d) }} />
              <span className="text-[10px] font-bold uppercase" style={{ color: d.isToday ? GOLD_ON_NAVY : 'rgba(233,241,251,0.8)' }}>
                {d.isToday ? 'Today' : d.dayNum}
              </span>
              <span className="text-[8px] font-semibold uppercase tracking-wide text-white/45">{d.monthLabel}</span>
            </button>
          )
        })}
      </div>

      {days.length <= 1 && (
        <p className="mt-2 px-1 text-[10px] italic leading-snug text-white/45">No previous reads yet — earlier days appear here as each daily brief is saved.</p>
      )}
    </aside>
  )
}
