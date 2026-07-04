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

interface Focus {
  key: string
  scope: string
  maxItems: number
}

// The agent's deep multi-topic search runs too long in one shot and the request
// gets terminated (~5-min server limit) — retries just hit the same wall. Splitting
// it into a couple of FOCUSED pulls keeps each call small enough to finish; their
// results are de-duped and merged. Each pull still prefers the trusted outlets and
// links the original article.
const FOCUSES: Focus[] = [
  {
    key: 'company',
    scope:
      'FOCUS OF THIS PULL — company & analyst: developments for the LISTED standalone health insurers, Niva Bupa (NSE: NIVABUPA) first, then Star Health, Care Health (Care / Religare), Aditya Birla Health, ManipalCigna. Cover results / earnings and board / investor-meet dates, analyst rating & target-price actions, capital raises, big partnerships, and management / leadership changes (CEO / MD / founders / owners — named only from a source). Skip general regulatory news in this pull.',
    maxItems: 8,
  },
  {
    key: 'regulatory',
    scope:
      'FOCUS OF THIS PULL — regulatory & sector: developments for Indian health / non-life (general) insurance that affect every standalone health insurer. Cover IRDAI rules, circulars, drafts, master guidelines, licences and penalties; pricing / claims / cashless regulation; health-cover changes; sector M&A and capital; and genuinely market-moving sector news. Skip individual company earnings in this pull.',
    maxItems: 6,
  },
]

