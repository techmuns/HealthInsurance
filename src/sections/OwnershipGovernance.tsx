import { SectionTabs, type SectionTab } from '@/components/SectionTabs'
import { Ownership } from '@/sections/Ownership'
import { ManagementEvents } from '@/sections/ManagementEvents'
import { useSectionFocus } from '@/state/insightFocus'

const TABS: SectionTab[] = [
  { id: 'ownership', label: 'Ownership' },
  { id: 'management', label: 'Management Events' },
]

/**
 * Ownership & Governance — merges Ownership and Management Events under one
 * section with internal tabs. Both are now exposed for visual review: Ownership
 * carries its shareholding scaffold and Management Events its Promise Tracker +
 * event-feed structure (each clearly flagged where live data is still pending).
 */
export function OwnershipGovernance({ onNavigate, sub }: { onNavigate?: (id: string) => void; sub?: string }) {
  // When arriving from a management / events insight, open the Management tab so
  // the reader lands on the exact thing the insight pointed at.
  const focus = useSectionFocus('governance')
  const wantsMgmt = focus?.kind === 'locator' && (focus.locatorKind === 'management' || focus.locatorKind === 'events')
  const explicit = TABS.find((t) => t.id === sub?.split('/')[0])?.id
  const tab = explicit ?? (wantsMgmt ? 'management' : TABS[0].id)
  const go = (id: string) => onNavigate?.(`ownership-governance/${id}`)
  return (
    <div className="space-y-5">
      <SectionTabs tabs={TABS} active={tab} onSelect={go} />
      <div key={tab} className="animate-fade-in">
        {tab === 'ownership' && <Ownership />}
        {tab === 'management' && <ManagementEvents />}
      </div>
    </div>
  )
}
