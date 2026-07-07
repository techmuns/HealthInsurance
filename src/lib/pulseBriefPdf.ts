// ---------------------------------------------------------------------------
//  Daily Brief export — a compact PE-useful impact brief (PDF via the browser's
//  print-to-PDF, no external library).
//
//  This is the "daily PE alert layer", NOT a diligence memo: a 3-line executive
//  read (what changed · why it matters · what to do today), the one thing to read,
//  what changed since yesterday, and the highest-conviction items in the PE card
//  format — Event → Status → Impact metric → Company exposure → PE read → Action —
//  with ONE confidence per item and a source cluster that flags syndication.
//
//  Honesty (CLAUDE.md): every line is derived from the real, source-backed feed.
//  Duplicates are collapsed upstream (one story per card); exposure shows real
//  channel-mix numbers or an explicit "Needs data" — never invented precision;
//  events ahead are future-only; empty sections are simply omitted.
// ---------------------------------------------------------------------------

import type { Confidence } from '@/insights/investorPulse'
import type {
  MorningBrief,
  BriefMessage,
  SinceDelta,
  ConvictionIdea,
  PulseEvent,
  PulseAction,
  OneThing,
} from '@/components/pulse/derive'
import { toPeBriefItem, buildExecBrief, type PeBriefItem } from '@/lib/peBrief'

export interface DailyBriefPayload {
  company: string
  companyId: string
  dateLabel: string
  isToday: boolean
  brief: MorningBrief
  message: BriefMessage
  one: OneThing | null
  sinceDeltas: SinceDelta[]
  ideas: ConvictionIdea[]
  events: PulseEvent[]
  actions: PulseAction[]
  confidence: Confidence
}

// ── small, safe helpers ───────────────────────────────────────────────────────

const esc = (s: string): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const cls = (s: string): string => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')

// Each PE item is paired with its origin idea (for the honest freshness trail).
interface Row { idea: ConvictionIdea; pe: PeBriefItem }
function rowsFor(payload: DailyBriefPayload): Row[] {
  return payload.ideas.slice(0, 4).map((idea) => ({ idea, pe: toPeBriefItem(idea, payload.companyId, payload.company) }))
}

/** Deduped evidence list across every PE item + event — the "sources" foot. */
function sourceList(rows: Row[], events: PulseEvent[]): { name: string; url: string }[] {
  const seen = new Set<string>()
  const out: { name: string; url: string }[] = []
  const add = (name?: string, url?: string) => {
    const key = (url || name || '').trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push({ name: name || url || '', url: url || '' })
  }
  rows.forEach((r) => r.pe.sources.forEach((s) => add(s.name, s.url)))
  events.forEach((e) => add(e.kindLabel, e.url))
  return out.slice(0, 24)
}

// ── section builders (return '' when empty, so nothing renders) ────────────────

// Executive brief — EXACTLY three lines: what changed · why it matters · today's action.
function execSection(rows: Row[], message: BriefMessage): string {
  const exec = buildExecBrief(rows.map((r) => r.pe), message.nothing ? '' : message.since, message.why)
  const line = (k: string, v: string) => (v ? `<div class="exec-line"><span class="exec-k">${esc(k)}</span><span class="exec-v">${esc(v)}</span></div>` : '')
  return `
    <section class="block exec3">
      <h2>Executive brief</h2>
      ${line('What changed', exec.whatChanged)}
      ${line('Why it matters', exec.whyItMatters)}
      ${line('Today’s action', exec.todaysAction)}
    </section>`
}

function oneThingSection(one: OneThing | null, m: BriefMessage): string {
  const text = one?.sentence || m.keyThing
  if (!text) return ''
  return `
    <section class="callout">
      <div class="callout-label">If you read only one thing today</div>
      <p class="callout-text">${esc(text)}</p>
    </section>`
}

function sinceSection(deltas: SinceDelta[]): string {
  if (!deltas.length) return ''
  const rows = deltas
    .map((d) => {
      const mark = d.direction === 'down' ? '▼' : d.direction === 'flat' ? '—' : '▲'
      const c = d.direction === 'down' ? 'down' : d.direction === 'flat' ? 'flat' : 'up'
      return `<li><span class="mark ${c}">${mark}</span> <strong>${esc(d.value)}</strong> ${esc(d.label)}</li>`
    })
    .join('\n')
  return `
    <section class="block">
      <h2>What changed since yesterday</h2>
      <ul class="delta">${rows}</ul>
    </section>`
}

