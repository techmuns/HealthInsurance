// ---------------------------------------------------------------------------
//  health-check — the data-pipeline watchdog.
//
//  Reads data-health.json (written by build-snapshots.ts) and decides which
//  sources genuinely need a human's attention. A source can look off for four
//  reasons:
//    • regressed — was succeeding, now failing (upstream page changed / errored)
//    • blocked   — was succeeding, now WAF/login-blocked
//    • stale     — no successful refresh within its expected cadence window
//    • empty     — fetched OK but extracted 0 records (likely a layout change)
//
//  Two filters keep the alert honest — so the ⚠️ issue only ever fires when
//  something a person actually needs to act on has broken (Neha, 2026-07-03,
//  "I don't want anything to fail ever"):
//
//    1. TIER. Core sources are the official record (IRDAI, GI Council, company
//       filings, the primary price feed). Backup sources are optional
//       aggregators / secondary adapters (Moneycontrol, Screener, Trendlyne,
//       Yahoo, Investing, the NSE deliverable column). When a BACKUP source
//       breaks, the dashboard simply keeps its last real value from the primary
//       official source — nothing is wrong for a viewer and nobody needs to do
//       anything, so it is recorded for the record but NEVER opens an alert.
//
//    2. DEBOUNCE. A single bad run is usually a transient blip (a dropped agent
//       call, a momentary 5xx) that fixes itself on the next cadence. A
//       transient kind (regressed / empty) must repeat for MIN_BAD_RUNS
//       consecutive runs before it alerts. Inherently-persistent kinds (blocked
//       / stale) alert on first confirmed sight. Streaks persist across runs in
//       a committed snapshot file so the count survives the ephemeral runner.
//
//  Sources that have NEVER succeeded are treated as known-pending (not yet
//  wired / standing-blocked) and are NOT flagged — the signal stays about
//  things that *broke*, not things that were never on.
//
//  It writes a machine-readable report to $RUNNER_TEMP (CI) / the OS temp dir
//  for the workflow's alert step (which opens/refreshes/closes the GitHub issue
//  from `report.issues` only), prints a human summary, and ALWAYS exits 0 — it
//  is informational and must never fail the ingest run or block the data commit.
//  The dashboard keeps showing the last real, dated value while a source is
//  down; nothing here fabricates data.
// ---------------------------------------------------------------------------

import { tmpdir } from 'node:os'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readSnapshot, writeSnapshot } from './util'

type Cadence = 'daily' | 'monthly' | 'quarterly' | 'annual'
const STALE_DAYS: Record<Cadence, number> = { daily: 4, monthly: 45, quarterly: 110, annual: 400 }

// Backup / cross-check sources: optional aggregators + secondary price/delivery
// adapters. A break here is a non-event for the dashboard (the primary official
// source still supplies the shown value), so it is recorded but never alerted.
const BACKUP_SOURCE = /moneycontrol|screener|trendlyne|yahoo|investing|nse.?deliver|_delivery/i

// …EXCEPT where the aggregator is the ONLY supplier of its metric. The "a break
// here is a non-event" reasoning holds only when an official source still fills
// the cell. Broker ratings and price targets have no official feed at all — the
// aggregator IS the source — so demoting them to a silent 'backup' meant analyst
// coverage could go dark and never raise a word. It did: both broker feeds died
// and the Analyst coverage sheet sat frozen for a fortnight, recorded but never
// alerted. Sole-source feeds are treated as core no matter who serves them.
const SOLE_SOURCE = /analyst|broker|target_price|trendlyne_backup/i

function tierOf(sourceId: string): 'core' | 'backup' {
  if (SOLE_SOURCE.test(sourceId)) return 'core'
  return BACKUP_SOURCE.test(sourceId) ? 'backup' : 'core'
}

/** Infer a source's expected refresh cadence from its id (robust to new sources). */
function cadenceOf(sourceId: string): Cadence {
  const s = sourceId.toLowerCase()
  if (/price|delivery|muns_market|yahoo|moneycontrol_analyst|valuation_daily|quotes/.test(s)) return 'daily'
  if (/quarterly/.test(s)) return 'quarterly'
  if (/annual|handbook|_ir$|disclosures_batch|company_annual/.test(s)) return 'annual'
  return 'monthly' // monthly feeds + conservative default
}

interface PerSource {
  source_id: string
  status: 'success' | 'failed' | 'pending' | 'blocked'
  last_attempt_at: string | null
  last_success_at: string | null
  records_fetched: number | null
  error?: string
}
interface HealthFile {
  per_source: PerSource[]
  last_successful_run: string | null
}

type IssueKind = 'regressed' | 'blocked' | 'stale' | 'empty'
interface HealthIssue {
  source_id: string
  cadence: Cadence
  tier: 'core' | 'backup'
  kind: IssueKind
  age_days: number | null
  last_success: string | null
  detail: string
}

// Consecutive-bad-run memory, persisted in a committed snapshot file so the
// count survives the ephemeral CI runner (data/logs/ is git-ignored; snapshots
// are committed by the ingest workflow).
const STREAKS_FILE = 'watchdog-streaks.json'
interface Streak { bad_runs: number; bad_since: string; kind: IssueKind }
type Streaks = Record<string, Streak>

