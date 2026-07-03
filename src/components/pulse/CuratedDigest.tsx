// Curated — the Pulse's premium daily intelligence digest.
//
// A tight, editor-picked read meant to carry the value of a paid news desk: the
// day's single highest-value movement (the LEAD), a connective "so what", then the
// few other moves that matter — each tiered by what it means for the reader,
// reasoned and source-linked, with the full note one tap away.
//
// Honesty (see CLAUDE.md): curation RANKS and FRAMES the already-scored, source-
// backed conviction ideas (see ./derive) — it never invents a movement. When
// nothing meets the bar it shows a clean, honest empty state, never filler. The
// footer keeps it plain: AI-curated, source-linked, verify before acting.

import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw, Clock3, BookOpen, Eye, Globe, ShieldCheck, type LucideIcon } from 'lucide-react'
import type { InvestorPulse } from '@/insights/investorPulse'
import type { NavTarget } from '@/insights/sourceMap'
import {
  STATUS_COLOR,
  CURATED_TIER_META,
  type CuratedView,
  type CuratedEntry,
  type CuratedTier,
  type ConvictionIdea,
} from './derive'
import { GOLD, GOLD_ON_NAVY, CATEGORY_ICON, SourceChip } from './parts'
import { ConvictionOverlay } from './ConvictionPages'
import { SS, readSS, writeSS, clearSS } from './pulseState'

// Colour as signal (never decoration): regulatory = orange (caution), otherwise
// the status colour — green constructive / gold watch / red risk / slate neutral.
const ORANGE = '#C2703D'
function accentFor(idea: ConvictionIdea): string {
  return idea.category === 'Regulatory' ? ORANGE : STATUS_COLOR[idea.status].dot
}

const TIER_STYLE: Record<CuratedTier, { fg: string; bg: string; ring: string }> = {
  lead: { fg: '#9C7430', bg: 'rgba(182,139,58,0.14)', ring: 'rgba(182,139,58,0.34)' },
  position: { fg: '#2F855A', bg: 'rgba(47,133,90,0.10)', ring: 'rgba(47,133,90,0.24)' },
  watch: { fg: '#9C7430', bg: 'rgba(182,139,58,0.10)', ring: 'rgba(182,139,58,0.24)' },
  context: { fg: '#5B6573', bg: 'rgba(91,101,115,0.08)', ring: 'rgba(91,101,115,0.20)' },
}

function TierBadge({ tier }: { tier: CuratedTier }) {
  const s = TIER_STYLE[tier]
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-[0.06em]"
      style={{ color: s.fg, background: s.bg, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
      title={CURATED_TIER_META[tier].blurb}
    >
      {CURATED_TIER_META[tier].label}
    </span>
  )
}

// ── Masthead — a navy ribbon that reads like a research-desk header ────────────

function Masthead({ company, dateLabel, isToday, digest }: { company: string; dateLabel: string; isToday: boolean; digest: CuratedView }) {
  const CONF: Record<string, string> = { High: '#4FD1C5', Medium: '#E9C46C', Low: '#C4B487' }
  return (
    <div className="relative isolate overflow-hidden px-4 py-3" style={{ background: 'linear-gradient(160deg, #1C3A6E 0%, #15294C 60%, #102140 100%)' }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(228,198,124,0.5) 28%, rgba(228,198,124,0.5) 72%, transparent)' }} />
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(circle at 94% 120%, rgba(214,178,98,0.22) 0%, transparent 48%)' }} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD_ON_NAVY, background: 'rgba(228,198,124,0.10)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.26)' }}>
            <Sparkles className="h-2.5 w-2.5" strokeWidth={2.2} /> Curated Intelligence
          </span>
          <span className="text-[11px] font-semibold text-white/60">
            {company} · {isToday ? `Today · ${dateLabel}` : dateLabel}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: CONF[digest.confidenceTier] }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: CONF[digest.confidenceTier] }} />
            {digest.confidenceTier} confidence
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-white/45">
            <RefreshCw className="h-2.5 w-2.5" strokeWidth={2} style={{ color: 'rgba(228,198,124,0.8)' }} /> {digest.updatedLabel}
          </span>
        </div>
      </div>

      {/* the connective read — the editorial "so what" for the whole day */}
      {digest.synthesis && (
        <p className="mt-2 max-w-3xl font-editorial text-[13.5px] leading-relaxed text-white/90">{digest.synthesis}</p>
      )}
    </div>
  )
}