// One compact PE card: Headline → Status → Impact → Exposure → PE read → Action →
// Watch → Sources, with ONE confidence and the honest freshness trail.
function peCard(row: Row, i: number): string {
  const { pe, idea } = row
  const metricChips = pe.metrics.map((m) => `<span class="mchip">${esc(m)}</span>`).join(' ')
  const srcNames = pe.sources.slice(0, 3).map((s) => esc(s.name)).join(' · ')
  const rowLine = (k: string, v: string) => `<div class="row"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`
  const watch = pe.watchNext.length ? rowLine('Watch next', `<span class="muted">${pe.watchNext.slice(0, 4).map(esc).join(' · ')}</span>`) : ''
  return `
    <article class="idea">
      <div class="idea-head">
        <span class="idea-n">${i + 1}</span>
        <span class="idea-entity">${esc(pe.entity)}</span>
        <span class="status status-${cls(pe.status)}" title="${esc(pe.statusHint)}">${esc(pe.status)}</span>
        <span class="idea-conf conf-${pe.confidence.toLowerCase()}" title="${esc(pe.confidenceWhy)}">${esc(pe.confidence)} confidence</span>
      </div>
      <div class="idea-headline">${esc(pe.headline)}</div>
      ${rowLine('Impact', `<span class="chips">${metricChips}</span><span class="impact-line">${esc(pe.impactLine)}</span>`)}
      ${rowLine('Exposure', `<span class="exp exp-${cls(pe.exposure.level)}">${esc(pe.exposure.level)}</span> <span class="muted">${esc(pe.exposure.basis)}</span>`)}
      ${rowLine('PE read', esc(pe.peRead))}
      ${rowLine('Action', `<span class="act">${esc(pe.action.verb)}</span> ${esc(pe.action.label)}`)}
      ${watch}
      ${rowLine('Sources', `<span class="src-count">${esc(pe.sourceLabel)}</span>${srcNames ? ` <span class="muted">— ${srcNames}</span>` : ''}`)}
      <div class="idea-foot">Published ${esc(idea.publishedLabel)} · Discovered ${esc(idea.discoveredLabel)} · ${esc(idea.freshnessLabel)}</div>
    </article>`
}

function itemsSection(rows: Row[]): string {
  if (!rows.length) return ''
  return `
    <section class="block">
      <h2>Highest-conviction items</h2>
      ${rows.map((r, i) => peCard(r, i)).join('\n')}
    </section>`
}

// Events ahead — FUTURE ONLY (#7): a past-dated "active catalyst" is not an event
// ahead, so it is dropped here rather than shown under a future heading.
function eventsSection(events: PulseEvent[]): string {
  const future = events.filter((e) => e.isFirm).slice(0, 6)
  if (!future.length) return ''
  const rows = future
    .map((e) => `<li><span class="ev-date">${esc(e.day)} ${esc(e.month)}</span> <strong>${esc(e.kindLabel)}</strong><span class="ev-when">${esc(e.whenLabel)}</span></li>`)
    .join('\n')
  return `
    <section class="block">
      <h2>Events ahead</h2>
      <ul class="events">${rows}</ul>
    </section>`
}

function sourcesFooter(payload: DailyBriefPayload, rows: Row[]): string {
  const b = payload.brief
  // ONE overall confidence signal for the whole brief (the tier, matching the
  // masthead ring) — never a second, differently-computed number in the footer.
  const tier = b.confidenceTier
  const list = sourceList(rows, payload.events)
  const items = list
    .map((s) => (s.url ? `<li><a href="${esc(s.url)}">${esc(s.name)}</a></li>` : `<li>${esc(s.name)}</li>`))
    .join('\n')
  return `
    <section class="footer">
      <div class="conf">
        <span class="conf-badge conf-${tier.toLowerCase()}">${esc(tier)} source confidence</span>
        <span class="conf-meta">${b.developmentsCount} developments · ${b.sourcesCount} source-backed · ${b.domainsCount} distinct domains · data as of ${esc(b.lastUpdatedLabel)}</span>
      </div>
      ${items ? `<div class="sources"><div class="sources-label">Sources &amp; evidence</div><ul>${items}</ul></div>` : ''}
      <p class="fineprint">Figures sourced from company filings, IRDAI &amp; GI Council disclosures and company investor presentations. AI-gathered items are clearly labelled. Status reflects official confirmation, not media echo; premium metrics (GWP / NWP / NEP) are not profit measures.</p>
    </section>`
}

// ── the document ───────────────────────────────────────────────────────────────

