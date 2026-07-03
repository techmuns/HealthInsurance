// ---------------------------------------------------------------------------
//  AI market-intelligence pull via the muns chat agent → market-intelligence.
//
//  Generates the "AI Market Intelligence" feed: upcoming investor/analyst meets,
//  board & earnings dates, sector & regulatory news, and catalysts that could
//  move the SAHI shares — focused on Niva Bupa plus the broader health-insurance
//  sector. Web-sourced (the agent's web search), every item carrying a source.
//
//  This is AI-GENERATED intelligence, clearly labelled as such in the UI — not
//  audited data. The agent decides relevance; we only parse + store, and a row
//  is kept only if it has a headline. Token from MUNS_API_TOKEN.
// ---------------------------------------------------------------------------

import { writeSnapshot, readSnapshot, nowIso, appendLog } from './util'
import { createHash } from 'node:crypto'

const API_URL = process.env.MUNS_AGENT_URL || 'https://devde.muns.io/chat/chat-muns'
const API_TIMEOUT_MS = 600_000

function buildPayload() {
  return {
    user_index: 124,
    tasks: [
      "I'm an investor tracking NIVA BUPA HEALTH INSURANCE (NSE: NIVABUPA) and the Indian standalone health-insurance sector (Star Health, Care, Aditya Birla, ManipalCigna). Give me a concise market-intelligence feed of anything that could MOVE the Niva Bupa share or matters for the health-insurance sector right now.\n\n" +
        'Include, where available:\n' +
        '- Upcoming investor / analyst meets, AGMs, board meetings and earnings-call / results dates.\n' +
        '- Recent or upcoming SECTOR & REGULATORY news (IRDAI rules, pricing/claims regulation, health-cover changes, M&A, capital raises, big partnerships).\n' +
        '- Analyst rating / target-price actions on the listed names.\n' +
        '- Any catalyst that could move the Niva Bupa share specifically.\n\n' +
        'Return a table with exactly these columns, in this order, pipe-delimited:\n\n' +
        'company | date | kind | horizon | impact | headline | detail | source_url\n\n' +
        'Rules:\n' +
        'company = "Niva Bupa" for company-specific items, or "Sector" for sector/regulatory items.\n' +
        'date = the event/news date as YYYY-MM-DD (best estimate if a window).\n' +
        'kind = one of: investor_meet, earnings, board_meeting, regulatory, sector_news, catalyst, rating.\n' +
        'horizon = "upcoming" for future-dated, "recent" for the last ~60 days.\n' +
        'impact = one of: positive, negative, watch, neutral (likely effect on the Niva Bupa share).\n' +
        'headline = one short line.\n' +
        'detail = one sentence on why it matters to the share / sector.\n' +
        'source_url = the link backing the item.\n\n' +
        'PREFERRED SOURCES — search these trusted outlets deeply and prefer them for headlines and links:\n' +
        '- The Economic Times (economictimes.indiatimes.com, including bfsi.economictimes.indiatimes.com)\n' +
        '- The Hindu BusinessLine (thehindubusinessline.com)\n' +
        '- Moneycontrol (moneycontrol.com)\n' +
        '- Livemint / Mint (livemint.com)\n' +
        '- Pulse by Zerodha (pulse.zerodha.com) — a live aggregator of Indian market news. Use it to DISCOVER the latest headlines, but link the ORIGINAL source article it points to (the Economic Times / BusinessLine / Moneycontrol / Livemint / other outlet page), never the aggregator URL.\n' +
        'Dig into these for the latest IRDAI / regulatory, sector and company developments. When several outlets carry the same story, cite one of the trusted outlets above. Still include other credible sources for anything these have not covered — do not omit a real development just because it is elsewhere.\n\n' +
        'Give 6–12 of the most relevant, current items, most market-moving first. Use real, sourced items only — do not invent events. Leave a cell blank rather than guess.\n\n' +
        'Example (format only):\n' +
        'company | date | kind | horizon | impact | headline | detail | source_url\n' +
        'Niva Bupa | 2026-05-20 | earnings | upcoming | watch | Q4 FY26 results on 20 May | Combined ratio and growth guidance are the swing factors for the stock. | https://…',
    ],
    query_context: {
      TICKER_SYMBOL: ['NIVABUPA', 'STARHEALTH'],
      FROM_DATE: '2026-03-01',
      TO_DATE: '2026-12-31',
      ANNOUNCEMENT_FORM_TYPE: 'all',
      DOCUMENT_IDS: [],
      CATEGORIES: [],
      WEB_SEARCH_ENABLED: true,
      COUNTRY: [],
      CONTEXT_EMAIL: 'nadamsaluja@gmail.com',
      CONTEXT_COMPANY_NAME: [],
      GET_ANNOUNCEMENTS_ENABLED: true,
      chatHistory: [],
      mode: 'fast',
    },
    autoAddUpcoming: false,
  }
}