// ── The lead — the single most valuable movement, given room to breathe ────────

function LeadCard({ idea, onOpen }: { idea: ConvictionIdea; onOpen: () => void }) {
  const accent = accentFor(idea)
  const CatIcon: LucideIcon = CATEGORY_ICON[idea.category]
  const src = idea.sources[0]
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="group relative block w-full overflow-hidden rounded-xl border border-soft-border bg-white px-4 py-3.5 text-left shadow-soft transition-all hover:border-champagne/70 hover:shadow-card"
    >
      {/* left accent bar — the signal colour of the lead */}
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} />

      <div className="flex flex-wrap items-center gap-1.5 pl-1">
        <span className="grid h-5 w-5 place-items-center rounded-md" style={{ background: `${accent}14`, boxShadow: `inset 0 0 0 1px ${accent}33` }}>
          <CatIcon className="h-3 w-3" strokeWidth={2.1} style={{ color: accent }} />
        </span>
        <TierBadge tier="lead" />
        <span className="text-[9.5px] font-bold uppercase tracking-[0.08em]" style={{ color: accent }}>
          {idea.category === 'Regulatory' ? 'Regulatory' : idea.status}
        </span>
        {idea.isBreaking && (
          <span className="inline-flex items-center gap-1 rounded-full px-1 text-[7.5px] font-bold uppercase tracking-wide text-coral" style={{ background: 'rgba(192,88,79,0.10)' }}>
            <span className="pulse-live h-1 w-1 rounded-full" style={{ background: '#C0584F' }} /> Live
          </span>
        )}
        <span className="ml-auto truncate text-[10.5px] font-bold text-navy-deep">{idea.entity}</span>
      </div>

      <h3 className="mt-2 pl-1 font-display text-[16.5px] font-semibold leading-snug text-navy-deep">{idea.why.whatHappened}</h3>

      <p className="mt-1.5 pl-1 font-editorial text-[13px] leading-relaxed text-ink-secondary">{idea.why.whyItMatters}</p>

      {idea.whatToWatch && (
        <p className="mt-2 flex items-start gap-1.5 pl-1 text-[12px] leading-snug text-ink-secondary">
          <Eye className="mt-[3px] h-3 w-3 shrink-0" strokeWidth={2.1} style={{ color: GOLD }} />
          <span><span className="font-bold uppercase tracking-[0.08em] text-[8.5px] text-champagne-deep">Watch&nbsp;·&nbsp;</span>{idea.whatToWatch}</span>
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-2 pl-1">
        {src && <SourceChip kind={src.kind} name={src.name} url={src.url} />}
        <span className="text-[9px] font-semibold text-ink-secondary/70">{idea.evidenceCount} source{idea.evidenceCount === 1 ? '' : 's'}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] text-champagne-deep">
          Open full note <BookOpen className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
        </span>
      </div>
    </button>
  )
}

// ── Supporting movements — compact, ranked, each tiered by value ───────────────

function EntryCard({ entry, active, onOpen }: { entry: CuratedEntry; active: boolean; onOpen: () => void }) {
  const { idea, tier } = entry
  const accent = accentFor(idea)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={`group flex w-full items-start gap-2 rounded-lg border bg-white px-2.5 py-2 text-left shadow-soft transition-all ${active ? 'border-champagne shadow-card' : 'border-soft-border hover:border-champagne/60 hover:shadow-card'} ${idea.isNew ? 'glow-new' : ''}`}
    >
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: accent, boxShadow: `0 0 0 3px ${accent}1f` }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-bold text-navy-deep">{idea.entity}</span>
          <TierBadge tier={tier} />
          {idea.isBreaking && (
            <span className="inline-flex items-center gap-1 rounded-full px-1 text-[7.5px] font-bold uppercase tracking-wide text-coral" style={{ background: 'rgba(192,88,79,0.10)' }}>
              <span className="pulse-live h-1 w-1 rounded-full" style={{ background: '#C0584F' }} /> Live
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12px] font-semibold leading-snug text-navy-deep/90">{idea.why.whatHappened}</p>
        <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-ink-secondary">{idea.reasoning[0]}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[9px] font-semibold text-ink-secondary">
          <span>{idea.evidenceCount} source{idea.evidenceCount === 1 ? '' : 's'}</span>
          <span className="ml-auto inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-[0.08em] text-champagne-deep">
            Open note <BookOpen className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
          </span>
        </div>
      </div>
    </button>
  )
}

