import { useEffect, useRef, useState, type ComponentType } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { AuditFocus, NavTarget } from '@/insights/sourceMap'
import type { InsightFocus } from '@/insights/insightFocus'
import { FilterProvider, useFilters } from '@/state/filters'
import { InsightFocusProvider, type InsightFocusValue } from '@/state/insightFocus'
import { AuditSourceProvider, type AuditSourceValue } from '@/state/auditSource'
import { VerifyProvider } from '@/state/verifyState'
import { DEFAULT_RANGE } from '@/lib/dateRange'
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary'
import { SectionTransition } from '@/components/SectionTransition'
import { DataAuditPane } from '@/components/DataAuditPane'
import { HeaderSwitcher, type TopPage } from '@/components/HeaderSwitcher'
import { SahiAnalysisHeader } from '@/components/SahiAnalysisHeader'
import { type SectionTab } from '@/components/SectionTabs'
import { Sidebar } from '@/components/Sidebar'
import { MarketTrendExplorer } from '@/components/MarketTrendExplorer'
import { ExecutiveOverview } from '@/sections/ExecutiveOverview'
import { MarketDistribution } from '@/sections/MarketDistribution'
import { CompetitivePositioning } from '@/sections/CompetitivePositioning'
import { ProfitabilityReview } from '@/sections/ProfitabilityReview'
import { ValuationMarketView } from '@/sections/ValuationMarketView'
import { StreetView } from '@/sections/StreetView'
import { OwnershipGovernance } from '@/sections/OwnershipGovernance'
import { SectoralNews } from '@/sections/SectoralNews'
import { Insights } from '@/sections/Insights'

// The Data Audit tab carries a ~1 MB cell-level index that should only load when
// a reviewer actually opens the QA surface, never on first paint. DataAuditPane
// owns that lazy load (a dynamic import) plus the premium "preparing" progress
// experience, so opening Data Audit is the only place that pulls SheetJS + the
// cell-level model.

type SectionProps = { onNavigate?: (id: string) => void; sub?: string }

// ── SAHI Analysis sub-navigation ────────────────────────────────────────────
// The detailed SAHI workspace starts directly at Companies (Overview has moved
// to Industry Insights > Health Industry Insights). Each tab maps to a route
// string that drives the period/basis behaviour in the SAHI header.
const SAHI_TABS: SectionTab[] = [
  { id: 'companies', label: 'Companies' },
  { id: 'distribution', label: 'Premium & Distribution' },
  { id: 'profitability', label: 'Profitability' },
  { id: 'valuation', label: 'Valuation' },
  { id: 'street-view', label: 'Street View' },
  { id: 'governance', label: 'Governance' },
  { id: 'sector-news', label: 'Key Sectoral News' },
]

// Per-view colour-psychology aura key (reuses the section palette below).
const AURA_KEY: Record<string, string> = {
  companies: 'peers',
  distribution: 'market-distribution',
  profitability: 'company-performance',
  valuation: 'company-performance',
  'street-view': 'street-view',
  governance: 'ownership-governance',
  'sector-news': 'sector-news',
}

const SECTION_AURA: Record<string, { a: string; b: string; c: string }> = {
  overview: { a: '#27457E', b: '#168E8E', c: '#B68B3A' },
  'market-distribution': { a: '#168E8E', b: '#4F7BCF', c: '#27457E' },
  'company-performance': { a: '#3D5F9F', b: '#168E8E', c: '#B68B3A' },
  'street-view': { a: '#B68B3A', b: '#27457E', c: '#168E8E' },
  peers: { a: '#6E7BD6', b: '#168E8E', c: '#27457E' },
  'ownership-governance': { a: '#27457E', b: '#8C97A8', c: '#B68B3A' },
  // Editorial field for the sector briefing — navy (trust) / gold (editorial) / teal.
  'sector-news': { a: '#27457E', b: '#B68B3A', c: '#168E8E' },
  // Calm, neutral field for the QA surface — navy / slate / muted gold.
  audit: { a: '#27457E', b: '#8C97A8', c: '#B68B3A' },
  // Analytical / editorial field for Insights — gold (edge) / navy / teal.
  insights: { a: '#B68B3A', b: '#27457E', c: '#168E8E' },
}

/** Wraps a section that manages internal tabs so its routing stays local. */
function StatefulSection({ Comp }: { Comp: ComponentType<SectionProps> }) {
  const [sub, setSub] = useState<string | undefined>(undefined)
  const onNavigate = (route: string) => {
    const rest = route.split('/').slice(1).join('/')
    setSub(rest || undefined)
  }
  return <Comp onNavigate={onNavigate} sub={sub} />
}

/**
 * Industry Insights — the broad insight homepage, two stacked layers:
 *   A. Overall Industry View  (macro insurance market + GI pool shift)
 *   B. SAHI Analysis  (the health drilldown: health-share & premium charts →
 *      the company-specific insurer comparison)
 * No company / year / period controls here — it stays a clean insight layer.
 */
