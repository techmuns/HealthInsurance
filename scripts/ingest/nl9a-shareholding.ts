// ---------------------------------------------------------------------------
//  Shareholding pattern from an insurer's IRDAI public disclosure
//  (Form NL-9 "Pattern of shareholding" + Form NL-9A "Shareholding pattern
//  schedule", Part A) - read from the pdf-parse text of the quarterly
//  public-disclosure PDF the pipeline already stages.
//
//  Agent-free and official: the insurer publishes these forms every quarter,
//  certified by management, and NL-9A names every holder above 1% of the
//  paid-up equity (foot-note (a) of the form) - the same threshold as the
//  exchange shareholding pattern.
//
//  Strict on purpose - anything that doesn't tie returns null (never a guess):
//   * the quarter-end date must read the same in NL-9 and NL-9A,
//   * every line's % must match shares / NL-9 total, and its paid-up (Rs lakh,
//     Rs 10 shares) must match shares / 10,000,
//   * the promoter lines plus every public category must add up EXACTLY to the
//     NL-9 total (the printed NL-9A "Total" row is not used - it can be wrong
//     in the source: Niva's Jun-2026 form prints 1,66,63,53,816 against a
//     true 1,84,92,33,703).
// ---------------------------------------------------------------------------

export interface Nl9aLine {
  /** Label as printed, whitespace-collapsed ("(a) DSP Mutual Fund Through various schemes"). */
  label: string
  shares: number
  pct: number
}
export interface Nl9aCategory extends Nl9aLine {
  /** The holders the form names inside this category (above 1%). */
  named: Nl9aLine[]
}
export interface Nl9aShareholding {
  /** Quarter end, YYYY-MM-DD. */
  asOf: string
  /** Total equity shares (Form NL-9 TOTAL, current-quarter column). */
  total: number
  /** Promoter holders (always named individually). */
  promoters: Nl9aLine[]
  /** Public / non-promoter categories, each with its named holders. */
  categories: Nl9aCategory[]
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

/** "JUNE 30,2026" / "March 31, 2026" -> "2026-06-30". */
function isoFromWords(s: string): string | null {
  const m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\s*,\s*(\d{4})/i)
  if (!m) return null
  return `${m[3]}-${MONTHS[m[1].toLowerCase()]}-${m[2].padStart(2, '0')}`
}

const NUM = /^\d{1,3}(?:,\d{2,3})*(?:\.\d+)?$|^\d+(?:\.\d+)?$/
const toNum = (t: string) => Number(t.replace(/,/g, ''))

/** Split a record into its label and the numbers printed after it. */
function splitRecord(record: string): { label: string; nums: string[] } {
  const tokens = record.replace(/\s+/g, ' ').trim().split(' ')
  let i = tokens.length
  while (i > 0 && (NUM.test(tokens[i - 1]) || tokens[i - 1] === '-')) i--
  return { label: tokens.slice(0, i).join(' '), nums: tokens.slice(i).filter((t) => t !== '-') }
}

/** Shares + % from a line's numbers: [investors?, shares, pct, paid-up?]. */
function readLine(nums: string[]): { shares: number; pct: number; paidUp: number | null } | null {
  const firstDec = nums.findIndex((t) => t.includes('.'))
  if (firstDec < 1) return null
  const shares = toNum(nums[firstDec - 1])
  const pct = toNum(nums[firstDec])
  const paidUp = nums[firstDec + 1]?.includes('.') ? toNum(nums[firstDec + 1]) : null
  if (!Number.isInteger(shares) || shares <= 0 || !(pct >= 0 && pct <= 100)) return null
  return { shares, pct, paidUp }
}

// A new record starts at a row marker; anything else continues the previous
// record (labels and numbers wrap onto following lines in the PDF text).
const ROW_START = /^\s*(?:\([a-z]\)|[ivx]+\s*[).]|-\s*[A-Za-z]|A\.\d|B\.\d|\d\.\d\)|A\s*Promoters|B\.?\s*Non|Total\b|Foot\s*Notes)/i

