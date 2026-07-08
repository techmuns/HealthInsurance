import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Info, Lightbulb } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import { FOCAL_VALUATION_ID, peerValuation, type PeerValuationRow } from '@/data/valuationData'
import { buildNavValuation, periodLabel, type NavValuation } from '@/lib/navValuation'
import { getMarketQuote, type MarketQuote } from '@/lib/analystCoverage'
import { buildQuality, insurerById, qualityReadText, type QualityAnalysis } from './qualityCompass'
import { CORAL, Eyebrow, GOLD, GREEN, NAVY, PEER, TEAL, fmtCr, xMult } from './valuationShared'

// ---------------------------------------------------------------------------
//  Peer valuation & quality — an always-visible, side-by-side comparison.
//
//  TOP: one wide table split into three grouped blocks so a reader takes in both
//  valuation frameworks at a glance, no toggle:
//     • Shared / Company (anchored left) — Company · Listing · GWP · Growth
//     • Market Value View  — P/GWP · P/E · Market value        (Live price)
//     • Book Value View    — Book value · BVPS · P/BV · Impl/sh · Vs NAV  (Latest FY)
//  Shared company data appears ONCE; each framework has its own tinted block.
//
//  BOTTOM: the selected row drives two cards — a Selected Peer Snapshot and the
//  always-on Quality Lens (radar + score bars + read). Clicking a row re-selects;
//  the default is the active company. Works for every company and peer set.
//
//  UI only — data & calculations are unchanged (peerValuation, buildNavValuation,
//  getMarketQuote, buildQuality). Missing inputs render a clean dash, never a
//  fabricated number.
// ---------------------------------------------------------------------------

const GROWTH_GREEN = '#2E8B63'
const RED = '#A8443B'

