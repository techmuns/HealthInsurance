// ---------------------------------------------------------------------------
//  Insight Engine — deterministic NARRATION.
//
//  Turns a typed Finding into card copy a reader absorbs in one pass. The
//  writing contract, in order of priority:
//   1. The FIRST sentence of every summary states the concrete fact in plain
//      words — who, what, how much, from what, over which period.
//   2. The second sentence says why it matters (the "so what").
//   3. Jargon is either dropped or defined in-line in a short clause
//      ("combined ratio — claims plus costs per ₹100 of premium").
//   4. Every numeral comes from the finding's own value slots (the assembly
//      layer re-emits them as signals), so the grounding firewall passes by
//      construction. No comma-grouped numbers.
//   5. keyMove carries the one from → to move for the card front.
//
//  Templates are keyed by DETECTOR + DIRECTION — never by card id — which is
//  what lets brand-new insights write themselves when the data moves.
// ---------------------------------------------------------------------------

import type { Application, Insight, Watch } from '@/insights/types'
import type { Finding } from './detect'

export interface FrontCopy {
  shortHeadline: string
  headline: string
  summary: string
  thesis: string
  whatConsensusMisses: string
  consensusView: string
  variantBasis: string
  steelman: string
  falsifier: string
  application: Application
  watch: Watch
  keyMove?: Insight['keyMove']
}

// ── formatting (no thousand separators — grounding-safe) ─────────────────────

const f1 = (n: number) => String(Math.round(n * 10) / 10)
const f2 = (n: number) => String(Math.round(n * 100) / 100)
const cr = (n: number) => `₹${Math.round(n)} cr`
const pp = (n: number) => `${f1(Math.abs(n))}pp`
const pct = (n: number) => `${f1(n)}%`
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${f1(Math.abs(n))}`

const inv = (trigger: string, condition: string): Watch['items'][number] => ({ trigger, condition, direction: 'invalidates' })
const conf = (trigger: string, condition: string): Watch['items'][number] => ({ trigger, condition, direction: 'confirms' })
const app = (framing: string, uses: Application['uses']): Application => ({ framing, uses })
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`
const move = (label: string, from: number | null, to: number, unit: string, divider?: string): Insight['keyMove'] =>
  ({ label, from, to, unit, ...(divider ? { divider } : {}) })

type Narrator = (f: Finding) => FrontCopy

// ─────────────────────────────────────────────────────────────────────────────
//  Market share, quarter by quarter
// ─────────────────────────────────────────────────────────────────────────────

