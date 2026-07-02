// ConvictionPages — the in-place "insight booklet" that a Highest-Conviction idea
// expands into. Three pages, all inside the same card (no modal, no floating
// widget, never leaves Pulse):
//   1 · The Story   — "What changed?"   a sharp, plain-language narrative.
//   2 · Impact      — "Why should I care?"  short labelled rows.
//   3 · Sources     — "Where to verify"  evidence, type chips + jump actions.
//
// Pages slide horizontally (calm, click-based — no 3D flip) and the panel height
// eases to the active page, so it reads like turning pages of an analyst note.
// All content is source-derived (see ./derive); nothing is fabricated.

import { useLayoutEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
  History,
  TrendingUp,
  Radar,
  Zap,
  ArrowUpRight,
  ExternalLink,
  BookOpen,
  FileText,
  LineChart,
  Newspaper,
  UserCog,
  Landmark,
  type LucideIcon,
} from 'lucide-react'
import type { NavTarget } from '@/insights/sourceMap'
import type { SignalCategory } from '@/insights/investorPulse'
import { dashboardTargetFor, type ConvictionIdea, type EvidenceKind } from './derive'
import { GOLD } from './parts'

const PAGES = ['Story', 'Impact', 'Sources'] as const

// ── shared page pieces ────────────────────────────────────────────────────────

function PageTitle({ icon: Icon, kicker, title }: { icon: LucideIcon; kicker: string; title: string }) {
  return (
    <div className="mb-1.5">
      <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>
        <Icon className="h-2.5 w-2.5" strokeWidth={2.4} /> {kicker}
      </span>
      <h4 className="font-display text-[15px] font-semibold leading-tight text-navy-deep">{title}</h4>
    </div>
  )
}

function LabelRow({ icon: Icon, label, text }: { icon: LucideIcon; label: string; text: string }) {
  return (
    <div className="flex gap-1.5">
      <span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-[5px]" style={{ background: 'rgba(39,69,126,0.06)' }}>
        <Icon className="h-2.5 w-2.5 text-navy-primary" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-ink-secondary">{label}</span>
        <p className="text-[11px] leading-snug text-ink-primary">{text}</p>
      </div>
    </div>
  )
}

// ── page 1 · the story ────────────────────────────────────────────────────────

/** A short, de-duplicated narrative built from the idea's own reasoning. */
function storyOf(idea: ConvictionIdea): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [idea.why.whatHappened, ...idea.reasoning, idea.why.whyItMatters]) {
    const t = (raw || '').trim()
    const key = t.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (t && key && !seen.has(key)) {
      seen.add(key)
      out.push(t)
    }
    if (out.length >= 3) break
  }
  return out
}

function StoryPage({ idea }: { idea: ConvictionIdea }) {
  const lines = storyOf(idea)
  return (
    <div>
      <PageTitle icon={Zap} kicker="The story" title="What changed?" />
      <div className="space-y-1.5">
        {lines.map((l, i) => (
          <p key={i} className={`font-editorial leading-relaxed text-ink-primary ${i === 0 ? 'text-[13px] text-navy-deep' : 'text-[12.5px] text-ink-secondary'}`}>{l}</p>
        ))}
      </div>
    </div>
  )
}

// ── page 2 · why it matters ───────────────────────────────────────────────────

function ImpactPage({ idea }: { idea: ConvictionIdea }) {
  const w = idea.why
  return (
    <div>
      <PageTitle icon={ShieldCheck} kicker="Impact" title="Why should I care?" />
      <div className="space-y-1.5">
        <LabelRow icon={ShieldCheck} label="Why it matters" text={w.whyItMatters} />
        <LabelRow icon={Users} label="Who is affected" text={w.whoAffected} />
        {w.historicalContext && <LabelRow icon={History} label="Historical context" text={w.historicalContext} />}
        {w.potentialImpact && <LabelRow icon={TrendingUp} label="Potential impact" text={w.potentialImpact} />}
        <LabelRow icon={Radar} label="What to watch next" text={idea.whatToWatch} />
      </div>
    </div>
  )
}