function buildHtml(payload: DailyBriefPayload): string {
  const title = `Daily Brief — ${payload.company} — ${payload.dateLabel}`
  const rows = rowsFor(payload)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  :root {
    --navy-deep: #14294C; --navy: #1E4079; --gold: #B68B3A; --gold-soft: #F3EAD4;
    --ink: #1E2A44; --ink-2: #5A6479; --line: #E4E1D8; --tint: #F7F5EF;
    --green: #2F855A; --amber: #9C7430; --red: #B4453C; --slate: #5A6479;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--ink); font-size: 12px; line-height: 1.5; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { max-width: 760px; margin: 0 auto; padding: 30px 34px 40px; }

  /* Masthead */
  .masthead { border-bottom: 2px solid var(--navy-deep); padding-bottom: 14px; margin-bottom: 20px; }
  .eyebrow { font-size: 9.5px; letter-spacing: .22em; text-transform: uppercase; color: var(--gold); font-weight: 700; }
  .mast-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-top: 6px; }
  .company { font-family: Georgia, "Times New Roman", serif; font-size: 27px; font-weight: 600; color: var(--navy-deep); line-height: 1.05; }
  .date { font-size: 12px; color: var(--ink-2); margin-top: 3px; }
  .mast-conf { text-align: right; font-size: 10px; color: var(--ink-2); white-space: nowrap; }
  .ring { font-family: Georgia, serif; font-size: 22px; font-weight: 700; color: var(--navy); }
  .ring small { font-size: 11px; }

  h2 {
    font-family: Georgia, "Times New Roman", serif; font-size: 14.5px; font-weight: 600; color: var(--navy-deep);
    margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--line);
  }
  .block { margin: 20px 0; }
  p { margin: 0 0 7px; }
  .muted { color: var(--ink-2); }

  /* Executive brief — 3 lines */
  .exec3 .exec-line { display: flex; gap: 10px; padding: 5px 0; border-bottom: 1px dotted var(--line); }
  .exec3 .exec-line:last-child { border-bottom: 0; }
  .exec-k { flex: 0 0 96px; font-size: 8.5px; letter-spacing: .06em; text-transform: uppercase; font-weight: 700; color: var(--gold); padding-top: 2px; }
  .exec-v { flex: 1; font-family: Georgia, "Times New Roman", serif; font-size: 13px; color: var(--navy-deep); line-height: 1.45; }

  /* One-thing callout */
  .callout { background: var(--gold-soft); border-left: 3px solid var(--gold); border-radius: 6px; padding: 12px 14px; margin: 18px 0; }
  .callout-label { font-size: 8.5px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700; color: #8A6A25; }
  .callout-text { font-family: Georgia, "Times New Roman", serif; font-size: 14.5px; color: var(--navy-deep); margin: 4px 0 0; line-height: 1.4; }

  /* Since yesterday */
  ul.delta { list-style: none; margin: 0; padding: 0; }
  ul.delta li { padding: 3px 0; border-bottom: 1px dotted var(--line); }
  ul.delta li:last-child { border-bottom: 0; }
  .mark { display: inline-block; width: 14px; font-size: 10px; }
  .mark.up { color: var(--green); } .mark.down { color: var(--red); } .mark.flat { color: #8C7A55; }

  /* PE item cards */
  .idea { border: 1px solid var(--line); border-radius: 7px; padding: 11px 13px; margin: 9px 0; page-break-inside: avoid; }
  .idea-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
  .idea-n { display: inline-grid; place-items: center; width: 17px; height: 17px; border-radius: 50%; background: var(--navy-deep); color: #fff; font-size: 9.5px; font-weight: 700; }
  .idea-entity { font-weight: 700; color: var(--navy-deep); font-size: 13px; }
  .idea-conf { margin-left: auto; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 2px 7px; border-radius: 999px; }
  .idea-headline { font-family: Georgia, "Times New Roman", serif; font-size: 13px; font-weight: 600; color: var(--navy-deep); margin: 2px 0 7px; line-height: 1.35; }
  .idea .row { display: flex; gap: 8px; padding: 2.5px 0; }
  .idea .k { flex: 0 0 74px; font-size: 8px; letter-spacing: .05em; text-transform: uppercase; font-weight: 700; color: var(--ink-2); padding-top: 2px; }
  .idea .v { flex: 1; font-size: 11.5px; color: var(--ink); }
  .impact-line { display: block; margin-top: 3px; }

  /* Status pills */
  .status { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 2px 7px; border-radius: 999px; }
  .status-final-rule { background: #DCEFEA; color: #0E6F6D; }
  .status-confirmed { background: #E1F0E6; color: var(--green); }
  .status-draft-expected { background: var(--gold-soft); color: var(--amber); }
  .status-reported { background: #E9EEF6; color: var(--navy); }
  .status-rumour { background: #EFEAE0; color: #8C7A55; }

  /* Metric chips */
  .chips { display: inline-flex; flex-wrap: wrap; gap: 4px; }
  .mchip { font-size: 8.5px; font-weight: 700; color: var(--navy); background: #EDF1F8; border: 1px solid #DCE4F0; border-radius: 4px; padding: 1px 6px; }

  /* Exposure + action + sources */
  .exp { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 1.5px 7px; border-radius: 999px; }
  .exp-high { background: #F6E2DE; color: var(--red); }
  .exp-medium { background: var(--gold-soft); color: var(--amber); }
  .exp-low { background: #E1F0E6; color: var(--green); }
  .exp-needs-data { background: #ECECEC; color: var(--slate); }
  .act { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #8A6A25; background: rgba(182,139,58,0.12); border-radius: 4px; padding: 1.5px 7px; }
  .src-count { font-weight: 700; color: var(--navy-deep); font-size: 11px; }
  .idea-foot { margin-top: 7px; padding-top: 6px; border-top: 1px dotted var(--line); font-size: 8.5px; color: var(--ink-2); }

  .conf-high { background: #DCEFEA; color: #0E6F6D; } .conf-medium { background: #F3EAD4; color: #9C7430; } .conf-low { background: #EFEAE0; color: #8C7A55; }

  /* Events */
  ul.events { list-style: none; margin: 0; padding: 0; }
  ul.events li { padding: 4px 0; border-bottom: 1px dotted var(--line); display: flex; align-items: baseline; gap: 8px; }
  ul.events li:last-child { border-bottom: 0; }
  .ev-date { flex: 0 0 52px; font-weight: 700; color: var(--navy); font-size: 11px; }
  .ev-when { margin-left: auto; font-size: 10px; color: var(--ink-2); }

  /* Footer */
  .footer { margin-top: 26px; padding-top: 14px; border-top: 2px solid var(--navy-deep); }
  .conf { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .conf-badge { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; padding: 3px 8px; border-radius: 999px; }
  .conf-meta { font-size: 9.5px; color: var(--ink-2); }
  .sources { margin-top: 10px; }
  .sources-label { font-size: 8.5px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: var(--ink-2); margin-bottom: 4px; }
  .sources ul { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 22px; }
  .sources li { font-size: 9.5px; padding: 1.5px 0; break-inside: avoid; }
  .sources a { color: var(--navy); text-decoration: none; }
  .fineprint { margin-top: 12px; font-size: 8.5px; color: var(--ink-2); line-height: 1.4; }

  @media print {
    .page { padding: 0; max-width: none; }
    @page { margin: 14mm 14mm; }
  }
</style>
</head>
<body>
  <div class="page">
    <header class="masthead">
      <div class="eyebrow">Daily Intelligence Brief</div>
      <div class="mast-row">
        <div>
          <div class="company">${esc(payload.company)}</div>
          <div class="date">${payload.isToday ? 'Today · ' : ''}${esc(payload.dateLabel)}</div>
        </div>
        <div class="mast-conf">
          <div class="ring">${payload.brief.confidencePct}<small>%</small></div>
          <div>${esc(payload.brief.confidenceTier)} confidence</div>
          <div>${payload.brief.readingMins} min read</div>
        </div>
      </div>
    </header>

    ${execSection(rows, payload.message)}
    ${oneThingSection(payload.one, payload.message)}
    ${sinceSection(payload.sinceDeltas)}
    ${itemsSection(rows)}
    ${eventsSection(payload.events)}
    ${sourcesFooter(payload, rows)}
  </div>
</body>
</html>`
}

/** The composed daily-brief document as a standalone HTML string (pure — no DOM).
 *  Exposed so the same brief can be rendered outside the browser (server-side PDF,
 *  an emailed morning note) from the identical PE-impact logic. */
export function renderDailyBriefHtml(payload: DailyBriefPayload): string {
  return buildHtml(payload)
}

/** Open the composed daily brief in a print-ready window and trigger the browser's
 *  print-to-PDF dialog. Returns false if the window was blocked (popup blocker). */
export function downloadDailyBrief(payload: DailyBriefPayload): boolean {
  const html = buildHtml(payload)
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  // Give the new document a beat to lay out before invoking print.
  window.setTimeout(() => {
    try {
      w.print()
    } catch {
      /* user can still print manually from the opened window */
    }
  }, 350)
  return true
}
