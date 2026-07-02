// Today's Read — the deep-navy editorial hero. Gold serif headline, a status pill,
// three read rows (Changed / Matters / Watch next) and a source/freshness foot.
// Soft corner blobs + a hairline gold top edge keep the premium, calm finish.

import { PenLine, Globe, type LucideIcon } from 'lucide-react'
import type { InvestorPulse } from '@/insights/investorPulse'
import { statusOf } from './derive'
import { StatusPill, READ_ICON, GOLD_ON_NAVY } from './parts'

function ReadRow({ icon: Icon, label, text, tint, fg }: { icon: LucideIcon; label: string; text: string; tint: string; fg: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 first:pt-0" style={{ borderTop: '1px solid rgba(228,198,124,0.12)' }}>
      <span className="icon-ring-gold-dark mt-px grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: tint }}>
        <Icon className="h-4 w-4" strokeWidth={2.1} style={{ color: fg }} />
      </span>
      <p className="w-[74px] shrink-0 pt-1 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: GOLD_ON_NAVY }}>
        {label}
      </p>
      <p className="flex-1 pt-0.5 font-editorial text-[13px] leading-snug text-white/85">{text}</p>
    </div>
  )
}

export function TodaysReadCard({ pulse }: { pulse: InvestorPulse }) {
  const tr = pulse.todayRead
  if (!tr) {
    return (
      <section id="pulse-today" className="rounded-2xl border border-dashed border-soft-border bg-ice/40 px-5 py-10 text-center text-[12.5px] text-ink-secondary">
        No source-backed read for {pulse.company} today.
      </section>
    )
  }
  const status = statusOf(tr.stance)
  return (
    <section
      id="pulse-today"
      className="relative isolate flex flex-col overflow-hidden rounded-2xl px-5 py-4 shadow-card"
      style={{ background: 'linear-gradient(150deg, #1C3A6E 0%, #15294C 58%, #102140 100%)' }}
    >
      {/* soft corner-blob detailing — warm gold lower-right, soft blues elsewhere */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(circle at 90% 96%, rgba(214,178,98,0.34) 0%, transparent 50%),' +
            'radial-gradient(circle at 97% 6%, rgba(96,138,206,0.30) 0%, transparent 48%),' +
            'radial-gradient(circle at 4% 98%, rgba(44,80,146,0.5) 0%, transparent 54%),' +
            'radial-gradient(circle at 28% 24%, rgba(74,114,184,0.20) 0%, transparent 56%),' +
            'radial-gradient(circle at 16% 6%, rgba(122,162,222,0.26) 0%, transparent 50%)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(228,198,124,0.45) 30%, rgba(228,198,124,0.45) 70%, transparent)' }} />

      {/* eyebrow + status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="icon-ring-gold-dark grid h-8 w-8 place-items-center rounded-full" style={{ background: 'rgba(228,198,124,0.12)' }}>
            <PenLine className="h-4 w-4" style={{ color: GOLD_ON_NAVY }} strokeWidth={2} />
          </span>
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: GOLD_ON_NAVY }}>
              Today&apos;s Read
            </span>
            <span className="gold-rule h-px w-9 rounded-full" />
          </span>
        </div>
        <StatusPill status={status} onNavy />
      </div>

      {/* gold serif headline */}
      <h2 className="mt-2.5 font-display text-[21px] font-semibold leading-[1.2] tracking-[0.002em]" style={{ color: '#E9C46C' }}>
        {tr.headline}
      </h2>

      {/* changed / matters / watch next */}
      <div className="mt-2.5">
        <ReadRow icon={READ_ICON.changed} label="Changed" text={tr.changed} tint="rgba(228,198,124,0.14)" fg={GOLD_ON_NAVY} />
        <ReadRow icon={READ_ICON.matters} label="Matters" text={tr.matters} tint="rgba(255,255,255,0.08)" fg="#CFE0F5" />
        <ReadRow icon={READ_ICON.watch} label="Watch Next" text={tr.watchNext} tint="rgba(56,168,162,0.16)" fg="#6FD0CB" />
      </div>

      {/* source / freshness foot */}
      <div className="mt-3 flex items-center gap-2 pt-2.5 text-[10.5px] font-medium text-white/60" style={{ borderTop: '1px solid rgba(228,198,124,0.16)' }}>
        <span className="icon-ring-gold-dark grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: 'rgba(228,198,124,0.10)' }}>
          <Globe className="h-3 w-3" strokeWidth={2.1} style={{ color: 'rgba(228,198,124,0.9)' }} />
        </span>
        <span className="tracking-[0.01em]">{tr.sourceLine}</span>
      </div>
    </section>
  )
}
