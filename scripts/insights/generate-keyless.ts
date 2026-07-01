// ---------------------------------------------------------------------------
//  Insights generation — the KEYLESS / DETERMINISTIC synthesis layer.
//
//  A no-API fallback for the Anthropic writer (scripts/generate-insights.ts).
//  It keeps the Insights feed NUMERICALLY FRESH and honest with ZERO secret:
//  every card's numbers are re-read from the live signals on each run and the
//  front-facing prose is re-narrated from those grounded numbers with fixed
//  templates. It does NOT try to reproduce the AI writer's variant-perception
//  prose — the wording is plainer by design (Neha, keyless-fallback decision) —
//  but it is always current, always source-backed, and passes the SAME firewall
//  (grounding + arithmetic/direction audit) as the AI path.
//
//  How it stays honest:
//   • Card IDENTITY (id / category / affected names / chart / evidence metrics)
//     is preserved from the committed skeleton — so the deterministic
//     methodology (methods.ts) re-links and the ID-specific checks still hold.
//   • Each evidence VALUE is refreshed from the matching live signal (or set to
//     null — an honest gap — if the signal is gone). Missing ≠ 0.
//   • Every number that appears in prose is a refreshed evidence value or an
//     allowed structural constant (100, 1.5, 150, 12, small ints) — so the
//     grounding validator passes by construction.
//   • The methodology "show the working" back is assembled by methods.ts from
//     the refreshed evidence, exactly as in the AI path.
//
//  Run:  npm run insights:generate:keyless
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs'
import { buildPanel } from '@/insights/panel'
import { runAllSignals, signalHash } from '@/insights/signals'
import { validateInsightsFile } from '@/insights/validate'
import { auditInsights } from '@/insights/audit'
import { assembleMethodology } from '@/insights/methods'
import type { Application, Insight, InsightEvidence, InsightsFile, Signal, SignalRun, Watch } from '@/insights/types'

const OUT = 'src/data/insights.generated.json'

// ── number formatting — identical rounding to methods.ts so front === back ────
const fmt = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return 'n/a'
  const r = Math.round(n * 100) / 100
  return String(r)
}
const abs = (n: number | null | undefined): string => (n == null ? 'n/a' : fmt(Math.abs(n)))

// ── live-signal lookup (exact metric first, then normalized contains) ─────────
const normMetric = (m: string) => m.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
function findSignal(run: SignalRun, insurer: string, metric: string, period?: string): Signal | undefined {
  const cands = run.signals.filter((s) => !s.dataGap && s.value != null && s.insurer === insurer)
  const exact = cands.filter((s) => s.metric === metric)
  const pool = exact.length ? exact : cands.filter((s) => {
    const a = normMetric(s.metric), b = normMetric(metric)
    return a === b || a.includes(b) || b.includes(a)
  })
  if (!pool.length) return undefined
  return pool.find((s) => s.period === period) ?? pool[0]
}

/** Refresh one evidence row's value + period from the live signal (null = honest gap). */
function refreshEvidence(ev: InsightEvidence, run: SignalRun): InsightEvidence {
  const s = findSignal(run, ev.insurer, ev.metric, ev.period)
  if (!s) return { ...ev, value: null }
  return { ...ev, value: s.value, period: s.period }
}

// ── prose narration, per card id ──────────────────────────────────────────────
// Every narrator receives a getter `v(insurer, metricSubstr)` returning the
// refreshed numeric value, and `p(insurer, metricSubstr)` the period label. It
// returns the front fields; ONLY refreshed values + allowed constants appear.

interface Ctx {
  v: (insurer: string, metricSub: string) => number | null
  p: (insurer: string, metricSub: string) => string
  ev: InsightEvidence[]
}
type FrontFields = Pick<Insight,
  'headline' | 'shortHeadline' | 'summary' | 'thesis' | 'whatConsensusMisses' | 'sourceNote' | 'falsifier'
  | 'tier' | 'consensusView' | 'variantBasis' | 'steelman' | 'application' | 'watch'>

