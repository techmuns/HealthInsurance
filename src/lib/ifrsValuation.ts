// ---------------------------------------------------------------------------
//  IFRS valuation multiples (P/E, P/B) — the SINGLE valuation basis the whole
//  dashboard prices listed insurers on.
//
//  These are the SAME figures the Extracted Data Audit grid computes in its
//  "P/E (IFRS)" / "P/B (IFRS)" columns:
//     P/E (IFRS) = market cap ÷ IFRS PAT
//     P/B (IFRS) = market cap ÷ IFRS net worth
//  projected into a slim per-company snapshot by scripts/excel/build_audit_index.py
//  (so the browser reads a few numbers, not the 11 MB audit index). Every
//  valuation surface — the Competitive Positioning card and the Analysis Builder
//  — reads them here, so the dashboard shows ONE P/E and P/B per company,
//  matching the audit grid AND the Valuation tab.
//
//  Why not the daily screener multiple? The third-party P/E (e.g. Niva Bupa
//  132.8x) divides the price by a much smaller, statutory/TTM earnings base than
//  the company's audited IFRS profit (₹366 Cr) — making the stock look ~3× more
//  expensive than its own reported profit implies, and contradicting the audit
//  grid's 42.8x. Pricing on the IFRS / listed-reporting basis (the same basis
//  the financials are shown on) keeps the page internally consistent.
//
//  Honest missing (missing ≠ zero): a company with no IFRS profit / net worth on
//  record — the unlisted SAHIs (no market price) and the multiline general
//  insurers (no IFRS accounts) — is simply absent from the snapshot, so this
//  returns null and the cell renders an honest "—" / NA. Never a 0, never a
//  cross-basis fill.
// ---------------------------------------------------------------------------

import ifrsMultiples from '@/data/snapshots/ifrs-valuation-multiples.json'

interface IfrsMultipleRow {
  /** P/E (IFRS) = market cap ÷ IFRS PAT. */
  pe?: number | null
  /** P/B (IFRS) = market cap ÷ IFRS net worth. */
  pb?: number | null
}

const BY_COMPANY: Record<string, IfrsMultipleRow> =
  (ifrsMultiples as { data?: Record<string, IfrsMultipleRow> }).data ?? {}

/**
 * The IFRS-basis P/E or P/B for a company — the same value shown in the audit
 * grid and the Valuation tab. `null` when there's no IFRS profit / net worth on
 * record for the company (unlisted SAHIs; multiline general insurers) → honest
 * NA, never a 0 and never the screener multiple on a different basis.
 */
export function ifrsValuationMultiple(companyId: string, kind: 'pe' | 'pb'): number | null {
  const v = BY_COMPANY[companyId]?.[kind]
  return typeof v === 'number' && isFinite(v) ? v : null
}