const shareShiftQ: Narrator = (f) => {
  const { cur, prev, delta, retailCr } = f.v
  const { name, prevPeriod } = f.s
  const gain = f.direction === 'gain'
  return {
    shortHeadline: gain ? `${name} is winning retail market share` : `${name} is losing retail market share`,
    headline: `${name}'s share of India's retail health premium: ${pct(prev)} in ${prevPeriod} → ${pct(cur)} in ${f.period} (${signed(delta)}pp)`,
    summary: `${name} wrote ${pct(cur)} of the industry's retail health premium in ${f.period}, ${gain ? 'up from' : 'down from'} ${pct(prev)} in the same quarter last year — ${gain ? 'a gain' : 'a loss'} of ${pp(delta)} of the market, on a ${cr(retailCr)} quarterly book. Retail health is the stickiest, best-priced business an insurer can win, so this is the share that matters most.`,
    thesis: `Quarterly market share is where competitive shifts show up first — annual league tables catch up a year later. ${gain ? `${name} is taking new demand from competitors right now; if the next quarter holds this level, the annual tables will confirm what this print already shows.` : `${name}'s new demand is going to competitors right now; the erosion compounds quietly until the annual table finally shows it, by which point the multiple has usually adjusted.`}`,
    whatConsensusMisses: `Most investors read market share off annual tables. The quarter-by-quarter share is public months earlier — and it already shows ${name} ${gain ? 'gaining' : 'losing'} ${pp(delta)} versus a year ago.`,
    consensusView: `Market-share league tables are annual; a stable full-year ranking reads as a stable franchise.`,
    variantBasis: `The standalone-quarter share (${pct(cur)} now vs ${pct(prev)} the same quarter last year) moves a full year before the annual table does — the shift is visible today.`,
    steelman: `One quarter can be lumpy — a single big product launch or a reclassification can move a point of share. Handled: the comparison is same-quarter against last year (so seasonality cancels), the book is ${cr(retailCr)} (too big for one deal to swing), and the very next print is the test.`,
    falsifier: `The next standalone quarter shows ${name}'s retail share back near ${pct(prev)} — the shift was one-off, not a trend.`,
    application: app(`A competitive-momentum read on ${name}.`, [
      { angle: 'Relative value', detail: 'Rank the cohort on quarterly share moves, not annual tables — the same lens across all names.' },
      { angle: gain ? 'Thesis confirm' : 'Risk flag', detail: gain ? 'Share gains in retail health are the highest-quality growth in this sector — check pricing keeps up.' : 'Quiet share losses hit the growth multiple before they hit reported premium.' },
      { angle: 'Catalyst', detail: 'The next GI Council quarter-end release either extends or reverses the move.' },
    ]),
    watch: { items: [
      inv('Next-quarter retail share', `${name}'s share back near ${pct(prev)} at the next quarterly release.`),
      conf('Share trend', `A second consecutive move in the same direction from ${pct(cur)}.`),
      conf('Retail premium', `The retail book compounding from ${cr(retailCr)} while share holds.`),
    ] },
    keyMove: move(`Retail market share, ${prevPeriod} → ${f.period}`, prev, cur, '%'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Growth breaking its own pattern
// ─────────────────────────────────────────────────────────────────────────────

const growthInflectionQ: Narrator = (f) => {
  const { cur, norm, accel, totalCr } = f.v
  const { name } = f.s
  const dir = f.direction // acceleration | deceleration | contraction
  return {
    shortHeadline: dir === 'acceleration' ? `${name}'s growth just jumped a gear` : dir === 'contraction' ? `${name}'s premium is actually shrinking` : `${name}'s growth is cooling fast`,
    headline: `${name} grew ${dir === 'contraction' ? `−${pct(Math.abs(cur))}` : pct(cur)} in ${f.period} vs its usual ~${pct(norm)} pace — a ${pp(accel)} break from trend`,
    summary: `${name}'s health premium ${dir === 'contraction' ? `fell ${pct(Math.abs(cur))}` : `grew ${pct(cur)}`} in ${f.period} compared with the same quarter last year — ${dir === 'acceleration' ? 'far above' : 'far below'} the ~${pct(norm)} it usually grows (the median of its recent quarters, with government-scheme business stripped out). On a ${cr(totalCr)} quarter, a ${pp(accel)} break from its own pattern means something real changed in the business${dir === 'contraction' ? ' — this is an outright decline, not just slower growth' : ''}.`,
    thesis: `The comparison is same-quarter and excludes government schemes, so seasonality and one-off scheme wins are already out of the number. ${dir === 'acceleration' ? 'When growth jumps this far above a company’s own pace, something started working — distribution, pricing, or a product — and it compounds from here if it holds.' : 'When growth falls this far below a company’s own pace, something stopped working — and most forecasts are still extrapolating the old speed.'}`,
    whatConsensusMisses: `Annual growth figures still show the old pace; the newest quarter runs at ${dir === 'contraction' ? `−${pct(Math.abs(cur))}` : pct(cur)}. Anyone modelling ${name} off last year's rate is ${dir === 'acceleration' ? 'underestimating' : 'overestimating'} it by roughly ${pp(accel)}.`,
    consensusView: `${name} is extrapolated at roughly ${pct(norm)} growth, because that is what the trailing figures show.`,
    variantBasis: `The newest quarter runs at ${dir === 'contraction' ? `−${pct(Math.abs(cur))}` : pct(cur)} — the current pace has already moved ${pp(accel)}; annual numbers will catch up with a lag.`,
    steelman: `One quarter is one data point, and a single large corporate deal can move even a same-quarter comparison. Handled: government schemes are excluded, the base quarter is ${cr(totalCr)} — big enough that one contract rarely moves it this far — and the next print is the direct test.`,
    falsifier: `The following quarter returns to the ~${pct(norm)} usual pace, marking this print as noise or a one-off contract.`,
    application: app(`A growth-pace reset read on ${name}.`, [
      { angle: 'Forecast check', detail: `Re-base premium models on the ${dir === 'contraction' ? `−${pct(Math.abs(cur))}` : pct(cur)} newest pace rather than the trailing average.` },
      { angle: dir === 'acceleration' ? 'Thesis confirm' : 'Risk flag', detail: dir === 'acceleration' ? 'A growth jump on a large base is the strongest confirmation a franchise thesis gets.' : 'Slowdowns on a large base are how premium misses start — check the mix for the cause.' },
    ]),
    watch: { items: [
      inv('Next-quarter growth', `A print back near the ~${pct(norm)} usual pace — the break did not hold.`),
      conf('New pace', `A second consecutive quarter within a few points of ${pct(cur)}.`),
    ] },
    keyMove: move(`Growth vs its usual pace, ${f.period}`, norm, cur, '%'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mix quality — what kind of premium is growing
// ─────────────────────────────────────────────────────────────────────────────

const mixShiftQ: Narrator = (f) => {
  const { mixCur, mixPrev, delta, retailCr, groupCr } = f.v
  const { name, prevPeriod } = f.s
  const retailLed = f.direction === 'retail_led'
  const shrink = f.direction === 'retail_led_shrink'
  const legs = f.v.retailG != null && f.v.groupG != null
    ? ` Underneath: retail premium ${f.v.retailG >= 0 ? 'grew' : 'fell'} ${pct(Math.abs(f.v.retailG))} while group ${f.v.groupG >= 0 ? 'grew' : 'fell'} ${pct(Math.abs(f.v.groupG))}.`
    : ''
  return {
    shortHeadline: shrink ? `${name}'s book is shrinking, not upgrading` : retailLed ? `${name}'s growth just got healthier` : `${name} is leaning on lower-margin group deals`,
    headline: `Retail is now ${pct(mixCur)} of ${name}'s book, vs ${pct(mixPrev)} a year ago (${signed(delta)}pp) — ${shrink ? 'because group collapsed' : retailLed ? 'the good kind of growth' : 'group business is doing the growing'}`,
    summary: `In ${f.period}, ${pct(mixCur)} of ${name}'s health premium came from retail customers, against ${pct(mixPrev)} in ${prevPeriod}.${legs} ${shrink ? 'The retail share rose only because group business fell away — the book got smaller, not better.' : retailLed ? 'Retail policies renew year after year and price better than corporate group deals, so the same headline growth is now worth more.' : 'More of the growth is coming from corporate group deals, which re-price every year in the buyer’s favour — the growth rate looks fine, but its quality is slipping.'}`,
    thesis: shrink
      ? `A rising retail share only signals quality when retail itself is growing. Here retail ${f.v.retailG != null ? `moved ${signed(f.v.retailG)}%` : 'did not grow'} while group collapsed — the right read is lost or abandoned group contracts, and the question is whether the remaining retail base holds its pricing.`
      : `Retail and group health are different businesses: retail renews at high rates with pricing power; group is re-tendered every year on price. A ${pp(delta)} one-quarter shift on a ${cr(retailCr + groupCr)} book re-weights future margin ${retailLed ? 'upward' : 'downward'} before any profit ratio shows it.`,
    whatConsensusMisses: shrink
      ? `A mix table alone scores this as an upgrade; read with the growth legs it is a shrinking book whose retail share rose by default.`
      : retailLed
        ? `Growth screens show one number; the composition shows the same growth is now coming from the better book — which turns into margin several quarters later.`
        : `Growth screens show one number; the composition shows the growth is increasingly group-sourced, which shows up in the loss ratios only quarters later.`,
    consensusView: `Health premium growth is read as one number; what kind of premium is growing rarely gets examined.`,
    variantBasis: `The quarter's own retail/group split (${pct(mixCur)} retail now vs ${pct(mixPrev)} a year ago) re-prices the quality of that growth today.`,
    steelman: `Group business is lumpy — one big corporate win or loss can swing a quarter's mix without any strategy change. Handled: the comparison is same-quarter against last year on a ${cr(retailCr + groupCr)} base, and government schemes are excluded so a scheme win can't pollute the read.`,
    falsifier: `The next quarter's retail share reverts toward ${pct(mixPrev)} — the shift was one contract, not a reallocation.`,
    application: app(`A growth-quality read on ${name}.`, [
      { angle: 'Thesis test', detail: 'Adjust the growth multiple for mix: retail-led growth deserves a premium, group-led growth a discount.' },
      { angle: retailLed ? 'Margin watch' : 'Risk flag', detail: retailLed ? 'A rising retail mix should pull loss ratios down over the next year — watch for the follow-through.' : 'A falling retail mix typically precedes margin pressure by two to four quarters.' },
    ]),
    watch: { items: [
      inv('Next-quarter mix', `Retail share back near ${pct(mixPrev)} — the shift did not persist.`),
      conf('Mix trend', `A second quarter at or beyond ${pct(mixCur)} retail.`),
    ] },
    keyMove: move(`Retail share of the book, ${prevPeriod} → ${f.period}`, mixPrev, mixCur, '%'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  A company breaking its own seasonal pattern
// ─────────────────────────────────────────────────────────────────────────────

const seasonalSurpriseQ: Narrator = (f) => {
  const { cur, mu, z, n, totalCr } = f.v
  const { name, quarterName } = f.s
  const hot = f.direction === 'hot'
  const curTxt = cur < 0 ? `fell ${pct(Math.abs(cur))}` : `grew ${pct(cur)}`
  return {
    shortHeadline: hot ? `${name} just broke its own record pace` : `${name} fell off its own pattern`,
    headline: `${name}'s ${quarterName} ${curTxt} — its ${quarterName}s usually run ~${pct(mu)} (${f2(Math.abs(z))}σ ${hot ? 'above' : 'below'} its own record)`,
    summary: `${name}'s premium ${curTxt} in ${f.period} — in its last ${String(n)} ${quarterName}s it has averaged ~${pct(mu)} growth, so this print sits ${f2(Math.abs(z))} standard deviations ${hot ? 'above' : 'below'} its own record (government schemes excluded, on a ${cr(totalCr)} quarter). Every insurer has a seasonal rhythm; the signal is when a company breaks its own.`,
    thesis: `Comparing ${name} against its own ${quarterName} history removes both seasonality and company-specific quirks in one step — a cleaner test than any peer table. A departure this large says the underlying trajectory changed: ${hot ? 'demand or distribution found another gear' : 'the engine lost a gear, and the season is not the excuse'}.`,
    whatConsensusMisses: `Screens compare this quarter to last quarter or to peers. Almost nobody compares a company to its own same-quarter record — which is the only view where this print stands out as clearly abnormal.`,
    consensusView: cur < 0 ? `A weak quarter gets filed under sector softness — a peer table can't show that it breaks this company's own pattern.` : `A ${pct(cur)} quarter reads as roughly in line for a growth insurer; nothing in a peer table flags it.`,
    variantBasis: `Against its own ${quarterName} record (~${pct(mu)} average over its last ${String(n)} prints) this quarter is a genuine outlier, not ordinary variation.`,
    steelman: `With ${String(n)} historical observations the sample is small, and one unusual year can exaggerate σ-based reads. Handled: the detector requires minimum spread, caps degenerate readings, excludes government schemes and any comparison crossing the Oct-2024 accounting change — and the claim is only that the pattern broke; the cause needs the mix and channel data alongside.`,
    falsifier: `Next year's ${quarterName} returns to the ~${pct(mu)} historical pace, reclassifying this print as a one-year anomaly.`,
    application: app(`A pattern-break screen on ${name}.`, [
      { angle: 'Early warning', detail: hot ? 'Breaks above a company’s own seasonal pattern often front-run guidance raises by a quarter or two.' : 'Breaks below a company’s own pattern often front-run soft full-year numbers.' },
      { angle: 'Cross-check', detail: 'Read together with the same quarter’s mix shift and share move to identify the mechanism.' },
    ]),
    watch: { items: [
      inv('Same quarter next year', `A return to the ~${pct(mu)} historical ${quarterName} pace.`),
      conf('Adjacent quarters', `The surrounding quarters confirming the new trajectory rather than reverting.`),
    ] },
    keyMove: move(`${quarterName} growth vs its usual, ${f.period}`, mu, cur, '%'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Monthly momentum — seeing the turn before results day
// ─────────────────────────────────────────────────────────────────────────────

const monthlyMomentum: Narrator = (f) => {
  const { curG, prevG, shift, curW } = f.v
  const { name, windowEnd } = f.s
  const dir = f.direction // building | fading | normalizing
  return {
    shortHeadline: dir === 'building' ? `${name.replace(/^The /, '')} is speeding up, month by month` : dir === 'normalizing' ? `${name.replace(/^The /, '')}'s hyper-growth is settling down` : `${name.replace(/^The /, '')} is slowing down, month by month`,
    headline: `${name}'s three months to ${windowEnd} grew ${pct(curG)} year-on-year — the three months before that grew ${pct(prevG)}`,
    summary: `${name}'s health premium for the three months to ${windowEnd} was ${pct(curG)} higher than the same three months last year — one quarter earlier the pace was ${pct(prevG)}. That is a ${pp(shift)} ${shift > 0 ? 'pick-up' : 'slow-down'} on a ${cr(curW)} rolling book (monthly regulator filings, government schemes excluded). Quarterly results will not show this until the next reporting date; the monthly data shows it now.`,
    thesis: dir === 'building'
      ? `Monthly premium filings are the earliest reliable read the public data offers — roughly a quarter ahead of results. A ${pp(shift)} acceleration this size, on a base this large, usually survives into the reported quarter.`
      : dir === 'normalizing'
        ? `A ${pct(prevG)} pace was never sustainable — it was a low-base effect washing out. The honest current pace is ${pct(curG)}, and any model still extrapolating the old number is set up for a headline 'miss' that is really just arithmetic.`
        : `A ${pp(shift)} cool-down between rolling windows is the kind of quiet slowdown annual data hides for months. If the next window confirms it, the reported quarter will surprise on the soft side.`,
    whatConsensusMisses: `Most investors wait for quarterly results. The monthly filings already show the pace ${shift > 0 ? 'rising' : 'falling'} — ${pct(prevG)} to ${pct(curG)} — weeks before any result is published.`,
    consensusView: `Growth is tracked quarterly; between results the last reported pace is assumed to continue.`,
    variantBasis: `Rolling three-month growth (${pct(curG)} now vs ${pct(prevG)} a quarter ago) re-times the change to today instead of the next results day.`,
    steelman: `Monthly numbers are lumpy and one big booking can tilt a window. Handled: three-month windows smooth single-month noise, both windows compare like-for-like against their own prior-year months, government schemes are excluded, and the base is ${cr(curW)} — large enough that one deal rarely explains ${pp(shift)}.`,
    falsifier: `The next monthly window reverts toward ${pct(prevG)}, marking the shift as booking-timing noise.`,
    application: app(`An early-warning read on ${name.replace(/^The /, 'the ')}.`, [
      { angle: 'Timing', detail: 'Position before the quarterly result rather than reacting to it — the monthly data already contains its direction.' },
      { angle: dir === 'building' ? 'Thesis confirm' : 'Risk flag', detail: dir === 'building' ? 'Monthly acceleration on a large base tends to survive into the reported quarter.' : 'Two consecutive slowing windows almost always show up as a soft quarter.' },
    ]),
    watch: { items: [
      inv('Next monthly window', `Rolling three-month growth reverting toward ${pct(prevG)}.`),
      conf('Window trend', `Another window at or ${shift > 0 ? 'above' : 'below'} ${pct(curG)}.`),
    ] },
    keyMove: move('3-month growth pace, vs a quarter earlier', prevG, curG, '%'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Specialists vs generalists — the structural war
// ─────────────────────────────────────────────────────────────────────────────

const sahiStructure: Narrator = (f) => {
  const { cur, prev, delta, streak, sahiCr } = f.v
  const gaining = f.direction === 'sahi_gaining'
  const streakTxt = streak >= 3 ? ` — the ${ord(streak)} consecutive quarter moving the same way` : ''
  return {
    shortHeadline: gaining ? 'Specialists keep taking the health market' : 'Generalists are pushing back into health',
    headline: `Specialist health insurers wrote ${pct(cur)} of all health premium in ${f.period}, vs ${pct(prev)} a year ago (${signed(delta)}pp)${streakTxt}`,
    summary: `The specialist health insurers (SAHIs) together wrote ${pct(cur)} of the industry's health premium in ${f.period}, ${gaining ? 'up from' : 'down from'} ${pct(prev)} in ${f.s.prevPeriod} — on a ${cr(sahiCr)} quarterly book${streakTxt}. This is the structural contest under every SAHI valuation: specialists versus the big general insurers.`,
    thesis: gaining
      ? `Share the specialists take from generalists is stickier than share swapped between specialists: it comes with retail-heavy mix and agency distribution the generalists struggle to match. ${streak >= 3 ? `${String(streak)} consecutive quarters in the same direction is a trend, not noise.` : 'One quarter is a data point, not a trend — the streak to watch starts here.'}`
      : `The generalists — with bank distribution and cross-selling — are clawing health premium back. For SAHI valuations built on a rising-share story, ${pp(delta)} of share ceded in a year hits the terminal assumption directly.`,
    whatConsensusMisses: `The specialist-vs-generalist split is tracked annually, if at all. The quarterly numbers show it moving ${gaining ? 'up' : 'down'} as of ${f.period} — and this share is baked into every SAHI's long-term valuation as if it were constant.`,
    consensusView: `The SAHI share of health premium is treated as a slow-moving constant in long-term valuation math.`,
    variantBasis: `The quarterly industry numbers show it moving ${signed(delta)}pp year-on-year${streak >= 3 ? ` with a ${String(streak)}-quarter streak` : ''} — the 'constant' is drifting print by print.`,
    steelman: `Government-scheme flows in the industry total can nudge these shares without any retail-market change. Handled: the read uses the report's own printed sub-totals — and where no multi-quarter streak exists the card claims a data point, not a trend.`,
    falsifier: `The next quarterly release reverses the ${gaining ? 'gain' : 'loss'}, breaking the run.`,
    application: app('A market-structure input for every SAHI valuation.', [
      { angle: 'Terminal value', detail: `Stress long-term SAHI share assumptions against the printed ${pct(cur)} and its direction.` },
      { angle: gaining ? 'Sector tailwind' : 'Sector risk', detail: gaining ? 'A rising specialist share lifts the whole SAHI cohort’s addressable market.' : 'A falling specialist share is a cohort-wide valuation risk, independent of single-name execution.' },
    ]),
    watch: { items: [
      inv('Next quarterly aggregate', `SAHI share back near ${pct(prev)} — run broken.`),
      conf('Streak', `A further same-direction quarter beyond ${pct(cur)}.`),
    ] },
    keyMove: move(`SAHI share of health premium, ${f.s.prevPeriod} → ${f.period}`, prev, cur, '%'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  New capacity entering the market
// ─────────────────────────────────────────────────────────────────────────────

const entrantRamp: Narrator = (f) => {
  const { totalCr, prevCr, g } = f.v
  const { name, prevPeriod } = f.s
  return {
    shortHeadline: `New player ${name} is scaling fast`,
    headline: `${name} wrote ${cr(totalCr)} in ${f.period} vs ${cr(prevCr)} a year ago — a ${pct(g)} ramp from one of the newest licences`,
    summary: `${name}, one of the newest health-insurance licences, wrote ${cr(totalCr)} of premium in ${f.period} — a year earlier it was ${cr(prevCr)}. Still a small book, but a steep curve: new capacity entering a market tells you where pricing pressure comes from next.`,
    thesis: `Insurance margins are set by the capital cycle: new entrants price low to build their book, and the pressure lands on incumbents through the marginal quote in retail and group tenders — well before the entrant's market share looks meaningful. Every incumbent margin model that extrapolates today's pricing quietly assumes the entrants stay small. This print says they are not staying small.`,
    whatConsensusMisses: `New licences get ignored while their share is tiny — but pricing pressure arrives through competing quotes, not market share, and a book compounding at ${pct(g)} changes the marginal quote first.`,
    consensusView: `The newest SAHIs are too small to matter to anyone's economics.`,
    variantBasis: `A book compounding at ${pct(g)} on the tender-facing margin changes marginal pricing well before it changes share tables.`,
    steelman: `Ramps from small bases often stall once claims start maturing, and some never reach scale. Handled: the flag requires real absolute premium, not just a growth rate — and the watch item is whether the ramp persists, not that it exists.`,
    falsifier: `${name}'s quarterly premium plateaus near ${cr(totalCr)} — the ramp stalls before reaching pricing-relevant scale.`,
    application: app('A capital-cycle input for incumbent margin assumptions.', [
      { angle: 'Pricing watch', detail: 'Track incumbent renewal pricing in the entrant’s launch segments for the first signs of pressure.' },
      { angle: 'Cycle timing', detail: 'Several simultaneous ramps mark the expansion phase of the health capital cycle — margin assumptions should mean-revert, not extrapolate.' },
    ]),
    watch: { items: [
      inv('Ramp persistence', `Quarterly premium flat or lower at the next print vs ${cr(totalCr)}.`),
      conf('Scale threshold', `Another near-doubling quarter — tender-relevant scale arrives sooner.`),
    ] },
    keyMove: move(`Quarterly premium, ${prevPeriod} → ${f.period}`, prevCr, totalCr, '₹ Cr'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Underwriting economics — the combined ratio, translated
// ─────────────────────────────────────────────────────────────────────────────

const uwEconomics: Narrator = (f) => {
  const { cur, prev, dCR } = f.v
  const { name, basis, prevPeriod } = f.s
  const dir = f.direction
  const attribution = f.v.dClaims != null && f.v.dExp != null
    ? ` The move came ${signed(f.v.dClaims)}pp from claims and ${signed(f.v.dExp)}pp from costs.`
    : ''
  const crossProfit = dir === 'crossed_into_profit'
  const crossLoss = dir === 'crossed_into_loss'
  const profitRegime = dir === 'profit_narrowing' || dir === 'profit_widening'
  return {
    shortHeadline: crossProfit ? `${name}'s insurance book now pays for itself`
      : crossLoss ? `${name} slipped into underwriting loss`
      : dir === 'profit_narrowing' ? `${name}'s underwriting cushion is thinning`
      : dir === 'profit_widening' ? `${name}'s underwriting profit is widening`
      : dir === 'improving' ? `${name}'s underwriting losses are shrinking` : `${name}'s underwriting losses are deepening`,
    headline: `${name}'s combined ratio (${basis}): ${f2(prev)}% in ${prevPeriod} → ${f2(cur)}% in ${f.period}${crossProfit ? ' — under the 100% break-even line' : crossLoss ? ' — over the 100% break-even line' : ''}`,
    summary: `${name} spent ₹${f2(cur)} on claims and costs for every ₹100 of premium earned in ${f.period} (the combined ratio, ${basis} basis) — a year earlier it was ₹${f2(prev)}.${attribution} ${crossProfit ? 'Crossing under 100 means the insurance business itself now makes money, instead of relying on investment income to cover underwriting losses.' : crossLoss ? 'Crossing over 100 means the insurance business itself now loses money — reported profit is investment income covering the gap.' : profitRegime ? (dCR > 0 ? 'Still below 100 — the book stays profitable — but the safety margin to break-even narrowed this period.' : 'The book stays profitable and the cushion below the 100 line got thicker.') : dCR < 0 ? 'Still above 100 — every ₹100 of premium still costs more to service — but the gap to break-even is closing.' : 'Above 100 and widening: the underwriting hole is getting deeper and must be funded by investment income and capital.'}`,
    thesis: crossProfit
      ? `Crossing below a 100% combined ratio is the single most valuation-relevant event a health insurer can print: it changes the equity story from 'investment fund with an insurance cost attached' to 'profitable insurance franchise', and multiples re-rate on it. The question from here is persistence, not the crossing.`
      : crossLoss
        ? `A cross above 100% turns underwriting from an earnings engine into a funding cost. Most models keep last year's ratio; the ${signed(dCR)}pp move means economic earnings just deteriorated even where headline profit holds up on investment income.`
        : profitRegime
          ? `For a profitable underwriter the combined ratio IS the margin: at ${f2(cur)}%, the buffer to break-even is ${f1(Math.abs(100 - cur))} points of premium, and it ${dCR > 0 ? 'shrank' : 'grew'} this period.${attribution ? ' Whether claims or costs moved it matters — pricing problems and efficiency gains have different lifespans.' : ''}`
          : `The combined ratio is the sector's margin trend in one number.${attribution ? ' Whether claims or costs moved it matters — pricing problems and efficiency gains have different lifespans.' : ''}`,
    whatConsensusMisses: `Headline profit hides the split: at ${f2(cur)}%, the insurance operation itself ${cur > 100 ? 'loses' : 'makes'} money on its own — and the ${signed(dCR)}pp move re-prices the quality of every rupee of reported profit.`,
    consensusView: `Reported profit is read at face value; the combined ratio is a secondary disclosure.`,
    variantBasis: `Economic earnings live in the underwriting line: ${f2(cur)}% vs ${f2(prev)}% (${basis}, like-for-like) is the real margin print.${attribution}`,
    steelman: `Combined ratios can move on reserve adjustments and one-off cost items, not just current-year pricing.${f.cadence === 'quarterly' ? ' A single standalone quarter is also seasonally light on renewals.' : ''} Handled: the comparison is strictly same-basis and same-period-type, and the watch items test persistence.`,
    falsifier: crossProfit
      ? `The ratio moves back above 100 at the next same-basis print — the crossing was one-off (reserve releases or cost timing).`
      : `The next same-basis print reverses the ${signed(dCR)}pp move.`,
    application: app(`An earnings-quality read on ${name} (${basis} basis).`, [
      { angle: 'Valuation', detail: crossProfit ? 'A health insurer that makes money on underwriting deserves a structurally higher multiple than one that relies on float income — check whether the market has re-rated it yet.' : 'Subtract the underwriting deficit from reported profit to see the economic earnings.' },
      { angle: 'Cross-check', detail: 'Confirm the same direction on the other accounting basis before sizing a position on it.' },
    ]),
    watch: { items: [
      inv('Next same-basis print', crossProfit ? `Combined ratio back above 100.` : `The ${signed(dCR)}pp move reversing.`),
      conf('Persistence', crossProfit ? `A second consecutive print below 100.` : `The trajectory extending from ${f2(cur)}%.`),
    ] },
    keyMove: move(`Combined ratio (${basis}), ${prevPeriod} → ${f.period}`, prev, cur, '%'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Two rulebooks, two profit stories
// ─────────────────────────────────────────────────────────────────────────────

const basisDivergence: Narrator = (f) => {
  const { gI, gF, gap, patI, patF } = f.v
  const { name } = f.s
  const flip = f.direction === 'sign_flip'
  const iUp = gI > gF
  return {
    shortHeadline: `${name}'s profit: two rulebooks, two answers`,
    headline: flip
      ? `${name}'s ${f.period} profit ${gI < 0 ? 'FELL' : 'grew'} ${pct(Math.abs(gI))} under statutory accounting but ${gF > 0 ? 'GREW' : 'fell'} ${pct(Math.abs(gF))} under IFRS`
      : `${name}'s profit growth differs by ${pp(gap)} between the two accounting bases in ${f.period}`,
    summary: `${name} earned ${cr(patI)} in ${f.period} under Indian statutory accounting (${gI < 0 ? 'down' : 'up'} ${pct(Math.abs(gI))} on the year) — but ${cr(patF)} under IFRS (${gF < 0 ? 'down' : 'up'} ${pct(Math.abs(gF))}). Same company, same twelve months${flip ? ', opposite stories' : ''}. Which number a screen shows depends only on which rulebook its data source reads.`,
    thesis: `Accounting timing drives most of the gap: IFRS spreads the cost of acquiring customers over the life of the policy, while statutory accounting charges it all upfront — so the two bases can price the same year very differently. ${iUp ? `Here the statutory line (${signed(gI)}%) runs ahead of IFRS (${signed(gF)}%) — check what one-offs or reserve movements sit in the statutory print before crediting it.` : `Here IFRS (${signed(gF)}%) runs ahead of the statutory print (${signed(gI)}%) — a pattern consistent with upfront acquisition costs on a growing book, though the data here sizes the gap rather than proves the cause.`}`,
    whatConsensusMisses: `Screens and databases key off one basis — usually statutory — so half the market is anchored to ${signed(gI)}% growth while the IFRS accounts print ${signed(gF)}%. The difference is the anchor, not the business.`,
    consensusView: `${name}'s profit trajectory is quoted as one number, from whichever basis the reader's data source happens to carry.`,
    variantBasis: `Both reported bases are public: ${cr(patI)} vs ${cr(patF)} for the same year. The gap is measurable, dated and falsifiable — not an opinion.`,
    steelman: `IFRS profit for unlisted-basis reporters can rest on management-selected assumptions that flatter growth. Handled: the read never claims one basis is 'true' — it flags that the divergence exists, sizes it, and points to the underwriting line as the referee.`,
    falsifier: `The two bases converge again at the next annual print — the divergence was a one-year timing artifact, not a persistent feature.`,
    application: app(`An accounting-lens read on ${name}.`, [
      { angle: 'Anchor check', detail: 'Know which basis every counterparty quotes before debating the "growth" — the argument is often about accounting, not business.' },
      { angle: 'Entry point', detail: flip && gF > gI ? 'Statutory-anchored screens mark the name as deteriorating while IFRS says improving — mispricings born of accounting anchors tend to close.' : 'Size the timing gap before it converges.' },
    ]),
    watch: { items: [
      inv('Next annual prints', `Statutory and IFRS profit growth converging back to a normal spread.`),
      conf('Underwriting line', `The combined ratio confirming the direction the IFRS line implies.`),
    ] },
    keyMove: move(`${f.period} profit growth — statutory vs IFRS`, gI, gF, '%', 'vs'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Capital running out of road
// ─────────────────────────────────────────────────────────────────────────────

const solvencyRunway: Narrator = (f) => {
  const { s, g, t, headroom } = f.v
  const { name } = f.s
  return {
    shortHeadline: `${name} is about ${f1(t)} years from needing capital`,
    headline: `${name}'s solvency is ${f2(s)}x vs the 1.5x floor — at ${pct(g)} growth, roughly ${f1(t)} years of cushion left`,
    summary: `${name}'s capital cushion (solvency ratio) stands at ${f2(s)}x against the regulator's 1.5x minimum — that sounds safe, but growing premium at ${pct(g)} a year consumes capital mechanically. At the current pace, the ${f2(headroom)}x of headroom runs out in roughly ${f1(t)} years unless the company raises money or slows down.`,
    thesis: `Solvency is an insurer's growth governor: the faster the book compounds, the faster the ratio falls toward the floor. A ~${f1(t)}-year runway makes a capital event — a share issue, debt, or deliberately slower growth — a near-term planning item, not a distant risk. Each path costs someone: dilution for shareholders, interest for earnings, or the growth story itself.`,
    whatConsensusMisses: `The market reads the level — ${f2(s)}x, 'above the floor'. The binding number is the level divided by the growth rate, and on that measure the clock reads ~${f1(t)} years.`,
    consensusView: `A solvency ratio above the regulatory floor is filed under 'adequately capitalised'.`,
    variantBasis: `Growth-adjusted, the same number implies a dated capital event: ${f2(s)}x eroding at ${pct(g)} premium growth reaches the 1.5x floor in about ${f1(t)} years.`,
    steelman: `Profits retained along the way lengthen the runway, and management can throttle group business to slow the capital burn. Handled: the runway is labelled a rough estimate — its value is ranking names by capital urgency and dating the window, not predicting the raise to the quarter.`,
    falsifier: `${name} raises capital, or profitability improves enough that the next solvency prints hold ${f2(s)}x instead of eroding.`,
    application: app(`A capital-event clock on ${name}.`, [
      { angle: 'Catalyst', detail: `Position for the fundraising window the ~${f1(t)}-year runway implies — terms are set by whoever moves first.` },
      { angle: 'Relative value', detail: 'Rank the cohort by growth-adjusted runway, not by the headline solvency level.' },
    ]),
    watch: { items: [
      inv('Capital action', `A share issue or debt raise, or growth slowing enough to visibly stop the erosion.`),
      conf('Next solvency print', `The ratio stepping down again from ${f2(s)}x.`),
    ] },
    keyMove: move(`Solvency cushion vs the 1.5x floor`, null, s, 'x'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  What the price is promising vs what the company delivers
// ─────────────────────────────────────────────────────────────────────────────

const valuationDislocation: Narrator = (f) => {
  const { pb, roe, implied, gapPp } = f.v
  const { name } = f.s
  const ahead = f.direction === 'priced_ahead'
  return {
    shortHeadline: ahead ? `${name}'s price assumes profits it doesn't make yet` : `${name} delivers more than its price asks`,
    headline: `${name} trades at ${f2(pb)}x book value but earns ${pct(roe)} on that book — the price only works at a ~${pct(implied)} return`,
    summary: `${name}'s market value is ${f2(pb)} times its statutory book value, but the company currently earns just ${pct(roe)} on that book (return on equity). Run the arithmetic backwards — with a 12% cost of equity and 8% long-run growth — and today's price only makes sense if returns rise to roughly ${pct(implied)}. That is a ${pp(gapPp)} gap between what the company earns and what the price ${ahead ? 'is already paying for' : 'gives credit for'}, measured on one accounting basis end-to-end.`,
    thesis: ahead
      ? `The multiple is a promise: the equity only works if returns climb from ${pct(roe)} toward ${pct(implied)} on schedule. That path runs through underwriting profitability and cost leverage — both visible quarter by quarter — so the promise is testable at every print, and every print that fails to close the gap shortens the market's patience.`
      : `Delivering more return than the price requires is the rarer setup — either the market doubts the returns can last, or the name has slipped through the coverage net. The gap closes either by a re-rating or by returns fading; which one is the trade.`,
    whatConsensusMisses: `Multiples get debated as 'expensive or cheap vs peers'. Solved backwards into the return they require, ${f2(pb)}x book is a ~${pct(implied)} ROE claim standing against ${pct(roe)} actually delivered — a concrete forecast most holders have never worked out.`,
    consensusView: `${f2(pb)}x book is discussed by peer comparison, not solved for the return path it demands.`,
    variantBasis: `Inverting the multiple turns the price into a testable claim: ~${pct(implied)} required vs ${pct(roe)} delivered — a ${pp(gapPp)} execution gap with a clock on it.`,
    steelman: `Young insurance books earn depressed statutory returns while customer-acquisition costs are charged upfront — on the IFRS lens the same year's profit is materially higher, so the gap narrows on that basis. Handled: the read holds ONE basis end-to-end (statutory book, statutory return) and shows the IFRS multiple separately; the direction of the gap survives the lens change even where its size does not.`,
    falsifier: ahead
      ? `Delivered ROE climbs decisively toward ${pct(implied)} over the coming prints — the price's assumption starts being earned.`
      : `The multiple re-rates upward toward what delivered returns support.`,
    application: app(`An expectations read on ${name}.`, [
      { angle: 'Expectations gap', detail: `Track delivered ROE each print against the ~${pct(implied)} the price requires; the trend of the gap is the position signal.` },
      { angle: 'Risk flag', detail: ahead ? 'Prices that assume a profit ramp leave no room for slips — small misses produce outsized falls.' : 'Cheapness against delivered returns still needs a catalyst to close.' },
    ]),
    watch: { items: [
      inv('ROE trajectory', ahead ? `Delivered ROE climbing toward ${pct(implied)} — the gap closing through earnings, not through a falling price.` : `Delivered returns fading toward what the multiple implies.`),
      conf('Multiple', `The book multiple holding near ${f2(pb)}x while the return gap persists.`),
    ] },
    keyMove: move('Return on equity: delivered vs what the price needs', roe, implied, '%', 'vs'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  The share price and the business disagreeing
// ─────────────────────────────────────────────────────────────────────────────

const priceFundamentalsGap: Narrator = (f) => {
  const { ret, retailG, p0, p1 } = f.v
  const { name, proxy } = f.s
  const derate = f.direction === 'derating_despite_growth'
  const stockTxt = proxy ? `${name}'s listed proxy (${proxy})` : `${name}'s shares`
  return {
    shortHeadline: derate ? `${name}: stock down, business up` : `${name}: stock up, business down`,
    headline: derate
      ? `${stockTxt} fell ${pct(Math.abs(ret))} in ${f.period} — the same quarter retail premium grew ${pct(retailG)}`
      : `${stockTxt} rose ${pct(ret)} in ${f.period} — the same quarter retail premium fell ${pct(Math.abs(retailG))}`,
    summary: `${stockTxt} ${ret < 0 ? 'fell' : 'rose'} ${pct(Math.abs(ret))} over ${f.period} (₹${f1(p0)} to ₹${f1(p1)}) — while in exactly the same three months the retail health book ${retailG > 0 ? 'grew' : 'shrank'} ${pct(Math.abs(retailG))} year-on-year. The share price and the business are telling opposite stories about the same quarter; one of them is wrong.`,
    thesis: derate
      ? `Divergences like this resolve one of two ways: either the market knows something the filings don't yet show (claims, costs, governance, supply of stock), or sentiment overshot a business that kept compounding. The premium number is a regulatory filing; the price move is sentiment until proven otherwise. The gap itself is the opportunity — the work is finding which side is right.`
      : `A rising price against weakening premium borrows from the future: either a margin or capital-return story justifies it, or the price falls back to the business.`,
    whatConsensusMisses: `Price momentum and business momentum get screened separately; the information is in their disagreement — ${signed(ret)}% price vs ${signed(retailG)}% premium over the identical window.`,
    consensusView: derate ? `A falling stock is read as a deteriorating business — the price is treated as the evidence.` : `A rising stock is read as an improving business.`,
    variantBasis: `The official premium filing covers the same calendar window as the price move and points the other way; only one of the two signals is a regulatory filing.`,
    steelman: `The market may be pricing what premium can't show — claims inflation, a cost problem, or a wave of sellers (lock-in expiries, block deals)${proxy ? '; and a listed-holding-company proxy adds its own discount noise' : ''}. Handled: the card claims divergence, not direction — the next loss-ratio and shareholding prints are the referees.`,
    falsifier: derate
      ? `The next results print justifies the fall — claims or cost deterioration the premium line could not show.`
      : `The next results print justifies the rally with margin improvement the premium line hid.`,
    application: app(`A dislocation read on ${name}.`, [
      { angle: 'Opportunity screen', detail: derate ? 'A business growing into a falling price is the classic setup for variant perception — do the claims-side work.' : 'Rallies without business support are funding sources when they lack a margin story.' },
      { angle: 'Resolution watch', detail: 'The next combined-ratio and shareholding prints decide which signal was right.' },
    ]),
    watch: { items: [
      inv('Next results print', derate ? `Claims or cost deterioration that justifies the ${pct(Math.abs(ret))} fall.` : `Margin improvement that justifies the rally.`),
      conf('Premium persistence', `Retail growth holding near ${pct(retailG)} at the next quarterly print.`),
    ] },
    keyMove: move(`${f.period}: share price vs retail premium growth`, ret, retailG, '%', 'vs'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Who owns the stock — and who's leaving
// ─────────────────────────────────────────────────────────────────────────────

const ownershipRotation: Narrator = (f) => {
  const { cur, prev, delta, streak } = f.v
  const { name, holder, counterHolder } = f.s
  const accumulating = f.direction === 'accumulating'
  const institutional = holder === 'FIIs' || holder === 'DIIs'
  const who = holder === 'FIIs' ? 'Foreign funds' : holder === 'DIIs' ? 'Domestic funds' : holder === 'Promoters' ? 'The promoters' : 'Retail and public investors'
  const streakTxt = streak >= 2 ? ` — the ${streak >= 3 ? 'third-or-more' : 'second'} quarter in a row moving the same way` : ''
  const counterTxt = counterHolder != null && f.v.counterDelta != null
    ? ` On the other side, ${counterHolder === 'FIIs' ? 'foreign funds' : counterHolder === 'DIIs' ? 'domestic funds' : counterHolder === 'Promoters' ? 'the promoters' : 'retail and public investors'} went ${signed(f.v.counterDelta)}pp to ${pct(f.v.counterCur)}.`
    : ''
  const closing = holder === 'Promoters' && !accumulating
    ? 'Promoter selling is the heaviest overhang a shareholder list can carry.'
    : institutional && accumulating
      ? 'Funds building a position quietly is the vote that usually precedes broader coverage and a re-rating.'
      : institutional && !accumulating
        ? 'Funds heading for the exit is the quiet signal that usually precedes downgrades.'
        : accumulating
          ? 'A swelling public shareholding usually means institutions are supplying the stock.'
          : counterHolder != null
            ? 'Stock moving from retail hands into funds is how a shareholder list matures.'
            : 'Retail selling without a visible buyer leaves the stock looser-held than before.'
  return {
    shortHeadline: accumulating ? `${who} are buying into ${name}` : `${who} are selling ${name}`,
    headline: `${holder} went from ${pct(prev)} to ${pct(cur)} of ${name} in ${f.period} (${signed(delta)}pp)${streakTxt}`,
    summary: `${who} ${accumulating ? 'raised' : 'cut'} their stake in ${name} from ${pct(prev)} to ${pct(cur)} during ${f.period}${streakTxt}.${counterTxt} ${closing}`,
    thesis: institutional
      ? (accumulating
        ? `${pp(delta)} of a listed insurer's shareholder base changing hands in one quarter is real money making a real decision${streak >= 2 ? ', and consecutive quarters of it turn a data point into a position' : ''}. Sustained fund buying tightens the freely-traded stock, steadies the price, and often front-runs analyst initiation.`
        : `${pp(delta)} of fund selling in a quarter${streak >= 2 ? ' — repeated across consecutive quarters —' : ''} is supply the rest of the register must absorb. That pressure caps re-ratings regardless of how the business performs.`)
      : `${pp(delta)} of the shareholder base rotating in one quarter is a positioning fact, not noise.${counterHolder != null ? ` Here ${holder.toLowerCase()} ${accumulating ? 'absorbed what ' + counterHolder + ' supplied' : 'supplied what ' + counterHolder + ' absorbed'} — the direction of travel between holder types is the signal.` : ''}`,
    whatConsensusMisses: `Shareholding filings are lagged and rarely parsed by holder type. The ${signed(delta)}pp quarterly move${streak >= 2 ? ' and its streak' : ''} is public, dated evidence of who is positioning — most models ignore it entirely.`,
    consensusView: `Ownership tables are compliance paperwork, not signal.`,
    variantBasis: `Filing-to-filing changes by holder type are among the few direct positioning reads available on this name — and they currently point one way.`,
    steelman: `A single block trade, an index event or a placement can move a holder group without any active view taken. Handled: the streak dimension separates events from campaigns, and the read is weighed with the same quarter's price action.`,
    falsifier: `The next quarterly filing reverses the move — ${holder} back toward ${pct(prev)}.`,
    application: app(`A shareholder-register read on ${name}.`, [
      { angle: 'Positioning', detail: accumulating ? 'Fund accumulation tightens the freely-traded stock — size entries before the register crowds.' : 'Selling overhangs cap rallies — respect the supply when timing entries.' },
      { angle: 'Cross-check', detail: 'Match the register move against the same quarter’s price action and block-deal disclosures for the mechanism.' },
    ]),
    watch: { items: [
      inv('Next shareholding filing', `${holder} reverting toward ${pct(prev)}.`),
      conf('Streak extension', `Another same-direction quarterly move beyond ${pct(cur)}.`),
    ] },
    keyMove: move(`${holder} stake in ${name}, over ${f.period}`, prev, cur, '%'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Broker targets on the move
// ─────────────────────────────────────────────────────────────────────────────

const analystReprice: Narrator = (f) => {
  const { curT, prevT, move: mv } = f.v
  const { name, broker, rating } = f.s
  const pack = f.direction === 'pack_up' || f.direction === 'pack_down'
  const split = f.direction === 'split'
  const raised = f.direction === 'raised' || f.direction === 'pack_up'
  const secondTxt = f.v.move2 != null && f.s.broker2
    ? ` ${f.s.broker2} moved ${signed(f.v.move2)}% to ₹${f1(f.v.curT2)} in the same month.`
    : ''
  return {
    shortHeadline: pack
      ? `Brokers are ${raised ? 'raising' : 'cutting'} ${name} targets together`
      : split
        ? `Brokers just split on ${name}`
        : `${broker} ${raised ? 'raised' : 'cut'} its ${name} target hard`,
    headline: pack
      ? `${String(f.v.n)} broker desks moved their ${name} targets the same way in ${f.period} — ${broker} led with ${signed(mv)}% (₹${f1(prevT)} → ₹${f1(curT)})`
      : split
        ? `Broker desks moved ${name} targets in opposite directions in ${f.period} — ${broker} went ${signed(mv)}% against the other side`
        : `${broker} moved its ${name} price target from ₹${f1(prevT)} to ₹${f1(curT)} — ${signed(mv)}%${rating !== 'n/a' ? ` (${rating})` : ''}`,
    summary: `${broker} moved its ${name} price target from ₹${f1(prevT)} to ₹${f1(curT)} — a ${pct(Math.abs(mv))} ${raised ? 'raise' : 'cut'} between its own consecutive notes.${secondTxt} ${pack ? 'Several desks moving the same way in the same month is how re-rating cycles usually start.' : split ? 'Desks moving in opposite directions in the same month means the story is genuinely contested.' : 'A change of this size from the same desk matters more than the rating on the cover — it shows conviction moving.'}`,
    thesis: pack
      ? `When several desks re-set their targets in the same direction inside one window, the reference price most investors anchor to moves with them — that is the mechanism by which a data print becomes a re-rating. The lead move of ${signed(mv)}% sets the new anchor.`
      : `Comparing a broker's new target with its own previous one strips out house style and leaves only the change of view — the cleanest sell-side signal there is. ${raised ? 'Upward revisions tend to run in packs: one desk re-sets, the rest follow within weeks.' : 'Downward revisions from a covering desk often start an estimate-cutting cycle, and stocks rarely bottom before the cuts stop.'}`,
    whatConsensusMisses: `The consensus average barely moves when one desk swings ${pct(Math.abs(mv))} — yet the change, not the average, is where the information sits.`,
    consensusView: `Coverage gets summarised by the average target and the buy/hold/sell count.`,
    variantBasis: `Same-desk target changes show the direction conviction is moving — a sharper, earlier read than any average level.`,
    steelman: `A desk's move can reflect a model refresh or an analyst change rather than new information. Handled: each revision is attributed as one desk's opinion${pack ? ', and this card only fired because more than one desk moved together' : ' and gains weight only if other desks follow — that follow-through is the watch item'}.`,
    falsifier: pack
      ? `The next round of notes fails to extend the direction — the pack move exhausts itself.`
      : `No other covering desk moves the same way in the next round of notes — the revision stays one desk's view.`,
    application: app(`A sell-side momentum read on ${name}.`, [
      { angle: 'Revision cycle', detail: raised ? 'Track whether more desks re-set targets upward — pack revisions precede re-ratings.' : 'Track whether estimate cuts spread — packs of cuts precede de-ratings.' },
      { angle: 'Attribution', detail: 'This is broker opinion, priced for its direction — never a view of fair value.' },
    ]),
    watch: { items: [
      inv('Peer desks', `The next notes from other covering brokers failing to ${pack ? 'extend' : 'join'} the direction.`),
      conf('Follow-through', `Another desk revising ${raised ? 'up' : 'down'} within the following weeks.`),
    ] },
    keyMove: move(`${broker}'s ${name} target`, prevT, curT, '₹'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  The Street can't agree
// ─────────────────────────────────────────────────────────────────────────────

const analystDispersion: Narrator = (f) => {
  const { hi, lo, mu, disp, n } = f.v
  const { name } = f.s
  return {
    shortHeadline: `Brokers can't agree what ${name} is worth`,
    headline: `${String(n)} live broker targets on ${name} run from ₹${f1(lo)} to ₹${f1(hi)} — a ${pct(disp)} spread around the ₹${f1(mu)} average`,
    summary: `The ${String(n)} brokers covering ${name} currently carry price targets from ₹${f1(lo)} all the way to ₹${f1(hi)}, around a ₹${f1(mu)} average — a ${pct(disp)} spread. Disagreement this wide means the story is unresolved, and unresolved stories move hardest on new data.`,
    thesis: `Target dispersion measures how unsettled the equity story is. At ${pct(disp)}, ${name} trades on narrative rather than an agreed model — surprises in either direction travel further because there is no anchor to pull the reaction back. Names like this reward primary work: whoever resolves the disagreement first captures the move.`,
    whatConsensusMisses: `Quoting the ₹${f1(mu)} average hides that the desks behind it disagree by ${pct(disp)} of it — the average of an unresolved argument is an artifact, not a forecast.`,
    consensusView: `The consensus target is treated as the Street's answer on fair value.`,
    variantBasis: `The spread around it — ₹${f1(lo)} to ₹${f1(hi)} — says there is no answer yet, only a live argument.`,
    steelman: `Dispersion can simply reflect stale notes never withdrawn. Handled: only each broker's most recent note counts, and the read prices the disagreement, not any single target.`,
    falsifier: `The next round of notes narrows the band materially toward the average — the argument resolves.`,
    application: app(`A conviction-map read on ${name}.`, [
      { angle: 'Volatility', detail: 'Wide-dispersion names move harder on data — size positions for the wider range of outcomes.' },
      { angle: 'Edge', detail: 'Where brokers disagree, primary data (the quarterly premium and loss-ratio prints in this dashboard) is the tiebreaker.' },
    ]),
    watch: { items: [
      inv('Band convergence', `New notes narrowing the ₹${f1(lo)}–₹${f1(hi)} band substantially.`),
      conf('Print reactions', `Outsized stock reactions to routine data — the signature of an unresolved story.`),
    ] },
    keyMove: move(`Lowest to highest live broker target`, lo, hi, '₹'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Distribution rewiring
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_PLAIN: Record<string, string> = {
  Bancassurance: 'bank branches (bancassurance)',
  Brokers: 'insurance brokers',
  'Individual agents': 'individual agents',
  'Corporate agents (non-bank)': 'corporate agents',
  'Direct business': 'direct sales (no intermediary)',
}

const channelShift: Narrator = (f) => {
  const { cur, prev, delta } = f.v
  const { name, channel, basisNote, channel2 } = f.s
  const rising = f.direction === 'rising'
  const plain = CHANNEL_PLAIN[channel] ?? channel.toLowerCase()
  const secondTxt = channel2 != null && f.v.delta2 != null
    ? ` The offsetting winner: ${(CHANNEL_PLAIN[channel2] ?? channel2.toLowerCase())} went ${signed(f.v.delta2)}pp to ${pct(f.v.cur2)}.`
    : ''
  return {
    shortHeadline: `${name} is changing how it sells`,
    headline: `${name} now sources ${pct(cur)} of premium through ${plain}, vs ${pct(prev)} a year ago (${signed(delta)}pp, ${basisNote})`,
    summary: `${pct(cur)} of ${name}'s premium came through ${plain} this period, against ${pct(prev)} in the same window a year ago (${basisNote}).${secondTxt} Distribution is destiny in retail insurance: each sales channel carries its own commission cost, renewal stickiness and claims profile, so mix shifts like this reach the profit line with a lag.`,
    thesis: `Channel mix moves before economics do: a ${pp(delta)} reallocation ${rising ? 'toward' : 'away from'} ${plain} re-prices acquisition costs and renewal durability quarters before the expense ratio shows it. The disclosure sits in a regulatory filing almost nobody models — which is exactly why it is early.`,
    whatConsensusMisses: `Distribution mix is treated as a static fact from the last annual report. The filings show it moving ${pp(delta)} within a year — strategy changing in real time, with margin consequences still ahead of the P&L.`,
    consensusView: `Distribution mix is a descriptive footnote, refreshed once a year.`,
    variantBasis: `The like-for-like disclosure shows ${plain} moving ${pp(delta)} in twelve months — a live strategic shift, not a footnote.`,
    steelman: `Cumulative windows can shift on the timing of one big campaign, and a channel's share can move because another channel surged. Handled: the comparison holds the window fixed against the same period last year, and the card reports the reallocation without asserting intent.`,
    falsifier: `The full-year disclosure shows ${channel} back near ${pct(prev)} — campaign timing, not strategy.`,
    application: app(`A distribution-economics read on ${name}.`, [
      { angle: 'Margin lead indicator', detail: 'Map the channel’s commission and renewal profile onto the shift to pre-model the expense-ratio drift.' },
      { angle: 'Dependence', detail: 'Watch concentration: a company leaning harder on one channel inherits that channel’s bargaining power.' },
    ]),
    watch: { items: [
      inv('Full-year mix', `${channel} share reverting toward ${pct(prev)} at the annual disclosure.`),
      conf('Expense ratio', `Commission and cost lines drifting the way the new mix implies.`),
    ] },
    keyMove: move(`Premium sold via ${plain}`, prev, cur, '%'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  The tide under everything
// ─────────────────────────────────────────────────────────────────────────────

const industryTide: Narrator = (f) => {
  const { cur, prev, delta, streak } = f.v
  const growthTxt = f.v.healthG != null && f.v.motorG != null
    ? ` This year health premium grew ${pct(f.v.healthG)} while motor grew ${pct(f.v.motorG)}.`
    : ''
  return {
    shortHeadline: 'Health keeps taking over general insurance',
    headline: `Health is now ${pct(cur)} of all general-insurance premium in India — up from ${pct(prev)} a year ago, ${String(streak)} rising years in a row`,
    summary: `Health insurance now makes up ${pct(cur)} of everything India's general insurers write, up from ${pct(prev)} a year before — the ${ord(streak)} consecutive rising year.${growthTxt} The pool the health specialists fish in keeps getting bigger, quietly compounding under every valuation in this dashboard.`,
    thesis: `${String(streak)} consecutive rising years is not a cycle — it is a structural reallocation of the industry's premium pool (commonly attributed to medical inflation, low penetration and post-pandemic awareness, though the data here shows the shift, not its causes). Every year health outgrows the industry, the specialists' addressable market compounds ahead of GDP — and motor-led generalists' mix decays by default.`,
    whatConsensusMisses: `Sector debates fixate on who is beating whom within health. The quieter, larger number is the pool itself growing ${signed(delta)}pp of industry share a year — a compounding tailwind most terminal-value math leaves out.`,
    consensusView: `Health's rise within general insurance is acknowledged qualitatively — then left out of the long-term growth math.`,
    variantBasis: `The printed segment shares quantify it: ${pct(cur)} of the industry and a ${String(streak)}-year rising run — a measurable structural input, not a talking point.`,
    steelman: `Government-scheme premium and one-off group repricing can inflate a single year's health share. Handled: the run of consecutive years — not any single year — carries the claim, and the split comes from the industry's own printed totals.`,
    falsifier: `Health's share of general-insurance premium prints flat or lower next fiscal year, breaking the run.`,
    application: app('The structural backdrop for every health-insurance position.', [
      { angle: 'Terminal value', detail: 'A segment gaining industry share yearly justifies higher long-run growth for pure-plays than for the diversified peer set.' },
      { angle: 'Cycle context', detail: 'A growing pool cushions share losses within it — erosion in a compounding market is survivable; in a flat one it is not.' },
    ]),
    watch: { items: [
      inv('Next FY segment print', `Health share flat or down versus ${pct(cur)}.`),
      conf('Monthly flash', `Health continuing to outgrow motor and fire through the year.`),
    ] },
    keyMove: move(`Health's share of all GI premium, ${f.s.prevPeriod} → ${f.period}`, prev, cur, '%'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export const NARRATORS: Record<string, Narrator> = {
  share_shift_q: shareShiftQ,
  growth_inflection_q: growthInflectionQ,
  mix_shift_q: mixShiftQ,
  seasonal_surprise_q: seasonalSurpriseQ,
  monthly_momentum: monthlyMomentum,
  sahi_structure: sahiStructure,
  entrant_ramp: entrantRamp,
  uw_economics: uwEconomics,
  basis_divergence: basisDivergence,
  solvency_runway: solvencyRunway,
  valuation_dislocation: valuationDislocation,
  price_fundamentals_gap: priceFundamentalsGap,
  ownership_rotation: ownershipRotation,
  analyst_reprice: analystReprice,
  analyst_dispersion: analystDispersion,
  channel_shift: channelShift,
  industry_tide: industryTide,
}

export function narrateFinding(f: Finding): FrontCopy {
  const n = NARRATORS[f.detector]
  if (!n) throw new Error(`no narrator for detector "${f.detector}" — every detector must ship with one`)
  return n(f)
}
