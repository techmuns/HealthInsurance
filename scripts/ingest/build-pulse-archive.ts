// ---------------------------------------------------------------------------
//  Pulse daily-brief archive — freezes one immutable brief record per calendar
//  day (IST) per company. Past days stay exactly as they were shown that day; the
//  live Today view keeps recomposing. Read by the Pulse UI for the timeline
//  archive and to render a past date's frozen brief.
//
//  Runs AFTER the market-intelligence fetch (needs no API token — it reads the
//  already-committed snapshot and computes the brief with the SAME derive stack
//  the UI uses). Each run UPSERTS today's record: appends a runs[] entry and
//  refreshes the frozen bundle + lastUpdatedAt. It never rewrites a past date, so
//  prior days are immutable. Records are kept ~90 days per company.
// ---------------------------------------------------------------------------

import { insurers } from '@/data/mockData'
import { buildInvestorPulse } from '@/insights/investorPulse'
import {
  scopeSignals,
  convictionIdeas,
  morningBrief,
  oneThing,
  briefMessage,
  sinceYesterday,
  upcomingEvents,
  actionsForBrief,
  statusOf,
} from '@/components/pulse/derive'
import { readSnapshot, writeSnapshot, nowIso } from './util'

const RETAIN_DAYS = 90
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The standalone health insurers the Pulse serves. Their daily brief spans all three
// dimensions the reader cares about — company-specific items, sector moves, and
// health-insurance / IRDAI regulatory news — so each is archived (not just days with
// a company-specific item). Other insurers (life / general PSU) are out of the Pulse's
// health-insurance focus and would only duplicate the sector read, so they are skipped.
const ARCHIVE_COMPANIES = new Set(['niva-bupa', 'star-health', 'care-health', 'aditya-birla', 'manipalcigna'])

// The calendar day in IST — the pipeline runs at 07:30–19:30 IST, all one IST day.
function istToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

interface Archive {
  _meta?: Record<string, unknown>
  briefs: Record<string, Record<string, unknown>>
}

async function main(): Promise<number> {
  const today = istToday()
  const runTime = nowIso()

  let archive: Archive = { briefs: {} }
  try {
    const prev = await readSnapshot<Archive>('pulse-brief-archive.json')
    if (prev && typeof prev === 'object' && prev.briefs) archive = prev
  } catch {
    /* first run — start fresh */
  }

  let wrote = 0
  for (const ins of insurers as { id: string; shortName: string }[]) {
    if (!ARCHIVE_COMPANIES.has(ins.id)) continue
    const pulse = buildInvestorPulse(ins.id, ins.shortName)
    if (pulse.isEmpty) continue

    // Compute EXACTLY what the live Today view renders (isToday = true). The brief
    // spans company + sector + health-insurance/regulatory items in scope for this
    // insurer — not company-specific only.
    const scoped = scopeSignals(pulse, 'relevant', 'today')
    const ideas = convictionIdeas(scoped, pulse)
    const brief = morningBrief(pulse, ideas, scoped, true, '')
    const one = oneThing(scoped, ideas, pulse)
    const message = briefMessage(pulse, scoped, one, true, '')
    const sinceDeltas = sinceYesterday(pulse)
    const events = upcomingEvents(pulse)
    const actions = actionsForBrief(pulse, scoped)

    // Freeze the "updated" label in ABSOLUTE form so a past-date view never reads a
    // relative "Today, HH:MM" on a later day.
    const [, mm, dd] = today.split('-')
    const absDate = `${Number(dd)} ${MONTHS[Number(mm) - 1]}`
    if (brief.lastUpdatedLabel?.startsWith('Today,')) brief.lastUpdatedLabel = brief.lastUpdatedLabel.replace(/^Today,/, `${absDate},`)

    const perCompany = (archive.briefs[ins.id] ?? {}) as Record<string, { generatedAt?: string; runs?: unknown[] }>
    const existing = perCompany[today]
    const run = { runTime, developments: brief.developmentsCount, sourceCount: brief.sourcesCount, ideas: ideas.length, status: 'ok' }

    perCompany[today] = {
      date: today,
      company: pulse.company,
      companyId: ins.id,
      generatedAt: existing?.generatedAt ?? runTime,
      lastUpdatedAt: runTime,
      status: pulse.todayRead ? statusOf(pulse.todayRead.stance) : 'Neutral',
      sourceConfidence: pulse.confidence,
      // Real item count of the day's read — so the timeline badge is consistent
      // whether the day is live or frozen (not the capped conviction-idea count).
      itemCount: scoped.length,
      runs: [...(existing?.runs ?? []), run].slice(-24),
      // Frozen render bundle — exactly what the Pulse shows for this day.
      brief,
      message,
      one,
      ideas,
      sinceDeltas,
      events,
      actions,
    }

    // Keep only the most recent RETAIN_DAYS dates for this company.
    const dates = Object.keys(perCompany).sort()
    if (dates.length > RETAIN_DAYS) for (const d of dates.slice(0, dates.length - RETAIN_DAYS)) delete perCompany[d]

    archive.briefs[ins.id] = perCompany
    wrote++
  }

  archive._meta = {
    snapshot_id: 'pulse-brief-archive',
    description:
      'Immutable per-calendar-day Pulse brief records (IST), one per company. Past days are frozen exactly as shown that day; the live Today view recomposes. Kept ~90 days per company.',
    last_updated: today,
    last_successful_run: runTime,
  }

  await writeSnapshot('pulse-brief-archive.json', archive)
  console.log(`pulse-brief-archive: upserted ${today} record for ${wrote} compan${wrote === 1 ? 'y' : 'ies'}.`)
  return 0
}

main().then((code) => {
  process.exitCode = code
})
