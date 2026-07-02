import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ShieldAlert, AlertTriangle, Scale, TrendingUp, Gauge, Users, Landmark, Share2, CalendarClock, RotateCw, type LucideIcon } from 'lucide-react'
import type { Insight, InsightCategory } from '@/insights/types'
import { InsightChart } from '@/components/InsightChart'
import { MethodologyPanel } from '@/components/MethodologyPanel'
import { getPromises, type PromiseStatus } from '@/lib/promiseTracker'
import { classifySource, sourceHref, isLinkable } from '@/lib/sourceHealth'
import type { Freshness, SourceLocation } from '@/insights/sourceMap'

// ───────────────────────────────────────────────────────────────────────────
//  InsightCard — the Data-Insights flip card. The FRONT is deliberately minimal
//  and catchy: one sharp headline, a 1–2 line plain-English read, the company,
//  a section tag and a period tag — no numbers, ratios, charts or tables. The
//  whole card is clickable; a tap flips it to the detailed BACK (the
//  MethodologyPanel: how it was derived, the formula, the source data points,
//  the framework, the interpretation, what to watch and a go-to-source link).
//  The 3D flip, variable-height sizing and reduced-motion cross-fade are the
//  proven mechanics reused across the dashboard's insight cards.
// ───────────────────────────────────────────────────────────────────────────

// Readable insurer names (the data uses lowercase ids).
export const NAMES: Record<string, string> = {
  'niva-bupa': 'Niva Bupa', 'star-health': 'Star Health', 'care-health': 'Care Health',
  'aditya-birla': 'Aditya Birla', 'manipalcigna': 'ManipalCigna', panel: 'Across the panel',
}
export const pretty = (id: string) => NAMES[id] ?? id
const GOLD = '#C99736'

// Colour-psychology tones, one per insight character — muted and premium, never
// loud: risk = warm terracotta (caution), opp = deep teal (upside), watch =
// champagne gold (valuation / high-conviction), flag = slate navy (steady,
// competitive). Each tone carries fg (ink + strokes), bg (chip tint), ring
// (hairline border), wash (ultra-faint full-card overlay) and soft (metric-tile fill).
export type Tone = 'risk' | 'opp' | 'watch' | 'flag'
export const TONE: Record<Tone, { fg: string; bg: string; ring: string; wash: string; soft: string }> = {
  risk:  { fg: '#A8443B', bg: 'rgba(168,68,59,0.08)',  ring: 'rgba(168,68,59,0.20)',  wash: 'rgba(168,68,59,0.05)',  soft: '#FBEEEC' },
  opp:   { fg: '#0E6F6D', bg: 'rgba(14,111,109,0.08)', ring: 'rgba(14,111,109,0.20)', wash: 'rgba(14,111,109,0.045)', soft: '#E6F2F1' },
  watch: { fg: '#9C7430', bg: 'rgba(156,116,48,0.10)', ring: 'rgba(156,116,48,0.24)', wash: 'rgba(156,116,48,0.05)',  soft: '#F6EFDD' },
  flag:  { fg: '#27457E', bg: 'rgba(39,69,126,0.07)',  ring: 'rgba(39,69,126,0.18)',  wash: 'rgba(39,69,126,0.04)',  soft: '#EEF3FB' },
}
export const CATCH: Record<InsightCategory, { label: string; Icon: LucideIcon; tone: Tone }> = {
  capital: { label: 'Capital watch', Icon: ShieldAlert, tone: 'risk' },
  earnings_quality: { label: 'Earnings-quality flag', Icon: AlertTriangle, tone: 'risk' },
  valuation: { label: 'Valuation gap', Icon: Scale, tone: 'watch' },
  growth: { label: 'Growth standout', Icon: TrendingUp, tone: 'opp' },
  quality: { label: 'Quality flag', Icon: Gauge, tone: 'flag' },
  management: { label: 'Management read', Icon: Users, tone: 'flag' },
  regulatory: { label: 'Regulatory shift', Icon: Landmark, tone: 'flag' },
  market_structure: { label: 'Market shift', Icon: Share2, tone: 'flag' },
}

export type Priority = 'high' | 'watch' | 'normal'

// Front-of-card priority/relevance tag — tone-coded, compact. High = act on it
// (champagne), Watch = monitor (navy), Context = supporting read (slate).
const PRIORITY_TAG: Record<Priority, { label: string; fg: string; bg: string; ring: string }> = {
  high: { label: 'High priority', fg: '#9C7430', bg: 'rgba(156,116,48,0.12)', ring: 'rgba(156,116,48,0.26)' },
  watch: { label: 'Watch', fg: '#27457E', bg: 'rgba(39,69,126,0.09)', ring: 'rgba(39,69,126,0.20)' },
  normal: { label: 'Context', fg: '#64748B', bg: 'rgba(100,116,139,0.10)', ring: 'rgba(100,116,139,0.22)' },
}