// ── Formatters (display only; reuse the shared ones where they exist) ─────────
const fmtGrowth = (v: number | null) => (v == null ? null : `${v >= 0 ? '+' : '−'}${Math.abs(Number.isInteger(v) ? v : +v.toFixed(1))}%`)
const inr = (v: number | null) => (v == null ? null : `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: v < 100 ? 1 : 0 })}`)
const signPct = (v: number | null) => (v == null ? null : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`)

function Dash({ title }: { title?: string }) {
  return <span className="text-ink-secondary/45" title={title}>—</span>
}

export function PeerValuationSection({ defaultCompanyId }: { defaultCompanyId: string }) {
  const rows = peerValuation
  // Selected row drives the snapshot + quality lens; defaults to the active
  // company and follows it when the top dropdown changes.
  const [selectedId, setSelectedId] = useState(defaultCompanyId)
  useEffect(() => setSelectedId(defaultCompanyId), [defaultCompanyId])

  const navById = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.companyId, buildNavValuation(r.companyId)])) as Record<string, NavValuation>,
    [rows],
  )
  const quoteById = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.companyId, getMarketQuote(r.companyId)])) as Record<string, MarketQuote | null>,
    [rows],
  )

  const selectedRow = rows.find((r) => r.companyId === selectedId) ?? rows[0]
  const selectedInsurer = insurerById(selectedRow.companyId) ?? insurerById(defaultCompanyId)
  const quality = selectedInsurer ? buildQuality(selectedInsurer) : null

  const anyUnlisted = rows.some((r) => r.listingStatus === 'Unlisted')

  return (
    <section>
      <Eyebrow
        label="Peer Comparison"
        title="Peer valuation & quality"
        note="Both valuation frameworks side by side — no toggle. Pick a peer to see its snapshot and operating-quality read."
      />

      {/* ── TOP · split valuation table ─────────────────────────────────────── */}
      <div className="card-surface overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-separate border-spacing-0 text-left text-[11.5px]">
            <thead>
              {/* Group header — three tinted blocks + a helper chip each. */}
              <tr>
                <th colSpan={4} className="sticky left-0 z-10 border-b border-r border-soft-border bg-[#EEF2F9] px-4 py-2 text-left">
                  <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-navy-primary/80">Shared · Company</span>
                </th>
                <th colSpan={3} className="border-b border-r border-soft-border bg-[#E7F0FB] px-3 py-2 text-left">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-navy-primary/85">Market Value View</span>
                    <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-navy-primary ring-1 ring-[rgba(39,69,126,0.18)]">Live price</span>
                  </span>
                </th>
                <th colSpan={5} className="border-b border-soft-border bg-[#E7F2EF] px-3 py-2 text-left">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: '#0E6F6D' }}>Book Value View</span>
                    <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-teal ring-1 ring-[rgba(22,142,142,0.22)]">Latest FY</span>
                  </span>
                </th>
              </tr>
              {/* Column header. */}
              <tr className="text-[9px] uppercase tracking-[0.04em] text-ink-secondary">
                <Th sticky className="pl-4">Company</Th>
                <Th>Listing</Th>
                <Th align="right">GWP · FY</Th>
                <Th align="right" className="border-r border-soft-border pr-3">Growth</Th>
                <Th align="right">P / GWP</Th>
                <Th align="right">P / E</Th>
                <Th align="right" className="border-r border-soft-border pr-3">Mkt value</Th>
                <Th align="right">Book value</Th>
                <Th align="right">BVPS</Th>
                <Th align="right">P / BV</Th>
                <Th align="right">Impl / sh</Th>
                <Th align="right" className="pr-4">Vs NAV</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const focal = r.companyId === FOCAL_VALUATION_ID
                const selected = r.companyId === selectedId
                const unlisted = r.listingStatus === 'Unlisted'
                const nav = navById[r.companyId]
                const quote = quoteById[r.companyId]
                const growth = fmtGrowth(r.growth)
                // Sticky-cell + row background reflect selection (soft blue) / focal.
                const rowBg = selected ? 'bg-soft-blue/60' : focal ? 'bg-soft-blue/25' : 'bg-white hover:bg-soft-blue/15'
                const stickyBg = selected ? 'bg-[#E4ECF9]' : focal ? 'bg-[#EEF3FC]' : 'bg-white'

                return (
                  <tr
                    key={r.companyId}
                    onClick={() => setSelectedId(r.companyId)}
                    aria-selected={selected}
                    className={`cursor-pointer align-middle transition-colors ${rowBg}`}
                  >
                    {/* SHARED · Company (anchored) */}
                    <td className={`sticky left-0 z-10 border-b border-soft-border/70 py-2.5 pl-4 pr-3 ${stickyBg}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="h-3.5 w-[3px] rounded-full" style={{ background: selected ? NAVY : 'transparent' }} />
                        <span className="font-semibold text-navy-deep">{r.companyName}</span>
                        {focal && <span className="rounded-full bg-champagne-soft px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-champagne-deep">Focal</span>}
                      </span>
                    </td>
                    <td className="border-b border-soft-border/70 py-2.5 pr-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${unlisted ? 'border border-dashed border-[#CAD0DA] text-ink-secondary' : 'bg-emerald-soft text-emerald'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${unlisted ? 'bg-[#B7BECB]' : 'bg-emerald'}`} />
                        {r.listingStatus}
                      </span>
                    </td>
                    <td className="border-b border-soft-border/70 py-2.5 pr-3 text-right tabular-nums">
                      {r.gwp != null ? (
                        <span className="inline-flex items-baseline gap-1">
                          <span className="font-semibold text-navy-deep">{fmtCr(r.gwp)}</span>
                          {r.gwpFy && <span className="text-[8.5px] font-semibold uppercase tracking-wide text-ink-secondary/70">{r.gwpFy}</span>}
                        </span>
                      ) : <Dash />}
                    </td>
                    <td className="border-b border-r border-soft-border/70 py-2.5 pr-3 text-right tabular-nums">
                      {growth != null ? <span className="font-semibold" style={{ color: r.growth != null && r.growth >= 0 ? GROWTH_GREEN : RED }}>{growth}</span> : <Dash />}
                    </td>

                    {/* MARKET VALUE VIEW */}
                    <td className="border-b border-soft-border/70 py-2.5 pr-3 text-right tabular-nums">
                      {r.pGwp != null ? <span className="font-semibold text-navy-deep">{xMult(r.pGwp)}</span> : <Dash title={unlisted ? 'No public market price' : undefined} />}
                    </td>
                    <td className="border-b border-soft-border/70 py-2.5 pr-3 text-right tabular-nums text-navy-deep">
                      {r.pe != null ? xMult(r.pe, 1) : <Dash title={unlisted ? 'No public market price' : undefined} />}
                    </td>
                    <td className="border-b border-r border-soft-border/70 py-2.5 pr-3 text-right tabular-nums text-navy-deep">
                      {r.marketCap != null ? fmtCr(r.marketCap) : <Dash title={unlisted ? 'No public market price' : undefined} />}
                    </td>

                    {/* BOOK VALUE VIEW */}
                    <td className="border-b border-soft-border/70 py-2.5 pr-3 text-right tabular-nums">
                      {nav?.netWorth ? (
                        <span className="inline-flex items-baseline gap-1">
                          <span className="font-semibold text-navy-deep">{fmtCr(nav.netWorth.value)}</span>
                          <span className="text-[8.5px] font-semibold uppercase tracking-wide text-ink-secondary/70">{periodLabel(nav.netWorth.period)}</span>
                        </span>
                      ) : <Dash title="Book value pending" />}
                    </td>
                    <td className="border-b border-soft-border/70 py-2.5 pr-3 text-right tabular-nums text-navy-deep">
                      {nav?.navPerShare != null ? inr(nav.navPerShare) : <Dash title="Needs shares outstanding" />}
                    </td>
                    <td className="border-b border-soft-border/70 py-2.5 pr-3 text-right tabular-nums">
                      {quote?.pb != null ? <span className="font-semibold" style={{ color: GOLD }}>{xMult(quote.pb)}</span> : <Dash title={unlisted ? 'No public market price' : undefined} />}
                    </td>
                    <td className="border-b border-soft-border/70 py-2.5 pr-3 text-right tabular-nums text-navy-deep">
                      {nav?.impliedPerShare != null ? inr(nav.impliedPerShare) : <Dash title="Needs shares & a peer P/BV" />}
                    </td>
                    <td className="border-b border-soft-border/70 py-2.5 pr-4 text-right tabular-nums">
                      {nav?.premiumDiscountPct != null ? (
                        <span className="font-semibold" style={{ color: nav.premiumDiscountPct >= 0 ? GOLD : TEAL }}>{signPct(nav.premiumDiscountPct)}</span>
                      ) : <Dash title={unlisted ? 'No public market price' : undefined} />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer — the missing-data convention, once. */}
        <div className="flex items-start gap-1.5 border-t border-soft-border bg-[#FAFBFD] px-4 py-2.5 text-[10.5px] leading-snug text-ink-secondary">
          <Info className="mt-px h-3 w-3 shrink-0 text-ink-secondary/70" />
          <span>
            <b className="text-navy-deep/80">Market Value View</b> needs a live share price — the {anyUnlisted ? 'unlisted peers ' : ''}names with no public listing show a clean <b className="text-navy-deep/80">—</b>; their GWP &amp; growth are real filed figures.
            {' '}<b className="text-navy-deep/80">Book Value View</b> values each peer on its filed net worth: <b className="text-navy-deep/80">BVPS</b> = book value ÷ shares, <b className="text-navy-deep/80">Impl / sh</b> applies a listed-peer P/BV, <b className="text-navy-deep/80">Vs NAV</b> is market vs that implied value. Nothing is estimated.
          </span>
        </div>
      </div>

      {/* ── BOTTOM · selected snapshot + quality lens ───────────────────────── */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SelectedPeerSnapshot row={selectedRow} nav={navById[selectedRow.companyId]} quote={quoteById[selectedRow.companyId]} />
        <QualityLensPanel quality={quality} companyName={selectedRow.companyName} />
      </div>
    </section>
  )
}

