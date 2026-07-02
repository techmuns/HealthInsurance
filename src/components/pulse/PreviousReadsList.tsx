// Previous Reads — a compact log. Each row: date · one-line summary · status pill ·
// chevron to expand that day's source-backed items. Selecting a date on the left
// timeline auto-expands and scrolls to its row. No large cards unless expanded.

import { useEffect, useState } from 'react'
import { History, ChevronDown, ExternalLink } from 'lucide-react'
import type { PreviousRead } from './derive'
import { StatusPill, CATEGORY_ICON, GOLD } from './parts'

function ReadRow({ read, open, onToggle }: { read: PreviousRead; open: boolean; onToggle: () => void }) {
  return (
    <div id={`pulse-prev-${read.date}`} className="scroll-mt-24">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${open ? 'bg-ice/60' : 'hover:bg-ice/50'}`}
      >
        <span className="w-[64px] shrink-0 text-[11px] font-bold text-navy-deep">{read.dateLabel}</span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-primary">{read.summary}</span>
        <StatusPill status={read.status} />
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="space-y-1.5 border-t border-soft-border/60 bg-surface-tint/40 px-3 py-2.5 pl-[76px]">
          {read.items.map((it, i) => {
            const Icon = CATEGORY_ICON[it.category]
            return (
              <li key={i} className="flex items-start gap-2 text-[11px] leading-snug">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-primary" strokeWidth={2} />
                <span className="min-w-0 flex-1 text-ink-secondary">
                  {it.title}
                  {it.url && (
                    <a href={it.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[10px] font-medium text-navy-primary hover:underline">
                      source<ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function PreviousReadsList({ reads, openDate }: { reads: PreviousRead[]; openDate: string | null }) {
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    if (openDate) setOpen(openDate)
  }, [openDate])

  if (reads.length === 0) return null
  return (
    <section id="pulse-previous" className="premium-panel overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-soft-border/70 px-4 py-2.5">
        <span className="icon-ring-gold grid h-6 w-6 place-items-center rounded-md" style={{ background: 'rgba(182,139,58,0.12)' }}>
          <History className="h-3.5 w-3.5" strokeWidth={2.1} style={{ color: GOLD }} />
        </span>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-navy-deep">Previous Reads</h3>
        <span className="ml-auto text-[9.5px] font-semibold text-ink-secondary">{reads.length}</span>
      </div>
      <div className="divide-y divide-soft-border/70">
        {reads.map((r) => (
          <ReadRow key={r.date} read={r} open={open === r.date} onToggle={() => setOpen((v) => (v === r.date ? null : r.date))} />
        ))}
      </div>
    </section>
  )
}
