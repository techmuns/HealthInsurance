// InvestorPulse — the Insights header's company control + the Pulse view export.
//
// The Pulse UI lives in ./pulse — an AI-first Executive Brief (ExecutiveBrief)
// driven by PulseTimeline (dates) + PulseFilterChips, composed in PulseView over
// the ./derive selectors. This module keeps the single company selector used in
// the Insights header and re-exports PulseView so existing imports stay stable.

import { ChevronDown } from 'lucide-react'
import { insurers } from '@/data/mockData'

// ── Insights company scope ───────────────────────────────────────────────────
// The sentinel for the combined, no-company-filter view. When selected, the
// Pulse (and Data Insights) read the whole standalone-health pool together.
export const ALL_COMPANIES = 'all'

export interface InsightsCompanyOption {
  id: string
  label: string
}

// Canonical company order for the Insights (Pulse of Insights) selector:
// "All" (combined) first, then the standalone health insurers in the established
// order. Labels come straight from the insurer master so they never drift from
// the data.
const SAHI_ORDER = ['niva-bupa', 'star-health', 'care-health', 'aditya-birla', 'manipalcigna']
const SAHI = insurers
  .filter((i) => i.peerGroup === 'SAHI')
  .slice()
  .sort((a, b) => SAHI_ORDER.indexOf(a.id) - SAHI_ORDER.indexOf(b.id))

export const INSIGHTS_COMPANY_OPTIONS: InsightsCompanyOption[] = [
  { id: ALL_COMPANIES, label: 'All' },
  ...SAHI.map((c) => ({ id: c.id, label: c.shortName })),
]

/** The prose label for a scope id — the plain insurer name, or "All companies"
 *  for the combined view (the identity used in the brief / PDF title). */
export function insightsCompanyLabel(id: string): string {
  if (id === ALL_COMPANIES) return 'All companies'
  return SAHI.find((c) => c.id === id)?.shortName ?? id
}

// ── Compact company filter — a controlled dropdown shared across the Insights
//    tab (Pulse + Data Insights). "All" is the default combined view. ──────────

export function CompanyFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <label className="group inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-soft-border bg-white px-2.5 py-1.5 shadow-soft transition-colors hover:border-muted-blue">
      <span className="text-[8.5px] font-bold uppercase tracking-[0.09em] text-ink-secondary">Company</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent pr-1 text-[12px] font-semibold text-navy-deep outline-none"
      >
        {INSIGHTS_COMPANY_OPTIONS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <ChevronDown className="h-3 w-3 shrink-0 text-ink-secondary transition-colors group-hover:text-muted-blue" />
    </label>
  )
}

export { PulseView } from './pulse/PulseView'
