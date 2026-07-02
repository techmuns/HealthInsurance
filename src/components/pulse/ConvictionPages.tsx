// ConvictionPages — the "insight note" a Highest-Conviction idea opens into: a
// fixed-size booklet page you TURN, not a set of tabs. Three pages inside one
// block whose size never changes:
//   1 · Story    — "What changed?"      a sharp narrative + why it's interesting.
//   2 · Impact   — "Why should I care?"  short labelled bullets.
//   3 · Sources  — "Where to verify"     confidence, types + jump actions.
//
// Navigation is a folded page-corner (bottom hint via dots + subtle side arrows),
// never tab buttons. Pages slide over like turning a sheet; the block keeps a
// fixed height and each page scrolls internally if it runs long. Calm motion,
// reduced-motion respected. All content is source-derived (see ./derive).

import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Users,
  Radar,
  Zap,
  TrendingUp,
  ArrowUpRight,
  ExternalLink,
  BookOpen,
  FileText,
  LineChart,
  Newspaper,
  UserCog,
  Landmark,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { NavTarget } from '@/insights/sourceMap'
import type { SignalCategory } from '@/insights/investorPulse'
import { dashboardTargetFor, type ConvictionIdea, type EvidenceKind } from './derive'
import { GOLD, GOLD_ON_NAVY } from './parts'

const PAGES = ['Story', 'Impact', 'Sources'] as const

const tierOf = (pct: number): 'High' | 'Medium' | 'Low' => (pct >= 82 ? 'High' : pct >= 66 ? 'Medium' : 'Low')
const TIER_COLOR: Record<string, string> = { High: '#0E6F6D', Medium: '#9C7430', Low: '#8C7A55' }
// Same tiers, brightened to read on the navy header.
const TIER_ON_NAVY: Record<string, string> = { High: '#4FD1C5', Medium: '#E9C46C', Low: '#C4B487' }

// ── shared page pieces ────────────────────────────────────────────────────────