// ── page 3 · sources & next step ──────────────────────────────────────────────

const CHIP_STYLE: Record<string, { icon: LucideIcon; fg: string; bg: string }> = {
  Filing: { icon: FileText, fg: '#27457E', bg: 'rgba(39,69,126,0.08)' },
  'Market Data': { icon: LineChart, fg: '#0E6F6D', bg: 'rgba(14,111,109,0.09)' },
  News: { icon: Newspaper, fg: '#3D5F9F', bg: 'rgba(61,95,159,0.09)' },
  'Management Update': { icon: UserCog, fg: '#9C7430', bg: 'rgba(182,139,58,0.11)' },
  Regulatory: { icon: Landmark, fg: '#C2703D', bg: 'rgba(194,112,61,0.11)' },
}
const KIND_CHIP: Record<EvidenceKind, string> = {
  Filing: 'Filing',
  News: 'News',
  Interview: 'Management Update',
  'Market data': 'Market Data',
  Regulatory: 'Regulatory',
  'Analyst report': 'News',
}
const CAT_CHIP: Record<SignalCategory, string> = {
  'Analyst Action': 'News',
  'Sector Catalyst': 'News',
  Regulatory: 'Regulatory',
  Management: 'Management Update',
  Filing: 'Filing',
  'Data Movement': 'Market Data',
}
function chipTypes(idea: ConvictionIdea): string[] {
  const set = new Set<string>([CAT_CHIP[idea.category]])
  idea.sources.forEach((s) => set.add(KIND_CHIP[s.kind] ?? 'News'))
  return [...set].filter(Boolean).slice(0, 5)
}

function TypeChip({ label }: { label: string }) {
  const s = CHIP_STYLE[label] ?? CHIP_STYLE.News
  const Icon = s.icon
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ color: s.fg, background: s.bg }}>
      <Icon className="h-2.5 w-2.5" strokeWidth={2.2} /> {label}
    </span>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="leading-none">
      <div className="text-[16px] font-bold text-navy-deep">{value}</div>
      <div className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">{label}</div>
    </div>
  )
}

