// Shared Pulse UI atoms — status pill, relevance tags, source chip + icon maps.
// Kept tiny and reused across the eight Pulse cards so the surface reads as one
// system (navy / gold / light-blue, thin strokes, compact type).

import {
  Zap,
  ShieldCheck,
  Eye,
  Landmark,
  LineChart,
  Users,
  FileText,
  Activity,
  ExternalLink,
  Newspaper,
  Mic,
  BarChart3,
  Gauge,
  type LucideIcon,
} from 'lucide-react'
import { CATEGORY_META, type SignalCategory } from '@/insights/investorPulse'
import { STATUS_COLOR, type PulseStatus, type PickTag, type EvidenceKind } from './derive'

export const GOLD = '#B68B3A'
export const GOLD_ON_NAVY = '#E4C67C'

export const CATEGORY_ICON: Record<SignalCategory, LucideIcon> = {
  'Analyst Action': LineChart,
  'Sector Catalyst': Zap,
  Regulatory: Landmark,
  Management: Users,
  Filing: FileText,
  'Data Movement': Activity,
}

export const EVIDENCE_ICON: Record<EvidenceKind, LucideIcon> = {
  Filing: FileText,
  News: Newspaper,
  Interview: Mic,
  'Market data': BarChart3,
  Regulatory: Landmark,
  'Analyst report': Gauge,
}

// ── Status pill — Constructive / Neutral / Watch / Risk ──────────────────────

export function StatusPill({ status, onNavy = false }: { status: PulseStatus; onNavy?: boolean }) {
  const c = STATUS_COLOR[status]
  if (onNavy) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-white/90"
        style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 1px rgba(228,198,124,0.28)' }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
        {status}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em]"
      style={{ color: c.fg, background: c.bg, boxShadow: `inset 0 0 0 1px ${c.dot}33` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {status}
    </span>
  )
}

// ── Relevance tag — subtle pills on each top pick ────────────────────────────

const TAG_STYLE: Record<PickTag, { fg: string; bg: string; ring: string }> = {
  'High priority': { fg: '#9C7430', bg: 'rgba(182,139,58,0.12)', ring: 'rgba(182,139,58,0.30)' },
  Regulatory: { fg: CATEGORY_META.Regulatory.fg, bg: CATEGORY_META.Regulatory.bg, ring: CATEGORY_META.Regulatory.ring },
  Sector: { fg: '#0E6F6D', bg: 'rgba(14,111,109,0.08)', ring: 'rgba(14,111,109,0.20)' },
  'Fresh today': { fg: '#2F855A', bg: 'rgba(47,133,90,0.10)', ring: 'rgba(47,133,90,0.22)' },
  // Older item we first surfaced today — amber, distinct from the green "Fresh today".
  'Newly surfaced': { fg: '#9C7430', bg: 'rgba(156,116,48,0.12)', ring: 'rgba(156,116,48,0.24)' },
  'Source-backed': { fg: '#5B6573', bg: 'rgba(91,101,115,0.08)', ring: 'rgba(91,101,115,0.20)' },
  Correlation: { fg: '#27457E', bg: 'rgba(39,69,126,0.08)', ring: 'rgba(39,69,126,0.20)' },
}

export function RelevanceTag({ tag }: { tag: PickTag }) {
  const s = TAG_STYLE[tag]
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-[0.05em]"
      style={{ color: s.fg, background: s.bg, boxShadow: `inset 0 0 0 1px ${s.ring}` }}
    >
      {tag}
    </span>
  )
}

// ── Source chip — a compact "Go to source" for a pick's evidence ─────────────

export function SourceChip({ kind, name, url }: { kind: EvidenceKind; name: string; url: string }) {
  const Icon = EVIDENCE_ICON[kind]
  const inner = (
    <>
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2.1} />
      <span className="truncate">{kind}</span>
      {url && <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />}
    </>
  )
  if (!url) {
    return (
      <span
        className="inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold text-ink-secondary"
        style={{ background: 'rgba(91,101,115,0.07)' }}
        title={`${name} · link pending`}
      >
        {inner}
      </span>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Go to source — ${name}`}
      className="inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold text-navy-primary transition-colors hover:bg-ice"
      style={{ background: 'rgba(39,69,126,0.06)' }}
    >
      {inner}
    </a>
  )
}

export const READ_ICON = { changed: Zap, matters: ShieldCheck, watch: Eye }