function PageTitle({ icon: Icon, kicker, title }: { icon: LucideIcon; kicker: string; title: string }) {
  return (
    <div className="mb-2">
      <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>
        <Icon className="h-2.5 w-2.5" strokeWidth={2.4} /> {kicker}
      </span>
      <h4 className="font-display text-[15.5px] font-semibold leading-tight text-navy-deep">{title}</h4>
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

/** A short, de-duplicated narrative + a "why interesting" hook, from the idea's
 *  own reasoning. Concise by design — the full detail lives on the Sources page. */
function storyOf(idea: ConvictionIdea): { narrative: string[]; hook: string } {
  const seen = new Set<string>()
  const uniq: string[] = []
  for (const raw of [idea.why.whatHappened, ...idea.reasoning, idea.why.whyItMatters]) {
    const t = (raw || '').trim()
    const key = t.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (t && key && !seen.has(key)) {
      seen.add(key)
      uniq.push(t)
    }
  }
  return { narrative: uniq.slice(0, 2), hook: uniq[2] ?? idea.whatToWatch }
}

function StoryPage({ idea }: { idea: ConvictionIdea }) {
  const { narrative, hook } = storyOf(idea)
  return (
    <div>
      <PageTitle icon={Zap} kicker="The story" title="What changed?" />
      <div className="space-y-1.5">
        {narrative.map((l, i) => (
          <p key={i} className={`font-editorial leading-relaxed ${i === 0 ? 'text-[13.5px] text-navy-deep' : 'text-[12.5px] text-ink-secondary'}`}>{l}</p>
        ))}
      </div>
      {hook && (
        <div className="mt-2.5 rounded-lg px-3 py-2" style={{ background: 'rgba(228,198,124,0.10)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.22)' }}>
          <p className="text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: '#9C7430' }}>Why it&rsquo;s interesting today</p>
          <p className="mt-0.5 font-editorial text-[12.5px] leading-relaxed text-navy-deep">{hook}</p>
        </div>
      )}
    </div>
  )
}

// ── page 2 · why it matters ───────────────────────────────────────────────────

function ImpactPage({ idea }: { idea: ConvictionIdea }) {
  const w = idea.why
  const couldChange = w.potentialImpact ?? w.historicalContext
  return (
    <div>
      <PageTitle icon={ShieldCheck} kicker="Impact" title="Why should I care?" />
      <div className="space-y-2">
        <LabelRow icon={ShieldCheck} label="Why it matters" text={w.whyItMatters} />
        <LabelRow icon={Users} label="Who is affected" text={w.whoAffected} />
        {couldChange && <LabelRow icon={TrendingUp} label="What could change" text={couldChange} />}
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
  const tier = tierOf(idea.confidencePct)
  return (
    <div>
      <PageTitle icon={Landmark} kicker="Sources" title="Where to verify" />
      <div className="flex items-center gap-3 rounded-lg border border-soft-border bg-white/70 px-3 py-1.5">
        <div className="leading-none">
          <div className="text-[16px] font-bold text-navy-deep">{idea.evidenceCount}</div>
          <div className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">{idea.evidenceCount === 1 ? 'source' : 'sources'}</div>
        </div>
        <span className="h-6 w-px bg-soft-border" />
        <div className="leading-none">
          <div className="text-[14px] font-bold" style={{ color: TIER_COLOR[tier] }}>{tier}</div>
          <div className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">source confidence</div>
        </div>
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

// ── the page-turn corner (folded page, not a tab) ─────────────────────────────

function PageCorner({ page, onTurn }: { page: number; onTurn: () => void }) {
  const last = page === PAGES.length - 1
  const nextName = last ? 'Story' : PAGES[page + 1]
  const label = last ? 'Back to Story' : `${nextName} →`
  return (
    <button
      type="button"
      onClick={onTurn}
      aria-label={`Turn to ${nextName}`}
      title={last ? 'Back to Story' : `Turn to ${nextName}`}
      className="group absolute right-0 top-0 z-20 h-14 w-28"
    >
      {/* the folded corner — a gold sheet peeled back, lifting a touch on hover */}
      <span
        aria-hidden
        className="absolute right-0 top-0 transition-transform duration-300 ease-premium group-hover:scale-110 motion-reduce:transition-none"
        style={{
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderWidth: '0 38px 38px 0',
          borderColor: `transparent ${GOLD} transparent transparent`,
          filter: 'drop-shadow(-2px 2px 2px rgba(23,43,77,0.20))',
        }}
      />
      {/* curl highlight on the fold */}
      <span aria-hidden className="absolute right-[3px] top-[3px] h-2.5 w-2.5 rounded-bl-[10px]" style={{ background: 'rgba(255,255,255,0.42)' }} />
      {/* the next-page hint, under the fold */}
      <span className="pointer-events-none absolute bottom-1 right-1.5 whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.08em] text-champagne-deep transition-colors group-hover:text-navy-deep">
        {label}
      </span>
    </button>
  )
}

function FootArrow({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous page' : 'Next page'}
      className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-ink-secondary/60 transition-colors enabled:hover:text-champagne-deep disabled:opacity-25"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
    </button>
  )
}

// ── the fixed-size note body: turning pages, orientation footer ───────────────

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
  const go = (d: number) => onPage(Math.max(0, Math.min(PAGES.length - 1, page + d)))
  const bodies = [
    <StoryPage idea={idea} />,
    <ImpactPage idea={idea} />,
    <SourcesPage idea={idea} companyId={companyId} onNavigate={onNavigate} />,
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ background: '#FCFBF7' }}>
      {/* page body — FIXED height (fills the note), pages slide across, each page
          scrolls internally if it runs long so the block never resizes. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-[320ms] ease-premium motion-reduce:transition-none"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {bodies.map((node, i) => (
            <div key={i} className="scroll-thin h-full w-full shrink-0 overflow-y-auto px-4 py-3.5" aria-hidden={i !== page}>
              {node}
            </div>
          ))}
        </div>

        {/* a soft "spine" shadow on the right edge for paper depth */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-5" style={{ background: 'linear-gradient(90deg, transparent, rgba(23,43,77,0.05))' }} />

        {/* the folded page-corner control */}
        <PageCorner page={page} onTurn={() => onPage((page + 1) % PAGES.length)} />
      </div>

      {/* orientation footer — dots + current label + subtle arrows (NOT tabs) */}
      <div className="flex items-center justify-center gap-2.5 border-t border-soft-border/70 px-3 py-1.5">
        <FootArrow dir="prev" disabled={page === 0} onClick={() => go(-1)} />
        <div className="flex items-center gap-1">
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
        <span className="min-w-[46px] text-[8.5px] font-bold uppercase tracking-[0.1em] text-champagne-deep">{PAGES[page]}</span>
        <FootArrow dir="next" disabled={page === PAGES.length - 1} onClick={() => go(1)} />
      </div>
    </div>
  )
}

// ── the overlay note · header + pages, floating above the conviction list ──────

const CAT_LABEL: Record<SignalCategory, string> = {
  'Analyst Action': 'Analyst view',
  'Sector Catalyst': 'Sector signal',
  Regulatory: 'Regulatory',
  Management: 'Management',
  Filing: 'Filing',
  'Data Movement': 'Market move',
}

function NoteHeader({ idea, onClose }: { idea: ConvictionIdea; onClose: () => void }) {
  const tier = tierOf(idea.confidencePct)
  return (
    <div className="relative flex items-start gap-2.5 px-3.5 py-2.5" style={{ background: 'linear-gradient(135deg, #1E4079 0%, #14294C 100%)' }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(228,198,124,0.5) 30%, rgba(228,198,124,0.5) 70%, transparent)' }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate font-display text-[14.5px] font-semibold leading-tight text-white">{idea.entity}</span>
          {idea.isBreaking && (
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[7.5px] font-bold uppercase tracking-wide text-white" style={{ background: 'rgba(192,88,79,0.38)' }}>
              <span className="pulse-live h-1 w-1 rounded-full" style={{ background: '#F0A199' }} /> Live
            </span>
          )}
          <span className="text-[8px] font-bold uppercase tracking-[0.14em]" style={{ color: GOLD_ON_NAVY }}>
            {CAT_LABEL[idea.category]}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[9.5px] font-semibold text-white/60">
          <span style={{ color: TIER_ON_NAVY[tier] }}>{tier} confidence</span>
          <span className="h-2 w-px bg-white/25" />
          <span>
            {idea.evidenceCount} source{idea.evidenceCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close note"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.4} />
      </button>
    </div>
  )
}

/** One conviction idea as a contained, FIXED-SIZE "insight note" overlay — a
 *  dimmed/blurred backdrop over the conviction list, the paged note floating
 *  above. Only ever one open at a time (the caller holds a single open id). */
export function ConvictionOverlay({
  idea,
  companyId,
  page,
  onPage,
  onClose,
  onNavigate,
}: {
  idea: ConvictionIdea
  companyId: string
  page: number
  onPage: (p: number) => void
  onClose: () => void
  onNavigate?: (t: NavTarget, id: string) => void
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-1.5 sm:p-2">
      {/* backdrop — softly dims + blurs the cards; click to close */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Dismiss note"
        onClick={onClose}
        className="absolute inset-0 cursor-default animate-fade-in backdrop-blur-[2px]"
        style={{ background: 'rgba(16,31,61,0.14)' }}
      />
      {/* the note — fixed width + height; never resizes between pages */}
      <div
        className="relative z-[1] flex h-[420px] max-h-full w-full max-w-[380px] flex-col overflow-hidden rounded-xl border bg-white animate-note-in"
        style={{ borderColor: 'rgba(228,206,147,0.75)', boxShadow: '0 24px 60px -18px rgba(16,33,64,0.55)' }}
        role="dialog"
        aria-label={`${idea.entity} — insight note`}
      >
        <NoteHeader idea={idea} onClose={onClose} />
        <ConvictionPages idea={idea} companyId={companyId} page={page} onPage={onPage} onNavigate={onNavigate} />
      </div>
    </div>
  )
}
