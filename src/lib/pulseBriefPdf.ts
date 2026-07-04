// ---------------------------------------------------------------------------
//  Daily Brief export — turns the composed Pulse read into a clean, printable
//  daily note (PDF via the browser's print-to-PDF, no external library).
//
//  It reads like an analyst's morning memo — NOT a screenshot of the UI: a dated
//  header, the executive brief, the one thing to read, what changed since
//  yesterday, the highest-conviction ideas (with the full why), events ahead,
//  the action list, and a source-confidence footer with the evidence list.
//
//  Honesty (CLAUDE.md): every line here is passed in from the real, source-backed
//  derivation layer. Nothing is fabricated; empty sections are simply omitted.
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

export interface DailyBriefPayload {
  company: string
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

const stars = (n: number): string => '★★★★★'.slice(0, Math.max(0, Math.min(5, n))) + '☆☆☆☆☆'.slice(0, 5 - Math.max(0, Math.min(5, n)))

/** Deduped evidence list across every conviction idea + event — the "sources" foot. */
function sourceList(payload: DailyBriefPayload): { name: string; url: string }[] {
  const seen = new Set<string>()
  const out: { name: string; url: string }[] = []
  const add = (name?: string, url?: string) => {
    const key = (url || name || '').trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push({ name: name || url || '', url: url || '' })
  }
  payload.ideas.forEach((i) => i.sources.forEach((s) => add(s.name, s.url)))
  payload.events.forEach((e) => add(e.kindLabel, e.url))
  return out.slice(0, 24)
}

// ── section builders (return '' when empty, so nothing renders) ────────────────

function briefSection(m: BriefMessage): string {
  if (m.nothing) {
    return `<p class="lead">No major new insight dropped today. The existing thesis remains live.</p>`
  }
  const parts: string[] = []
  if (m.since) parts.push(`<p class="lead">${esc(m.since)}</p>`)
  if (m.why) parts.push(`<p>${esc(m.why)}</p>`)
  if (m.watch) parts.push(`<p><span class="tag">Watch next</span> ${esc(m.watch)}</p>`)
  return parts.join('\n')
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
      const cls = d.direction === 'down' ? 'down' : d.direction === 'flat' ? 'flat' : 'up'
      return `<li><span class="mark ${cls}">${mark}</span> <strong>${esc(d.value)}</strong> ${esc(d.label)}</li>`
    })
    .join('\n')
  return `
    <section class="block">
      <h2>What changed since yesterday</h2>
      <ul class="delta">${rows}</ul>
    </section>`
}

function ideasSection(ideas: ConvictionIdea[]): string {
  if (!ideas.length) return ''
  const cards = ideas
    .slice(0, 4)
    .map((idea, i) => {
      const w = idea.why
      const rows: string[] = []
      if (w.whatHappened) rows.push(`<div class="row"><span class="k">What happened</span><span class="v">${esc(w.whatHappened)}</span></div>`)
      if (w.whyItMatters) rows.push(`<div class="row"><span class="k">Why it matters</span><span class="v">${esc(w.whyItMatters)}</span></div>`)
      if (w.whoAffected) rows.push(`<div class="row"><span class="k">Who is affected</span><span class="v">${esc(w.whoAffected)}</span></div>`)
      if (idea.whatToWatch) rows.push(`<div class="row"><span class="k">What to watch next</span><span class="v">${esc(idea.whatToWatch)}</span></div>`)
      const srcNames = idea.sources.slice(0, 3).map((s) => esc(s.name)).join(' · ')
      const srcLine = srcNames ? `<div class="row"><span class="k">Source basis</span><span class="v muted">${srcNames}</span></div>` : ''
      // Honest freshness trail: published vs discovered vs classification — so a "found
      // today" item is never read as "happened today".
      const freshLine = `<div class="row"><span class="k">Freshness</span><span class="v muted">Published ${esc(idea.publishedLabel)} · Discovered ${esc(idea.discoveredLabel)} · ${esc(idea.freshnessLabel)}</span></div>`
      return `
        <article class="idea">
          <div class="idea-head">
            <span class="idea-n">${i + 1}</span>
            <span class="idea-entity">${esc(idea.entity)}</span>
            <span class="idea-stars" title="${idea.stars} / 5 conviction">${stars(idea.stars)}</span>
            <span class="idea-conf">${idea.confidencePct}% confidence · ${idea.evidenceCount} source${idea.evidenceCount === 1 ? '' : 's'}</span>
          </div>
          ${rows.join('\n')}
          ${srcLine}
          ${freshLine}
        </article>`
    })
    .join('\n')
  return `
    <section class="block">
      <h2>Highest-conviction ideas</h2>
      ${cards}
    </section>`
}

function eventsSection(events: PulseEvent[]): string {
  if (!events.length) return ''
  const rows = events
    .slice(0, 6)
    .map((e) => `<li><span class="ev-date">${esc(e.day)} ${esc(e.month)}</span> <strong>${esc(e.kindLabel)}</strong><span class="ev-when">${esc(e.whenLabel)}</span></li>`)
    .join('\n')
  return `
    <section class="block">
      <h2>Events ahead</h2>
      <ul class="events">${rows}</ul>
    </section>`
}

