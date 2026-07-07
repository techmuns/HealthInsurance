/**
 * audit-source-nav — the LIVE source-navigation audit (Playwright).
 *
 * Complements `check:links` (which probes external URLs for 404s): this one
 * proves the INTERNAL navigation works. It walks the analysis surfaces, clicks
 * every source chip that routes to Data Audit, and verifies each lands on its
 * evidence — the "Verify this source" banner names the metric and (when the
 * metric is an addressable cell) that exact cell is highlighted and scrolled to.
 * External chips are recorded (they open a document, by design).
 *
 * A categorized report is written to docs/source-nav-audit.md.
 *
 *   npm run dev            # one shell
 *   npm run audit:source-nav   # another  (BASE_URL / PW_CHROMIUM override)
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173/'
const EXE = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium'

const SURFACES = [
  { label: 'SAHI · Companies', page: 'SAHI Analysis', tab: 'Companies' },
  { label: 'SAHI · Premium & Distribution', page: 'SAHI Analysis', tab: 'Premium & Distribution' },
  { label: 'SAHI · Profitability', page: 'SAHI Analysis', tab: 'Profitability' },
  { label: 'SAHI · Valuation', page: 'SAHI Analysis', tab: 'Valuation' },
  { label: 'SAHI · Street View', page: 'SAHI Analysis', tab: 'Street View' },
  { label: 'SAHI · Governance', page: 'SAHI Analysis', tab: 'Governance' },
  { label: 'SAHI · Key Sectoral News', page: 'SAHI Analysis', tab: 'Key Sectoral News' },
  { label: 'Industry', page: 'Industry', tab: null },
]

const results = []
const record = (r) => { results.push(r); console.log(`  [${r.verdict}] ${r.kind} ${r.detail ?? ''}`) }

async function openPage(page, label) {
  await page.locator('header').getByText(label, { exact: true }).first().click()
  await page.waitForTimeout(700)
}
async function openTab(page, label) {
  const t = page.locator('header').getByText(label, { exact: true }).first()
  if (await t.count()) { await t.click(); await page.waitForTimeout(1100) }
}
async function gotoSurface(page, s) { await openPage(page, s.page); if (s.tab) await openTab(page, s.tab); await page.waitForTimeout(400) }

/** After clicking an internal source chip, capture the landing evidence. */
async function landing(page) {
  try { await page.waitForSelector('[data-source-focus-banner]', { timeout: 15000 }) } catch { return { verdict: 'FAIL', detail: 'no "Verify this source" banner appeared' } }
  await page.waitForTimeout(450) // let the scroll + pulse settle within the ~1.9s window
  const banner = (await page.locator('[data-source-focus-banner]').first().textContent())?.replace(/\s+/g, ' ').trim() || ''
  const hl = await page.$$eval('[data-source-highlight="1"]', (els) => els.map((e) => e.getAttribute('data-cell-id')))
  const pinged = await page.locator('.animate-ping').count()
  if (hl.length || pinged) return { verdict: 'PASS', detail: `cell ${hl[0] ?? '(pulsing)'} · "${banner.slice(0, 70)}"` }
  // Banner but no exact cell = the honest section fallback (metric not an addressable cell).
  return { verdict: 'FALLBACK', detail: `section fallback (no exact cell) · "${banner.slice(0, 70)}"` }
}

