import type { ReactNode } from 'react'
import { SourceTag, type SourceTagProps } from '@/components/SourceTag'
import { GOLD, NAVY, TEAL, px, SIGNAL_TONE, streetSignal, upPct, ValPill, xMult } from './valuationShared'

// ---------------------------------------------------------------------------
//  Valuation Decision Layer — the FIRST view of the Valuation section.
//
//  One soft blue-tinted band holding three compact "lens" cards that answer the
//  section's three questions before the reader reaches any table:
//
//    1. Valuation Lens — is the stock cheap / fair / expensive?
//    2. Quality Lens   — does operating quality support the valuation?
//    3. Street Verdict — what does the analyst street think?
//
//  It OWNS the repeated valuation / street numbers so they appear once here and
//  are not echoed across the cards below. This component is PRESENTATIONAL: every
//  figure is passed in (see `DecisionData`), derived by the section from the
//  ACTIVE company's own live sources. That's what lets the same layer serve every
//  listed name (Niva Bupa, Star Health, …) from its own data — never one
//  company's numbers under another's label.
//
//  All three cards share ONE typography system (display verdict headline, sans
//  tabular figures) and hide any metric that is unavailable rather than showing
//  an "n/a" — so the band stays clean for every company, year and view.
// ---------------------------------------------------------------------------

// Verdict accent tones — kept in the section's navy / teal / gold / coral family.
const V_TONE = {
  teal: { fg: '#0E6F6D', soft: '#EAF5F1', ring: 'rgba(22,142,142,0.22)', bar: TEAL },
  gold: { fg: '#8A6A1E', soft: '#F7F0DF', ring: 'rgba(182,139,58,0.26)', bar: GOLD },
  navy: { fg: '#27457E', soft: '#EAF0FA', ring: 'rgba(39,69,126,0.18)', bar: NAVY },
  coral: { fg: '#A8443B', soft: '#F7E9E7', ring: 'rgba(176,86,74,0.22)', bar: '#B0564A' },
} as const
type ToneKey = keyof typeof V_TONE

/** Quality read passed in from the section (computed once, reused by the full
 *  radar breakdown lower on the page so the two never drift). */
export interface QualityLens {
  verdict: string
  tone: ToneKey
  /** Peer-group label for the sub-line (dynamic, never hard-coded). */
  peerGroup: string
  drivers: { axis: string; delta: number; ahead: boolean; niva: number }[]
}

/** Everything the three cards render — derived by the section from the ACTIVE
 *  company's own live data, so the layer works for any listed name. */
export interface DecisionData {
  price: number | null
  fairValue: number | null // consensus / Street fair value
  upside: number | null
  pGwp: number | null
  /** Listed peer the P/GWP premium is measured against (dynamic per company). */
  benchmarkName: string | null
  premiumVsBench: number | null
  /** 52-week range — shown only when both are known (focal today). */
  lo: number | null
  hi: number | null
  priceSource: SourceTagProps
  consensusSource: SourceTagProps
  quality: QualityLens
  street: {
    hasCoverage: boolean
    buy: number
    hold: number
    sell: number
    n: number
    /** Consensus target (each broker's latest) — same basis as the Valuation Lens. */
    target: number | null
    signalUpside: number | null
    latestDate: string | null
  }
}

export function ValuationDecisionLayer({ data }: { data: DecisionData }) {
  return (
    <section
      className="relative overflow-hidden rounded-[1.4rem] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] sm:p-4"
      style={{ background: 'linear-gradient(155deg,#EAF1FB 0%,#E1EAF7 52%,#EBF1FA 100%)' }}
    >
      {/* Subtle tonal pools so the blue layer reads premium & soothing, not flat:
          navy (trust) top-right, teal (growth) lower-left, a whisper of gold. */}
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-70 blur-3xl" style={{ background: 'radial-gradient(circle,rgba(39,69,126,0.10),transparent 70%)' }} />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full opacity-60 blur-3xl" style={{ background: 'radial-gradient(circle,rgba(22,142,142,0.08),transparent 70%)' }} />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#B68B3A]/40 to-transparent" />

      <div className="relative grid gap-3 lg:grid-cols-3">
        <ValuationLensCard data={data} />
        <QualityLensCard quality={data.quality} />
        <StreetVerdictCard street={data.street} consensusSource={data.consensusSource} />
      </div>
    </section>
  )
}

// ── Shared card shell — one typography + surface system for all three ─────────
function LensCard({ eyebrow, accent, right, children }: { eyebrow: string; accent: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-[rgba(39,69,126,0.10)] bg-white/75 p-3.5 shadow-[0_1px_2px_rgba(23,43,77,0.03),0_6px_16px_rgba(23,43,77,0.05)] backdrop-blur">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[2.5px]" style={{ background: accent }} />
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-champagne-deep">{eyebrow}</p>
        {right}
      </div>
      {children}
    </div>
  )
}

