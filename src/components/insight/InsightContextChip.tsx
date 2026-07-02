// InsightContextChip — the slim banner a section shows when it was opened from an
// insight: "Opened from Pulse · Premium growth +32% YoY", a Back-to-Pulse action
// (restores the reader's company, date + scroll), and a dismiss that clears the
// highlight for a clean view. Institutional, not loud.

import { ArrowLeft, Sparkles, X } from 'lucide-react'
import { focusPalette, type InsightFocus } from '@/insights/insightFocus'
import { useInsightFocus } from '@/state/insightFocus'

export function InsightContextChip({ focus, className = '' }: { focus: InsightFocus; className?: string }) {
  const { clearFocus, returnToOrigin, fromPulse } = useInsightFocus()
  const pal = focusPalette(focus.tone)
  const originLabel = focus.origin === 'pulse' || fromPulse ? 'Pulse' : 'Insight'

  return (
    <div
      className={`animate-fade-in flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-white/90 px-3 py-2 shadow-soft backdrop-blur ${className}`}
      style={{ borderColor: pal.ring }}
    >
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ color: pal.text, background: pal.soft }}
      >
        <Sparkles className="h-3 w-3" strokeWidth={2.2} />
        Opened from {originLabel}
      </span>

      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-navy-deep">
        {focus.insightLabel}
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={returnToOrigin}
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-white shadow-soft transition-transform hover:-translate-y-px"
          style={{ background: 'linear-gradient(135deg, #1E4079 0%, #14294C 100%)', borderColor: '#E4CE93' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} /> Back to {originLabel}
        </button>
        <button
          type="button"
          onClick={clearFocus}
          title="Dismiss highlight"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-soft-border text-ink-secondary transition-colors hover:bg-ice"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
