// ---------------------------------------------------------------------------
//  agent-table — read one row of a markdown table from a muns-agent answer.
//
//  The agent's replies drifted from bare pipe rows to decorated markdown
//  (seen from Aug 2026): a leading "|", **bold** figures, <span style=…>
//  colour tags, ▲/▼ trend arrows and [text](url) links. Parsers that split on
//  "|" and read raw cells either matched nothing (the leading pipe shifts every
//  column) or mis-read numbers — a first-number regex takes "1" out of
//  "#1E3A8A" — and the fetchers reported "no change" as a green run
//  (valuation snapshot frozen at 2026-08-04, ownership at Mar-2026).
//
//  This is the one shared reader. It strips the decoration and never guesses:
//  a ▲/▼ is a trend colour on a printed magnitude, not a sign.
// ---------------------------------------------------------------------------

// A real HTML tag only (a name right after "<" or "</"), so prose such as
// "growth <5% vs >10%" is left alone.
const HTML_TAG = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/g
const MD_LINK = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g
const WHOLE_MD_LINK = /^\[[^\]]*\]\((https?:\/\/[^)\s]+)\)$/
const TREND_ARROWS = /[▲▼△▽↑↓⬆⬇🔺🔻]/gu

/** Plain text of one table cell. A cell that is just a markdown link becomes
 *  its URL; a link inside other text becomes "text url" (no brackets, so a URL
 *  regex never captures a trailing ")"). */
export function cleanCell(raw: string | undefined): string {
  let s = (raw ?? '').trim()
  const whole = s.match(WHOLE_MD_LINK)
  if (whole) return whole[1]
  s = s.replace(MD_LINK, (_m, text: string, url: string) => (text.trim() ? `${text.trim()} ${url}` : url))
  s = s.replace(HTML_TAG, '')
  s = s
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
  s = s.replace(/\*\*|__|`/g, '').replace(TREND_ARROWS, '')
  return s.replace(/^["'*_\s]+|["'*_\s]+$/g, '').replace(/\s{2,}/g, ' ').trim()
}

/** Cleaned cells of one markdown table row, with the outer pipes dropped.
 *  Null for a line that isn't a table row, or for the |---|---| divider. */
export function tableRow(line: string): string[] | null {
  const t = line.trim()
  if (!t.includes('|')) return null
  const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cleanCell)
  if (cells.every((c) => c === '' || /^:?-{2,}:?$/.test(c))) return null
  return cells
}