// ── Table header cell ─────────────────────────────────────────────────────────
function Th({ children, align = 'left', sticky = false, className = '' }: { children: ReactNode; align?: 'left' | 'right'; sticky?: boolean; className?: string }) {
  return (
    <th className={`border-b border-soft-border bg-[#F4F7FC] py-2 pr-3 font-semibold ${align === 'right' ? 'text-right' : 'text-left'} ${sticky ? 'sticky left-0 z-10 bg-[#F4F7FC]' : ''} ${className}`}>
      {children}
    </th>
  )
}

// ── Selected peer snapshot ────────────────────────────────────────────────────
function SnapStat({ k, v, tone = 'navy' }: { k: string; v: string | null; tone?: 'navy' | 'teal' | 'coral' | 'gold' }) {
  if (v == null) return null
  const fg = tone === 'teal' ? '#0E6F6D' : tone === 'coral' ? RED : tone === 'gold' ? '#8A6A1E' : '#27457E'
  const bg = tone === 'teal' ? '#F1FAF8' : tone === 'coral' ? '#F8ECEC' : tone === 'gold' ? '#FBF6EA' : '#EEF3FB'
  return (
    <div className="rounded-lg px-2.5 py-1.5" style={{ background: bg }}>
      <p className="text-[8.5px] font-semibold uppercase tracking-[0.05em] text-ink-secondary">{k}</p>
      <p className="mt-0.5 font-display text-[15px] leading-none tabular-nums" style={{ color: fg }}>{v}</p>
    </div>
  )
}