function SectionHead({ icon: Icon, label, note }: { icon: LucideIcon; label: string; note?: string }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} style={{ color: GOLD }} />
      <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-navy-deep">{label}</span>
      <span className="gold-rule h-px flex-1 rounded-full opacity-70" />
      {note && <span className="text-[9px] font-semibold text-ink-secondary">{note}</span>}
    </div>
  )
}

// ── composition ────────────────────────────────────────────────────────────────

export function CuratedDigest({
  pulse,
  digest,
  isToday,
  dateLabel,
  onNavigate,
}: {
  pulse: InvestorPulse
  digest: CuratedView
  isToday: boolean
  dateLabel: string
  onNavigate?: (t: NavTarget, id: string) => void
}) {
  const companyId = pulse.companyId
  const all: ConvictionIdea[] = digest.lead ? [digest.lead, ...digest.entries.map((e) => e.idea)] : []

  // Single open note (only one at a time), restored after a dashboard round-trip.
  const restoredId = readSS(SS.openIdea, companyId)
  const initId = all.some((i) => i.id === restoredId) ? restoredId : null
  const [openId, setOpenId] = useState<string | null>(initId)
  const [page, setPage] = useState(() => (initId ? Number(readSS(SS.openPage, companyId)) || 0 : 0))
  const openIdea = all.find((i) => i.id === openId) ?? null

  const open = (id: string) => {
    setOpenId(id)
    setPage(0)
    writeSS(SS.openIdea, companyId, id)
    writeSS(SS.openPage, companyId, '0')
  }
  const close = () => {
    setOpenId(null)
    clearSS(SS.openIdea, companyId)
  }
  const changePage = (p: number) => {
    setPage(p)
    if (openId) writeSS(SS.openPage, companyId, String(p))
  }

  useEffect(() => {
    if (!openId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenId(null)
        clearSS(SS.openIdea, companyId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, companyId])

  return (
    <section className="premium-panel relative overflow-hidden rounded-2xl">
      <Masthead company={pulse.company} dateLabel={dateLabel} isToday={isToday} digest={digest} />

      {digest.isEmpty ? (
        <div className="px-4 py-10 text-center">
          <p className="text-[12.5px] text-ink-secondary">
            No source-backed movements meet the curation bar for {pulse.company} under this view right now.
          </p>
          <p className="mt-1 text-[11px] text-ink-secondary/70">New filings, regulation, analyst actions and sector news appear here as they are gathered — ranked by what matters most, not what is newest.</p>
        </div>
      ) : (
        <div className="space-y-4 px-4 py-4">
          {/* THE LEAD */}
          <div>
            <SectionHead icon={Sparkles} label="The lead" note="the one move that matters most" />
            {digest.lead && <LeadCard idea={digest.lead} onOpen={() => open(digest.lead!.id)} />}
          </div>

          {/* WHAT ELSE MOVED */}
          {digest.entries.length > 0 && (
            <div>
              <SectionHead icon={Eye} label="Also on the board" note={`${digest.entries.length} ranked by value`} />
              <div className="space-y-1.5">
                {digest.entries.map((entry) => (
                  <EntryCard key={entry.idea.id} entry={entry} active={entry.idea.id === openId} onOpen={() => open(entry.idea.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* honest provenance footer */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-soft-border bg-surface-tint/60 px-4 py-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-ink-secondary">
          <Globe className="h-3 w-3" strokeWidth={2.1} style={{ color: GOLD }} />
          Curated from {digest.developmentsCount} developments · {digest.sourcesCount} source-backed · {digest.domainsCount} distinct
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-ink-secondary" title="AI-curated market intelligence — source-linked, not audited. Verify before acting.">
          <ShieldCheck className="h-3 w-3" strokeWidth={2.1} style={{ color: GOLD }} />
          AI-curated · verify before acting
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-secondary">
          <Clock3 className="h-3 w-3" strokeWidth={2.1} style={{ color: GOLD }} /> {digest.updatedLabel}
        </span>
      </div>

      {/* the shared insight-note overlay — reused from the brief so a curated card
          opens the same three-page note (Story · Impact · Sources). */}
      {openIdea && <ConvictionOverlay idea={openIdea} companyId={companyId} page={page} onPage={changePage} onClose={close} onNavigate={onNavigate} />}
    </section>
  )
}