async function callAgent(token: string): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { accept: '*/*', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`agent call failed: HTTP ${res.status} ${res.statusText}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

function extractAnswer(text: string): string {
  const m = text.match(/<ans>([\s\S]*?)<\/ans>/)
  return m ? m[1] : text
}

const KINDS = new Set(['investor_meet', 'earnings', 'board_meeting', 'regulatory', 'sector_news', 'catalyst', 'rating'])
const IMPACTS = new Set(['positive', 'negative', 'watch', 'neutral'])

function companyId(s: string): string {
  const t = s.toLowerCase()
  if (t.includes('niva')) return 'niva-bupa'
  if (t.includes('star')) return 'star-health'
  if (t.includes('care') || t.includes('religare')) return 'care-health'
  if (t.includes('aditya')) return 'aditya-birla'
  if (t.includes('manipal')) return 'manipalcigna'
  return 'sector'
}

function clean(s: string | undefined): string {
  return (s ?? '').replace(/^["'\s]+|["'\s]+$/g, '').trim()
}

interface IntelItem {
  id: string
  company_id: string
  date: string | null
  kind: string
  horizon: 'upcoming' | 'recent'
  impact: string
  headline: string
  detail: string
  source_name: string | null
  source_url: string | null
  /** Bookkeeping only (never shown): when this highlight first entered the feed.
   *  Lets undated items age out of the accumulated feed. */
  first_seen?: string
}

function parseItems(answer: string, today: string): IntelItem[] {
  const out: IntelItem[] = []
  for (const line of answer.split('\n')) {
    if (!line.includes('|')) continue
    const c = line.split('|').map(clean)
    if (c.length < 6) continue
    if (/^company$/i.test(c[0]) || /^-+$/.test(c[1] ?? '')) continue // header / divider
    const headline = clean(c[5])
    if (!headline || headline.length < 4) continue
    const dateRaw = clean(c[1])
    const date = /\d{4}-\d{2}-\d{2}/.test(dateRaw) ? dateRaw.match(/\d{4}-\d{2}-\d{2}/)![0] : null
    const kind = KINDS.has(c[2]) ? c[2] : 'sector_news'
    let horizon = (c[3] || '').toLowerCase() === 'upcoming' || (c[3] || '').toLowerCase() === 'recent' ? (c[3].toLowerCase() as 'upcoming' | 'recent') : null
    if (!horizon) horizon = date && date >= today ? 'upcoming' : 'recent'
    const impact = IMPACTS.has((c[4] || '').toLowerCase()) ? c[4].toLowerCase() : 'neutral'
    const sourceUrl = (c[7] || '').match(/https?:\/\/\S+/)?.[0] ?? null
    out.push({
      id: createHash('sha1').update(headline + (date ?? '')).digest('hex').slice(0, 10),
      company_id: companyId(c[0]),
      date,
      kind,
      horizon,
      impact,
      headline,
      detail: clean(c[6]),
      source_name: sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, '') : null,
      source_url: sourceUrl,
    })
  }
  return out
}

// ── Accumulation (Neha, 2026-07-03) ──────────────────────────────────────────
// Each run MERGES its fresh pull into the stored feed instead of replacing it, so
// a highlight surfaced earlier in the day is never lost when a later run doesn't
// re-list it. New items are appended (deduped by id = hash(headline + date)); the
// day's developments accumulate under the single "Today" read and the Pulse brief
// re-composes over the fuller set. Genuinely stale items age out so the feed stays
// current and compact, never unbounded.
const RETAIN_RECENT_DAYS = 45 // drop 'recent' items older than this many days
const UPCOMING_GRACE_DAYS = 3 // drop 'upcoming' items whose date passed this long ago
const MAX_ITEMS = 60 // backstop cap on total stored items (newest kept)

function daysSince(dateIso: string, today: string): number | null {
  const t = Date.parse(`${dateIso}T00:00:00Z`)
  const n = Date.parse(`${today}T00:00:00Z`)
  if (isNaN(t) || isNaN(n)) return null
  return Math.round((n - t) / 86_400_000) // > 0 in the past, < 0 in the future
}

// An item still belongs in the live feed when it is current: 'recent' items inside
// the retention window; 'upcoming' items until shortly after their date passes.
// Undatable items (no date, no first_seen) are kept but bounded by MAX_ITEMS.
function isStillCurrent(it: IntelItem, today: string): boolean {
  const ref = it.date || (it.first_seen ? it.first_seen.slice(0, 10) : '')
  if (!ref) return true
  const age = daysSince(ref, today)
  if (age === null) return true
  if (it.horizon === 'upcoming') return age <= UPCOMING_GRACE_DAYS
  return age <= RETAIN_RECENT_DAYS
}

// Merge a fresh pull into the stored set: existing items win on conflict (a
// first-captured highlight stays put), genuinely new ids are appended with a
// first_seen stamp; then prune stale items and cap, newest first.
function mergeFeed(
  existing: IntelItem[],
  fresh: IntelItem[],
  today: string,
  fetchedAt: string,
): { merged: IntelItem[]; added: number; carried: number } {
  const byId = new Map<string, IntelItem>()
  for (const it of existing) byId.set(it.id, it)
  const carried = byId.size
  let added = 0
  for (const it of fresh) {
    if (!byId.has(it.id)) {
      byId.set(it.id, { ...it, first_seen: fetchedAt })
      added++
    }
  }
  let merged = [...byId.values()].filter((it) => isStillCurrent(it, today))
  merged.sort((a, b) => {
    const da = a.date || ''
    const db = b.date || ''
    if (da && db) return da < db ? 1 : da > db ? -1 : 0
    if (da) return -1
    if (db) return 1
    return 0
  })
  if (merged.length > MAX_ITEMS) merged = merged.slice(0, MAX_ITEMS)
  return { merged, added, carried }
}

async function main(): Promise<number> {
  const token = (process.env.MUNS_API_TOKEN || '').trim()
  if (!token) { console.error('ERROR: MUNS_API_TOKEN is not set.'); return 1 }
  const fetched_at = nowIso()
  const today = fetched_at.slice(0, 10)

  console.log('Calling chat-muns agent for SAHI market intelligence ...')
  let raw: string
  try { raw = await callAgent(token) } catch (err) {
    console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`); return 1
  }
  const items = parseItems(extractAnswer(raw), today)
  console.log(`Parsed ${items.length} intelligence item(s).`)
  for (const i of items) {
    console.log(`  + [${i.horizon}/${i.impact}] ${i.date ?? '—'} ${i.company_id}: ${i.headline}`)
  }
  await appendLog('sahi-intelligence-agent.log', { count: items.length })

  if (items.length === 0) {
    console.error('No parseable items — leaving market-intelligence-snapshot.json untouched. Raw answer:\n' + extractAnswer(raw).slice(0, 1500))
    return 0
  }

  // Merge this pull into the stored feed so the day's highlights accumulate (a
  // highlight surfaced at 11:30 isn't lost when the 15:30 run doesn't re-list it).
  let existing: IntelItem[] = []
  try {
    const prev = await readSnapshot<{ data?: IntelItem[] }>('market-intelligence-snapshot.json')
    if (Array.isArray(prev?.data)) existing = prev.data
  } catch {
    /* first run / no prior snapshot — start fresh */
  }
  const { merged, added, carried } = mergeFeed(existing, items, today, fetched_at)
  console.log(`Feed merge: ${carried} carried + ${added} new this run = ${merged.length} stored (${items.length} pulled).`)

  await writeSnapshot('market-intelligence-snapshot.json', {
    _meta: {
      snapshot_id: 'market-intelligence-snapshot',
      description: 'AI-generated market intelligence for the SAHI health insurers — investor meets, earnings/board dates, sector & regulatory news, share catalysts. Web-sourced; each item links its source. AI-generated, not audited.',
      schema_version: '1.0.0',
      dataset: 'ai_generated',
      last_updated: today,
      last_successful_run: fetched_at,
      upstream_sources: ['muns_agent_web'],
      parser_status: 'ready',
      generated_by: 'AI (muns agent, web search)',
      notes: 'Clearly labelled AI-generated intelligence — verify before acting. Items accumulate through the day and rank by investor impact, not recency.',
    },
    data: merged,
  })
  console.log(`market-intelligence-snapshot: wrote ${merged.length} item(s).`)
  return 0
}

main().then((code) => { process.exitCode = code })
