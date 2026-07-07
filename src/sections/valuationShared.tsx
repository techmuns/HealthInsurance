import type { ReactNode } from 'react'
import { ArrowUpRight, ExternalLink, Lock, Minus } from 'lucide-react'
import { valSrc } from '@/data/valuationSources'
import type { Rating, ValConfidence } from '@/data/valuationData'
import { useAuditSource } from '@/state/auditSource'
import { resolveAuditCell } from '@/insights/sourceMap'

// Shared valuation/street primitives — colours, formatters and the small pills
// reused by both the Valuation page (Company Performance) and the Street View
// page. Extracted verbatim so neither chart is redesigned; only relocated.

// ── Colour psychology (kept subtle, light, source-backed) ────────────────────
export const NAVY = '#27457E'
export const TEAL = '#168E8E'
export const GREEN = '#3F9C6B'
export const GOLD = '#B68B3A'
export const PEER = '#A6B2C6'
export const CORAL = '#C2766B'

export const clamp = (v: number, lo = 16, hi = 96) => Math.max(lo, Math.min(hi, v))
export const fmtCr = (v: number | null) => (v == null ? 'n/a' : v >= 1000 ? `₹${(v / 1000).toFixed(1)}k Cr` : `₹${v.toFixed(0)} Cr`)
export const px = (v: number | null) => (v == null ? 'Pending' : `₹${Number.isInteger(v) ? v : v.toFixed(1)}`)
export const xMult = (v: number | null, d = 2) => (v == null ? 'n/a' : `${v.toFixed(d)}x`)
export const upPct = (v: number | null) => (v == null ? 'Pending' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)

// Tone by rating, bullish → bearish. Buy/Add read teal-green (positive), Hold/
// Equal-weight read amber/slate (neutral), Reduce/Sell read coral (caution).
export const ratingTone: Record<Rating, { fg: string; bg: string }> = {
  Buy: { fg: '#0E6F6D', bg: '#E2F4F1' },
  Add: { fg: '#2E8B63', bg: '#E7F4EC' },
  Hold: { fg: '#9A6B12', bg: '#FBF3E2' },
  'Equal-weight': { fg: '#647488', bg: '#EEF1F6' },
  Reduce: { fg: '#B0564A', bg: '#F8ECEC' },
  Sell: { fg: '#B0564A', bg: '#F8ECEC' },
}

// ── Street signal (Bull / Neutral / Bear) — one shared definition ────────────
// Used by BOTH the Street Verdict decision card and the Street View evidence
// section so the read never drifts between them. Logic is unchanged from the
// original Street View: a 0–10 score from the rating skew and upside, mapped to
// a stance. Pure — no data or thresholds changed, only relocated to be shared.
export type SignalKind = 'Bullish' | 'Neutral' | 'Bearish'
export const SIGNAL_TONE: Record<SignalKind, string> = { Bullish: TEAL, Neutral: GOLD, Bearish: '#B0564A' }
export function streetSignal(buy: number, _hold: number, sell: number, n: number, upside: number) {
  const ratingScore = n > 0 ? (buy - sell) / n : 0 // −1..1
  const upsideScore = Math.max(-1, Math.min(1, upside / 20))
  const score = Math.max(0, Math.min(10, 5.5 + ratingScore * 3 + upsideScore * 1.5))
  const kind: SignalKind = score >= 6.5 && upside >= 0 ? 'Bullish' : score <= 4 || upside <= -5 ? 'Bearish' : 'Neutral'
  return { score, kind }
}

const VAL_TONE: Record<ValConfidence, { label: string; fg: string; bg: string; dot: string }> = {
  verified: { label: 'Verified', fg: '#0E6F6D', bg: '#E2F4F1', dot: TEAL },
  secondary: { label: 'Secondary', fg: '#9A6B12', bg: '#FBF3E2', dot: GOLD },
  pending: { label: 'Locked', fg: '#64748B', bg: '#EEF1F6', dot: '#94A3B8' },
}

