// Pulse Timeline — the left navy date rail. Today is pinned + highlighted (gold);
// earlier entries appear ONLY for real saved brief dates (never news-item dates).
// When there is no saved history, it shows "No previous reads yet".
// Vertical rail on laptop+, a compact horizontal date strip on narrow screens.

import { STATUS_COLOR, type TimelineDay } from './derive'
import { GOLD_ON_NAVY } from './parts'

const NAVY = 'linear-gradient(168deg, #1C3A6E 0%, #15294C 60%, #102140 100%)'

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
  return (
    <aside
      className="relative isolate overflow-hidden rounded-2xl px-3 py-3.5 shadow-card lg:sticky lg:top-2 lg:self-start"
      style={{ background: NAVY }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(228,198,124,0.4) 30%, rgba(228,198,124,0.4) 70%, transparent)' }} />
      <p className="mb-3 px-1 text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: GOLD_ON_NAVY }}>
        Timeline
      </p>

      {/* vertical rail (lg+) */}
      <ol className="relative hidden lg:block">
        <span className="absolute bottom-2 left-[10px] top-2 w-px" style={{ background: 'linear-gradient(180deg, rgba(228,198,124,0.4), rgba(228,198,124,0.08))' }} />
        {days.map((d) => {
          const on = d.key === selectedKey
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

      {/* horizontal strip (< lg) */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar lg:hidden">
        {days.map((d) => {
          const on = d.key === selectedKey
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