function IndustryInsightsPage() {
  // The Industry page carries no period/range controls, so reset to the annual
  // full-span default on entry — SAHI may have left a quarter/period selection
  // on the shared filters, and the macro charts should read clean annual data.
  const { setPeriod, setRange } = useFilters()
  useEffect(() => {
    setPeriod('Annual')
    setRange(DEFAULT_RANGE)
  }, [setPeriod, setRange])

  return (
    <div className="space-y-6">
      {/* A · Overall Industry View — hero + market-structure snapshot + GI pool. */}
      <ExecutiveOverview />

      {/* B · SAHI Analysis — the health drilldown: the health-share & premium
            workbench. (Insurer-by-insurer peer analysis now lives in
            SAHI Analysis › Peer Positioning.) */}
      <section>
        <div className="mb-4 mt-1 flex items-center gap-2.5 border-t border-soft-border pt-5">
          <span className="h-8 w-[3px] rounded-full bg-gradient-to-b from-champagne to-champagne-deep" />
          <div className="leading-tight">
            <p className="font-display text-[17px] text-navy-deep">SAHI Analysis</p>
            <p className="text-[11.5px] text-ink-secondary">
              Inside health — share &amp; premium trends across the standalone insurers (SAHI)
            </p>
          </div>
        </div>
        <div className="space-y-6">
          <MarketTrendExplorer />
        </div>
      </section>
    </div>
  )
}

/** Renders the active SAHI deep-dive sub-section (no Overview — that has moved).
 *  Each section now carries its own calm, Industry-style header (SahiPageHeader);
 *  the old top headline band was a redundant glass cover and has been removed. */
function SahiContent({ tab }: { tab: string }) {
  switch (tab) {
    case 'distribution':
      return <MarketDistribution />
    case 'profitability':
      return <ProfitabilityReview />
    case 'valuation':
      return <ValuationMarketView />
    case 'street-view':
      return <StreetView />
    case 'governance':
      return <StatefulSection Comp={OwnershipGovernance} />
    case 'sector-news':
      return <SectoralNews />
    case 'companies':
    default:
      return <CompetitivePositioning />
  }
}

/** Where a Data-Audit visit came from, so "Back to dashboard" restores it. */
interface DashboardReturn {
  page: TopPage
  sahiTab?: string
  scroll: number
  label: string
}

