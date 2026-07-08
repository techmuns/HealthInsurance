import { Info } from 'lucide-react'
import { insurers } from '@/data/mockData'
import { FOCAL_VALUATION_ID, marketSnapshot, peerValuation, type PeerValuationRow } from '@/data/valuationData'
import { getAnalystCoverage, getMarketQuote } from '@/lib/analystCoverage'
import { srcTag } from '@/data/valuationSources'
import { InsightContextChip } from '@/components/insight/InsightContextChip'
import { useSectionInsight } from '@/components/insight/useSectionInsight'
import { type SourceTagProps } from '@/components/SourceTag'
import type { Insurer } from '@/data/types'
import { CORAL, Eyebrow, GOLD, NAVY, TEAL, ValPill, fmtCr, px, ratingTone, upPct, xMult } from './valuationShared'
import { ValuationDecisionLayer, type DecisionData, type QualityLens } from './ValuationHero'
import { PeerValuationSection } from './PeerValuationMatrix'
import { StreetView } from './StreetView'
import { buildQuality } from './qualityCompass'

export function ValuationMarketView() {
  // The Valuation tab is a peer-WIDE comparison — it deliberately does NOT follow
  // the global company selector (hidden on this tab). The consolidated top read
  // anchors to the focal valuation name; the peer table's own row selection then
  // drives the snapshot + quality lens, and the Street View card owns its own
  // listed-company selector. So the global selection never leaks into this tab.
  const company = insurers.find((c) => c.id === FOCAL_VALUATION_ID) ?? insurers[0]
  const isFocal = company.id === FOCAL_VALUATION_ID
  const { focus, ref: focusRef, arrived } = useSectionInsight('valuation')

  // Operating-quality compass for the ACTIVE company — feeds the decision-layer
  // Quality Lens card. The peer section builds its own for the SELECTED row from
  // the same shared helper, so the two never disagree.
  const q = buildQuality(company)
  const quality: QualityLens = { verdict: q.verdict, tone: q.tone, peerGroup: company.peerGroup, drivers: q.drivers }

  // ── Decision-layer data — derived from the ACTIVE company's OWN live sources,
  //    so the three lens cards serve any listed name (Niva, Star, …) from its own
  //    data, never one company's numbers under another's label. A name with no
  //    live market price (the unlisted SAHIs) has no cheap/fair/expensive read, so
  //    it keeps the honest per-company pending path below. ─────────────────────
  const quote = getMarketQuote(company.id)
  const coverage = getAnalystCoverage(company.id)
  const peerRow = peerValuation.find((r) => r.companyId === company.id) ?? null
  const decisionPrice = isFocal ? marketSnapshot.currentPrice : quote?.price ?? null
  const listedWithPrice = decisionPrice != null && (peerRow?.listingStatus === 'Listed' || quote != null)

  const ac = coverage?.consensus
  const reports = coverage?.reports ?? []
  const decisionPGwp = peerRow?.pGwp ?? quote?.pGwp ?? null
  // Street fair value = the CONSENSUS (each covering broker's latest target),
  // used coherently across the whole decision band (fair value, upside, verdict
  // and the street signal), so the three cards never disagree. The evidence strip
  // below carries its own average-of-all-dated-calls, labelled as such.
  const fairValue = ac?.consensusTargetPrice ?? null
  const decisionUpside = fairValue != null && decisionPrice != null && decisionPrice > 0 ? (fairValue / decisionPrice - 1) * 100 : null
  const latestDate = reports.find((r) => (r.reportDate ?? '').trim().length > 0)?.reportDate ?? null

  // Benchmark = the largest listed peer that ISN'T this company (Niva ↔ Star today).
  const benchmark = peerValuation
    .filter((r) => r.companyId !== company.id && r.listingStatus === 'Listed' && r.pGwp != null && r.gwp != null)
    .sort((a, b) => (b.gwp ?? 0) - (a.gwp ?? 0))[0] ?? null
  const premiumVsBench = decisionPGwp != null && benchmark?.pGwp ? ((decisionPGwp - benchmark.pGwp) / benchmark.pGwp) * 100 : null

  const priceSource: SourceTagProps = isFocal
    ? srcTag('niva-price')
    : { source: 'Exchange', period: quote?.asOf ?? '—', confidence: 'medium', audit: { company: company.id, metric: 'Market price' }, provenance: { source_name: 'Daily listed-insurer market quote — price, market cap & multiples.', source_url: '', fetched_at: quote?.asOf ?? '' } }
  const consensusSource: SourceTagProps = isFocal
    ? srcTag('niva-consensus')
    : { source: 'Broker research', period: ac?.lastUpdated ?? '—', confidence: 'medium', audit: { company: company.id, metric: 'Analyst consensus' }, provenance: { source_name: 'Dated broker reports (rating + target) via the Trendlyne research aggregator.', source_url: reports.find((r) => r.sourceUrl)?.sourceUrl ?? '', fetched_at: '' } }

  const decisionData: DecisionData = {
    price: decisionPrice,
    fairValue,
    upside: decisionUpside,
    pGwp: decisionPGwp,
    benchmarkName: benchmark?.companyName ?? null,
    premiumVsBench,
    lo: isFocal ? marketSnapshot.weekLow52 : null,
    hi: isFocal ? marketSnapshot.weekHigh52 : null,
    priceSource,
    consensusSource,
    quality,
    street: {
      hasCoverage: !!coverage,
      buy: ac?.buyCount ?? 0,
      hold: ac?.holdCount ?? 0,
      sell: ac?.sellCount ?? 0,
      n: ac?.analystCount ?? 0,
      target: fairValue,
      signalUpside: decisionUpside,
      latestDate,
    },
  }

  return (
    <div ref={focusRef} className={`space-y-5 ${arrived ? 'insight-arrival rounded-2xl' : ''}`}>
      {focus && <InsightContextChip focus={focus} />}

      {/* ═══ 1 · TOP READ — the decision layer for a fully-covered listed name, or
               the honest per-company pending read for the rest. ═══════════════ */}
      {listedWithPrice ? (
        <ValuationDecisionLayer data={decisionData} />
      ) : (
        <ValuationPending company={company} peerRow={peerRow} />
      )}

      {/* ═══ 2 · PEER VALUATION & QUALITY — one always-visible split table (Shared ·
               Market Value · Book Value, no toggle); the selected row drives a peer
               snapshot + the quality lens. Peer-agnostic → works for every company. */}
      <PeerValuationSection defaultCompanyId={company.id} />

      {/* ═══ 3 · STREET VIEW · ANALYST VIEWS — the consolidated analyst evidence. */}
      <StreetView embedded />
    </div>
  )
}

