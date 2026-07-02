// InvestorPulse — the Insights header's company control + the Pulse view export.
//
// The Pulse daily-briefing UI lives in ./pulse — one unified card
// (TodaysIntelligenceCard) driven by PulseTimeline (dates) + PulseFilterChips,
// composed in PulseView over the ./derive selectors. This module keeps the single
// company selector used in the Insights header and re-exports PulseView so
// existing imports stay stable.

import { ChevronDown } from 'lucide-react'
import { insurers } from '@/data/mockData'
import { useActiveCompany, useFilters } from '@/state/filters'

const SAHI = insurers.filter((i) => i.peerGroup === 'SAHI')

// ── Compact company filter — drives the global `highlightedCompany`. A small
//    dropdown (not a chip row), so the Pulse works for any company later. ──────

export function CompanyFilter() {
  const active = useActiveCompany()
  const { setHighlightedCompany } = useFilters()
  return (
    <label className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-soft-border bg-white px-2.5 py-1.5 shadow-soft transition-colors hover:border-muted-blue">
      <span className="text-[8.5px] font-bold uppercase tracking-[0.09em] text-ink-secondary">Company</span>
      <select
        value={active.id}
        onChange={(e) => setHighlightedCompany(e.target.value)}
        className="appearance-none bg-transparent pr-1 text-[12px] font-semibold text-navy-deep outline-none"
      >
        {SAHI.map((c) => (
          <option key={c.id} value={c.id}>
            {c.shortName}
          </option>
        ))}
      </select>
      <ChevronDown className="h-3 w-3 shrink-0 text-ink-secondary transition-colors group-hover:text-muted-blue" />
    </label>
  )
}

export { PulseView } from './pulse/PulseView'
