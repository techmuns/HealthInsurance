// ---------------------------------------------------------------------------
//  Insight Engine — ASSEMBLY.
//
//  Findings + narration → the Insight contract the UI reads, PLUS the engine's
//  own Signal payload so the existing fail-closed gates (grounding firewall in
//  validate.ts, arithmetic/direction audit in audit.ts) verify every card
//  against real signal data. The engine never bypasses the gates — it feeds
//  them.
//
//  Tiering is earned, not asserted: score → tier/conviction, and the score is
//  built from magnitude, materiality, persistence and recency (detect.ts).
// ---------------------------------------------------------------------------

import type {
  Insight, InsightsFile, Lens, LensBlock, MethodDescriptor, Methodology, Signal, SignalRun,
} from '@/insights/types'
import { signalHash, runAllSignals } from '@/insights/signals'
import { buildPanel } from '@/insights/panel'
import { buildMarketPanel, type MarketPanel } from './marketPanel'
import { runDetectors, type Finding, type RunOptions } from './detect'
import { narrateFinding } from './narrate'

const LENS_ORDER: Lens[] = ['fundamental', 'technical', 'sentiment', 'macro']

// ── signals ──────────────────────────────────────────────────────────────────

/** Every number a finding's card may cite, emitted as signals so the grounding
 *  firewall can verify the prose against them. One signal per evidence row plus
 *  one context signal whose note enumerates every slot and method figure. */
export function signalsForFinding(f: Finding): Signal[] {
  const out: Signal[] = f.evidence.map((e) => ({
    family: `engine_${f.detector}`,
    insurer: e.insurer,
    period: e.period,
    metric: e.metric,
    value: e.value,
    unit: e.unit,
    layers: [e.layer],
    dataGap: false,
    note: e.context,
  }))
  const nums = new Set<number>()
  for (const v of Object.values(f.v)) if (Number.isFinite(v)) nums.add(v)
  for (const m of f.method) {
    for (const i of m.inputs) nums.add(i.value)
    nums.add(m.statistic.value)
    if (m.threshold) nums.add(m.threshold.value)
  }
  out.push({
    family: `engine_${f.detector}`,
    insurer: f.evidence[0]?.insurer ?? 'panel',
    period: f.period,
    metric: `${f.detector} — computation context`,
    value: null,
    unit: '',
    layers: ['derived'],
    dataGap: false,
    note: `figures: ${[...nums].map((n) => String(n)).join(' · ')}`,
  })
  return out
}

/** The combined signal run: the legacy annual battery plus the engine's own
 *  payload. The gates and the AI writer both see one coherent run. */
export function runEngineSignals(findings: Finding[], panel?: MarketPanel): SignalRun {
  const p = panel ?? buildMarketPanel()
  const legacy = runAllSignals(buildPanel())
  const engine = findings.flatMap(signalsForFinding)
  return { asOf: p.asOf, signals: [...legacy.signals, ...engine], coverage: legacy.coverage }
}

// ── methodology ──────────────────────────────────────────────────────────────

function lensesFor(steps: MethodDescriptor[], f: Finding, listed: Set<string>): Record<Lens, LensBlock> {
  const out = {} as Record<Lens, LensBlock>
  const anyListed = f.insurers.length === 0 || f.insurers.some((id) => listed.has(id))
  for (const lens of LENS_ORDER) {
    const stepKeys = steps.filter((s) => s.lens === lens).map((s) => s.key)
    if (stepKeys.length) { out[lens] = { status: 'populated', stepKeys }; continue }
    if (lens === 'technical') {
      out[lens] = anyListed
        ? { status: 'no_signal', stepKeys: [] }
        : { status: 'not_applicable', reason: 'Unlisted — no market price/volume.', stepKeys: [] }
      continue
    }
    out[lens] = { status: 'no_signal', stepKeys: [] }
  }
  return out
}