const fmtVal = (v: number | null, unit: string) => (v == null ? 'n/a' : unit === 'x' ? `${v}x` : unit === '%' || unit === 'pp' ? `${v}${unit}` : `${v} ${unit}`)

// The concrete company subject of the insight, in plain English. A single name
// spotlights that insurer; two names read as a pair; a broader set (or an
// explicit `panel` tag) reads as "Across the panel".
function companyLabelOf(ins: Insight): string {
  const cos = ins.affectedInsurers.filter((id) => id !== 'panel')
  if (ins.affectedInsurers.includes('panel') || cos.length >= 3 || cos.length === 0) return 'Across the panel'
  if (cos.length === 2) return `${pretty(cos[0])} & ${pretty(cos[1])}`
  return pretty(cos[0])
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

// The BACK's "visual evidence" for a "X of Y guidance delivered" insight — the
// per-target met/missed breakdown (this card carries no chart otherwise). Real
// and source-backed: reads the same getPromises() the Promise Tracker uses.
const GUIDE_STATUS: Record<PromiseStatus, { label: string; mark: string; fg: string; bg: string; ring: string }> = {
  Delivered:        { label: 'Met',            mark: '✓', fg: '#0E6F6D', bg: 'rgba(14,111,109,0.10)',  ring: 'rgba(14,111,109,0.22)' },
  'On Track':       { label: 'On track',       mark: '→', fg: '#3D5F9F', bg: 'rgba(61,95,159,0.10)',   ring: 'rgba(61,95,159,0.22)' },
  Delayed:          { label: 'Behind',         mark: '!', fg: '#9C7430', bg: 'rgba(156,116,48,0.12)',  ring: 'rgba(156,116,48,0.26)' },
  Missed:           { label: 'Missed',         mark: '✗', fg: '#A8443B', bg: 'rgba(168,68,59,0.10)',   ring: 'rgba(168,68,59,0.22)' },
  'Not Measurable': { label: 'Not measurable', mark: '–', fg: '#64748B', bg: 'rgba(100,116,139,0.10)', ring: 'rgba(100,116,139,0.22)' },
}
const GUIDE_ORDER: PromiseStatus[] = ['Delivered', 'On Track', 'Delayed', 'Missed', 'Not Measurable']

function GuidanceBreakdown({ companyId }: { companyId: string }) {
  const items = getPromises(companyId)
  if (!items.length) return null
  const delivered = items.filter((p) => p.status === 'Delivered').length
  const sorted = [...items].sort((a, b) => GUIDE_ORDER.indexOf(a.status) - GUIDE_ORDER.indexOf(b.status))
  return (
    <div className="flex h-full flex-col">
      <p className="text-[11.5px] leading-snug text-ink-secondary">
        <span className="font-bold text-navy-deep">{delivered} of {items.length}</span> guidance targets delivered — each line is management&apos;s own target vs the latest audited actual.
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {sorted.map((p, i) => {
          const s = GUIDE_STATUS[p.status]
          return (
            <li key={`${p.metric}-${i}`} className="flex items-start gap-2 rounded-lg border bg-card px-2.5 py-1.5" style={{ borderColor: s.ring }}>
              <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold" style={{ color: s.fg, background: s.bg }}>{s.mark}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-navy-deep">{p.metric}</p>
                <p className="text-[10.5px] tabular-nums leading-snug text-ink-secondary">
                  Target {p.target} · now {p.current}{p.actualFy ? ` (${p.actualFy})` : ''}
                </p>
              </div>
              <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: s.fg, background: s.bg }}>{s.label}</span>
            </li>
          )
        })}
      </ul>
      {isLinkable(items[0].sourceUrl) && (
        <p className="mt-2 text-[10px] leading-snug text-ink-secondary">
          Source: <a href={sourceHref(items[0].sourceUrl)!} target="_blank" rel="noreferrer" title={classifySource(items[0].sourceUrl).hint} className="text-navy-primary hover:underline">{items[0].source}</a> · targets are management&apos;s stated guidance; actuals read live from the audited annual disclosures.
        </p>
      )}
    </div>
  )
}

