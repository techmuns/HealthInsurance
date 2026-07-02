// Pulse filter chips — subtle, single-select. "Most relevant" is the default; the
// rest appear only when they have data. The active filter reshapes Top Picks,
// Important Today and Previous Reads. Click-only, no hover-dependent behaviour.

import { SlidersHorizontal } from 'lucide-react'
import { FILTERS, type PulseFilter } from './derive'

export function PulseFilterChips({
  active,
  available,
  onSelect,
}: {
  active: PulseFilter
  available: Set<PulseFilter>
  onSelect: (f: PulseFilter) => void
}) {
  const shown = FILTERS.filter((f) => available.has(f.id))
  if (shown.length <= 1) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-secondary">
        <SlidersHorizontal className="h-3 w-3" strokeWidth={2.2} />
        Filter
      </span>
      {shown.map((f) => {
        const on = f.id === active
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            className={[
              'chip-soft rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors',
              on ? 'text-white' : 'border border-soft-border bg-white text-navy-deep hover:bg-ice',
            ].join(' ')}
            style={on ? { background: 'linear-gradient(135deg, #1E4079 0%, #14294C 100%)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.4)' } : undefined}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