// Transient kinds must repeat before alerting; persistent kinds alert at once.
const DEBOUNCED_KINDS: IssueKind[] = ['regressed', 'empty']
const MIN_BAD_RUNS = 2

function ageDays(iso: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86_400_000)
}

function detectProblem(p: PerSource, cadence: Cadence): { kind: IssueKind; detail: string } | null {
  const age = ageDays(p.last_success_at)
  if (p.status === 'failed') {
    return { kind: 'regressed', detail: p.error ? `failing: ${p.error.slice(0, 140)}` : 'failing after previously succeeding' }
  }
  if (p.status === 'blocked') {
    return { kind: 'blocked', detail: 'WAF/login-blocked after previously succeeding' }
  }
  if (age != null && age > STALE_DAYS[cadence]) {
    return { kind: 'stale', detail: `no successful refresh in ${age}d (>${STALE_DAYS[cadence]}d expected for a ${cadence} source)` }
  }
  if (p.status === 'success' && p.records_fetched === 0) {
    return { kind: 'empty', detail: 'fetched but extracted 0 records — possible upstream layout change' }
  }
  return null
}

async function main(): Promise<void> {
  const health = await readSnapshot<HealthFile>('data-health.json')
  const sources = health.per_source ?? []

  let streaks: Streaks = {}
  try {
    streaks = await readSnapshot<Streaks>(STREAKS_FILE)
  } catch {
    streaks = {} // first run / file not yet created — start clean
  }

  const issues: HealthIssue[] = [] // → drives the GitHub alert (core + confirmed only)
  const recorded: HealthIssue[] = [] // → logged for the record, never alerts
  const stillBad = new Set<string>()

  for (const p of sources) {
    // Known-pending (never succeeded) → not a regression; don't track or alert.
    if (!p.last_success_at) {
      delete streaks[p.source_id]
      continue
    }
    const cadence = cadenceOf(p.source_id)
    const tier = tierOf(p.source_id)
    const problem = detectProblem(p, cadence)

    if (!problem) {
      // Recovered (or healthy) → clear any streak so a future blip starts fresh.
      delete streaks[p.source_id]
      continue
    }

    const entry: HealthIssue = {
      source_id: p.source_id,
      cadence,
      tier,
      kind: problem.kind,
      age_days: ageDays(p.last_success_at),
      last_success: p.last_success_at,
      detail: problem.detail,
    }

    if (tier === 'backup') {
      // A backup outage never alerts and needs no streak memory — record only.
      recorded.push({
        ...entry,
        detail: `${problem.detail} · backup source — dashboard keeps the last official value; no action needed`,
      })
      continue
    }

    // Core source: track a consecutive-bad-run streak so a transient blip is
    // debounced away and only a persistent break alerts.
    stillBad.add(p.source_id)
    const prev = streaks[p.source_id]
    const continuing = prev && prev.kind === problem.kind
    const bad_runs = (continuing ? prev.bad_runs : 0) + 1
    const bad_since = continuing ? prev.bad_since : new Date().toISOString()
    streaks[p.source_id] = { bad_runs, bad_since, kind: problem.kind }

    const confirmed = !DEBOUNCED_KINDS.includes(problem.kind) || bad_runs >= MIN_BAD_RUNS
    if (confirmed) {
      issues.push(entry)
    } else {
      recorded.push({
        ...entry,
        detail: `${problem.detail} · transient — seen ${bad_runs}× of ${MIN_BAD_RUNS} needed to alert`,
      })
    }
  }

  // Drop streaks for core sources that recovered or dropped out of the report.
  for (const id of Object.keys(streaks)) {
    if (!stillBad.has(id)) delete streaks[id]
  }

  try {
    await writeSnapshot(STREAKS_FILE, streaks)
  } catch (e) {
    console.error('health-check: could not persist streaks (non-fatal) —', e instanceof Error ? e.message : e)
  }

  const report = {
    generated_at: new Date().toISOString(),
    checked: sources.length,
    attention: issues.length,
    recorded: recorded.length,
    issues, // the ONLY thing the workflow's alert step reads
    info: recorded,
  }
  const out = resolve(process.env.RUNNER_TEMP || tmpdir(), 'data-health-report.json')
  writeFileSync(out, JSON.stringify(report, null, 2))

  if (issues.length === 0) {
    console.log(
      `data-health watchdog: all clear for core sources — ${report.checked} checked` +
        (recorded.length ? `, ${recorded.length} backup/transient note(s) recorded (not alerted).` : '.'),
    )
  } else {
    console.log(`data-health watchdog: ${issues.length} CORE source(s) need attention:`)
    for (const i of issues) console.log(`  • [${i.kind}] ${i.source_id} (${i.cadence}) — ${i.detail}`)
  }
  if (recorded.length) {
    console.log('recorded (no alert):')
    for (const i of recorded) console.log(`  · [${i.kind}] ${i.source_id} (${i.tier}) — ${i.detail}`)
  }
  console.log(`report → ${out}`)
}

main().catch((e) => {
  // Informational only — never fail the ingest run.
  console.error('health-check: non-fatal error —', e instanceof Error ? e.message : e)
})