export function InsightCard({
  ins,
  section,
  priority = 'normal',
  source,
  freshness,
  onGoToSource,
  initialFlipped = false,
}: {
  ins: Insight
  /** The section tag shown on the front (e.g. 'Profitability'). */
  section: string
  /** Triage priority — high gets a subtle gold-featured ring. */
  priority?: Priority
  source: SourceLocation
  freshness: Freshness
  onGoToSource: () => void
  initialFlipped?: boolean
}) {
  const cat = CATCH[ins.category]
  const tone = TONE[cat.tone]
  const Icon = cat.Icon
  const high = priority === 'high'
  const companyLabel = companyLabelOf(ins)

  // Single-subject insight → spotlight that company in gold; comparisons stay multi-tone.
  const focal = ins.affectedInsurers.length === 1 ? ins.affectedInsurers[0] : undefined
  // The one number that makes the insight concrete — the proof under the claim
  // (lives on the BACK, never on the clean front).
  const stat = ins.evidence.find((e) => e.value != null) ?? ins.evidence[0]
  const guidanceCo = ins.evidence.find((e) => /guidance delivered/i.test(e.metric))?.insurer ?? null
  const statColor = focal && stat && stat.insurer === focal ? GOLD : tone.fg

  const heroStat = stat
    ? { value: fmtVal(stat.value, stat.unit), period: stat.period, label: `${pretty(stat.insurer)} · ${stat.metric}`, context: stat.context, color: statColor }
    : null
  const visualEvidence = guidanceCo
    ? <div className="rounded-xl border border-soft-border bg-card p-3.5 shadow-soft"><GuidanceBreakdown companyId={guidanceCo} /></div>
    : <InsightChart spec={ins.chart} focal={focal} embedded />

  // ── flip state + variable-height 3D flip ──────────────────────────────────
  // `initialFlipped` is true only when the reader is returning from "Go to source
  // → Back to Insight", so the card reopens on its basis, where they left off.
  const reduced = usePrefersReducedMotion()
  const [flipped, setFlipped] = useState(initialFlipped)
  const articleRef = useRef<HTMLElement>(null)
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const frontFaceRef = useRef<HTMLDivElement>(null)
  const backFaceRef = useRef<HTMLDivElement>(null)
  const backBtnRef = useRef<HTMLButtonElement>(null)
  const [h, setH] = useState<number | undefined>(undefined)
  const didMount = useRef(false)
  const backId = `basis-${ins.id}`
  const labelId = `basis-label-${ins.id}`

  // Measure both faces and size the card to whichever is showing (auto-grow, never clip).
  useLayoutEffect(() => {
    const measure = () => setH((flipped ? backRef.current?.offsetHeight : frontRef.current?.offsetHeight) || undefined)
    measure()
    const ro = new ResizeObserver(measure)
    if (frontRef.current) ro.observe(frontRef.current)
    if (backRef.current) ro.observe(backRef.current)
    return () => ro.disconnect()
  }, [flipped])

  // Move focus to the newly-revealed face; keep inert/aria-hidden on the hidden one.
  useEffect(() => {
    if (frontFaceRef.current) frontFaceRef.current.inert = flipped
    if (backFaceRef.current) backFaceRef.current.inert = !flipped
    if (!didMount.current) { didMount.current = true; return }
    if (flipped) backBtnRef.current?.focus()
    else frontFaceRef.current?.focus()
  }, [flipped])

  // On return from "Go to source", scroll this (re-flipped) card back into view.
  useEffect(() => {
    if (initialFlipped) articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const innerStyle: React.CSSProperties = reduced
    ? { transform: 'none' }
    : { transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transition: 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)' }
  const frontFaceStyle: React.CSSProperties = reduced
    ? { opacity: flipped ? 0 : 1, transition: 'opacity 0.22s ease', pointerEvents: flipped ? 'none' : undefined, zIndex: flipped ? 0 : 1 }
    : { zIndex: flipped ? 0 : 1 }
  const backFaceStyle: React.CSSProperties = reduced
    ? { position: 'absolute', inset: 0, transform: 'none', opacity: flipped ? 1 : 0, transition: 'opacity 0.22s ease', pointerEvents: flipped ? undefined : 'none', zIndex: flipped ? 1 : 0 }
    : { position: 'absolute', inset: 0, transform: 'rotateY(180deg)' }

  // Whole-card flip. Guard: a drag-to-select (or a click on a real link) must not
  // flip — interactive children stopPropagation; here we also skip mid-selection.
  const flipTo = (next: boolean) => {
    if (typeof window !== 'undefined' && window.getSelection?.()?.toString()) return
    setFlipped(next)
  }

  return (
    <article
      ref={articleRef}
      className={[
        'group relative animate-fade-in overflow-hidden rounded-2xl border bg-card transition-shadow duration-300',
        // A flipped card opens to the full grid width, so the detailed back reads
        // in its intended two-column study layout instead of a cramped half-column.
        flipped ? 'lg:col-span-2' : 'hover:-translate-y-px',
        high
          ? 'border-[#E4CE93] shadow-[0_2px_8px_rgba(23,43,77,0.05),0_18px_44px_rgba(23,43,77,0.11)] hover:shadow-[0_4px_12px_rgba(23,43,77,0.06),0_22px_52px_rgba(23,43,77,0.13),0_0_0_1px_rgba(228,206,147,0.7)]'
          : 'border-soft-border shadow-card hover:shadow-[0_16px_40px_rgba(23,43,77,0.12),0_0_0_1px_rgba(228,206,147,0.45)]',
      ].join(' ')}
    >
      {/* Category accent strip on the left edge — instant, colour-coded character. */}
      <span aria-hidden className="absolute inset-y-0 left-0 z-[2] w-[3.5px]" style={{ background: high ? `linear-gradient(180deg, ${tone.fg}, ${GOLD})` : tone.fg }} />

      <div className="flip-3d" style={{ height: h }}>
        <div className="flip-inner" style={innerStyle}>
          {/* ───────────────────── FRONT — the clean, catchy read ───────────── */}
          <div
            ref={frontFaceRef}
            role="button"
            tabIndex={flipped ? -1 : 0}
            aria-expanded={flipped}
            aria-controls={backId}
            onClick={() => flipTo(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipTo(true) } }}
            title="Click to view the basis — how it was worked out, the formula & the source"
            className="flip-face relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-champagne/60"
            style={frontFaceStyle}
          >
           <div ref={frontRef} className="relative flex flex-col px-6 py-5">
            {/* Ultra-faint category wash — a tinted overlay, never a flat fill. */}
            <span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(100deg, ${tone.wash} 0%, transparent 55%)` }} />
            {/* faint category-icon watermark — quiet premium character. */}
            <Icon aria-hidden className="pointer-events-none absolute -right-2 -top-3 h-24 w-24 opacity-[0.05]" style={{ color: tone.fg }} strokeWidth={1.1} />

            {/* top row — section + priority tags (left) · period tag (right) */}
            <div className="relative flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: tone.fg, background: tone.bg, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}>
                <Icon className="h-3.5 w-3.5" strokeWidth={2.4} /> {section}
              </span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.07em]" style={{ color: PRIORITY_TAG[priority].fg, background: PRIORITY_TAG[priority].bg, boxShadow: `inset 0 0 0 1px ${PRIORITY_TAG[priority].ring}` }}>
                {PRIORITY_TAG[priority].label}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-ice px-2 py-0.5 text-[10px] font-semibold text-ink-secondary ring-1 ring-soft-border" title={freshness.detail}>
                <CalendarClock className="h-3 w-3" strokeWidth={2.2} />
                {freshness.period}
              </span>
            </div>

            {/* headline — the one sharp, catchy line */}
            <h3 className="relative mt-3 font-editorial text-[22px] font-bold leading-[1.16] tracking-[-0.01em] text-navy-deep lg:text-[23px]">{ins.shortHeadline}</h3>

            {/* 1–2 line plain-English read — no numbers, no jargon */}
            <p className="relative mt-2 line-clamp-3 font-editorial text-[14px] leading-relaxed text-ink-primary">{ins.whatConsensusMisses}</p>

            {/* footer — company (left) · flip affordance (right). Sits right under
                the read so a full-width card stays compact, never a tall void. */}
            <div className="relative mt-4 flex items-center gap-2 border-t border-soft-border pt-3">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-navy-deep">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.fg }} />
                {companyLabel}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-secondary transition-colors group-hover:text-navy-primary">
                <RotateCw className="h-3 w-3 transition-transform group-hover:rotate-90" strokeWidth={2.4} style={{ color: tone.fg }} />
                Click to view basis
              </span>
            </div>
           </div>
          </div>

          {/* ─────────────── BACK — click anywhere to flip back; interactive
               controls inside stop propagation, so accordions/links still work ── */}
          <div ref={backFaceRef} onClick={() => flipTo(false)} className="flip-face cursor-pointer overflow-hidden rounded-2xl bg-card" style={backFaceStyle} id={backId}>
            <div ref={backRef}>
              <MethodologyPanel ins={ins} tone={tone} source={source} freshness={freshness} onGoToSource={onGoToSource} onBack={() => setFlipped(false)} backRef={backBtnRef} labelId={labelId} heroStat={heroStat} visual={visualEvidence} />
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
