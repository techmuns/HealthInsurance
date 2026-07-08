// ---------------------------------------------------------------------------
//  Insights generation — the ENGINE path (deterministic, keyless, self-surfacing).
//
//  Runs the detector battery over the wide market panel (discrete quarters,
//  single months, fiscal years, ownership, analyst notes, prices, valuation,
//  channel mix), narrates each finding with the deterministic buy-side
//  templates, and writes src/data/insights.generated.json — after BOTH
//  fail-closed gates pass:
//    1. the grounding firewall (every number traces to a signal), and
//    2. the arithmetic/direction/uniqueness audit (the words match the math).
//  On any gate failure it writes NOTHING and exits 1.
//
//  Unlike the old keyless re-narrator, this path is not tied to a committed
//  card skeleton: new data produces new cards, organised by the quarter or
//  month where each insight became observable.
//
//  Run:  npm run insights:generate:keyless    (CI keyless default)
//        npm run insights:generate:engine     (alias)
// ---------------------------------------------------------------------------

import { writeFileSync } from 'node:fs'
import { runEngine } from '@/insights/engine/assemble'
import { validateInsightsFile } from '@/insights/validate'
import { auditInsights } from '@/insights/audit'

const OUT = 'src/data/insights.generated.json'
const DRY = process.argv.includes('--dry-run')

function main(): number {
  const { file, run, findings } = runEngine()
  console.log(`engine: ${findings.length} findings · signals ${run.signals.length} · asOf ${run.asOf} · ${file.meta.signalHash}`)

  const periods = [...new Set(file.insights.map((i) => i.period ?? ''))]
  console.log(`periods: ${periods.join(', ')}`)

  const v = validateInsightsFile(file, run)
  if (!v.ok) {
    console.error(`grounding firewall failed (${v.errors.length}) — writing nothing:`)
    v.errors.forEach((e) => console.error('  · ' + e))
    return 1
  }
  const a = auditInsights(file)
  if (!a.ok) {
    console.error(`correctness gate failed (${a.errors.length}) — writing nothing:`)
    a.errors.forEach((e) => console.error('  · ' + e))
    return 1
  }
  if (DRY) {
    console.log(`DRY RUN — gates pass; ${file.insights.length} insights would be written.`)
    return 0
  }
  writeFileSync(OUT, JSON.stringify(file, null, 2) + '\n')
  console.log(`wrote ${OUT}: ${file.insights.length} insights (engine, deterministic)`)
  return 0
}

process.exit(main())