function methodologyFor(f: Finding, listed: Set<string>, computedAt: string): Methodology {
  const steps: MethodDescriptor[] = f.method.map((m) => ({
    key: m.key, lens: m.lens, name: m.name, refTag: m.refTag, gloss: m.gloss,
    formulaTeX: m.formulaTeX, instanceTeX: m.instanceTeX,
    inputs: m.inputs.map((i) => ({ symbol: i.symbol, label: i.label, value: i.value, unit: i.unit, insurer: i.insurer, period: i.period, layer: i.layer })),
    statistic: m.statistic,
    threshold: m.threshold,
    robustness: m.robustness,
  }))
  return {
    steps,
    lenses: lensesFor(steps, f, listed),
    payloadHash: signalHash(signalsForFinding(f)),
    computedAt,
    isQuantitative: steps.length > 0,
  }
}

// ── tiering ──────────────────────────────────────────────────────────────────

const tierOf = (score: number): NonNullable<Insight['tier']> => (score >= 95 ? 'goldmine' : score >= 68 ? 'supporting' : 'context')
const convictionOf = (score: number): Insight['conviction'] => (score >= 90 ? 'high' : score >= 65 ? 'medium' : 'low')
const horizonOf = (f: Finding): Insight['horizon'] =>
  f.detector === 'valuation_dislocation' || f.detector === 'industry_tide' || f.detector === 'basis_divergence' ? 'medium'
    : f.cadence === 'annual' ? 'medium' : 'near'

// ── assembly ─────────────────────────────────────────────────────────────────

export function assembleInsight(f: Finding, rank: number, listed: Set<string>, computedAt: string): Insight {
  const copy = narrateFinding(f)
  return {
    id: f.id,
    rank,
    category: f.category,
    headline: copy.headline,
    shortHeadline: copy.shortHeadline,
    summary: copy.summary,
    thesis: copy.thesis,
    whatConsensusMisses: copy.whatConsensusMisses,
    tier: tierOf(f.score),
    consensusView: copy.consensusView,
    variantBasis: copy.variantBasis,
    steelman: copy.steelman,
    evidence: f.evidence.map((e) => ({
      insurer: e.insurer, metric: e.metric, value: e.value, unit: e.unit, context: e.context, layers: [e.layer], period: e.period,
    })),
    conviction: convictionOf(f.score),
    horizon: horizonOf(f),
    falsifier: copy.falsifier,
    affectedInsurers: f.insurers,
    chart: f.chart,
    sourceNote: f.sourceNote,
    period: f.period,
    cadence: f.cadence,
    keyMove: copy.keyMove,
    methodology: methodologyFor(f, listed, computedAt),
    application: copy.application,
    watch: copy.watch,
  }
}

export interface EngineRun {
  file: InsightsFile
  run: SignalRun
  findings: Finding[]
}

/** One deterministic pass: detect → narrate → assemble → stamp. The caller
 *  (scripts/insights/generate-engine.ts) runs the fail-closed gates and writes. */
export function runEngine(opts: RunOptions = {}, generatedAt?: string): EngineRun {
  const panel = buildMarketPanel()
  const findings = runDetectors(panel, opts)
  const run = runEngineSignals(findings, panel)
  const computedAt = generatedAt ?? new Date().toISOString()

  // rank: score descending; ties by recency of period then id for stability.
  const ranked = [...findings].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const rankOf = new Map(ranked.map((f, i) => [f.id, i + 1]))
  const insights = findings
    .map((f) => assembleInsight(f, rankOf.get(f.id)!, panel.listed, computedAt))
    .sort((a, b) => a.rank - b.rank)

  const file: InsightsFile = {
    meta: {
      generatedAt: computedAt,
      dataAsOf: panel.asOf,
      model: 'insight-engine v2 — deterministic detector battery (no AI, no key; quarterly + monthly + annual)',
      signalsComputed: run.signals.length,
      signalHash: signalHash(run.signals),
      coverage: run.coverage,
    },
    insights,
  }
  return { file, run, findings }
}