const inv = (trigger: string, condition: string): Watch['items'][number] => ({ trigger, condition, direction: 'invalidates' })
const conf = (trigger: string, condition: string): Watch['items'][number] => ({ trigger, condition, direction: 'confirms' })
const app = (framing: string, uses: Application['uses']): Application => ({ framing, uses })

const NARRATORS: Record<string, (c: Ctx) => FrontFields> = {
  'care-solvency-runway': ({ v }) => {
    const sol = v('care-health', 'Solvency ratio')
    const careH = v('care-health', 'Raise-pressure')
    const nivaH = v('niva-bupa', 'Raise-pressure')
    const starH = v('star-health', 'Raise-pressure')
    return {
      tier: 'supporting',
      shortHeadline: 'Care is closest to a capital raise',
      headline: "Care Health has the panel's shortest solvency runway — a capital raise looks nearest here",
      summary: `At ${fmt(sol)}x solvency — only just above the 1.5x regulatory floor — Care's headroom erodes fastest as it keeps compounding premium. Its runway to a forced raise is about ${fmt(careH)} years, versus roughly ${fmt(nivaH)} for Niva and ${fmt(starH)} for Star.`,
      thesis: `Care runs solvency at ${fmt(sol)}x, just above the 150% control floor, while growing premium fast. On that growth the cushion reaches the floor in about ${fmt(careH)} years — far sooner than Niva (~${fmt(nivaH)}) or Star (~${fmt(starH)}). Of the panel, Care has the least room before a capital action is forced.`,
      whatConsensusMisses: `"Above the floor" reads as safe, but growth-adjusted, Care's runway is the thinnest in the panel — the dilution / raise catalyst is near-term and concrete, not a tail risk.`,
      consensusView: 'A solvency ratio above the 1.5x floor is read as comfortably capitalised.',
      variantBasis: 'Level ignores growth: aged forward at the current premium-growth rate, Care hits the floor first.',
      sourceNote: 'Solvency ratios are statutory filings; the raise-pressure horizon is a derived heuristic (headroom eroded at the trailing GWP growth rate), not a company forecast.',
      falsifier: 'Care raises equity, or its premium growth slows sharply, restoring a multi-year solvency runway.',
      application: app('A capital / dilution-risk read on the focal name.', [
        { angle: 'Catalyst', detail: 'Size the dilution risk from a near-term equity raise against the runway.' },
        { angle: 'Relative value', detail: 'Rank the panel by growth-adjusted solvency runway, not the headline ratio.' },
        { angle: 'Risk flag', detail: 'Treat "above the floor" as necessary, not sufficient, once growth is fast.' },
      ]),
      watch: { items: [
        inv('Equity raise', `Care raises capital or growth slows below the pace that erodes the ${fmt(sol)}x cushion.`),
        conf('Solvency ratio', `Solvency drifts further toward the 1.5x floor at the next statutory print.`),
        conf('Premium growth', 'Premium keeps compounding at the pace that shortens the runway.'),
      ] },
    }
  },

  'segment-underwriting-loss': ({ v }) => {
    const star = v('star-health', 'Combined ratio')
    const man = v('manipalcigna', 'Combined ratio')
    const mean = v('panel', 'peer mean')
    return {
      tier: 'goldmine',
      shortHeadline: 'The whole cohort loses money underwriting',
      headline: 'Every SAHI in the panel runs a combined ratio above 100% — the core insurance book loses money sector-wide',
      summary: `All five names print a combined ratio over the 100% break-even, a peer mean near ${fmt(mean)}%. This is not one weak insurer — from Star at ${fmt(star)}% to ManipalCigna at ${fmt(man)}%, the entire cohort funds float at an underwriting loss. Where profit is reported, it is investment income carrying a loss-making book.`,
      thesis: `Combined ratios run from ~${fmt(star)}% to ~${fmt(man)}% across the panel, mean ~${fmt(mean)}% — every name above the 100% line. For short-tail health, an above-100 combined ratio means the underwriting line itself loses money; reported profit, where positive, is investment-led. The franchise question is whether scale can pull underwriting back below 100.`,
      whatConsensusMisses: 'A positive bottom line masks that the insurance operation itself is loss-making cohort-wide — the quality of earnings is investment income, not underwriting.',
      consensusView: 'Reported profits imply the health-insurance model is working.',
      variantBasis: 'At a combined ratio above 100, underwriting loses money; the profit is float invested well, not insurance earned.',
      sourceNote: 'Combined ratios are statutory disclosures; the peer mean is computed across the five panel names.',
      falsifier: 'One or more names drives its combined ratio below 100%, proving underwriting profit is reachable at current scale.',
      application: app('A cohort-wide earnings-quality read.', [
        { angle: 'Thesis test', detail: 'Separate investment income from underwriting result before crediting reported profit.' },
        { angle: 'Relative value', detail: `Rank names by distance from the 100% line, not by headline profit.` },
        { angle: 'Catalyst', detail: 'Watch for the first name to cross below 100% as the scale-economics proof point.' },
      ]),
      watch: { items: [
        inv('Combined ratio', 'Any panel name sustains a combined ratio below the 100% break-even.'),
        conf('Peer mean', `The panel mean holds above 100% at the next reporting season.`),
      ] },
    }
  },

  'niva-pb-roe-dislocation': ({ v }) => {
    const pb = v('niva-bupa', 'P/B vs warranted')
    const roe = v('niva-bupa', 'ROE')
    const nivaPgwp = v('niva-bupa', 'P/GWP')
    const starPgwp = v('star-health', 'P/GWP')
    return {
      tier: 'goldmine',
      shortHeadline: 'Niva prices a return it has yet to earn',
      headline: `Niva trades at ${fmt(pb)}x book on a single-digit ROE — the multiple prices an ROE ramp not yet delivered`,
      summary: `Niva carries a ${fmt(pb)}x price-to-book while delivering a ${fmt(roe)}% ROE. At a 12% cost of equity, that multiple only makes sense on a much higher steady-state return than the book currently earns. On premium, Niva's ${fmt(nivaPgwp)}x P/GWP sits above Star's ${fmt(starPgwp)}x — a richer multiple, not obviously faster growth.`,
      thesis: `A ${fmt(pb)}x book multiple against a ${fmt(roe)}% delivered ROE embeds a steep return-on-equity expansion. Underwriting is still loss-making and coverage is thin, so there is little margin for a slip in the ROE path the price already assumes. The premium multiple (${fmt(nivaPgwp)}x vs Star's ${fmt(starPgwp)}x) says the same thing from the top line.`,
      whatConsensusMisses: 'The multiple is a forward-ROE option: the price front-runs a return ramp the book has not yet delivered, on a still loss-making underwriting line.',
      consensusView: `A premium multiple is read as a quality premium the franchise has earned.`,
      variantBasis: `Reverse the price: ${fmt(pb)}x book implies a steady-state ROE well above the ${fmt(roe)}% delivered — the re-rating is priced, not proven.`,
      sourceNote: 'Market multiples are exchange-derived; ROE is a statutory disclosure; the warranted multiple assumes a 12% cost of equity.',
      falsifier: `Niva's ROE ramps toward the level the multiple implies, or the multiple de-rates toward the delivered return.`,
      application: app('A valuation / expectations read on the focal listed name.', [
        { angle: 'Expectations', detail: 'Compare the ROE the multiple implies against the delivered and guided path.' },
        { angle: 'Risk flag', detail: 'Underwriting loss + thin coverage = little margin for an ROE miss.' },
        { angle: 'Relative value', detail: `Cross-check the P/GWP multiple against Star before crediting the premium.` },
      ]),
      watch: { items: [
        inv('ROE', `Delivered ROE climbs toward the level the ${fmt(pb)}x multiple implies.`),
        conf('Combined ratio', 'Underwriting stays loss-making, keeping the implied ramp unproven.'),
        conf('P/GWP vs peers', `Niva's premium multiple stays richer than Star's without faster growth.`),
      ] },
    }
  },

  'niva-retail-mix-drift': ({ v }) => {
    const slope = v('niva-bupa', 'Retail-mix trend')
    const groupG = v('niva-bupa', 'Group health premium growth')
    return {
      tier: 'supporting',
      shortHeadline: 'Niva is drifting toward thinner group business',
      headline: `Niva's retail mix is trending down ~${abs(slope)}pp/yr — growth is leaning on lower-margin group business`,
      summary: `Niva's retail share of health premium is sliding about ${abs(slope)}pp a year while group premium grows ~${fmt(groupG)}%. Retail is the higher-margin, stickier book; a falling retail mix means the growth on show is coming from the thinner end.`,
      thesis: `The least-squares trend on Niva's retail mix is about ${fmt(slope)}pp/yr — a drift, not one noisy print — even as group premium compounds ~${fmt(groupG)}%. Peers hold flat-to-rising retail mixes. Growth only improves quality if retail outpaces group; here the mix is moving the wrong way.`,
      whatConsensusMisses: 'Headline premium growth looks healthy, but the mix underneath is shifting to lower-margin group business — quality of growth, not just its rate, is deteriorating.',
      consensusView: 'Strong headline premium growth is read as healthy franchise expansion.',
      variantBasis: 'Decompose it: the retail mix is falling, so the growth leans on thinner group business.',
      sourceNote: 'Retail-mix slope is fit over trailing GI-Council prints; growth rates are statutory disclosures.',
      falsifier: 'Niva\'s retail mix slope turns positive, or retail premium growth overtakes group.',
      application: app('A growth-quality read on the focal name.', [
        { angle: 'Thesis test', detail: 'Discount headline growth by the direction of the retail/group mix.' },
        { angle: 'Relative value', detail: 'Compare the mix slope against peers building retail share.' },
        { angle: 'Risk flag', detail: 'A falling retail mix pressures margins even as premium grows.' },
      ]),
      watch: { items: [
        inv('Retail-mix slope', 'The retail-mix trend turns positive, or retail growth overtakes group.'),
        conf('Group premium growth', `Group premium keeps outpacing retail, extending the mix drift.`),
      ] },
    }
  },

  'aditya-growth-quality': ({ v }) => {
    const retailG = v('aditya-birla', 'Retail health premium growth')
    const mix = v('aditya-birla', 'Retail mix')
    const cr = v('aditya-birla', 'Combined ratio')
    const sol = v('aditya-birla', 'Solvency ratio')
    return {
      tier: 'supporting',
      shortHeadline: 'Aditya Birla grows fast, still loses underwriting',
      headline: `Aditya Birla is compounding retail premium ~${fmt(retailG)}% — but underwriting still loses money at a ${fmt(cr)}% combined ratio`,
      summary: `Aditya Birla is growing retail health premium about ${fmt(retailG)}%, lifting its retail mix to ~${fmt(mix)}% — the higher-quality kind of growth. But the combined ratio is still ${fmt(cr)}%, above the 100% break-even, and solvency sits at ${fmt(sol)}x. The growth is real; the underwriting economics have not turned yet.`,
      thesis: `Retail premium up ~${fmt(retailG)}% and a retail mix near ${fmt(mix)}% is genuinely higher-quality growth. Yet at a ${fmt(cr)}% combined ratio the book still loses money underwriting, funded by a ${fmt(sol)}x solvency position. The question is whether scale pulls the combined ratio under 100 before capital is stretched.`,
      whatConsensusMisses: 'Fast retail growth reads as a winning story, but the underwriting line is still loss-making — growth is outrunning profitability, not proving it.',
      consensusView: 'Rapid retail premium growth is read as a clear franchise win.',
      variantBasis: 'Pair it with the combined ratio: the growth is real but underwriting still loses money at this scale.',
      sourceNote: 'Growth, mix, combined ratio and solvency are statutory disclosures for the focal name.',
      falsifier: 'Aditya Birla drives its combined ratio below 100% while holding retail growth, proving the model scales.',
      application: app('A growth-quality read on the focal name.', [
        { angle: 'Thesis test', detail: 'Credit fast growth only alongside the path of the combined ratio.' },
        { angle: 'Catalyst', detail: 'Watch for the combined ratio to cross below 100% at scale.' },
        { angle: 'Risk flag', detail: `Fast growth on a ${fmt(sol)}x solvency base can stretch capital.` },
      ]),
      watch: { items: [
        inv('Combined ratio', 'The combined ratio falls below the 100% break-even while growth holds.'),
        conf('Retail mix', `Retail mix keeps climbing on continued retail-premium growth.`),
      ] },
    }
  },

  'manipal-cr-outlier': ({ v }) => {
    const cr = v('manipalcigna', 'Combined ratio')
    const mean = v('panel', 'peer mean')
    const slope = v('manipalcigna', 'Retail-mix trend')
    return {
      tier: 'supporting',
      shortHeadline: 'ManipalCigna is the underwriting outlier',
      headline: `ManipalCigna's ${fmt(cr)}% combined ratio is a statistical outlier well above the ~${fmt(mean)}% peer mean`,
      summary: `ManipalCigna underwrites at a ${fmt(cr)}% combined ratio against a peer mean near ${fmt(mean)}% — far enough from the pack to register as a genuine outlier, not ordinary spread. Its retail mix is drifting ~${fmt(slope)}pp/yr, so the fix has to come from pricing and claims, not mix alone.`,
      thesis: `At ${fmt(cr)}% the combined ratio sits more than the empirical-rule threshold of peer standard deviations above the ~${fmt(mean)}% mean — a real outlier. With the retail mix moving only ~${fmt(slope)}pp/yr, closing the gap depends on underwriting discipline, not a mix tailwind. This is the panel's steepest climb back to break-even.`,
      whatConsensusMisses: 'A high combined ratio is easy to wave off as early-scale; the z-score says ManipalCigna is a true outlier, with the longest road back to underwriting break-even.',
      consensusView: 'A weak combined ratio is dismissed as a young book still scaling.',
      variantBasis: 'The z-score flags it as a genuine outlier — well beyond ordinary peer spread, not just early-stage noise.',
      sourceNote: 'Combined ratio and peer mean are statutory; the retail-mix slope is fit over trailing GI-Council prints.',
      falsifier: 'ManipalCigna narrows its combined ratio toward the peer mean, collapsing the outlier gap.',
      application: app('A quality / underwriting-discipline read on the focal name.', [
        { angle: 'Risk flag', detail: 'Treat the combined ratio as an outlier, not ordinary early-scale spread.' },
        { angle: 'Catalyst', detail: 'Watch the gap to the peer mean narrow as the proof of pricing action.' },
        { angle: 'Thesis test', detail: 'A slow mix shift means the fix must come from claims and pricing.' },
      ]),
      watch: { items: [
        inv('Combined ratio', `The combined ratio narrows toward the ~${fmt(mean)}% peer mean.`),
        conf('Peer gap', 'The outlier gap to the peer mean persists at the next print.'),
      ] },
    }
  },

  'niva-credibility-thin-coverage': ({ v }) => {
    const hit = v('niva-bupa', 'Guidance delivered')
    const upside = v('niva-bupa', 'Consensus upside')
    const disp = v('niva-bupa', 'Target dispersion')
    return {
      tier: 'supporting',
      shortHeadline: 'Niva delivers, yet few analysts watch',
      headline: `Niva has delivered ${fmt(hit)}% of tracked guidance with none missed — yet only a couple of analysts price it, in a tight ${fmt(disp)}% target band`,
      summary: `Management is keeping its word — a ${fmt(hit)}% guidance hit-rate with nothing missed. Yet coverage is thin and the target band is only ${fmt(disp)}% wide around a ${fmt(upside)}% consensus upside. That is light scrutiny for a name whose multiple already embeds a steep ROE ramp — a small surprise could move it more than the narrow band implies.`,
      thesis: `A ${fmt(hit)}% delivered-guidance rate with zero misses is a decent credibility record. But with only a handful of analysts and a tight ${fmt(disp)}% dispersion around ${fmt(upside)}% upside, the forward-ROE thesis is lightly stress-tested. Thin coverage plus a demanding multiple is a volatility set-up, either way.`,
      whatConsensusMisses: 'Management is executing, but shallow coverage means the market\'s forward-ROE thesis is barely tested — a modest surprise can move the stock more than the narrow consensus band implies.',
      consensusView: `A tight target band reads as analyst agreement and low risk.`,
      variantBasis: 'A tight band on very few analysts is thin scrutiny, not conviction — it magnifies surprise risk.',
      sourceNote: 'Guidance delivery is scored against audited statutory outcomes; consensus upside and dispersion are a broker/aggregator view, attributed as analyst opinion.',
      falsifier: 'Analyst coverage broadens materially, or a tracked guidance item flips to "missed".',
      application: app('A management-credibility / coverage read on the focal name.', [
        { angle: 'Thesis test', detail: 'Weight the guidance hit-rate against the thinness of coverage.' },
        { angle: 'Risk flag', detail: 'A tight band on few analysts magnifies surprise risk.' },
        { angle: 'Catalyst', detail: 'Watch for coverage to broaden as the thesis gets stress-tested.' },
      ]),
      watch: { items: [
        inv('Analyst coverage', 'Coverage broadens materially, or a guidance item flips to "missed".'),
        conf('Guidance delivery', `The delivered-guidance rate holds with no missed items.`),
      ] },
    }
  },
}