function buildPayload(focus: Focus) {
  return {
    user_index: 124,
    tasks: [
      "I'm an investor tracking NIVA BUPA HEALTH INSURANCE (NSE: NIVABUPA) and the Indian standalone health-insurance sector (Star Health, Care, Aditya Birla, ManipalCigna). Give me a concise, source-linked market-intelligence feed of what could MOVE these shares or matters for the health-insurance sector right now.\n\n" +
        focus.scope +
        '\n\nReturn a table with exactly these columns, in this order, pipe-delimited:\n\n' +
        'company | date | kind | horizon | impact | headline | detail | source_url | published\n\n' +
        'Rules:\n' +
        'company = "Niva Bupa" for company-specific items, or "Sector" for sector/regulatory items.\n' +
        'date = the event/news date as YYYY-MM-DD (best estimate if a window).\n' +
        'kind = one of: investor_meet, earnings, board_meeting, regulatory, sector_news, catalyst, rating.\n' +
        'horizon = "upcoming" for future-dated, "recent" for the last ~60 days.\n' +
        'impact = one of: positive, negative, watch, neutral (likely effect on the Niva Bupa share).\n' +
        'headline = one short line.\n' +
        'detail = one sentence on why it matters to the share / sector.\n' +
        'source_url = the link backing the item.\n' +
        "published = the article's ORIGINAL PUBLICATION date (YYYY-MM-DD) exactly as printed on the article / byline / dateline. This is DIFFERENT from `date`: it is when the SOURCE was published, not when a scheduled event is due. Leave BLANK if the page shows no explicit publication date. NEVER put today's date here unless the article was genuinely published today — an analyst note you find today that was published last week must carry LAST WEEK's date here, so it is not mislabelled as a fresh, same-day development.\n\n" +
        'PREFERRED SOURCES — prefer these trusted outlets for headlines and links: The Economic Times (economictimes.indiatimes.com / bfsi.economictimes.indiatimes.com), The Hindu BusinessLine (thehindubusinessline.com), Moneycontrol (moneycontrol.com), Livemint (livemint.com). You may DISCOVER headlines via Pulse by Zerodha (pulse.zerodha.com) but link the ORIGINAL outlet article, never the aggregator URL. Include other credible sources for anything these have not covered.\n\n' +
        `Give up to ${focus.maxItems} of the most relevant, current items, most market-moving first. Use real, sourced items only — do not invent events. Leave a cell blank rather than guess.\n\n` +
        'DATE DISCIPLINE — the date must be the date the development actually happened / was published, NEVER today\'s date as a placeholder. Fill the `published` column with the source\'s real byline date whenever the page shows one (and leave it blank otherwise) — do NOT copy today\'s date into it. We separately record when WE discovered each item, so an older article you surface today is labelled "newly surfaced", not "fresh": accurate publication dates are what make that distinction work. Do NOT include evergreen explainer / "what the new rules mean" / guide / FAQ pages, or an insurer\'s investor-relations "watch this page" landing — those describe rules that may have changed months ago and have no real news date. If an item has no genuine, verifiable publication date, LEAVE THE DATE CELL BLANK rather than fill in today. Only a specific, dated development belongs in this feed.\n\n' +
        'Example (format only):\n' +
        'company | date | kind | horizon | impact | headline | detail | source_url | published\n' +
        'Niva Bupa | 2026-05-20 | earnings | upcoming | watch | Q4 FY26 results on 20 May | Combined ratio and growth guidance are the swing factors for the stock. | https://… | 2026-05-06',
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

async function callAgentOnce(token: string, focus: Focus): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { accept: '*/*', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(focus)),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`agent call failed: HTTP ${res.status} ${res.statusText}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

// Even a focused pull can be dropped mid-flight ("terminated") or hit a transient
// auth/5xx blip — one spaced retry lets it heal without blowing the workflow's
// timeout budget (two focused pulls per run).
async function callAgent(token: string, focus: Focus): Promise<string> {
  const backoffs = [15_000]
  let lastErr: unknown
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    try {
      return await callAgentOnce(token, focus)
    } catch (err) {
      lastErr = err
      if (attempt < backoffs.length) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[${focus.key}] agent call attempt ${attempt + 1} failed (${msg}); retrying in ${backoffs[attempt] / 1000}s ...`)
        await new Promise((r) => setTimeout(r, backoffs[attempt]))
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
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

// An evergreen explainer / guide / FAQ / IR-landing URL — reference content with no
// genuine publication date (an insurer's "what the new IRDAI rules mean" article, a
// broker's "IRDA rules" guide, an IR "watch this page"). Kept in sync with the reader's
// guard in src/components/pulse/derive.ts (isEvergreenReference).
const EVERGREEN_URL_RE =
  /health-insurance-articles|\/(blog|learn|guides?|knowledge|resources|faqs?)\/|what-is-|what-has-changed|rules-for-health|irda-rules|-guide(?:$|[-.?#/])|-explained|explainer|investor-relations|\.aspx(?:$|[?#])/i
function isEvergreenUrl(url: string | null): boolean {
  return !!url && EVERGREEN_URL_RE.test(url)
}

interface IntelItem {
  id: string
  company_id: string
  /** Best-known EVENT date. NOT trusted as proof of publication (the reader treats a
   *  bare date as a discovery/surface date unless `source_published_at` is present). */
  date: string | null
  kind: string
  horizon: 'upcoming' | 'recent'
  impact: string
  headline: string
  detail: string
  source_name: string | null
  source_url: string | null
  /** The source article's real PUBLICATION date (YYYY-MM-DD) from its byline, when the
   *  page exposes one. Null when unknown — never today-as-placeholder. The ONLY field
   *  the reader trusts to call an item "fresh". */
  source_published_at?: string | null
  /** When our pipeline first DISCOVERED the item (ISO). Stamped on first capture. */
  discovered_at?: string
  /** Bookkeeping (never shown): when this highlight first entered the feed. Alias of
   *  discovered_at, kept for back-compat / ageing undated items out of the feed. */
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
    const sourceUrl = (c[7] || '').match(/https?:\/\/\S+/)?.[0] ?? null
    const dateMatch = clean(c[1]).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null
    // An evergreen explainer / guide / FAQ / IR "watch this page" landing carries no
    // real publication date; when the agent stamps one anyway (typically "today"), drop
    // it so the item is stored as UNDATED background — never counted as a "since
    // yesterday" development. This is what kept surfacing last March's IRDAI rules as
    // brand-new regulatory updates. (Honesty: old rules must not be dressed up as new.)
    const date = dateMatch && isEvergreenUrl(sourceUrl) ? null : dateMatch
    // The source's REAL publication date (last column) — kept strictly separate from
    // `date`. Same evergreen guard: an explainer / landing page has no genuine byline
    // date, so we never store one. Null when the agent left it blank (unknown).
    const publishedMatch = clean(c[8] ?? '').match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null
    const source_published_at = publishedMatch && !isEvergreenUrl(sourceUrl) ? publishedMatch : null
    const kind = KINDS.has(c[2]) ? c[2] : 'sector_news'
    let horizon = (c[3] || '').toLowerCase() === 'upcoming' || (c[3] || '').toLowerCase() === 'recent' ? (c[3].toLowerCase() as 'upcoming' | 'recent') : null
    if (!horizon) horizon = date && date >= today ? 'upcoming' : 'recent'
    const impact = IMPACTS.has((c[4] || '').toLowerCase()) ? c[4].toLowerCase() : 'neutral'
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
      source_published_at,
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
      // Stamp DISCOVERY on first capture — when WE found it (distinct from when the
      // source was published). `first_seen` kept as an alias for back-compat.
      byId.set(it.id, { ...it, first_seen: fetchedAt, discovered_at: fetchedAt })
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

  // Two FOCUSED pulls (company & analyst, then regulatory & sector) — each small
  // enough to finish inside the agent's request window. A pull that fails doesn't
  // sink the run; we merge whatever the successful pulls returned.
  console.log(`Calling chat-muns agent — ${FOCUSES.length} focused pulls ...`)
  const raws: string[] = []
  for (const focus of FOCUSES) {
    try {
      console.log(`  · focus: ${focus.key}`)
      raws.push(await callAgent(token, focus))
    } catch (err) {
      console.error(`  · focus ${focus.key} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (raws.length === 0) {
    console.error('ERROR: all focused agent pulls failed — leaving snapshot untouched.')
    return 1
  }
  // Parse every pull and de-dupe across them (same id = same headline + date).
  const parsed = raws.flatMap((raw) => parseItems(extractAnswer(raw), today))
  const items = [...new Map(parsed.map((i) => [i.id, i])).values()]
  console.log(`Parsed ${items.length} item(s) from ${raws.length}/${FOCUSES.length} focused pull(s).`)
  for (const i of items) {
    console.log(`  + [${i.horizon}/${i.impact}] ${i.date ?? '—'} ${i.company_id}: ${i.headline}`)
  }
  await appendLog('sahi-intelligence-agent.log', { count: items.length, pulls: raws.length })

  if (items.length === 0) {
    console.error('No parseable items across pulls — leaving market-intelligence-snapshot.json untouched.')
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