// ── Per-company pending state ─────────────────────────────────────────────────
// Shown when the selected company is NOT the focal listed name. We never render
// the focal company's price / targets / multiples under another company's label.
function ValuationPending({ company, peerRow }: { company: Insurer; peerRow: PeerValuationRow | null }) {
  const quote = getMarketQuote(company.id)
  const coverage = getAnalystCoverage(company.id)
  const listed = peerRow?.listingStatus === 'Listed' || quote != null
  // P/GWP prefers the curated FY26 basis (peer table) for cross-tab consistency;
  // P/E, P/B, price, market cap come from the daily valuation feed.
  const pGwp = peerRow?.pGwp ?? quote?.pGwp ?? null
  const ac = coverage?.consensus
  const target = ac?.consensusTargetPrice ?? null
  const price = quote?.price ?? ac?.currentPrice ?? null
  const upside = target != null && price ? (target / price - 1) * 100 : null
  const hasMultiples = pGwp != null || quote?.pe != null || quote?.pb != null
  const hasReal = hasMultiples || ac != null

  return (
    <section className="relative overflow-hidden rounded-[1.4rem] border border-[#E4E8F0] bg-gradient-to-br from-[#F7FAFD] via-[#FBFCFD] to-[#F4F7FB] p-6 shadow-[0_2px_4px_rgba(23,43,77,0.04),0_18px_44px_rgba(23,43,77,0.08)]">
      <Eyebrow
        label="Valuation"
        title={hasReal ? `${company.shortName} · market valuation` : `Sourced valuation pending for ${company.shortName}`}
        note={hasReal
          ? 'Live multiples & analyst consensus from the market feed. The curated narrative (verdict, since-listing path, thesis) stays with the focal name.'
          : 'Live, source-backed valuation is wired for the listed names with coverage — never shown under another company’s label.'}
        right={<ValPill c={hasReal ? 'secondary' : 'pending'} />}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1fr]">
        <div className="card-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-secondary">What we have for {company.shortName}</p>
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${listed ? 'bg-soft-blue text-navy-primary' : 'border border-dashed border-[#C9CFD9] text-ink-secondary'}`}>{listed ? 'Listed' : 'Unlisted'}</span>
          </div>
          {hasReal ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Tile k="Current price" v={px(price)} sub={quote?.asOf ?? '—'} />
                <Tile k="Market cap" v={fmtCr(quote?.marketCap ?? null)} sub="latest" />
                <Tile k="P / GWP" v={xMult(pGwp)} sub={peerRow?.gwpFy ?? 'FY26'} tone="amber" />
                <Tile k="P / E" v={xMult(quote?.pe ?? null, 1)} sub="TTM" />
                <Tile k="P / B" v={xMult(quote?.pb ?? null, 1)} sub="latest" />
                {ac != null && (
                  <Tile k="Cons. target" v={px(target)} sub={`${ac.analystCount} analysts`} tone={upside == null ? 'navy' : upside >= 0 ? 'teal' : 'red'} />
                )}
              </div>
              {ac != null && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ice px-2.5 py-1 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: ratingTone[ac.ratingLabel]?.fg ?? NAVY }} />
                  {ac.ratingLabel}-skewed · {ac.buyCount} Buy · {ac.holdCount} Hold · {ac.sellCount} Sell · {upPct(upside)} to consensus
                </p>
              )}
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-secondary">
                {company.shortName}&rsquo;s market multiples{ac != null ? ' and analyst consensus are' : ' are'} sourced live. The full curated story — the verdict, since-listing path and bull/bear thesis — is authored for the focal name today.
              </p>
            </>
          ) : (
            <p className="mt-3 text-[12px] leading-relaxed text-ink-secondary">
              {listed
                ? `${company.shortName} is listed — market multiples will populate here once its price feed is sourced.`
                : `${company.shortName} is unlisted: there is no public market price, so we don't publish an equity value. Marked source pending — never estimated.`}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-dashed border-[#D7CBA8] bg-[#FBF6EA]/60 p-5 text-[#8C6B1A]">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]">Coverage</p>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed">
            Live multiples are sourced for the listed insurers (Niva Bupa, Star Health, ICICI Lombard, Go Digit); analyst consensus for the names brokers cover. The fully curated valuation narrative is authored for <b>Niva Bupa (NSE: NIVABUPA)</b>. We never display one company&rsquo;s numbers under another&rsquo;s name.
          </p>
          <p className="mt-2 text-[10.5px] leading-relaxed opacity-90">
            The peer comparison &amp; operating-quality view below is computed from {company.shortName}&rsquo;s own reported metrics, so it stays meaningful for every company.
          </p>
        </div>
      </div>
    </section>
  )
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Tile({ k, v, sub, tone = 'navy' }: { k: string; v: string; sub?: string; tone?: 'navy' | 'teal' | 'amber' | 'red' }) {
  // Tone-coded tint + accent so each metric reads by meaning at a glance
  // (navy = price, teal = upside, amber = multiple, coral = downside).
  const t =
    tone === 'teal' ? { text: 'text-teal', bar: TEAL, bg: 'linear-gradient(135deg,#FFFFFF 0%, rgba(22,142,142,0.07) 100%)', border: 'rgba(22,142,142,0.20)' }
    : tone === 'red' ? { text: 'text-signal-negative', bar: CORAL, bg: 'linear-gradient(135deg,#FFFFFF 0%, rgba(194,118,107,0.07) 100%)', border: 'rgba(194,118,107,0.22)' }
    : tone === 'amber' ? { text: 'text-champagne-deep', bar: GOLD, bg: 'linear-gradient(135deg,#FFFFFF 0%, rgba(182,139,58,0.08) 100%)', border: 'rgba(182,139,58,0.22)' }
    : { text: 'text-navy-deep', bar: NAVY, bg: 'linear-gradient(135deg,#FFFFFF 0%, rgba(39,69,126,0.06) 100%)', border: 'rgba(39,69,126,0.16)' }
  return (
    <div className="hover-lift relative overflow-hidden rounded-xl border px-2.5 py-2 shadow-soft" style={{ background: t.bg, borderColor: t.border }}>
      <span className="absolute inset-y-0 left-0 w-[2.5px]" style={{ background: t.bar }} aria-hidden />
      <p className="whitespace-nowrap pl-1 text-[8.5px] font-semibold uppercase text-ink-secondary">{k}</p>
      <p className={`mt-0.5 pl-1 font-display text-[16px] leading-none ${t.text}`}>{v}</p>
      {sub && <p className="mt-0.5 pl-1 text-[8.5px] text-ink-secondary/80">{sub}</p>}
    </div>
  )
}
