// Top Picks of the Day — the ranked table. Columns: Rank · Company/Topic · What
// happened · Why it matters · What to watch. Top 3 (a 4th only when genuinely
// high-relevance). Rank 1 carries a gold/blue accent. Each row expands (click /
// chevron) to a compact source-evidence stack — never a wall of media logos.

import { useState } from 'react'
import { Star, ChevronDown } from 'lucide-react'
import type { TopPick } from './derive'
import { StatusPill, RelevanceTag, SourceChip, CATEGORY_ICON, GOLD } from './parts'

const COLS = 'lg:grid lg:grid-cols-[34px_minmax(0,1.35fr)_minmax(0,1.7fr)_minmax(0,1.7fr)_minmax(0,1.7fr)_26px] lg:items-start lg:gap-3'

function RankBadge({ rank, lead }: { rank: number; lead: boolean }) {
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[12px] font-bold"
      style={
        lead
          ? { color: '#14294C', background: 'linear-gradient(135deg, #F0D89A, #D9B96A)', boxShadow: 'inset 0 0 0 1px rgba(182,139,58,0.5)' }
          : { color: '#27457E', background: 'rgba(39,69,126,0.08)', boxShadow: 'inset 0 0 0 1px rgba(39,69,126,0.16)' }
      }
    >
      {rank}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[8.5px] font-bold uppercase tracking-[0.12em] text-ink-secondary lg:hidden">{label}</p>
      {children}
    </div>
  )
}

function PickRow({ pick }: { pick: TopPick }) {
  const [open, setOpen] = useState(false)
  const lead = pick.rank === 1
  const Icon = CATEGORY_ICON[pick.category]
  return (
    <div
      className={`relative rounded-xl px-3 py-3 transition-colors ${open ? 'bg-ice/60' : 'hover:bg-ice/50'}`}
      style={lead ? { background: 'linear-gradient(100deg, rgba(228,198,124,0.12), rgba(39,69,126,0.05) 60%, transparent)' } : undefined}
    >
      {lead && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full" style={{ background: 'linear-gradient(180deg, #E4C67C, #B68B3A)' }} />}
      <button type="button" onClick={() => setOpen((v) => !v)} className={`w-full text-left ${COLS}`}>
        {/* rank */}
        <div className="mb-2 flex items-center gap-2 lg:mb-0">
          <RankBadge rank={pick.rank} lead={lead} />
        </div>

        {/* company / topic */}
        <Field label="Company / Topic">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} style={{ color: lead ? GOLD : '#27457E' }} />
            <span className="truncate text-[12.5px] font-bold text-navy-deep">{pick.entity}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <StatusPill status={pick.status} />
            {pick.tags.map((t) => (
              <RelevanceTag key={t} tag={t} />
            ))}
          </div>
        </Field>

        {/* what happened */}
        <Field label="What happened">
          <p className="text-[11.5px] font-semibold leading-snug text-navy-deep">{pick.whatHappened}</p>
          <p className="mt-0.5 text-[9.5px] font-medium text-ink-secondary">{pick.dateLabel}</p>
        </Field>

        {/* why it matters */}
        <Field label="Why it matters">
          <p className="text-[11px] leading-snug text-ink-secondary">{pick.whyItMatters}</p>
        </Field>

        {/* what to watch */}
        <Field label="What to watch">
          <p className="text-[11px] leading-snug text-ink-secondary">{pick.whatToWatch}</p>
        </Field>

        {/* chevron */}
        <span className="mt-2 hidden justify-self-end lg:mt-0.5 lg:flex">
          <ChevronDown className={`h-4 w-4 text-ink-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* evidence stack */}
      {open && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-soft-border/70 pt-2.5 lg:pl-[46px]">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-secondary">Evidence</span>
          <SourceChip kind={pick.evidence.kind} name={pick.evidence.name} url={pick.evidence.url} />
          <span className="truncate text-[10px] text-ink-secondary">{pick.evidence.name}</span>
        </div>
      )}
    </div>
  )
}

export function TopPicksTable({ picks }: { picks: TopPick[] }) {
  return (
    <section className="premium-panel overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <span className="icon-ring-gold grid h-6 w-6 place-items-center rounded-md" style={{ background: 'rgba(182,139,58,0.12)' }}>
            <Star className="h-3.5 w-3.5" strokeWidth={2.1} style={{ color: GOLD }} />
          </span>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-navy-deep">Top Picks of the Day</h2>
          <span className="gold-rule h-px w-8 rounded-full" />
        </div>
        <span className="text-[9.5px] font-semibold text-ink-secondary">Ranked by relevance · source-backed</span>
      </div>

      {picks.length === 0 ? (
        <div className="px-4 py-8 text-center text-[11.5px] text-ink-secondary">Nothing meets the bar for a pick under this filter.</div>
      ) : (
        <>
          {/* header row (lg only) */}
          <div className={`hidden border-y border-soft-border bg-surface-tint/70 px-3 py-2 ${COLS}`} style={{ borderBottomColor: 'rgba(182,139,58,0.28)' }}>
            {['#', 'Company / Topic', 'What happened', 'Why it matters', 'What to watch', ''].map((h, i) => (
              <span key={i} className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-secondary">
                {h}
              </span>
            ))}
          </div>
          <div className="divide-y divide-soft-border/70 p-1.5">
            {picks.map((p) => (
              <PickRow key={p.id} pick={p} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
