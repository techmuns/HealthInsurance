import { useMemo, useState } from 'react'
import { useFilters } from '@/state/filters'
import { InsightContextChip } from '@/components/insight/InsightContextChip'
import { useSectionInsight } from '@/components/insight/useSectionInsight'
import { getLatestAnnualFyLabel } from '@/lib/dataLayer'
import { AnalysisBuilder } from '@/components/AnalysisBuilder'
import { SectionTabs } from '@/components/SectionTabs'
import { AccountingBasisToggle } from '@/components/AccountingBasisControls'
import { BASIS_TRACKED_COMPANIES, type AccountingBasis } from '@/data/accountingBasis'
import { getFilteredInsurers, getHighlightedInsurer } from '@/lib/insurers'
import { getScorecard, fmtValue, type CellTone, type MetricDef, type ScoreRow } from '@/lib/peerScorecard'

// ── Palette (institutional light theme — navy + teal) ───────────────────────
const NAVY_PRIMARY = '#27457E'
const TEAL = '#168E8E'
const TEAL_DEEP = '#0E6F6D'
const MUTED_BLUE = '#3D5F9F'
const CORAL_DEEP = '#A8443B'
const SLATE = '#94A3B8'

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Tone → text colour for the value cells (calm, meaning-coded, never loud).
const TONE: Record<CellTone, { fg: string }> = {
  leader: { fg: TEAL_DEEP },
  strong: { fg: TEAL_DEEP },
  neutral: { fg: MUTED_BLUE },
  watch: { fg: '#996A14' },
  weak: { fg: CORAL_DEEP },
  na: { fg: SLATE },
}

// ── Peer comparison table — the primary view (columns / data unchanged) ──────
function TableView({ rows, metrics }: { rows: ScoreRow[]; metrics: MetricDef[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[660px] text-[12px]">
        <thead>
          <tr className="border-b border-soft-border text-ink-secondary">
            <th className="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide">Company</th>
            {metrics.map((m) => <th key={m.key} className="px-3 py-2.5 text-right text-[10.5px] font-semibold">{m.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.insurer.id} className="border-b border-soft-border/60 last:border-0" style={r.focal ? { background: hexA(NAVY_PRIMARY, 0.04) } : undefined}>
              <td className="px-3 py-2.5">
                <span className={r.focal ? 'font-bold text-navy-deep' : 'text-ink-primary'}>{r.insurer.shortName}</span>
              </td>
              {metrics.map((m) => {
                const c = r.cells[m.key]
                return (
                  <td key={m.key} className="px-3 py-2.5 text-right tabular-nums">
                    <span className="font-semibold" style={{ color: c.value == null ? SLATE : TONE[c.tone].fg }}>{fmtValue(c)}</span>
                    {c.rank != null && <span className="ml-1 text-[10px] text-ink-secondary">#{c.rank}</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
// Table-first: the peer comparison table is the default (and first) content —
// the old scorecard summary / sub-scores / "why this score" panel are gone. The
// only other view is the interactive Analysis Builder.
type Tab = 'Table' | 'Analysis Builder'
const TABS: Tab[] = ['Table', 'Analysis Builder']

export function CompetitivePositioning() {
  const filters = useFilters()
  const { focus, ref: focusRef, arrived } = useSectionInsight('companies')
  const [tab, setTab] = useState<Tab>('Table')
  // Accounting lens for the profit-basis column (Combined Ratio). Default
  // IGAAP/Statutory keeps the reported view unchanged; IFRS re-points Combined
  // Ratio to the dual-basis SAHIs' IFRS accounts (others → honest NA).
  const [basis, setBasis] = useState<AccountingBasis>('igaap')

  const card = useMemo(() => getScorecard({ peerGroup: filters.peerGroup, highlightedCompany: filters.highlightedCompany }, basis), [filters.peerGroup, filters.highlightedCompany, basis])

  // Competitive Position has no frequency toggle — the scorecard shows each
  // metric's LATEST real value, which can span fiscal years (e.g. provisional
  // FY26 GWP growth alongside the latest audited FY25 profitability and live
  // market multiples). Each cell's exact period is on its source tag, so the
  // footer states the span honestly rather than claiming one single year.
  const rangeLabel = `latest available per metric · FY26 GWP growth (provisional) · ${getLatestAnnualFyLabel()} profitability · live multiples`

  return (
    <div ref={focusRef} className={`space-y-4 ${arrived ? 'insight-arrival rounded-2xl' : ''}`}>
      {focus && <InsightContextChip focus={focus} />}

      {/* Table-first: the tabs (view switch) and the accounting-basis lens sit in
          the table's OWN header bar, so the basis reads as a control for the table
          itself — no floating card. The Analysis Builder runs its own metric set,
          so the basis lens is hidden there. */}
      {tab === 'Table' ? (
        <div className="overflow-hidden rounded-xl2 border border-soft-border bg-card shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-soft-border bg-[#FAFBFE] px-3 py-2">
            <SectionTabs tabs={TABS.map((t) => ({ id: t, label: t }))} active={tab} onSelect={(id) => setTab(id as Tab)} />
            <AccountingBasisToggle value={basis} onChange={setBasis} compact />
          </div>
          {basis === 'ifrs' && (
            <p className="flex items-start gap-1.5 border-b border-soft-border bg-[#F1FAF8] px-3.5 py-2 text-[11px] leading-snug text-[#0E6F6D]">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#168E8E]" />
              <span>
                <strong className="font-semibold">IFRS lens.</strong> Only the <strong className="font-semibold">Combined Ratio</strong> moves to IFRS, and only for {BASIS_TRACKED_COMPANIES.join(', ')} — the SAHIs that publish IFRS accounts; insurers without an IFRS filing show <em>NA</em> rather than a cross-basis number. ROE has no published IFRS equity, so it stays on the statutory basis. Premium, share and solvency columns are basis-neutral. <strong className="font-semibold">P/E and P/B</strong> are already on the IFRS basis — market cap ÷ IFRS profit / net worth, the same figures as the audit grid — on both lenses.
              </span>
            </p>
          )}
          <TableView rows={card.rows} metrics={card.metrics} />
        </div>
      ) : (
        <>
          <SectionTabs tabs={TABS.map((t) => ({ id: t, label: t }))} active={tab} onSelect={(id) => setTab(id as Tab)} />
          <AnalysisBuilder
            rows={getFilteredInsurers({ peerGroup: filters.peerGroup, highlightedCompany: filters.highlightedCompany })}
            focalId={getHighlightedInsurer({ peerGroup: filters.peerGroup, highlightedCompany: filters.highlightedCompany }).id}
          />
        </>
      )}

      {/* Source row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-soft-border pt-3 text-[10.5px] text-ink-secondary">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold"
          style={{ background: hexA(TEAL, 0.12), color: TEAL_DEEP }}
          title="Official filings (IRDAI disclosures &amp; annual reports); P/E &amp; P/B combine the daily market feed (market cap) with IFRS profit / net worth — the same figures as the audit grid — and growth and signal fields are derived from those figures. No mock data."
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: TEAL }} />
          Source-backed
        </span>
        <span>{rangeLabel} · scorecard basis · {card.groupLabel} peers · Updated {filters.updatedAsOf}</span>
      </div>
    </div>
  )
}