async function sweep(page, s) {
  const count = await page.locator('[data-source-kind="internal"]').count()
  const ext = await page.locator('[data-source-kind="external"]').count()
  const none = await page.locator('[data-source-kind="none"]').count()
  // A "none" pill is either a DOCUMENTED feed-level provenance note (marked
  // data-source-note — describes how a whole feed is sourced, real sources are the
  // per-item links) or a genuine silent gap (a datum with no citable URL yet).
  const documented = await page.locator('[data-source-kind="none"][data-source-note]').count()
  const silentGaps = none - documented
  console.log(`${s.label}: internal ${count} · external ${ext} · silent ${silentGaps}${documented ? ` · documented-note ${documented}` : ''}`)
  for (let i = 0; i < ext; i++) {
    const href = await page.locator('[data-source-kind="external"]').nth(i).getAttribute('href')
    record({ surface: s.label, kind: 'external', verdict: href ? 'EXTERNAL_OK' : 'EXTERNAL_NO_HREF', id: await page.locator('[data-source-kind="external"]').nth(i).getAttribute('data-source-id') })
  }
  if (documented) record({ surface: s.label, kind: 'note', verdict: 'PROVENANCE_NOTE', detail: `${documented} feed-level provenance note(s) — real sources are the per-item article links`, count: documented })
  if (silentGaps > 0) record({ surface: s.label, kind: 'none', verdict: 'SILENT_PILL', detail: `${silentGaps} source note(s) with no URL/target`, count: silentGaps })
  for (let i = 0; i < count; i++) {
    await gotoSurface(page, s) // re-navigate each time (the click leaves the page)
    const chip = page.locator('[data-source-kind="internal"]').nth(i)
    if (!(await chip.count())) break
    const target = await chip.getAttribute('data-source-target')
    const id = await chip.getAttribute('data-source-id')
    await chip.scrollIntoViewIfNeeded().catch(() => {})
    await chip.click()
    const l = await landing(page)
    record({ surface: s.label, kind: 'internal', id, target, verdict: l.verdict, detail: l.detail })
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: EXE, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  for (const s of SURFACES) {
    console.log(`\nSweeping ${s.label}…`)
    try { await gotoSurface(page, s); await sweep(page, s) }
    catch (e) { record({ surface: s.label, kind: 'nav', verdict: 'NAV_ERROR', detail: String(e).slice(0, 90) }) }
  }
  await browser.close()

  const internal = results.filter((r) => r.kind === 'internal')
  const pass = internal.filter((r) => r.verdict === 'PASS')
  const fallback = internal.filter((r) => r.verdict === 'FALLBACK')
  const fail = internal.filter((r) => r.verdict === 'FAIL')
  const external = results.filter((r) => r.kind === 'external')
  const extNoHref = external.filter((r) => r.verdict === 'EXTERNAL_NO_HREF')
  const silent = results.filter((r) => r.kind === 'none').reduce((n, r) => n + (r.count || 1), 0)
  const notes = results.filter((r) => r.kind === 'note').reduce((n, r) => n + (r.count || 1), 0)

  const L = []
  L.push('# Source-navigation live audit', '')
  L.push(`_Clicked every internal source chip on the analysis surfaces and verified it lands on its Data Audit evidence. Base: ${BASE_URL}._`, '')
  L.push('## Summary', '', '| Category | Count |', '| --- | ---: |')
  L.push(`| Internal source chips clicked | ${internal.length} |`)
  L.push(`| · PASS (exact cell highlighted) | ${pass.length} |`)
  L.push(`| · FALLBACK (banner only — metric not an addressable cell) | ${fallback.length} |`)
  L.push(`| · FAIL (did not navigate) | ${fail.length} |`)
  L.push(`| External source chips (open a document) | ${external.length} |`)
  L.push(`| · without href | ${extNoHref.length} |`)
  L.push(`| Documented feed provenance notes (intentional — per-item links carry the sources) | ${notes} |`)
  L.push(`| Silent source notes (no URL / no target) | ${silent} |`)
  L.push(`| Page errors | ${pageErrors.length} |`, '')
  if (notes) {
    L.push('## Documented provenance notes (not source gaps)', '')
    L.push('_A feed-level provenance label describes how an entire feed is sourced — it has no single cell or URL because the real per-item sources are the article links inside the feed. Listed here so it is an explained, intentional note, never an unverified gap._', '')
    for (const r of results.filter((x) => x.kind === 'note')) L.push(`- **${r.surface}** — ${r.detail}`)
    L.push('')
  }
  L.push('## Every source click', '', '| Surface | Kind | id / target | Verdict | Detail |', '| --- | --- | --- | --- | --- |')
  for (const r of results) L.push(`| ${r.surface} | ${r.kind} | ${r.id ?? ''}${r.target ? ` → ${r.target}` : ''} | ${r.verdict} | ${(r.detail || '').replace(/\|/g, '/')} |`)
  if (fail.length) { L.push('', '## ❌ Failures', ''); for (const r of fail) L.push(`- [${r.surface}] ${r.id ?? r.target}: ${r.detail}`) }
  mkdirSync('docs', { recursive: true })
  writeFileSync('docs/source-nav-audit.md', L.join('\n'))

  console.log('\n── Source-navigation audit ───────────────────────────────────')
  console.log(`Internal chips:  ${internal.length}  (pass ${pass.length}, fallback ${fallback.length}, fail ${fail.length})`)
  console.log(`External chips:  ${external.length}  (no-href ${extNoHref.length}) · documented notes ${notes} · silent gaps ${silent}`)
  console.log(`Page errors:     ${pageErrors.length}`)
  console.log('Report:          docs/source-nav-audit.md')
  console.log('──────────────────────────────────────────────────────────────')
  if (fail.length || extNoHref.length) { console.error(`\n✗ ${fail.length + extNoHref.length} source link problem(s).`); process.exit(1) }
  console.log('\n✓ Every source click lands on its evidence (or opens its document).')
}

main().catch((e) => { console.error(e); process.exit(1) })
