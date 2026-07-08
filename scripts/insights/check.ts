// ---------------------------------------------------------------------------
//  Insights — the fail-closed CHECK harness (npm run insights:check).
//
//  Verifies the committed insights feed against a FRESH engine run:
//   §1  the committed file passes the grounding firewall against live signals
//   §2  the committed file passes the arithmetic / direction / uniqueness audit
//   §3  the engine is deterministic — two runs, same stamp, identical output
//   §4  honesty invariants — no invented periods, no comma-fragment grounding
//       holes, methodology present and quantitative on every card
//   §5  adversarial — deliberately corrupted cards MUST be rejected
//
//  Exit 1 on any failure; CI runs this after regeneration and before commit.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs'
import { runEngine, runEngineSignals } from '@/insights/engine/assemble'
import { runDetectors, keyOfPeriod } from '@/insights/engine/detect'
import { buildMarketPanel } from '@/insights/engine/marketPanel'
import { validateInsightsFile } from '@/insights/validate'
import { auditInsights } from '@/insights/audit'
import { numbersIn } from '@/insights/grounding'
import type { InsightsFile } from '@/insights/types'

const FILE = 'src/data/insights.generated.json'
let failures = 0
const ok = (name: string) => console.log(`  ✓ ${name}`)
const fail = (name: string, detail?: string) => {
  failures++
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
}
const assert = (cond: boolean, name: string, detail?: string) => (cond ? ok(name) : fail(name, detail))

function main(): number {
  const committed = JSON.parse(readFileSync(FILE, 'utf8')) as InsightsFile
  const panel = buildMarketPanel()
  const findings = runDetectors(panel)
  const run = runEngineSignals(findings, panel)

  console.log('§1 grounding firewall (committed file vs live signals)')
  const v = validateInsightsFile(committed, run)
  assert(v.ok, `every number in ${committed.insights.length} committed cards traces to a live signal`, v.errors.slice(0, 5).join(' | '))

  console.log('§2 arithmetic / direction / uniqueness audit')
  const a = auditInsights(committed)
  assert(a.ok, 'every statistic recomputes and every direction claim matches its math', a.errors.slice(0, 5).join(' | '))

  console.log('§3 determinism')
  const stamp = '2026-01-01T00:00:00.000Z'
  const r1 = runEngine({}, stamp)
  const r2 = runEngine({}, stamp)
  assert(r1.file.meta.signalHash === r2.file.meta.signalHash, 'two engine runs produce the same signal hash')
  assert(JSON.stringify(r1.file.insights) === JSON.stringify(r2.file.insights), 'two engine runs produce byte-identical insights')
  assert(r1.findings.length >= 30, `the battery finds a healthy feed (${r1.findings.length} findings ≥ 30)`)
  const dets = new Set(r1.findings.map((f) => f.detector))
  assert(dets.size >= 8, `detector diversity (${dets.size} families ≥ 8)`)

  console.log('§4 honesty invariants')
  // every period label is parseable, and every quarterly card cites a quarter
  // that actually exists in the panel data (never invented from annual figures)
  const badPeriod = committed.insights.filter((i) => !i.period || keyOfPeriod(i.period) < 0)
  assert(badPeriod.length === 0, 'every card carries a parseable became-observable period', badPeriod.map((i) => i.id).join(','))
  const knownQuarters = new Set(panel.entities.flatMap((e) => e.quarters.map((q) => q.period)))
  const inventedQ = committed.insights.filter(
    (i) => i.cadence === 'quarterly' && /^Q/.test(i.period ?? '') && !knownQuarters.has(i.period as string),
  )
  assert(inventedQ.length === 0, 'no quarterly card cites a quarter absent from the panel', [...new Set(inventedQ.map((i) => i.period))].join(','))
  const noMeth = committed.insights.filter((i) => !i.methodology || !i.methodology.isQuantitative || i.methodology.steps.length === 0)
  assert(noMeth.length === 0, 'every card carries a quantitative methodology (show the working)', noMeth.map((i) => i.id).join(','))
  const noWatch = committed.insights.filter((i) => !i.watch?.items.some((w) => w.direction === 'invalidates'))
  assert(noWatch.length === 0, 'every card watches its own falsifier')
  // comma-grouped figures parse as one number (firewall hardening regression test)
  const parsed = numbersIn('GWP of ₹1,08,911 cr and ₹4,286 cr')
  assert(parsed.length === 2 && parsed[0] === 108911 && parsed[1] === 4286, 'comma-grouped figures ground as whole numbers')

  console.log('§5 adversarial — corrupted cards must be rejected')
  const clone = (): InsightsFile => JSON.parse(JSON.stringify(committed))
  // 5a. a fabricated evidence value must fail grounding
  const c1 = clone()
  const withVal = c1.insights.find((i) => i.evidence.some((e) => e.value != null))
  if (withVal) {
    withVal.evidence.find((e) => e.value != null)!.value = 424242.42
    assert(!validateInsightsFile(c1, run).ok, 'a fabricated evidence value is rejected by the firewall')
  } else fail('a fabricated evidence value is rejected by the firewall', 'no evidence values in committed file')
  // 5b. an orphan number smuggled into prose must fail grounding
  const c2 = clone()
  c2.insights[0].summary += ' A stealth figure of 133713.7 appears here.'
  assert(!validateInsightsFile(c2, run).ok, 'an orphan number in prose is rejected by the firewall')
  // 5c. a doctored statistic must fail the arithmetic recompute
  const RECOMPUTABLE = ['yoy_growth', 'pp_delta', 'share_of', 'zscore', 'implied_roe', 'solvency_runway', 'window_return', 'dispersion_pct']
  const c3 = clone()
  const withStep = c3.insights.find((i) => i.methodology?.steps.some((s) => RECOMPUTABLE.includes(s.key)))
  if (withStep) {
    const step = withStep.methodology!.steps.find((s) => RECOMPUTABLE.includes(s.key))!
    step.statistic = { ...step.statistic, value: step.statistic.value + 25 }
    assert(!auditInsights(c3).ok, 'a doctored statistic is rejected by the arithmetic recompute')
  } else fail('a doctored statistic is rejected by the arithmetic recompute', 'no recomputable step found in committed file')
  // 5d. a missing falsifier must fail validation
  const c4 = clone()
  c4.insights[0].falsifier = ''
  assert(!validateInsightsFile(c4, run).ok, 'a card without a falsifier is rejected')

  console.log(failures === 0 ? `\nall checks pass (${committed.insights.length} cards, ${run.signals.length} signals)` : `\n${failures} CHECK(S) FAILED`)
  return failures === 0 ? 0 : 1
}

process.exit(main())