function actionsSection(actions: PulseAction[]): string {
  if (!actions.length) return ''
  const rows = actions.map((a) => `<li>${esc(a.label)}</li>`).join('\n')
  return `
    <section class="block">
      <h2>Action for today</h2>
      <ul class="actions">${rows}</ul>
    </section>`
}

function sourcesFooter(payload: DailyBriefPayload): string {
  const b = payload.brief
  const list = sourceList(payload)
  const items = list
    .map((s) => (s.url ? `<li><a href="${esc(s.url)}">${esc(s.name)}</a></li>` : `<li>${esc(s.name)}</li>`))
    .join('\n')
  return `
    <section class="footer">
      <div class="conf">
        <span class="conf-badge conf-${payload.confidence.toLowerCase()}">${esc(payload.confidence)} source confidence</span>
        <span class="conf-meta">${b.developmentsCount} developments · ${b.sourcesCount} source-backed · ${b.domainsCount} distinct domains · data as of ${esc(b.lastUpdatedLabel)}</span>
      </div>
      ${items ? `<div class="sources"><div class="sources-label">Sources &amp; evidence</div><ul>${items}</ul></div>` : ''}
      <p class="fineprint">Figures sourced from company filings, IRDAI &amp; GI Council disclosures and company investor presentations. AI-gathered items are clearly labelled. Premium metrics (GWP / NWP / NEP) are not profit measures.</p>
    </section>`
}

// ── the document ───────────────────────────────────────────────────────────────

function buildHtml(payload: DailyBriefPayload): string {
  const title = `Daily Brief — ${payload.company} — ${payload.dateLabel}`
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
  .lead { font-family: Georgia, "Times New Roman", serif; font-size: 14px; color: var(--navy-deep); line-height: 1.45; }
  .exec p { color: var(--ink); }
  .tag { font-size: 8.5px; letter-spacing: .1em; text-transform: uppercase; font-weight: 700; color: var(--gold); }

  /* One-thing callout */
  .callout { background: var(--gold-soft); border-left: 3px solid var(--gold); border-radius: 6px; padding: 12px 14px; margin: 18px 0; }
  .callout-label { font-size: 8.5px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700; color: #8A6A25; }
  .callout-text { font-family: Georgia, "Times New Roman", serif; font-size: 14.5px; color: var(--navy-deep); margin: 4px 0 0; line-height: 1.4; }

  /* Since yesterday */
  ul.delta { list-style: none; margin: 0; padding: 0; }
  ul.delta li { padding: 3px 0; border-bottom: 1px dotted var(--line); }
  ul.delta li:last-child { border-bottom: 0; }
  .mark { display: inline-block; width: 14px; font-size: 10px; }
  .mark.up { color: #2F855A; } .mark.down { color: #B4453C; } .mark.flat { color: #8C7A55; }

  /* Ideas */
  .idea { border: 1px solid var(--line); border-radius: 7px; padding: 11px 13px; margin: 9px 0; page-break-inside: avoid; }
  .idea-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 7px; }
  .idea-n { display: inline-grid; place-items: center; width: 17px; height: 17px; border-radius: 50%; background: var(--navy-deep); color: #fff; font-size: 9.5px; font-weight: 700; }
  .idea-entity { font-weight: 700; color: var(--navy-deep); font-size: 13px; }
  .idea-stars { color: var(--gold); letter-spacing: 1px; font-size: 11px; }
  .idea-conf { margin-left: auto; font-size: 9.5px; color: var(--ink-2); }
  .idea .row { display: flex; gap: 8px; padding: 2px 0; }
  .idea .k { flex: 0 0 108px; font-size: 8.5px; letter-spacing: .04em; text-transform: uppercase; font-weight: 700; color: var(--ink-2); padding-top: 1px; }
  .idea .v { flex: 1; font-size: 11.5px; color: var(--ink); }
  .idea .v.muted { color: var(--ink-2); }

  /* Events + actions */
  ul.events, ul.actions { list-style: none; margin: 0; padding: 0; }
  ul.events li { padding: 4px 0; border-bottom: 1px dotted var(--line); display: flex; align-items: baseline; gap: 8px; }
  ul.events li:last-child { border-bottom: 0; }
  .ev-date { flex: 0 0 52px; font-weight: 700; color: var(--navy); font-size: 11px; }
  .ev-when { margin-left: auto; font-size: 10px; color: var(--ink-2); }
  ul.actions li { padding: 4px 0 4px 16px; position: relative; }
  ul.actions li::before { content: "→"; position: absolute; left: 0; color: var(--gold); font-weight: 700; }

  /* Footer */
  .footer { margin-top: 26px; padding-top: 14px; border-top: 2px solid var(--navy-deep); }
  .conf { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .conf-badge { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; padding: 3px 8px; border-radius: 999px; }
  .conf-high { background: #DCEFEA; color: #0E6F6D; } .conf-medium { background: #F3EAD4; color: #9C7430; } .conf-low { background: #EFEAE0; color: #8C7A55; }
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

    <section class="block exec">
      <h2>Executive brief</h2>
      ${briefSection(payload.message)}
    </section>

    ${oneThingSection(payload.one, payload.message)}
    ${sinceSection(payload.sinceDeltas)}
    ${ideasSection(payload.ideas)}
    ${eventsSection(payload.events)}
    ${actionsSection(payload.actions)}
    ${sourcesFooter(payload)}
  </div>
</body>
</html>`
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