function Verdict({ label, tone }: { label: string; tone: ToneKey }) {
  return (
    <h3 className="font-display text-[19px] leading-[1.12] tracking-tight" style={{ color: V_TONE[tone].fg }}>
      {label}
    </h3>
  )
}

// A compact tone-coded figure (label above, value below) — the shared stat unit.
function Stat({ k, v, tone = 'navy' }: { k: string; v: string; tone?: ToneKey }) {
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: V_TONE[tone].soft }}>
      <p className="text-[8.5px] font-semibold uppercase tracking-[0.05em] text-ink-secondary">{k}</p>
      <p className="mt-0.5 font-display text-[15px] leading-none tabular-nums" style={{ color: V_TONE[tone].fg }}>{v}</p>
    </div>
  )
}

// ── 1 · Valuation Lens — cheap / fair / expensive ─────────────────────────────
function ValuationLensCard({ data }: { data: DecisionData }) {
  const { price, fairValue, upside, pGwp, benchmarkName, premiumVsBench, lo, hi, priceSource } = data

  // Verdict from the upside band (unchanged thresholds), framed as cheap/fair/expensive.
  const v: { label: string; tone: ToneKey } =
    upside == null ? { label: 'Multiples in focus', tone: 'navy' }
    : upside >= 12 ? { label: 'Screens cheap', tone: 'teal' }
    : upside >= -3 ? { label: 'Near fair value', tone: 'gold' }
    : { label: 'Looks expensive', tone: 'coral' }

  // Premium vs the benchmark peer — neutral when within ±1pt, else signed.
  const benchWord = benchmarkName ? benchmarkName.split(' ')[0] : ''
  const premLabel =
    premiumVsBench == null ? null
    : Math.abs(premiumVsBench) < 1 ? 'In line'
    : `${premiumVsBench >= 0 ? '+' : ''}${premiumVsBench.toFixed(0)}%`
  const premTone: ToneKey = premiumVsBench == null || Math.abs(premiumVsBench) < 5 ? 'gold' : premiumVsBench > 0 ? 'gold' : 'teal'

  const stats = [
    price != null && { k: 'Current price', v: px(price), tone: 'navy' as ToneKey },
    fairValue != null && { k: 'Fair value', v: px(fairValue), tone: 'navy' as ToneKey },
    upside != null && { k: 'Upside', v: upPct(upside), tone: (upside >= 0 ? 'teal' : 'coral') as ToneKey },
    pGwp != null && { k: 'P / GWP', v: xMult(pGwp), tone: 'gold' as ToneKey },
    premLabel && benchWord && { k: `Premium vs ${benchWord}`, v: premLabel, tone: premTone },
  ].filter(Boolean) as { k: string; v: string; tone: ToneKey }[]

  const has52 = lo != null && hi != null && hi > lo && price != null
  const pos52 = has52 ? Math.max(0, Math.min(100, ((price! - lo!) / (hi! - lo!)) * 100)) : 0

  return (
    <LensCard eyebrow="Valuation Lens" accent={V_TONE[v.tone].bar} right={<ValPill c="secondary" />}>
      <Verdict label={v.label} tone={v.tone} />
      <p className="mt-1 text-[11.5px] leading-snug text-ink-secondary">
        {price != null && fairValue != null ? (
          <>Trades at <b className="text-navy-deep">{px(price)}</b> vs the Street&rsquo;s <b className="text-navy-deep">{px(fairValue)}</b> fair value.</>
        ) : pGwp != null ? (
          <>Read on multiples — <b className="text-navy-deep">{xMult(pGwp)}</b> P/GWP; no live Street target yet.</>
        ) : (
          <>Live market read for this name.</>
        )}
      </p>

      {stats.length > 0 && (
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {stats.map((s) => <Stat key={s.k} k={s.k} v={s.v} tone={s.tone} />)}
        </div>
      )}

      {/* 52-week position — a calm supporting visual (where price sits). */}
      {has52 && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[8.5px] font-semibold uppercase tracking-wide text-ink-secondary">
            <span>52-week range</span>
            <span className="tabular-nums text-navy-deep/80">{px(lo)} – {px(hi)}</span>
          </div>
          <div className="relative mt-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg,#EEF1F6,#E6F4F1)' }}>
            <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: `${pos52}%`, background: TEAL }} title={`Now ${px(price)}`} />
          </div>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <SourceTag {...priceSource} />
      </div>
    </LensCard>
  )
}

