import { Activity, Gauge, Percent, TrendingDown, TrendingUp } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { SourceTag } from '@/components/SourceTag'
import { useActiveCompany } from '@/state/filters'
import { FOCAL_VALUATION_ID, marketSnapshot } from '@/data/valuationData'
import { getAnalystCoverage, getMarketQuote } from '@/lib/analystCoverage'
import { srcTag } from '@/data/valuationSources'
import { OpenSource, px, ratingTone, SIGNAL_TONE, streetSignal, upPct, ValPill, type SignalKind } from './valuationShared'

// ── Soft premium palette ─────────────────────────────────────────────────────
// Muted teal/emerald = bullish/positive · soft burgundy/coral = negative ·
// warm gold = premium markers · deep navy = text/structure · slate = neutral.
const NAVY = '#27457E'
const TEAL = '#168E8E'
const GOLD = '#B68B3A'
const BURG = '#B0564A'
const SLATE = '#8C97A8'
// Soft surface tints (mist blue / ivory / slate-blue / teal / coral).
const TINT = {
  mist: { from: '#F2F6FC', to: '#E8F0FA', ring: 'rgba(39,69,126,0.14)' },
  navy: { from: '#FFFFFF', to: '#EBF0FA', ring: 'rgba(39,69,126,0.16)' },
  teal: { from: '#FFFFFF', to: '#E6F4F1', ring: 'rgba(22,142,142,0.20)' },
  coral: { from: '#FFFFFF', to: '#F7ECEA', ring: 'rgba(176,86,74,0.20)' },
  gold: { from: '#FFFFFF', to: '#F8F1E1', ring: 'rgba(182,139,58,0.22)' },
  slate: { from: '#FFFFFF', to: '#EEF2F8', ring: 'rgba(140,151,168,0.22)' },
}

// Street signal (Bull / Neutral / Bear) now lives in valuationShared so the
// Street Verdict decision card and this evidence view read the exact same stance.