/** The parsed forms, or null plus the reason they didn't tie (for the run log). */
export function parseNl9aShareholding(text: string): { data: Nl9aShareholding | null; reason: string } {
  const fail = (reason: string) => ({ data: null, reason })
  // ── Form NL-9: the total and the quarter it is for ──
  const nl9Start = text.search(/FORM NL-9\s*-\s*PATTERN OF SHAREHOLDING/i)
  const nl9aStart = text.search(/FORM NL-9A/i)
  if (nl9Start < 0 || nl9aStart < nl9Start) return fail('no Form NL-9 / NL-9A in the document')
  const nl9 = text.slice(nl9Start, nl9aStart)
  const totalM = nl9.match(/\bTOTAL\s+([\d,]+)\s+100(?:\.00)?%/)
  const asAtM = nl9.match(/As at\s+([A-Za-z]+\.?\s+\d{1,2}\s*,\s*\d{4})/i)
  if (!totalM || !asAtM) return fail('Form NL-9 total or date not found')
  const total = toNum(totalM[1])
  const nl9AsOf = isoFromWords(asAtM[1])
  if (!Number.isInteger(total) || total <= 0 || !nl9AsOf) return fail('Form NL-9 total or date unreadable')

  // ── Form NL-9A Part A (the insurer itself; Part B is the foreign promoter) ──
  const rest = text.slice(nl9aStart)
  const partBAt = rest.search(/\bPART\s*B\s*:/i)
  const partA = partBAt > 0 ? rest.slice(0, partBAt) : rest
  const asOfM = partA.match(/AS AT QUARTER ENDED\s+([A-Za-z]+\.?\s+\d{1,2}\s*,\s*\d{4})/i)
  if (!asOfM || isoFromWords(asOfM[1]) !== nl9AsOf)
    return fail(`NL-9A quarter (${asOfM ? isoFromWords(asOfM[1]) : 'not found'}) doesn't match NL-9 (${nl9AsOf})`)

  const records: string[] = []
  for (const line of partA.split('\n')) {
    if (ROW_START.test(line) || !records.length) records.push(line)
    else records[records.length - 1] += ` ${line}`
  }

  const promoters: Nl9aLine[] = []
  const categories: Nl9aCategory[] = []
  let section: 'A' | 'B' | null = null
  let current: Nl9aCategory | null = null
  for (const rec of records) {
    const { label, nums } = splitRecord(rec)
    if (/^A\s*Promoters/i.test(label)) { section = 'A'; current = null; continue }
    if (/^B\.?\s*Non\s*Promoters/i.test(label)) { section = 'B'; current = null; continue }
    // The table's closing "Total" row (label exactly "Total"; the column
    // headings above the table also start with "Total Shares held").
    if (section === 'B' && (/^Total$/i.test(label) || /^Foot\s*Notes/i.test(label))) break
    if (!section) continue
    const line = readLine(nums)
    const named = /^\([a-z]\)/.test(label)
    // A named holder always prints its holding; one we can't read would turn
    // into a wrong "not disclosed", so the whole quarter is refused instead.
    if (named && !line) return fail(`named holder "${label}" has no readable holding`)
    if (line) {
      // Each printed line must be internally consistent, or the read is wrong.
      if (Math.abs(line.pct - (100 * line.shares) / total) > 0.011)
        return fail(`"${label}": ${line.pct}% doesn't match its ${line.shares} shares`)
      if (line.paidUp != null && line.shares >= 1000 && Math.abs(line.paidUp - line.shares / 10_000) > 0.011)
        return fail(`"${label}": paid-up ${line.paidUp} doesn't match its ${line.shares} shares`)
    }
    if (section === 'A') {
      if (named && line) promoters.push({ label, shares: line.shares, pct: line.pct })
      else if (line) return fail(`promoter line "${label}" carries shares but names no holder`)
      continue
    }
    if (named && line) {
      if (!current) return fail(`named holder "${label}" sits outside any category`)
      current.named.push({ label, shares: line.shares, pct: line.pct })
      continue
    }
    current = line ? { label, shares: line.shares, pct: line.pct, named: [] } : null
    if (current) categories.push(current)
  }

  // Completeness: promoters + every public category must be the whole company.
  const sum = promoters.reduce((s, l) => s + l.shares, 0) + categories.reduce((s, c) => s + c.shares, 0)
  if (!promoters.length) return fail('no promoter holding found')
  if (sum !== total) return fail(`categories add to ${sum} shares, not the NL-9 total ${total}`)
  // A category's named holders can never exceed the category.
  for (const c of categories)
    if (c.named.reduce((s, n) => s + n.shares, 0) > c.shares) return fail(`named holders exceed their category "${c.label}"`)

  return { data: { asOf: nl9AsOf, total, promoters, categories }, reason: 'ok' }
}