/** Verified / Secondary / Locked (source-pending) validation status pill. */
export function ValPill({ c, className = '' }: { c: ValConfidence; className?: string }) {
  const t = VAL_TONE[c]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none ${className}`} style={{ color: t.fg, background: t.bg }}>
      {c === 'pending' ? (
        <Lock className="h-2.5 w-2.5" style={{ color: '#B68B3A' }} />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />
      )}
      {t.label}
    </span>
  )
}

/** Small "Open source" button — one click opens the exact report / filing.
 *  `url` (dynamic Moneycontrol rows) takes precedence over the curated `id`. */
export function OpenSource({ id, url, title: providedTitle }: { id: string; url?: string; title?: string }) {
  const s = valSrc(id)
  const auditNav = useAuditSource()
  const href = url ?? s?.source_url

  // SAHI Analysis / Industry Data — route to the Data Audit hub (where the raw
  // filing/URL lives) instead of opening it here.
  if (auditNav.active) {
    const company = s?.company ? s.company.toLowerCase().replace(/\s+/g, '-') : auditNav.company
    const year = s?.period?.match(/FY\s?\d{2}/i)?.[0]?.replace(/\s/g, '')
    const resolved = resolveAuditCell({ company, metric: s?.metric, year })
    // Two-path source rule. When this number IS an extracted, audited figure
    // (`resolved` maps to a cell or audit row) → deep-link to the exact cell.
    // When it is NOT in the audit grid — a derived / estimated / broker-note value
    // whose metric has no audit mapping (`status: 'pending'`) — but it carries its
    // own document, OPEN that document (Path 2). A precise external source beats a
    // vague "nearest section" landing; the audit hub has no cell to show here.
    if (resolved.status === 'pending' && href) {
      const extTitle = providedTitle ?? (url ? 'Moneycontrol' : s?.report_title ?? 'Source')
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          data-source-kind="external"
          data-source-id={`ext::${id}`}
          title={`${extTitle} — not an audited grid figure; opens the source document in a new tab`}
          className="inline-flex items-center gap-1 rounded-full border border-soft-border bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-navy-primary transition-all hover:border-muted-blue hover:bg-white hover:text-navy-deep hover:shadow-soft"
        >
          Open source
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )
    }
    const target = [company, s?.metric, year].filter(Boolean).join('::') || undefined
    return (
      <button
        type="button"
        data-source-kind="internal"
        data-source-id={`audit::${target ?? id}`}
        data-source-target={target}
        onClick={() => auditNav.goToAudit(resolved)}
        title="View in Data Audit — the source-verification layer"
        className="inline-flex items-center gap-1 rounded-full border border-soft-border bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-navy-primary transition-all hover:border-champagne hover:bg-champagne-soft/40 hover:text-navy-deep hover:shadow-soft"
      >
        View in Data Audit
        <ArrowUpRight className="h-2.5 w-2.5" />
      </button>
    )
  }

  if (!href) {
    return (
      <span data-source-kind="none" className="inline-flex items-center gap-1 rounded-full bg-ice px-2 py-0.5 text-[10px] font-semibold text-ink-secondary ring-1 ring-soft-border" title="Source pending — locked until a citable note is ingested">
        <Lock className="h-2.5 w-2.5 text-champagne-deep" />
        Locked
      </span>
    )
  }
  const title = providedTitle ?? (url ? 'Moneycontrol' : s?.report_title ?? 'Source')
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-source-kind="external"
      data-source-id={`ext::${id}`}
      title={`${title} — opens in a new tab`}
      className="inline-flex items-center gap-1 rounded-full border border-soft-border bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-navy-primary transition-all hover:border-muted-blue hover:bg-white hover:text-navy-deep hover:shadow-soft"
    >
      Open source
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  )
}

export function Eyebrow({ label, title, note, right }: { label: string; title: string; note?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-1 h-7 w-1 rounded-full bg-gradient-to-b from-champagne to-champagne-deep" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-champagne-deep">{label}</p>
          <h2 className="mt-0.5 font-display text-[20px] leading-tight text-navy-deep">{title}</h2>
          {note && <p className="mt-0.5 text-[11.5px] text-ink-secondary">{note}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

/** Analyst target-range strip — where the current price sits Low → Cons → High. */
export function LensRange({ price, target, lo, hi, analysts }: { price: number; target: number | null; lo: number | null; hi: number | null; analysts: number }) {
  if (lo == null || hi == null || hi <= lo) return <p className="mt-3 text-[10px] text-ink-secondary">Target range pending.</p>
  const pct = (v: number) => Math.max(2, Math.min(98, ((v - lo) / (hi - lo)) * 100))
  const near = Math.abs(price - (target ?? price)) / (target ?? price) < 0.04
  const priceTone = near ? GOLD : target != null && price < target ? TEAL : CORAL
  return (
    <div className="mt-3">
      <p className="mb-1 text-[8.5px] font-semibold uppercase tracking-wide text-ink-secondary">Analyst target range · {analysts} analysts</p>
      <div className="relative h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#F8ECEC,#FBF3E2,#E6F4F1)' }}>
        {target != null && <span className="absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-navy-primary/45" style={{ left: `${pct(target)}%` }} />}
        <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: `${pct(price)}%`, background: priceTone }} />
      </div>
      <div className="mt-1 flex justify-between text-[8.5px] text-ink-secondary">
        <span>Low {px(lo)}</span>
        <span className="font-semibold text-navy-deep/70">Cons. {px(target)}</span>
        <span>High {px(hi)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[8.5px] text-ink-secondary">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: priceTone }} />Price</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-navy-primary/45" />Consensus</span>
        <span className="inline-flex items-center gap-1"><Minus className="h-2.5 w-2.5" /> {near ? 'near fair value' : target != null && price < target ? 'below target' : 'above target'}</span>
      </div>
    </div>
  )
}