// A calm market-line for the hero background — trends up / flat / down with the
// signal (data-driven ambiance, not a value chart).
function heroPath(kind: SignalKind): string {
  const pts = kind === 'Bullish' ? [62, 58, 60, 50, 52, 40, 34, 26] : kind === 'Bearish' ? [30, 36, 32, 44, 40, 52, 58, 64] : [46, 42, 48, 44, 50, 45, 48, 44]
  const step = 320 / (pts.length - 1)
  return pts.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(0)},${y}`).join(' ')
}

// ── Semicircular signal gauge ────────────────────────────────────────────────
function SignalGauge({ kind, score, buy, hold, sell, upside }: { kind: SignalKind; score: number; buy: number; hold: number; sell: number; upside: number | null }) {
  const fg = SIGNAL_TONE[kind]
  const Icon = kind === 'Bullish' ? TrendingUp : kind === 'Bearish' ? TrendingDown : Gauge
  const a = Math.PI * (1 - Math.max(0, Math.min(10, score)) / 10) // π (0) … 0 (10)
  const mx = 100 + 80 * Math.cos(a)
  const my = 92 - 80 * Math.sin(a)
  const progress = `M20,92 A80,80 0 0 1 ${mx.toFixed(1)},${my.toFixed(1)}`
  const upTone = upside == null ? SLATE : upside >= 0 ? TEAL : BURG
  return (
    <div className="relative flex flex-col rounded-[1.15rem] border bg-white/80 p-4 shadow-card backdrop-blur-sm" style={{ borderColor: TINT.teal.ring }}>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#B68B3A]/45 to-transparent" />
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-ink-secondary">Street Signal</span>
        <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ background: `${fg}14`, color: fg }}><Icon className="h-3.5 w-3.5" /></span>
      </div>
      {/* gauge */}
      <div className="relative mx-auto mt-1 w-[200px]">
        <svg viewBox="0 0 200 108" className="w-full">
          <defs>
            <linearGradient id="gaugeArc" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#E7C9C5" /><stop offset="50%" stopColor="#EAD9B6" /><stop offset="100%" stopColor="#BFE3E1" />
            </linearGradient>
          </defs>
          <path d="M20,92 A80,80 0 0 1 180,92" fill="none" stroke="#E9EDF4" strokeWidth="11" strokeLinecap="round" />
          <path d={progress} fill="none" stroke="url(#gaugeArc)" strokeWidth="11" strokeLinecap="round" />
          <circle cx={mx} cy={my} r="7" fill="#fff" />
          <circle cx={mx} cy={my} r="5" fill={fg} />
        </svg>
        <div className="absolute inset-x-0 bottom-1 text-center">
          <p className="font-display text-[22px] leading-none" style={{ color: fg }}>{kind}</p>
          <p className="font-display text-[13px] leading-tight text-navy-deep/75 tabular-nums">{score.toFixed(1)} <span className="text-ink-secondary/70">/ 10</span></p>
        </div>
      </div>
      {/* chips */}
      <div className="mt-1 flex flex-wrap justify-center gap-1.5">
        {([['Buy', buy], ['Hold', hold], ['Sell', sell]] as const).map(([r, c]) => (
          <span key={r} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: ratingTone[r].fg, background: ratingTone[r].bg }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ratingTone[r].fg }} />{c} {r}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: upTone, background: `${upTone}16` }}>
          <Percent className="h-2.5 w-2.5" />{upPct(upside)} upside
        </span>
      </div>
    </div>
  )
}

export function StreetView({ embedded = false }: { embedded?: boolean } = {}) {
  const company = useActiveCompany()
  const coverage = getAnalystCoverage(company.id)
  const isFocal = company.id === FOCAL_VALUATION_ID

  if (!coverage) {
    return (
      <div className="space-y-5">
        {embedded ? (
          <PanelHead title="Street View" note="Analyst targets, ratings, price trend, and key catalysts." />
        ) : (
          <HeroBanner company={company.shortName} subtitle="Analyst targets, ratings, price trend, and key catalysts." kind="Neutral" right={null} />
        )}
        <div className="card-surface p-5">
          <EmptyState
            title={`Analyst coverage not tracked for ${company.shortName}`}
            body={`Broker targets and consensus are tracked for the listed insurers with citable analyst notes (Niva Bupa, Star Health, ICICI Lombard). ${company.shortName} populates here once such notes are ingested.`}
            height={300}
          />
        </div>
      </div>
    )
  }

  const quote = getMarketQuote(company.id)
  const ac = coverage.consensus
  const reports = coverage.reports
  const price = ac.currentPrice ?? quote?.price ?? null
  const priceAsOf = isFocal ? marketSnapshot.priceAsOf : quote?.asOf ?? '—'
  const target = ac.consensusTargetPrice
  const upside = target != null && price != null && price > 0 ? (target / price - 1) * 100 : null
  const { score, kind } = streetSignal(ac.buyCount, ac.holdCount, ac.sellCount, ac.analystCount, upside ?? 0)
  const up = (t: number | null) => (t != null && price != null && price > 0 ? (t / price - 1) * 100 : null)

  // Dynamic "Average Analyst Target" — the mean of the valid (numeric, > 0)
  // targets across every dated broker call on the table below. Blank / null /
  // non-numeric / NA / stale placeholder values are excluded, and it recomputes
  // automatically whenever the broker rows change. An additional, transparent
  // summary — never a replacement, and it never breaks if some rows are incomplete.
  const validTargets = reports
    .map((r) => r.targetPrice)
    .filter((t): t is number => typeof t === 'number' && Number.isFinite(t) && t > 0)
  const avgTarget = validTargets.length ? Math.round(validTargets.reduce((a, b) => a + b, 0) / validTargets.length) : null
  const avgUpside = avgTarget != null && price != null && price > 0 ? (avgTarget / price - 1) * 100 : null
  // Only show the "Key view" column when at least one row carries a thesis — the
  // dated audit calls don't, so an empty column would read as missing data.
  const hasThesis = reports.some((r) => (r.thesis ?? '').trim().length > 0)
  // Latest analyst view — the newest dated broker note (reports are newest-first);
  // shown in the consolidated summary strip. Hidden cleanly if none are dated.
  const latestDate = reports.find((r) => (r.reportDate ?? '').trim().length > 0)?.reportDate ?? null

  return (
    <div className="space-y-5">
      {/* Standalone (non-embedded) hero + signal gauge. Inside Valuation the
          decision layer above already carries the verdict, price, target and the
          signal — so the embedded view skips straight to the analyst evidence and
          never repeats those numbers. */}
      {!embedded && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
          <HeroBanner
            company={company.shortName}
            subtitle="Price, targets and momentum as the market sees them today."
            kind={kind}
            right={
              <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
                <div><p className="text-[9px] font-semibold uppercase tracking-wide text-ink-secondary">Current price</p><p className="font-display text-[20px] leading-none text-navy-deep tabular-nums">{px(price)}</p></div>
                <div><p className="text-[9px] font-semibold uppercase tracking-wide text-ink-secondary">Consensus</p><p className="font-display text-[20px] leading-none tabular-nums" style={{ color: NAVY }}>{px(target)}</p></div>
                <div><p className="text-[9px] font-semibold uppercase tracking-wide text-ink-secondary">Upside</p><p className="font-display text-[20px] leading-none tabular-nums" style={{ color: upside == null ? SLATE : upside >= 0 ? TEAL : BURG }}>{upPct(upside)}</p></div>
              </div>
            }
            asOf={priceAsOf}
          />
          <SignalGauge kind={kind} score={score} buy={ac.buyCount} hold={ac.holdCount} sell={ac.sellCount} upside={upside} />
        </div>
      )}

      {/* ── Street View · Analyst Views — the consolidated analyst evidence: one
             summary strip (target · upside · Buy/Hold/Sell · latest) + every dated
             broker call, in one clean table. ────────────────────────────────── */}
      <div className="card-surface p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <PanelHead title={embedded ? 'Street View · Analyst Views' : 'All Analyst Views'} note="Every dated broker call on record — newest first, each with a live source." />
          {isFocal ? (
            <SourceTag {...srcTag('niva-consensus')} />
          ) : (
            <SourceTag source="Broker research" period={ac.lastUpdated} confidence="medium" audit={{ company: company.id, metric: 'Analyst consensus' }} provenance={{ source_name: 'Dated broker reports (rating + target + price-at-reco) via the Trendlyne research aggregator.', source_url: reports.find((r) => r.sourceUrl)?.sourceUrl ?? '', fetched_at: '' }} />
          )}
        </div>

        {/* Consolidated summary strip — average target, upside vs current, the
            Buy/Hold/Sell split and the latest dated view. Recalculates
            automatically as the broker rows change; any missing part hides. */}
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[#DCE6F4] bg-soft-blue/50 px-4 py-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-secondary">Average target</span>
            <span className="font-display text-[21px] leading-none tabular-nums text-navy-deep">{px(avgTarget)}</span>
            <span className="text-[11px] text-ink-secondary">
              {validTargets.length > 0 ? (
                <>· {validTargets.length} {validTargets.length === 1 ? 'report' : 'reports'}</>
              ) : (
                'no numeric targets yet'
              )}
            </span>
          </div>
          {avgUpside != null && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-secondary">Upside vs current</span>
              <span className="font-display text-[16px] leading-none tabular-nums" style={{ color: avgUpside >= 0 ? TEAL : BURG }}>{upPct(avgUpside)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {([['Buy', ac.buyCount], ['Hold', ac.holdCount], ['Sell', ac.sellCount]] as const).map(([r, c]) => (
              <span key={r} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: ratingTone[r].fg, background: ratingTone[r].bg }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: ratingTone[r].fg }} />{c} {r}
              </span>
            ))}
          </div>
          {latestDate && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-secondary">Latest</span>
              <span className="text-[12px] font-semibold text-navy-deep">{latestDate}</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-[11.5px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-navy-primary/80">
                <th className="rounded-l-lg border-y border-l border-[#DCE6F4] bg-[#EBF1FB] py-2.5 pl-3 pr-3 font-semibold">Analyst / Broker</th>
                <th className="border-y border-[#DCE6F4] bg-[#EBF1FB] py-2.5 pr-3 font-semibold">Rating</th>
                <th className="border-y border-[#DCE6F4] bg-[#EBF1FB] py-2.5 pr-3 text-right font-semibold">Target</th>
                <th className="border-y border-[#DCE6F4] bg-[#EBF1FB] py-2.5 pr-3 text-right font-semibold">Upside</th>
                <th className="border-y border-[#DCE6F4] bg-[#EBF1FB] py-2.5 pr-3 font-semibold">Date</th>
                {hasThesis && <th className="border-y border-[#DCE6F4] bg-[#EBF1FB] py-2.5 pr-3 font-semibold">Key view</th>}
                <th className="border-y border-[#DCE6F4] bg-[#EBF1FB] py-2.5 pr-3 font-semibold">Source</th>
                <th className="rounded-r-lg border-y border-r border-[#DCE6F4] bg-[#EBF1FB] py-2.5 pr-3 font-semibold">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r, i) => {
                const u = up(r.targetPrice)
                return (
                  <tr key={`${r.brokerage}-${r.reportDate}-${i}`} className="align-top transition-colors duration-200 hover:bg-[#F4F8FE]">
                    <td className="border-b border-[#EEF1F7] py-2.5 pl-3 pr-3 font-semibold text-navy-deep">{r.brokerage}</td>
                    <td className="border-b border-[#EEF1F7] py-2.5 pr-3">
                      {r.rating ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-semibold" style={{ color: ratingTone[r.rating].fg, background: ratingTone[r.rating].bg }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: ratingTone[r.rating].fg }} />{r.rating}</span>
                      ) : (
                        <span className="text-ink-secondary/40">—</span>
                      )}
                    </td>
                    <td className="border-b border-[#EEF1F7] py-2.5 pr-3 text-right font-semibold tabular-nums text-navy-deep">{r.targetPrice != null ? px(r.targetPrice) : <span className="text-ink-secondary/40">—</span>}</td>
                    <td className="border-b border-[#EEF1F7] py-2.5 pr-3 text-right font-semibold tabular-nums" style={{ color: u == null ? '#A6AEBC' : u >= 0 ? TEAL : BURG }}>{u == null ? '—' : upPct(u)}</td>
                    <td className="whitespace-nowrap border-b border-[#EEF1F7] py-2.5 pr-3 text-ink-secondary">{r.reportDate}</td>
                    {hasThesis && <td className="border-b border-[#EEF1F7] py-2.5 pr-3 text-ink-secondary">{r.thesis}</td>}
                    <td className="border-b border-[#EEF1F7] py-2.5 pr-3"><OpenSource id={r.sourceId} url={r.sourceUrl} /></td>
                    <td className="border-b border-[#EEF1F7] py-2.5 pr-3"><ValPill c={r.confidence} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10.5px] text-ink-secondary">
          {reports.length} broker {reports.length === 1 ? 'call' : 'calls'} on record for {company.shortName} — every dated note we hold; the consensus above reflects each broker’s latest view. Targets are sourced, never invented.
        </p>
      </div>
    </div>
  )
}

// ── Hero banner — soft mist-blue, calm market-line ambiance ──────────────────
function HeroBanner({ company, subtitle, kind, right, asOf }: { company: string; subtitle: string; kind: SignalKind; right: React.ReactNode; asOf?: string }) {
  return (
    <header className="relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-card" style={{ background: `linear-gradient(135deg, ${TINT.mist.from} 0%, ${TINT.mist.to} 100%)`, borderColor: TINT.mist.ring }}>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#B68B3A]/45 to-transparent" />
      {/* calm market-line + soft glows */}
      <svg aria-hidden viewBox="0 0 320 90" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full opacity-[0.5]">
        <defs>
          <linearGradient id="heroLine" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SIGNAL_TONE[kind]} stopOpacity="0.18" /><stop offset="100%" stopColor={SIGNAL_TONE[kind]} stopOpacity="0" /></linearGradient>
        </defs>
        <path d={`${heroPath(kind)} L320,90 L0,90 Z`} fill="url(#heroLine)" />
        <path d={heroPath(kind)} fill="none" stroke={SIGNAL_TONE[kind]} strokeOpacity="0.4" strokeWidth="1.5" />
      </svg>
      <span aria-hidden className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full opacity-50 blur-3xl" style={{ background: 'rgba(39,69,126,0.10)' }} />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-md" style={{ background: 'rgba(182,139,58,0.14)', color: GOLD }}><Activity className="h-3 w-3" /></span>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-champagne-deep">The live market read</p>
        </div>
        <h2 className="mt-1.5 font-display text-[24px] leading-tight text-navy-deep">{company}</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-secondary">{subtitle}{asOf ? <span className="text-ink-secondary/70"> · as of {asOf}</span> : null}</p>
      </div>
      {right && <div className="relative mt-4">{right}</div>}
    </header>
  )
}

// Compact premium panel header — thin gold tick + eyebrow + optional note.
function PanelHead({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-[3px] rounded-full bg-gradient-to-b from-champagne to-champagne-deep" />
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-champagne-deep">{title}</p>
      </div>
      {note && <p className="mt-1 pl-[11px] text-[11.5px] text-ink-secondary">{note}</p>}
    </div>
  )
}