function AppInner() {
  const { setHighlightedCompany, highlightedCompany } = useFilters()
  const [page, setPage] = useState<TopPage>('industry')
  const [sahiTab, setSahiTab] = useState('companies')
  const [navOpen, setNavOpen] = useState(false)
  // Insight → source navigation: the Data-Audit cell to highlight on arrival, the
  // insight to offer "Back to Insight" for, and the insight to re-open (flipped)
  // once we land back on the Insights tab.
  const [auditFocus, setAuditFocus] = useState<AuditFocus | null>(null)
  const [insightReturn, setInsightReturn] = useState<string | null>(null)
  const [reopenInsightId, setReopenInsightId] = useState<string | null>(null)
  // Insight-linked chart highlighting: the structured comparison context (metric,
  // company, period vs comparison period, delta) that the destination section uses
  // to visually explain the exact insight the reader arrived from.
  const [insightFocus, setInsightFocus] = useState<InsightFocus | null>(null)
  // Source-tag → Data Audit: where a dashboard source click came from, so the
  // audit view can offer "Back to SAHI Analysis / Industry Data".
  const [dashboardReturn, setDashboardReturn] = useState<DashboardReturn | null>(null)

  // The scrolling content column + the scroll offset to restore on "Back", so a
  // jump out from Pulse/an insight returns to the exact spot the reader left.
  const mainRef = useRef<HTMLElement>(null)
  const returnScrollRef = useRef<number | null>(null)
  const dashScrollRef = useRef<number | null>(null)

  // Whether the current return breadcrumb was opened from Pulse (drives the chip
  // label + the fact that we land back on the Pulse read, not a Data Insights card).
  const fromPulse = insightReturn?.startsWith('pulse') ?? false

  const auraKey = page === 'industry' ? 'overview' : page === 'insights' ? 'insights' : page === 'audit' ? 'audit' : AURA_KEY[sahiTab] ?? 'peers'
  const aura = SECTION_AURA[auraKey] ?? SECTION_AURA.overview

  const selectPage = (p: TopPage) => {
    setPage(p)
    setNavOpen(false)
    // A manual page switch cancels the "return" breadcrumb + any pending scroll restore.
    setInsightReturn(null)
    setAuditFocus(null)
    setInsightFocus(null)
    setDashboardReturn(null)
    returnScrollRef.current = null
  }

  // Source tag on a SAHI Analysis / Industry Data visual → Data Audit at the exact
  // mapped cell (the single source-verification layer). Remembers the origin so the
  // reader can return, and never opens the raw PDF/PPT/URL from the dashboard.
  const goToAuditSource = (focus: AuditFocus) => {
    dashScrollRef.current = null
    setDashboardReturn({
      page,
      sahiTab: page === 'sahi' ? sahiTab : undefined,
      scroll: mainRef.current?.scrollTop ?? 0,
      label: page === 'sahi' ? 'SAHI Analysis' : 'Industry Data',
    })
    // Not an insight jump — keep the Insights breadcrumb + highlight out of it.
    setInsightReturn(null)
    setInsightFocus(null)
    setAuditFocus(focus)
    setPage('audit')
    setNavOpen(false)
  }

  // Return from Data Audit to the dashboard section the source click came from,
  // restoring the page, SAHI tab and scroll position.
  const backToDashboard = () => {
    if (!dashboardReturn) return
    dashScrollRef.current = dashboardReturn.scroll
    setPage(dashboardReturn.page)
    if (dashboardReturn.sahiTab) setSahiTab(dashboardReturn.sahiTab)
    setAuditFocus(null)
    setDashboardReturn(null)
  }

  // Jump from Pulse / an insight to its source — Data Audit first (the verification
  // layer), the dashboard chart only on fallback. Remembers where to return to.
  const goToInsightSource = (target: NavTarget, insightId: string) => {
    returnScrollRef.current = mainRef.current?.scrollTop ?? null
    setInsightReturn(insightId)
    setAuditFocus(target.page === 'audit' ? target.audit ?? null : null)
    // Carry the insight-linked highlight context into the destination section, and
    // pre-select the company it names so the chart lands on the right series. The
    // combined ("all") scope names no single insurer, so it never sets the highlight.
    setInsightFocus(target.focus ?? null)
    const company = target.focus?.company ?? target.company
    if (company && company !== 'all') setHighlightedCompany(company)
    setPage(target.page)
    if (target.sahiTab) setSahiTab(target.sahiTab)
    setNavOpen(false)
  }

  // Return to where the reader jumped from — the same Pulse read (restored filter,
  // date + scroll) or the same insight card, re-flipped to its workings.
  const backToInsight = () => {
    if (insightReturn) setReopenInsightId(insightReturn)
    setInsightReturn(null)
    setAuditFocus(null)
    setInsightFocus(null)
    setPage('insights')
  }

  // The insight-linked highlight context shared with every section via context.
  const focusValue: InsightFocusValue = {
    focus: insightFocus,
    clearFocus: () => setInsightFocus(null),
    returnToOrigin: backToInsight,
    fromPulse,
  }

  // After landing back on Insights, restore the scroll offset the reader left from.
  useEffect(() => {
    if (page !== 'insights' || returnScrollRef.current == null) return
    const y = returnScrollRef.current
    returnScrollRef.current = null
    // Two frames: let Insights (and the Pulse read) paint before we scroll.
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => mainRef.current?.scrollTo({ top: y }))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [page])

  // After returning from Data Audit to the dashboard, restore the scroll offset.
  useEffect(() => {
    if (dashScrollRef.current == null) return
    const y = dashScrollRef.current
    dashScrollRef.current = null
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => mainRef.current?.scrollTo({ top: y }))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [page, sahiTab])

  // Source tags on the SAHI Analysis / Industry Data pages route to Data Audit
  // (the single verification hub) instead of opening raw PDFs / PPTs / URLs.
  const auditSourceValue: AuditSourceValue = {
    active: page === 'sahi' || page === 'industry',
    company: highlightedCompany,
    fromLabel: page === 'sahi' ? 'SAHI Analysis' : 'Industry Data',
    goToAudit: goToAuditSource,
  }

  // Sidebar mirrors the top-level pages as app-level icon nav (ids match TopPage).
  const onSidebarNavigate = (id: string) =>
    selectPage(id === 'sahi' || id === 'audit' || id === 'insights' ? id : 'industry')

  const viewKey = page === 'industry' ? 'industry' : page === 'insights' ? 'insights' : page === 'audit' ? 'audit' : `sahi-${sahiTab}`

  return (
    <InsightFocusProvider value={focusValue}>
      <AuditSourceProvider value={auditSourceValue}>
      <div className="flex h-screen overflow-hidden">
        {/* Lean collapsible left navigation — app-level (the two pages). */}
        <Sidebar
          activeId={page}
          open={navOpen}
          onOpen={() => setNavOpen(true)}
          onClose={() => setNavOpen(false)}
          onNavigate={onSidebarNavigate}
        />

        {/* Main application column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-[rgba(23,43,77,0.07)] bg-[#FAF9F6]/85 px-3 py-2 backdrop-blur-md sm:px-5">
            {/* One header band, ONE shared fixed height (sized for the SAHI
                command bar). Switcher blocks (left) + SAHI command area (right,
                only on SAHI). Industry uses the same height — switcher blocks
                sit vertically centered and airy. Same height ⇒ no content jump. */}
            <div className="flex min-h-[76px] items-center gap-x-4">
              <div className="shrink-0">
                <HeaderSwitcher active={page} onSelect={selectPage} />
              </div>
              {page === 'sahi' && (
                <div className="min-w-0 flex-1 animate-fade-soft">
                  <SahiAnalysisHeader tabs={SAHI_TABS} activeTab={sahiTab} onSelectTab={setSahiTab} />
                </div>
              )}
            </div>
          </header>

          {/* Only this content area scrolls — the shell stays fixed like an app. */}
          <main ref={mainRef} className="relative min-h-0 flex-1 overflow-y-auto scroll-thin">
            {/* Ambient colour-psychology field — retoned per view. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-28 top-6 h-72 w-72 rounded-full opacity-[0.06] blur-3xl transition-colors duration-700 ease-out" style={{ backgroundColor: aura.a }} />
              <div className="absolute right-[-7rem] top-1/3 h-80 w-80 rounded-full opacity-[0.05] blur-3xl transition-colors duration-700 ease-out" style={{ backgroundColor: aura.b }} />
              <div className="absolute bottom-[-5rem] left-1/3 h-64 w-72 rounded-full opacity-[0.045] blur-3xl transition-colors duration-700 ease-out" style={{ backgroundColor: aura.c }} />
              <div className="absolute right-1/4 top-2 h-px w-1/3 bg-gradient-to-r from-transparent via-[#B68B3A]/25 to-transparent" />
            </div>

            <div className="relative z-[1] flex min-h-full flex-col px-4 py-5 sm:px-6 lg:px-8">
              {/* Shared transition wrapper — the header/nav stay fixed while only
                  this inner content area crossfades between views. */}
              <SectionTransition transitionKey={viewKey} className="w-full">
                <SectionErrorBoundary
                  resetKey={viewKey}
                  sectionLabel={page === 'industry' ? 'Industry Insights' : page === 'insights' ? 'Insights' : page === 'audit' ? 'Extracted Data Audit' : 'SAHI Analysis'}
                >
                  {page === 'industry' ? (
                    <IndustryInsightsPage />
                  ) : page === 'insights' ? (
                    <Insights
                      onNavigate={goToInsightSource}
                      reopenInsightId={reopenInsightId}
                      onReopened={() => setReopenInsightId(null)}
                    />
                  ) : page === 'audit' ? (
                    <DataAuditPane focus={auditFocus} />
                  ) : (
                    <SahiContent tab={sahiTab} />
                  )}
                </SectionErrorBoundary>
              </SectionTransition>

              <footer className="mt-auto border-t border-soft-border pt-4 text-center text-[11px] text-ink-secondary">
                Insurance Investment Dashboard · Figures sourced from company filings, IRDAI &amp; GI Council disclosures · AI-gathered items are clearly labelled
              </footer>
            </div>
          </main>
        </div>

        {/* Floating return — shown after jumping from Pulse or an insight to its
            source (Data Audit or a chart). Brings the reader back to exactly where
            they left: the same Pulse read, or the same insight card re-flipped. */}
        {insightReturn && page !== 'insights' && (
          <button
            type="button"
            onClick={backToInsight}
            className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-[#E4CE93] bg-gradient-to-br from-[#1E4079] to-[#143058] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_10px_30px_rgba(23,43,77,0.28)] transition-transform hover:-translate-y-0.5"
          >
            <ArrowLeft className="h-4 w-4" /> {fromPulse ? 'Back to Pulse' : 'Back to Insight'}
          </button>
        )}

        {/* Floating return — shown after routing into Data Audit from a SAHI
            Analysis / Industry Data source tag. Brings the reader back to the
            exact dashboard section (page, tab + scroll) they left. */}
        {dashboardReturn && page === 'audit' && (
          <button
            type="button"
            onClick={backToDashboard}
            className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-[#E4CE93] bg-gradient-to-br from-[#1E4079] to-[#143058] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_10px_30px_rgba(23,43,77,0.28)] transition-transform hover:-translate-y-0.5"
          >
            <ArrowLeft className="h-4 w-4" /> Back to {dashboardReturn.label}
          </button>
        )}
      </div>
      </AuditSourceProvider>
    </InsightFocusProvider>
  )
}

export default function App() {
  return (
    <FilterProvider>
      {/* Verification state lives at the app level so an uploaded Excel survives
          moving between sections — leaving Data Audit no longer discards it. */}
      <VerifyProvider>
        <AppInner />
      </VerifyProvider>
    </FilterProvider>
  )
}