// ── 2 · Quality Lens — does operating quality support the valuation? ──────────
function QualityLensCard({ quality }: { quality: QualityLens }) {
  const maxAbs = Math.max(1, ...quality.drivers.map((d) => d.niva))
  return (
    <LensCard eyebrow="Quality Lens" accent={V_TONE[quality.tone].bar} right={<ValPill c="secondary" />}>
      <Verdict label={quality.verdict} tone={quality.tone} />
      <p className="mt-1 text-[11.5px] leading-snug text-ink-secondary">
        Operating quality vs the <b className="text-navy-deep">{quality.peerGroup}</b> peer average.
      </p>

      <div className="mt-2.5 space-y-1.5">
        {quality.drivers.map((d) => (
          <div key={d.axis} className="flex items-center gap-2 text-[11px]">
            <span className="w-[92px] shrink-0 text-ink-secondary">{d.axis}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E7ECF3]">
              <span className="block h-full rounded-full" style={{ width: `${Math.max(6, Math.min(100, (d.niva / maxAbs) * 100))}%`, background: d.ahead ? TEAL : NAVY }} />
            </div>
            <span className="w-9 text-right font-semibold tabular-nums" style={{ color: d.ahead ? '#0E6F6D' : '#64748B' }}>
              {d.delta >= 0 ? `+${d.delta}` : d.delta}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2.5 text-[9px] leading-snug text-ink-secondary/80">
        Relative score gap vs peers · operating quality, not valuation.
      </p>
    </LensCard>
  )
}

// ── 3 · Street Verdict — the analyst read (with the signal meter as support) ──
function StreetVerdictCard({ street, consensusSource }: { street: DecisionData['street']; consensusSource: SourceTagProps }) {
  const { hasCoverage, buy, hold, sell, n, target, signalUpside, latestDate } = street
  if (!hasCoverage) {
    return (
      <LensCard eyebrow="Street Verdict" accent={V_TONE.navy.bar}>
        <Verdict label="Coverage pending" tone="navy" />
        <p className="mt-1 text-[11.5px] leading-snug text-ink-secondary">No tracked analyst coverage yet.</p>
      </LensCard>
    )
  }
  const { score, kind } = streetSignal(buy, hold, sell, n, signalUpside ?? 0)
  const tone: ToneKey = kind === 'Bullish' ? 'teal' : kind === 'Bearish' ? 'coral' : 'gold'

  const chips: { r: string; c: number; tone: ToneKey }[] = [
    { r: 'Buy', c: buy, tone: 'teal' },
    { r: 'Hold', c: hold, tone: 'gold' },
    { r: 'Sell', c: sell, tone: 'coral' },
  ]

  return (
    <LensCard eyebrow="Street Verdict" accent={V_TONE[tone].bar} right={<ValPill c="secondary" />}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Verdict label={`${kind} street read`} tone={tone} />
          <p className="mt-1 text-[11.5px] leading-snug text-ink-secondary">
            {n} covering {n === 1 ? 'analyst' : 'analysts'}{latestDate ? <> · latest {latestDate}</> : null}.
          </p>
        </div>
        <MiniMeter score={score} color={SIGNAL_TONE[kind]} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <span key={c.r} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: V_TONE[c.tone].fg, background: V_TONE[c.tone].soft }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: V_TONE[c.tone].fg }} />
            {c.c} {c.r}
          </span>
        ))}
      </div>

      {target != null && (
        <div className="mt-2.5">
          <Stat k="Consensus target" v={px(target)} tone="navy" />
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <SourceTag {...consensusSource} />
      </div>
    </LensCard>
  )
}

// Compact semicircular signal meter — the speedometer, kept small as a support
// visual inside the Street Verdict card (never a dominant standalone card).
function MiniMeter({ score, color }: { score: number; color: string }) {
  const s = Math.max(0, Math.min(10, score))
  const a = Math.PI * (1 - s / 10)
  const cx = 44
  const cy = 40
  const r = 33
  const mx = cx + r * Math.cos(a)
  const my = cy - r * Math.sin(a)
  const track = `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`
  const prog = `M${cx - r},${cy} A${r},${r} 0 0 1 ${mx.toFixed(1)},${my.toFixed(1)}`
  return (
    <svg viewBox="0 0 88 46" className="w-[84px] shrink-0" role="img" aria-label={`Street signal ${score.toFixed(1)} of 10`}>
      <path d={track} fill="none" stroke="#E6EAF1" strokeWidth="6" strokeLinecap="round" />
      <path d={prog} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
      <circle cx={mx} cy={my} r="4.5" fill="#fff" />
      <circle cx={mx} cy={my} r="2.8" fill={color} />
      <text x="44" y="43" textAnchor="middle" style={{ fontSize: '11px', fontWeight: 700, fill: '#26303F' }}>
        {score.toFixed(1)}
      </text>
    </svg>
  )
}
