// Action for Today + Market Read — the middle-row right card. Up to 4 large action
// pills, each tied to a real top pick / event (navigates into the dashboard or
// opens the source). Under them, a 2–3 line Market Read explaining the daily read.

import { Users, Scale, ShieldCheck, CalendarClock, Landmark, ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { ActionIcon, PulseAction } from './derive'
import { GOLD } from './parts'

const ICON: Record<ActionIcon, LucideIcon> = {
  ownership: Users,
  margins: Scale,
  source: ShieldCheck,
  agm: CalendarClock,
  regulation: Landmark,
}

function ActionPill({ action, onRun }: { action: PulseAction; onRun: (a: PulseAction) => void }) {
  const Icon = ICON[action.icon]
  const external = !!action.href
  return (
    <button
      type="button"
      onClick={() => onRun(action)}
      className="group flex items-center gap-2 rounded-xl border border-soft-border bg-white px-3 py-2.5 text-left shadow-soft transition-colors hover:border-champagne hover:bg-champagne-soft/40"
    >
      <span className="icon-ring-gold grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: 'rgba(182,139,58,0.10)' }}>
        <Icon className="h-4 w-4" strokeWidth={2} style={{ color: GOLD }} />
      </span>
      <span className="min-w-0 flex-1 text-[12px] font-semibold leading-tight text-navy-deep">{action.label}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-secondary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={external ? { color: GOLD } : undefined} />
    </button>
  )
}

export function ActionMarketReadCard({
  actions,
  marketRead,
  onRun,
}: {
  actions: PulseAction[]
  marketRead: string[]
  onRun: (a: PulseAction) => void
}) {
  return (
    <section className="premium-panel flex flex-col rounded-2xl p-4">
      <div className="flex items-center gap-2 pb-3">
        <span className="h-3 w-[3px] rounded-full bg-champagne" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-navy-deep">Action for Today</h3>
        <span className="gold-rule h-px w-8 rounded-full" />
      </div>

      {actions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-soft-border bg-ice/40 px-3 py-4 text-center text-[11px] text-ink-secondary">
          No specific action stands out from today&apos;s picks.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {actions.map((a) => (
            <ActionPill key={a.id} action={a} onRun={onRun} />
          ))}
        </div>
      )}

      {marketRead.length > 0 && (
        <div className="mt-4 border-t border-soft-border/70 pt-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-champagne">Market Read</span>
            <span className="gold-rule h-px w-6 rounded-full" />
          </div>
          <div className="space-y-1.5">
            {marketRead.map((line, i) => (
              <p key={i} className="text-[11.5px] leading-snug text-ink-secondary">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