function ActionBtn({ icon: Icon, label, onClick, href, primary }: { icon: LucideIcon; label: string; onClick?: () => void; href?: string; primary?: boolean }) {
  const cls = primary
    ? 'text-white'
    : 'border border-soft-border bg-white text-navy-deep hover:border-champagne hover:bg-champagne-soft/40'
  const style = primary
    ? { background: 'linear-gradient(135deg, #1E4079 0%, #14294C 100%)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.4)' }
    : undefined
  const inner = (
    <>
      <Icon className="h-3 w-3" strokeWidth={2.2} style={{ color: primary ? '#E4C67C' : GOLD }} /> {label}
    </>
  )
  const base = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9.5px] font-semibold shadow-soft transition-colors'
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${base} ${cls}`} style={style}>{inner}</a>
  ) : (
    <button type="button" onClick={onClick} className={`${base} ${cls}`} style={style}>{inner}</button>
  )
}

function SourcesPage({ idea, companyId, onNavigate }: { idea: ConvictionIdea; companyId: string; onNavigate?: (t: NavTarget, id: string) => void }) {
  const chips = chipTypes(idea)
  const dash = dashboardTargetFor(idea, companyId)
  const primary = idea.sources.find((s) => s.url)?.url
  const full = idea.sources.find((s) => (s.kind === 'Filing' || s.kind === 'Analyst report') && s.url && s.url !== primary)?.url
  return (
    <div>
      <PageTitle icon={Landmark} kicker="Sources" title="Where to verify" />
      <div className="flex items-center gap-4 rounded-lg border border-soft-border bg-white/70 px-3 py-1.5">
        <Stat value={String(idea.evidenceCount)} label={idea.evidenceCount === 1 ? 'source' : 'sources'} />
        <span className="h-6 w-px bg-soft-border" />
        <Stat value={`${idea.confidencePct}%`} label="confidence" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {chips.map((c) => (
          <TypeChip key={c} label={c} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <ActionBtn icon={ArrowUpRight} label="View in dashboard" onClick={() => onNavigate?.(dash, `pulse-idea-${idea.id}`)} primary />
        {primary && <ActionBtn icon={ExternalLink} label="Go to source" href={primary} />}
        {full && <ActionBtn icon={BookOpen} label="Read full analysis" href={full} />}
      </div>
    </div>
  )
}

// ── the booklet · slide track + navigation ────────────────────────────────────

function NavArrow({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous page' : 'Next page'}
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-soft-border bg-white text-navy-primary shadow-soft transition-colors enabled:hover:border-champagne enabled:hover:text-champagne-deep disabled:opacity-30"
    >
      <Icon className="h-3 w-3" strokeWidth={2.4} />
    </button>
  )
}

export function ConvictionPages({
  idea,
  companyId,
  page,
  onPage,
  onNavigate,
}: {
  idea: ConvictionIdea
  companyId: string
  page: number
  onPage: (p: number) => void
  onNavigate?: (t: NavTarget, id: string) => void
}) {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const [h, setH] = useState<number | undefined>(undefined)

  // Ease the panel height to the active page (measured pre-paint, so no flash).
  useLayoutEffect(() => {
    const el = refs.current[page]
    if (el) setH(el.offsetHeight)
  }, [page, idea])

  const go = (d: number) => onPage(Math.max(0, Math.min(PAGES.length - 1, page + d)))
  const bodies = [
    <StoryPage idea={idea} />,
    <ImpactPage idea={idea} />,
    <SourcesPage idea={idea} companyId={companyId} onNavigate={onNavigate} />,
  ]

  return (
    <div
      className="relative border-t border-soft-border/70"
      style={{ background: 'linear-gradient(180deg, #F8FBFF 0%, #EEF3FB 100%)', boxShadow: 'inset 0 7px 10px -9px rgba(23,43,77,0.28)' }}
    >
      {/* stacked-page edge — two hairlines suggesting sheets beneath */}
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px" style={{ background: 'rgba(228,198,124,0.5)' }} />

      {/* tab bar: prev · Story | Impact | Sources · next */}
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <NavArrow dir="prev" disabled={page === 0} onClick={() => go(-1)} />
        <div className="flex flex-1 items-center justify-center gap-1">
          {PAGES.map((p, i) => {
            const on = i === page
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPage(i)}
                className={`rounded-full px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.06em] transition-colors ${on ? 'text-white' : 'text-ink-secondary hover:bg-white'}`}
                style={on ? { background: 'linear-gradient(135deg, #1E4079 0%, #14294C 100%)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.4)' } : undefined}
              >
                {p}
              </button>
            )
          })}
        </div>
        <NavArrow dir="next" disabled={page === PAGES.length - 1} onClick={() => go(1)} />
      </div>

      {/* sliding page track — height eases to the active page */}
      <div className="overflow-hidden px-3 pb-1.5 pt-2 transition-[height] duration-300 ease-premium" style={{ height: h }}>
        <div className="flex items-start transition-transform duration-300 ease-premium" style={{ transform: `translateX(-${page * 100}%)` }}>
          {bodies.map((node, i) => (
            <div
              key={i}
              ref={(el) => {
                refs.current[i] = el
              }}
              className="w-full shrink-0 self-start pr-0.5"
              aria-hidden={i !== page}
            >
              {node}
            </div>
          ))}
        </div>
      </div>

      {/* page dots */}
      <div className="flex items-center justify-center gap-1 pb-2.5">
        {PAGES.map((p, i) => (
          <button
            key={p}
            type="button"
            aria-label={`Go to ${p}`}
            onClick={() => onPage(i)}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: i === page ? 14 : 6, background: i === page ? GOLD : 'rgba(39,69,126,0.22)' }}
          />
        ))}
      </div>
    </div>
  )
}