function SelectedPeerSnapshot({ row, nav, quote }: { row: PeerValuationRow; nav: NavValuation | undefined; quote: MarketQuote | null }) {
  const focal = row.companyId === FOCAL_VALUATION_ID
  const unlisted = row.listingStatus === 'Unlisted'
  const growth = fmtGrowth(row.growth)
  return (
    <div className="card-surface card-tint-slate p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-champagne-deep">Selected Peer Snapshot</p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <h3 className="font-display text-[18px] leading-tight text-navy-deep">{row.companyName}</h3>
        {focal && <span className="rounded-full bg-champagne-soft px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-champagne-deep">Focal</span>}
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${unlisted ? 'border border-dashed border-[#CAD0DA] text-ink-secondary' : 'bg-emerald-soft text-emerald'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${unlisted ? 'bg-[#B7BECB]' : 'bg-emerald'}`} />{row.listingStatus}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <SnapStat k="Market value" v={row.marketCap != null ? fmtCr(row.marketCap) : null} />
        <SnapStat k="Book value" v={nav?.netWorth ? fmtCr(nav.netWorth.value) : null} tone="teal" />
        <SnapStat k="GWP · latest FY" v={row.gwp != null ? fmtCr(row.gwp) : null} />
        <SnapStat k="P / GWP" v={row.pGwp != null ? xMult(row.pGwp) : null} tone="gold" />
        <SnapStat k="P / BV" v={quote?.pb != null ? xMult(quote.pb) : null} tone="gold" />
        <SnapStat k="P / E" v={row.pe != null ? xMult(row.pe, 1) : null} />
        <SnapStat k="GWP growth" v={growth} tone={row.growth != null && row.growth >= 0 ? 'teal' : 'coral'} />
        <SnapStat k="BVPS" v={nav?.navPerShare != null ? inr(nav.navPerShare) : null} tone="teal" />
        <SnapStat k="Impl / share" v={nav?.impliedPerShare != null ? inr(nav.impliedPerShare) : null} tone="teal" />
      </div>

      {unlisted && (
        <p className="mt-3 text-[10px] leading-snug text-ink-secondary">
          Unlisted — no public market price, so market-based multiples read <b className="text-navy-deep/80">—</b>. Book value and GWP are real filed figures.
        </p>
      )}
    </div>
  )
}

// ── Quality lens (always visible, driven by the selected row) ─────────────────
function QualityLensPanel({ quality, companyName }: { quality: QualityAnalysis | null; companyName: string }) {
  if (!quality) {
    return (
      <div className="card-surface card-tint-slate p-4">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-champagne-deep">Quality Lens</p>
        <p className="mt-2 text-[12px] text-ink-secondary">Operating-quality metrics aren’t tracked for {companyName}.</p>
      </div>
    )
  }
  const { compassData, drivers, position } = quality
  const badge =
    position === 'Above Average' ? { fg: GREEN, bg: '#EAF5EE', ring: '#C8E2DD', label: 'Above Average operating quality' }
    : position === 'Weak vs peers' ? { fg: CORAL, bg: '#F8ECEC', ring: '#EAD2CD', label: 'Below-average operating quality' }
    : { fg: NAVY, bg: '#EAF0FB', ring: '#D6E2FA', label: 'In-line operating quality' }
  const readTone =
    position === 'Above Average' ? { fg: '#0E6F6D', bg: '#F1FAF8', ring: '#CFE7E3' }
    : position === 'Weak vs peers' ? { fg: '#A8443B', bg: '#F8ECEC', ring: '#EAD2CD' }
    : { fg: '#27457E', bg: '#EEF3FB', ring: '#D6E2FA' }

  return (
    <div className="card-surface card-tint-slate p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-champagne-deep">Quality Lens</p>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ color: badge.fg, background: badge.bg, borderColor: badge.ring }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: badge.fg }} />{badge.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_1.05fr]">
        {/* radar */}
        <div className="rounded-xl bg-gradient-to-br from-[#F6F9FD] to-[#ECF1F8] ring-1 ring-[rgba(39,69,126,0.06)]" style={{ width: '100%', height: 188 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={compassData} outerRadius="74%" margin={{ top: 8, right: 26, bottom: 8, left: 26 }}>
              <PolarGrid stroke="#E3E8F0" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: '#64748B' }} />
              <Radar name="Peer avg" dataKey="peer" stroke={PEER} fill={PEER} fillOpacity={0.16} strokeWidth={1.3} />
              <Radar name={companyName} dataKey="self" stroke={NAVY} fill={NAVY} fillOpacity={0.26} strokeWidth={1.8} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {/* score bars */}
        <div className="space-y-1.5">
          {drivers.map((d) => (
            <div key={d.axis} className="flex items-center gap-2 text-[11px]">
              <span className="w-[86px] shrink-0 text-ink-secondary">{d.axis}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft-border">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(6, Math.min(100, d.self))}%`, background: d.ahead ? GREEN : NAVY }} />
              </div>
              <span className="w-8 text-right text-[10.5px] font-semibold tabular-nums" style={{ color: d.ahead ? GREEN : '#64748B' }}>{d.delta >= 0 ? `+${d.delta}` : d.delta}</span>
            </div>
          ))}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-ink-secondary">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: NAVY }} />{companyName}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: PEER }} />Peer avg</span>
          </p>
        </div>
      </div>

      {/* what this means */}
      <div className="mt-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5" style={{ background: readTone.bg, borderColor: readTone.ring }}>
        <span className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/80" style={{ color: readTone.fg, boxShadow: `inset 0 0 0 1px ${readTone.ring}` }}>
          <Lightbulb className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: readTone.fg }}>What this means</p>
          <p className="mt-0.5 text-[12px] leading-snug text-navy-deep">{qualityReadText(position)}</p>
        </div>
      </div>
    </div>
  )
}