// ── assembly ──────────────────────────────────────────────────────────────────

function narrate(card: Insight, run: SignalRun): Insight {
  const evidence = card.evidence.map((e) => refreshEvidence(e, run))
  const v = (insurer: string, sub: string): number | null => {
    const e = evidence.find((x) => x.insurer === insurer && normMetric(x.metric).includes(normMetric(sub)))
    return e ? e.value : null
  }
  const p = (insurer: string, sub: string): string => {
    const e = evidence.find((x) => x.insurer === insurer && normMetric(x.metric).includes(normMetric(sub)))
    return e ? e.period : run.asOf
  }
  const narrator = NARRATORS[card.id]
  if (!narrator) throw new Error(`no keyless narrator for card ${card.id}`)
  const front = narrator({ v, p, ev: evidence })
  return {
    ...card,
    ...front,
    evidence,
    // methodology re-assembled from the refreshed evidence (deterministic).
    methodology: undefined,
  }
}

function main(): number {
  const run = runAllSignals(buildPanel())
  const generatedAt = new Date().toISOString()
  console.log(`signals: ${run.signals.length} · asOf ${run.asOf} · ${signalHash(run.signals)}`)

  const skeleton = JSON.parse(readFileSync(OUT, 'utf8')) as InsightsFile
  const insights: Insight[] = skeleton.insights
    .map((card) => narrate(card, run))
    .map((card) => ({ ...card, methodology: assembleMethodology(card, run, generatedAt) }))
    .sort((a, b) => a.rank - b.rank)

  const file: InsightsFile = {
    meta: {
      generatedAt,
      dataAsOf: run.asOf,
      model: 'deterministic-keyless (no-AI synthesis; plain templated prose, live numbers)',
      signalsComputed: run.signals.length,
      signalHash: signalHash(run.signals),
      coverage: run.coverage,
    },
    insights,
  }

  const val = validateInsightsFile(file, run)
  if (!val.ok) {
    console.error(`grounding/firewall failed (${val.errors.length}) — writing nothing:`)
    val.errors.forEach((e) => console.error('  · ' + e))
    return 1
  }
  const audit = auditInsights(file)
  if (!audit.ok) {
    console.error('correctness gate failed (arithmetic / direction / uniqueness) — writing nothing:')
    audit.errors.forEach((e) => console.error('  · ' + e))
    return 1
  }
  writeFileSync(OUT, JSON.stringify(file, null, 2) + '\n')
  console.log(`wrote ${OUT}: ${insights.length} insights (deterministic keyless)`)
  return 0
}

process.exit(main())
