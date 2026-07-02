// Important Today — a compact horizontal strip of the categories genuinely detected
// in today's active data (Regulatory Watch, Sector Update, Analyst View, Management
// Change, Unusual Move, Filing Update). Empty categories are hidden; nothing stale.

import { Users, Landmark, LineChart, Zap, Activity, FileText, AlertCircle, type LucideIcon } from 'lucide-react'
import { IMPACT_META } from '@/insights/investorPulse'
import type { ImportantCategory } from './derive'
import { GOLD } from './parts'

const ICON: Record<string, LucideIcon> = {
  management: Users,
  regulatory: Landmark,
  analyst: LineChart,
  sector: Zap,
  move: Activity,
  filing: FileText,
}

function Tile({ item }: { item: ImportantCategory }) {
  const Icon = ICON[item.id] ?? AlertCircle
  const tone = IMPACT_META[item.tone]
  return (
    <div className="flex min-w-[200px] flex-1 items-start gap-2.5 rounded-xl border border-soft-border bg-white/70 px-3 py-2 shadow-soft">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: tone.bg, boxShadow: `inset 0 0 0 1px ${tone.dot}33` }}>
        <Icon className="h-4 w-4" strokeWidth={2} style={{ color: tone.fg }} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-navy-deep">{item.label}</p>
          {item.count > 1 && (
            <span className="rounded-full bg-soft-blue px-1.5 text-[8.5px] font-bold text-navy-primary">{item.count}</span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-ink-secondary">{item.detail}</p>
      </div>
    </div>
  )
}

export function ImportantTodayStrip({ items }: { items: ImportantCategory[] }) {
  if (items.length === 0) return null
  return (
    <section className="rounded-2xl border border-soft-border bg-surface-tint/60 p-3 shadow-soft section-wash">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="icon-ring-gold grid h-5 w-5 place-items-center rounded-md" style={{ background: 'rgba(182,139,58,0.12)' }}>
          <AlertCircle className="h-3 w-3" strokeWidth={2.2} style={{ color: GOLD }} />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-navy-deep">Important Today</span>
        <span className="gold-rule h-px w-8 rounded-full" />
      </div>
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {items.map((it) => (
          <Tile key={it.id} item={it} />
        ))}
      </div>
    </section>
  )
}
