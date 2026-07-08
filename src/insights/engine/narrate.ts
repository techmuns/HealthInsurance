// ---------------------------------------------------------------------------
//  Insight Engine — deterministic NARRATION.
//
//  Turns a typed Finding into buy-side card copy: the comfortable read first,
//  then the variant that breaks it, then the falsifier that would kill it.
//  Every numeral in the prose comes from the finding's own value slots (which
//  the assembly layer re-emits as signals), so the grounding firewall passes by
//  construction. Template families are keyed by DETECTOR + DIRECTION — never by
//  card id — which is what lets brand-new insights write themselves when the
//  data moves.
//
//  Style contract (Neha's design bar):
//   • plain-English lead, the precise term second;
//   • no comma-grouped numbers (the grounding scanner reads raw numerals);
//   • every card answers "so what?" and names what would prove it wrong.
// ---------------------------------------------------------------------------

import type { Application, Watch } from '@/insights/types'
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

type Narrator = (f: Finding) => FrontCopy

// ─────────────────────────────────────────────────────────────────────────────

const shareShiftQ: Narrator = (f) => {
  const { cur, prev, delta, retailCr } = f.v
  const { name, prevPeriod } = f.s
  const gain = f.direction === 'gain'
  return {
    shortHeadline: gain ? `${name} is taking retail share` : `${name} is ceding retail share`,
    headline: `${name}'s retail health share moved ${signed(delta)}pp to ${pct(cur)} in ${f.period} — a real shift, not annual-average noise`,
    summary: gain
      ? `Annual share tables hide when a shift actually starts. In the ${f.period} standalone quarter ${name} wrote ${pct(cur)} of the industry's retail health premium against ${pct(prev)} in ${prevPeriod} — a ${pp(delta)} year-on-year move, visible in the standalone quarter, on a ${cr(retailCr)} retail book.`
      : `Annual share tables will smooth this away. In the ${f.period} standalone quarter ${name} held ${pct(cur)} of industry retail health premium against ${pct(prev)} in ${prevPeriod} — a ${pp(delta)} year-on-year loss, visible in the standalone quarter, on a ${cr(retailCr)} retail book.`,
    thesis: `Quarterly share is where competitive inflections first print. ${name} at ${pct(cur)} vs ${pct(prev)} a year earlier (${signed(delta)}pp) is ${gain ? 'incremental-demand capture — the growth engine is out-executing the market on the highest-quality retail book' : 'incremental demand going to competitors — the erosion compounds quietly until the annual table finally shows it'}.`,
    whatConsensusMisses: gain
      ? `The market reads share off annual tables; the standalone-quarter print shows where the year-on-year capture stands now — ${pp(delta)} — before any full-year table reflects it.`
      : `The market reads share off annual tables; the standalone-quarter print shows where the year-on-year erosion stands now — ${pp(delta)} — before it surfaces in any full-year league table.`,
    consensusView: `Market-share league tables are annual; a stable full-year ranking reads as a stable franchise.`,
    variantBasis: `The standalone-quarter share (${pct(cur)} vs ${pct(prev)} same quarter last year) moves a full year before the annual table does — the inflection is visible today.`,
    steelman: `One quarter can be lumpy — a single large group-to-retail reclassification or a launch quarter can move a point of share. Handled: the read uses only same-quarter comparisons and a ${cr(retailCr)} base, and the falsifier is the very next print.`,
    falsifier: `The next standalone quarter shows ${name}'s retail share reverting toward ${pct(prev)} — the shift was one-off, not a trend.`,
    application: app(`A competitive-momentum read on ${name}.`, [
      { angle: 'Relative value', detail: 'Rank the cohort on standalone-quarter share moves, not annual tables — the same lens across all names.' },
      { angle: gain ? 'Thesis confirm' : 'Risk flag', detail: gain ? 'Share capture on the retail book is the highest-quality growth in this sector — check pricing follows.' : 'Quiet share erosion pressures the growth multiple before it pressures reported premium.' },
      { angle: 'Catalyst', detail: 'The next GI Council quarter-end print either extends or reverses the move.' },
    ]),
    watch: { items: [
      inv('Next-quarter retail share', `${name}'s share back near ${pct(prev)} at the next standalone-quarter print.`),
      conf('Share trend', `A second consecutive same-direction move from ${pct(cur)}.`),
      conf('Retail premium', `The retail book compounding from ${cr(retailCr)} while share holds.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const growthInflectionQ: Narrator = (f) => {
  const { cur, norm, accel, totalCr } = f.v
  const { name, prevPeriod } = f.s
  const dir = f.direction // acceleration | deceleration | contraction
  const label = dir === 'acceleration' ? 'accelerated' : dir === 'deceleration' ? 'slowed' : 'contracted'
  return {
    shortHeadline: dir === 'acceleration' ? `${name}'s growth just broke higher` : dir === 'contraction' ? `${name}'s premium is shrinking` : `${name}'s growth engine is cooling`,
    headline: `${name} ${label} to ${pct(cur)} YoY in ${f.period}, against its own ~${pct(norm)} trailing pace`,
    summary: `${name} printed ${pct(cur)} health-premium growth in the ${f.period} standalone quarter — ${pp(accel)} ${accel > 0 ? 'above' : 'below'} the ~${pct(norm)} median of its own recent quarters, on a ${cr(totalCr)} quarter. ${dir === 'contraction' ? 'That is an outright decline against ' + prevPeriod + ', not just slower growth.' : 'Trend breaks of this size rarely print by accident.'}`,
    thesis: `A quarter that lands ${pp(accel)} away from the company's own trailing norm is a change in the machine, not seasonality — the comparison is same-quarter YoY, so festival and renewal cycles are already netted out. ${dir === 'acceleration' ? 'Something started working: distribution, pricing, or a product cycle — and it compounds from here if it holds.' : 'Something stopped working — and consensus premium forecasts still extrapolate the old pace.'}`,
    whatConsensusMisses: `Full-year growth still ${dir === 'acceleration' ? 'understates' : 'overstates'} the new run-rate: the ${f.period} print at ${pct(cur)} vs the ~${pct(norm)} norm means the exit pace differs materially from the average the market quotes.`,
    consensusView: `The name is extrapolated at its trailing growth rate — roughly ${pct(norm)} — because the annual figure still shows it.`,
    variantBasis: `The newest standalone quarter runs at ${pct(cur)}: the run-rate has already moved ${pp(accel)}; annual numbers will catch up with a lag.`,
    steelman: `One quarter is one data point, and a large group deal can distort even a same-quarter comparison. Handled: the base quarter is ${cr(totalCr)} — big enough that a single contract rarely moves it this far — and the next print is the direct test.`,
    falsifier: `The following quarter reverts to the ~${pct(norm)} trailing pace, marking this print as noise or a one-off contract effect.`,
    application: app(`A run-rate reset read on ${name}.`, [
      { angle: 'Forecast check', detail: `Rebase premium models on the ${pct(cur)} exit pace rather than the trailing average.` },
      { angle: dir === 'acceleration' ? 'Thesis confirm' : 'Risk flag', detail: dir === 'acceleration' ? 'Growth inflections on a large base are the strongest confirmations a franchise thesis gets.' : 'Deceleration on a large base is how premium misses start — check the mix for the cause.' },
    ]),
    watch: { items: [
      inv('Next-quarter growth', `A print back near the ~${pct(norm)} norm — the inflection did not hold.`),
      conf('Run-rate', `A second consecutive quarter within a few points of ${pct(cur)}.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const mixShiftQ: Narrator = (f) => {
  const { mixCur, mixPrev, delta, retailCr, groupCr } = f.v
  const { name, prevPeriod } = f.s
  const retailLed = f.direction === 'retail_led'
  const shrink = f.direction === 'retail_led_shrink'
  const legs = f.v.retailG != null && f.v.groupG != null
    ? ` Retail moved ${signed(f.v.retailG)}% YoY while group moved ${signed(f.v.groupG)}%.`
    : ''
  return {
    shortHeadline: shrink ? `${name}'s book is shrinking retail-ward` : retailLed ? `${name}'s growth quality just improved` : `${name} is buying growth with group business`,
    headline: `${name}'s quarter mix shifted ${signed(delta)}pp toward ${retailLed || shrink ? 'retail' : 'group'} — ${pct(mixCur)} retail vs ${pct(mixPrev)} a year ago`,
    summary: `Same premium line, different business underneath: in ${f.period} retail was ${pct(mixCur)} of ${name}'s retail-plus-group book against ${pct(mixPrev)} in ${prevPeriod}.${legs} ${shrink ? 'The mix moved retail-ward because group collapsed, not because retail grew — a smaller, retail-weighted book, not a quality upgrade.' : retailLed ? 'The growth is upgrading toward the sticky, better-priced retail book.' : 'The headline growth leans on thinner-margin group business — quality of growth is deteriorating even where its rate looks fine.'}`,
    thesis: shrink
      ? `A rising retail share is only a quality signal when retail itself is growing. Here the share rose ${pp(delta)} while the retail leg shrank — the book is contracting from the group side. The right read is a deliberate group walk-away or lost tenders, and the question is whether the remaining retail base holds its pricing.`
      : `Retail and group health are different businesses — retail renews at high persistency with pricing power, group re-prices every year in a buyer's market. A one-quarter mix move of ${pp(delta)} on a ${cr(retailCr + groupCr)} book re-weights the margin structure ${retailLed ? 'up' : 'down'} before any ratio shows it.`,
    whatConsensusMisses: shrink
      ? `A mix table alone would score this as improvement; paired with the growth legs it is a shrinking book whose retail share rose by default — composition without growth is not quality.`
      : retailLed
        ? `Premium growth screens can't see composition: the same reported growth is now coming from the better book — ${pct(mixCur)} retail vs ${pct(mixPrev)} — which compounds into margin later.`
        : `Premium growth screens can't see composition: the growth is increasingly group-sourced (retail share down ${pp(delta)} YoY), which shows up in the combined ratio only several quarters later.`,
    consensusView: `Top-line health premium growth is read as one number; mix inside the quarter is rarely examined.`,
    variantBasis: `The standalone quarter's retail share (${pct(mixCur)} vs ${pct(mixPrev)} same quarter last year) re-prices the quality of that growth ${retailLed ? 'up' : 'down'} today.`,
    steelman: `Group business is lumpy, and one large corporate win can swing a quarter's mix without a strategy change. Handled: the move is measured against the same quarter last year on a ${cr(retailCr + groupCr)} base, and government business is excluded so scheme wins can't pollute the read.`,
    falsifier: `The next quarter's retail share reverts toward ${pct(mixPrev)} — the mix move was one contract, not a reallocation.`,
    application: app(`A growth-quality read on ${name}.`, [
      { angle: 'Thesis test', detail: 'Adjust the growth multiple for mix: retail-led growth deserves a premium, group-led growth a discount.' },
      { angle: retailLed ? 'Margin watch' : 'Risk flag', detail: retailLed ? 'A rising retail mix should pull the expense-adjusted loss ratio down over the next year.' : 'A falling retail mix typically precedes combined-ratio pressure by two to four quarters.' },
    ]),
    watch: { items: [
      inv('Next-quarter mix', `Retail share back near ${pct(mixPrev)} — the shift did not persist.`),
      conf('Mix trend', `A second quarter at or beyond ${pct(mixCur)} retail.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const seasonalSurpriseQ: Narrator = (f) => {
  const { cur, mu, z, n, totalCr } = f.v
  const { name, quarterName } = f.s
  const hot = f.direction === 'hot'
  return {
    shortHeadline: hot ? `${name} broke its own seasonal pattern` : `${name} missed its own seasonal pattern`,
    headline: `${name}'s ${quarterName} ${cur < 0 ? `contracted ${pct(Math.abs(cur))}` : `grew ${pct(cur)}`} — ${f2(Math.abs(z))} standard deviations ${hot ? 'above' : 'below'} its own ${quarterName} record`,
    summary: `Every insurer has a seasonal rhythm; the tell is when a company breaks its own. ${name}'s ${f.period} print of ${cur < 0 ? `−${pct(Math.abs(cur))}` : pct(cur)} sits ${f2(Math.abs(z))}σ ${hot ? 'above' : 'below'} the ~${pct(mu)} it has averaged across its last ${String(n)} available ${quarterName} prints, on a ${cr(totalCr)} quarter.`,
    thesis: `Cross-company comparisons blur structural differences; comparing ${name} against its own ${quarterName} history removes both seasonality and company mix in one step. A ${f2(Math.abs(z))}σ departure is the cleanest single-quarter evidence that the underlying trajectory changed — ${hot ? 'demand or distribution found another gear' : 'the engine lost a gear, and the season cannot be blamed'}.`,
    whatConsensusMisses: `Screens compare this quarter to last quarter or to peers; almost nobody compares a company to its own same-quarter distribution — which is where this ${f2(Math.abs(z))}σ anomaly is visible.`,
    consensusView: cur < 0 ? `A weak quarter is easy to file under sector softness — a peer table cannot show that it breaks this company's own pattern.` : `A ${pct(cur)} quarter reads as roughly in line for a growth insurer; nothing in a peer table flags it.`,
    variantBasis: `Against its own ${quarterName} record (~${pct(mu)} mean over its last ${String(n)} available prints) this quarter is a genuine statistical outlier, not ordinary variation.`,
    steelman: `With ${String(n)} historical observations the distribution is thin, and one shock year inflates σ-based reads. Handled: the detector requires a minimum dispersion, caps degenerate σ readings, excludes government schemes and comparisons that cross the Oct-2024 recognition change — and the claim is only that the pattern broke; the cause needs the mix and channel data alongside.`,
    falsifier: `Next year's ${quarterName} reverts to the ~${pct(mu)} historical pace, reclassifying this print as a one-year anomaly.`,
    application: app(`A pattern-break screen on ${name}.`, [
      { angle: 'Early warning', detail: hot ? 'Seasonal breaks to the upside often front-run guidance raises by a quarter or two.' : 'Seasonal breaks to the downside often front-run soft full-year prints.' },
      { angle: 'Cross-check', detail: 'Read together with the same quarter\'s mix shift and share move to identify the mechanism.' },
    ]),
    watch: { items: [
      inv('Same quarter next year', `A reversion to the ~${pct(mu)} historical ${quarterName} pace.`),
      conf('Adjacent quarters', `The surrounding quarters confirming the new trajectory rather than mean-reverting.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const monthlyMomentum: Narrator = (f) => {
  const { curG, prevG, shift, curW } = f.v
  const { name, windowEnd, prevWindowEnd } = f.s
  const dir = f.direction // building | fading | normalizing
  return {
    shortHeadline: dir === 'building' ? `${name}'s momentum is building monthly` : dir === 'normalizing' ? `${name}'s hyper-growth is normalising` : `${name}'s momentum is fading monthly`,
    headline: `${name}'s trailing 3-month growth ${dir === 'building' ? 'rose' : 'eased'} to ${pct(curG)} (window to ${windowEnd}) from ${pct(prevG)} a quarter earlier`,
    summary: `The monthly flash sees inflections a full quarter before results do. ${name}'s three months to ${windowEnd} grew ${pct(curG)} YoY versus ${pct(prevG)} for the window ending ${prevWindowEnd} — a ${pp(shift)} ${shift > 0 ? 'pickup' : 'cooldown'} on a ${cr(curW)} rolling book.`,
    thesis: dir === 'building'
      ? `Premium momentum measured on rolling three-month windows is the earliest reliable read the public data offers. The ${pp(shift)} acceleration will not appear in quarterly results for another print — the window to act on it is now.`
      : dir === 'normalizing'
        ? `A ${pct(prevG)} pace was never the run-rate — it was a base effect unwinding. The honest read is the new ${pct(curG)} level, and models still extrapolating the old pace are set up for a headline 'miss' that is really arithmetic.`
        : `The ${pp(shift)} deceleration between adjacent windows is the kind of quiet cooling that annual data hides for months. If it persists one more window, the quarterly print will surprise to the downside.`,
    whatConsensusMisses: `Quarterly reporting is the market's clock; the monthly flash already shows the ${shift > 0 ? 'acceleration' : 'deceleration'} — ${pct(prevG)} to ${pct(curG)} between adjacent windows — before any result lands.`,
    consensusView: `Growth is tracked quarterly; between prints the trailing quarter's pace is assumed to continue.`,
    variantBasis: `Rolling monthly windows (${pct(curG)} now vs ${pct(prevG)} one quarter ago) re-time the trend change to today rather than to the next results day.`,
    steelman: `Monthly prints are lumpy and one big group booking can tilt a window. Handled: three-month windows smooth single-month noise, both windows compare to their own prior-year months, and the base is ${cr(curW)} — large enough that a single deal rarely explains ${pp(shift)}.`,
    falsifier: `The next monthly window reverts toward ${pct(prevG)}, marking the shift as booking-timing noise.`,
    application: app(`An early-warning cadence read on ${name}.`, [
      { angle: 'Timing', detail: 'Position ahead of the quarterly print rather than reacting to it — the flash already contains the number\'s direction.' },
      { angle: dir === 'building' ? 'Thesis confirm' : 'Risk flag', detail: dir === 'building' ? 'Monthly acceleration on a large base tends to survive into the quarterly print.' : 'Two consecutive fading windows almost always show up as a soft quarter.' },
    ]),
    watch: { items: [
      inv('Next monthly window', `Rolling 3-month growth reverting toward ${pct(prevG)}.`),
      conf('Window trend', `Another window at or ${shift > 0 ? 'above' : 'below'} ${pct(curG)}.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const sahiStructure: Narrator = (f) => {
  const { cur, prev, delta, streak, sahiCr } = f.v
  const gaining = f.direction === 'sahi_gaining'
  const streakTxt = streak >= 3 ? ` — the ${streak >= 4 ? 'fourth-or-more' : 'third'} consecutive same-direction quarter` : ''
  return {
    shortHeadline: gaining ? 'Specialists keep taking the health market' : 'Generalists are pushing back into health',
    headline: `SAHIs wrote ${pct(cur)} of industry health premium in ${f.period}, ${signed(delta)}pp vs a year earlier${streakTxt}`,
    summary: `The structural war in Indian health insurance is specialist versus generalist. In ${f.period} the standalone health insurers took ${pct(cur)} of the industry's health premium against ${pct(prev)} in ${f.s.prevPeriod} — ${signed(delta)}pp on a ${cr(sahiCr)} quarterly book${streakTxt}.`,
    thesis: gaining
      ? `Each point of carrier-type share the SAHIs take is structurally stickier than a within-cohort share swap: it comes with retail-heavy mix and agency distribution that generalists struggle to match on service economics. ${streak >= 3 ? `A ${String(streak)}-quarter directional streak says this is trend, not noise.` : 'One quarter is a data point, not a trend — the streak to watch starts here.'}`
      : `The generalists — with banca reach and cross-sell — are clawing health premium back. For SAHI valuations built on a rising-share narrative, ${pp(delta)} of carrier-type share ceded in a year is a direct hit to the terminal assumption.`,
    whatConsensusMisses: `The SAHI-vs-generalist split is tracked annually if at all; the quarterly aggregate print shows the structural share at ${pct(cur)} and moving ${gaining ? 'up' : 'down'} as of ${f.period}.`,
    consensusView: `SAHI share of health is treated as a slow-moving structural constant in terminal-value math.`,
    variantBasis: `The quarterly printed aggregates show it moving ${signed(delta)}pp year-on-year${streak >= 3 ? ` with a ${String(streak)}-quarter streak` : ''} — the 'constant' is drifting print by print.`,
    steelman: `Government-scheme flows in and out of the industry denominator can nudge carrier-type shares without any retail-market change. Handled: the read uses printed sub-totals from the same report${'\u00a0'}— and where no multi-quarter streak exists the card claims a data point, not a trend.`,
    falsifier: `The next quarterly print reverses the ${gaining ? 'gain' : 'loss'}, breaking the directional streak.`,
    application: app('A market-structure input for every SAHI valuation.', [
      { angle: 'Terminal value', detail: `Stress SAHI terminal share assumptions against the printed ${pct(cur)} and its direction.` },
      { angle: gaining ? 'Sector tailwind' : 'Sector risk', detail: gaining ? 'A rising specialist share lifts the whole SAHI cohort\'s addressable premium.' : 'A falling specialist share is a cohort-wide multiple risk, independent of single-name execution.' },
    ]),
    watch: { items: [
      inv('Next quarterly aggregate', `SAHI share back near ${pct(prev)} — streak broken.`),
      conf('Streak', `A further same-direction quarter beyond ${pct(cur)}.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const entrantRamp: Narrator = (f) => {
  const { totalCr, prevCr, g } = f.v
  const { name, prevPeriod } = f.s
  return {
    shortHeadline: `New capacity: ${name} is scaling fast`,
    headline: `${name} wrote ${cr(totalCr)} in ${f.period} — ${pct(g)} above the ${cr(prevCr)} of ${prevPeriod}`,
    summary: `Capacity entering a market tells you where pricing goes next. ${name}, one of the newest SAHI licences, compounded to ${cr(totalCr)} in the ${f.period} quarter from ${cr(prevCr)} a year earlier. Small book, steep curve — this is the supply side of the cycle turning up.`,
    thesis: `Insurance margins are made and destroyed by the capital cycle: new capacity chases the segment's growth, prices to build book, and pressures incumbent pricing with a lag. Every incumbent-margin model that extrapolates today's pricing implicitly assumes entrants stay small — this print says they are not staying small.`,
    whatConsensusMisses: `New-licence ramps are ignored while their absolute share is tiny; but pricing pressure arrives via the marginal quote in retail and group tenders, not via the entrant's market share.`,
    consensusView: `The newest SAHIs are too small to matter to incumbent economics.`,
    variantBasis: `A book compounding at ${pct(g)} on the tender-facing margin changes marginal pricing well before it changes share tables.`,
    steelman: `Ramps from small bases routinely stall once claims seasoning arrives, and some never reach scale. Handled: the flag requires real absolute premium, not just a growth rate — and the watch item is the ramp's persistence, not its existence.`,
    falsifier: `${name}'s quarterly premium plateaus near ${cr(totalCr)} — the ramp stalls before reaching pricing-relevant scale.`,
    application: app('A capital-cycle input for incumbent margin assumptions.', [
      { angle: 'Pricing watch', detail: 'Track incumbent renewal pricing in the entrant\'s launch segments for the first signs of pressure.' },
      { angle: 'Cycle timing', detail: 'Multiple simultaneous ramps mark the expansion phase of the health capital cycle — margin assumptions should mean-revert, not extrapolate.' },
    ]),
    watch: { items: [
      inv('Ramp persistence', `Quarterly premium flat or lower at the next print vs ${cr(totalCr)}.`),
      conf('Scale threshold', `Another near-doubling quarter — the entrant reaches tender-relevant scale sooner.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const uwEconomics: Narrator = (f) => {
  const { cur, prev, dCR } = f.v
  const { name, basis, prevPeriod } = f.s
  const dir = f.direction
  const attribution = f.v.dClaims != null && f.v.dExp != null
    ? ` The move splits into ${signed(f.v.dClaims)}pp from claims and ${signed(f.v.dExp)}pp from expenses.`
    : ''
  const crossProfit = dir === 'crossed_into_profit'
  const crossLoss = dir === 'crossed_into_loss'
  const profitRegime = dir === 'profit_narrowing' || dir === 'profit_widening'
  return {
    shortHeadline: crossProfit ? `${name} now underwrites at a profit`
      : crossLoss ? `${name} slipped into underwriting loss`
      : dir === 'profit_narrowing' ? `${name}'s underwriting margin is thinning`
      : dir === 'profit_widening' ? `${name}'s underwriting margin is widening`
      : dir === 'improving' ? `${name}'s underwriting is healing` : `${name}'s underwriting is bleeding more`,
    headline: crossProfit
      ? `${name}'s ${basis} combined ratio crossed below 100 — ${f2(cur)}% in ${f.period}, from ${f2(prev)}% in ${prevPeriod}`
      : crossLoss
        ? `${name}'s ${basis} combined ratio crossed above 100 — ${f2(cur)}% in ${f.period}, from ${f2(prev)}% in ${prevPeriod}`
        : `${name}'s ${basis} combined ratio moved ${signed(dCR)}pp to ${f2(cur)}% in ${f.period}`,
    summary: `${crossProfit ? 'The line every health insurer chases: ' : crossLoss ? 'The line no insurer wants to cross: ' : ''}${name} printed a ${f2(cur)}% combined ratio (${basis} basis) in ${f.period} against ${f2(prev)}% in ${prevPeriod}.${attribution} ${crossProfit ? 'Below 100, the insurance book itself makes money — profit stops depending on investment income.' : crossLoss ? 'Above 100, every rupee of premium costs more than a rupee to service — reported profit is investment income carrying a loss-making book.' : profitRegime ? (dCR > 0 ? 'The book still underwrites at a profit — but the margin of safety to the 100% line narrowed this period.' : 'The book underwrites at a profit and the cushion to the 100% line got thicker — margin, compounding.') : dCR < 0 ? 'The trajectory is toward underwriting break-even — the scale-economics thesis is being proven or broken right here.' : 'The gap to underwriting break-even is widening, and it must be funded by float income and capital.'}`,
    thesis: crossProfit
      ? `Crossing under a 100% combined ratio is the single most valuation-relevant event a health insurer prints: it converts the equity story from 'float vehicle' to 'underwriting franchise', and warranted multiples re-rate on it. The follow-through question is persistence, not the crossing itself.`
      : crossLoss
        ? `A cross above 100% converts underwriting from an earnings engine into a funding cost. Consensus models typically keep the prior year's ratio; the ${signed(dCR)}pp move means economic earnings just degraded even where headline PAT holds up on investment income.`
        : profitRegime
        ? `For a profitable underwriter the combined ratio IS the margin print: at ${f2(cur)}% the buffer to break-even is ${f1(Math.abs(100 - cur))}pp, and its direction this period was ${dCR > 0 ? 'erosion' : 'expansion'}.${attribution ? ' Claims-versus-expense attribution says whether pricing or operating leverage moved it.' : ''}`
        : `Combined-ratio direction is the sector's margin trend in one number.${attribution ? ' Claims-versus-expense attribution says whether pricing or operating leverage is doing the work — they mean different things for durability.' : ''}`,
    whatConsensusMisses: `Headline PAT hides the split: at a ${f2(cur)}% combined ratio the underwriting line ${cur > 100 ? 'loses' : 'makes'} money on its own, and the ${signed(dCR)}pp move re-prices the quality of every rupee of reported profit.`,
    consensusView: `Reported profit is read at face value; the combined ratio is a secondary disclosure.`,
    variantBasis: `Economic earnings live in the underwriting line: ${f2(cur)}% vs ${f2(prev)}% (${basis}, like-for-like) is the real margin print.${attribution}`,
    steelman: `Combined ratios on ${basis} can move on reserve development and one-off expense items, not just current-year pricing.${f.cadence === 'quarterly' ? ' A single standalone quarter is also seasonally light on renewals.' : ''} Handled: the comparison is strictly same-basis and same-period-type, and the watch items test persistence.`,
    falsifier: crossProfit
      ? `The ratio moves back above 100 at the next same-basis print — the crossing was one-off (reserve releases or an expense timing effect).`
      : `The next same-basis print reverses the ${signed(dCR)}pp move.`,
    application: app(`An earnings-quality read on ${name} (${basis} basis).`, [
      { angle: 'Valuation', detail: crossProfit ? 'Underwriting-profitable health franchises deserve a structurally higher multiple than float vehicles — test whether the market has re-rated it yet.' : 'Discount reported PAT by the underwriting deficit to see economic earnings.' },
      { angle: 'Cross-check', detail: 'Confirm the same direction on the other accounting basis before sizing a position on it.' },
    ]),
    watch: { items: [
      inv('Next same-basis print', crossProfit ? `Combined ratio back above 100.` : `The ${signed(dCR)}pp move reversing.`),
      conf('Persistence', crossProfit ? `A second consecutive print below 100.` : `The trajectory extending from ${f2(cur)}%.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const basisDivergence: Narrator = (f) => {
  const { gI, gF, gap, patI, patF } = f.v
  const { name } = f.s
  const flip = f.direction === 'sign_flip'
  const iUp = gI > gF
  return {
    shortHeadline: `${name}'s two profit stories disagree`,
    headline: flip
      ? `${name}: PAT ${gI < 0 ? 'fell' : 'grew'} ${pct(Math.abs(gI))} on IGAAP but ${gF > 0 ? 'grew' : 'fell'} ${pct(Math.abs(gF))} on IFRS — same company, same year`
      : `${name}'s PAT growth differs by ${pp(gap)} between IGAAP and IFRS in ${f.period}`,
    summary: `Which profit line you read decides the story. On the statutory IGAAP basis ${name} earned ${cr(patI)} in ${f.period} (${signed(gI)}% YoY); on IFRS it earned ${cr(patF)} (${signed(gF)}% YoY). ${flip ? 'One basis says profit fell, the other says it grew — a ' + pp(gap) + ' divergence on the same twelve months.' : 'A ' + pp(gap) + ' spread between the two bases for the same twelve months.'}`,
    thesis: `Accounting timing drives most of the gap: IFRS spreads acquisition costs over the contract life while IGAAP expenses them upfront, so the two bases can price the same year very differently. ${iUp ? `Here the statutory line (${signed(gI)}%) runs ahead of IFRS (${signed(gF)}%) — check what one-offs or reserve movements sit in the statutory print before crediting it.` : `Here the IFRS line (${signed(gF)}%) runs ahead of the statutory print (${signed(gI)}%) — a pattern consistent with acquisition-cost timing on a growing book, though the data here sizes the gap rather than proves the cause.`}`,
    whatConsensusMisses: `Screens and databases key off one basis — usually statutory — so half the market is anchored to ${signed(gI)}% growth while the IFRS accounts print ${signed(gF)}%: the anchor, not the business, is the difference.`,
    consensusView: `${name}'s profit trajectory is quoted as a single number, from whichever basis the reader's data source carries.`,
    variantBasis: `Both reported bases are public: ${cr(patI)} vs ${cr(patF)} for the same year. The gap is measurable, dated and falsifiable — not an opinion.`,
    steelman: `IFRS profit for unlisted-basis reporters can rest on management-selected assumptions (discount rates, CSM amortisation) that flatter growth. Handled: the read never claims one basis is 'true' — it flags that the divergence exists, sizes it, and points to the underwriting line as the arbiter.`,
    falsifier: `The two bases reconverge at the next annual print — the divergence was a one-year timing artifact, not a persistent feature of the growth model.`,
    application: app(`An accounting-lens read on ${name}.`, [
      { angle: 'Anchor check', detail: 'Know which basis every counterparty quotes before debating the "growth" — the argument is often about accounting, not business.' },
      { angle: 'Entry point', detail: flip && gF > gI ? 'Statutory-anchored screens mark the name as deteriorating while IFRS says improving — mispricings born of accounting anchors mean-revert.' : 'Size the timing gap before it converges.' },
    ]),
    watch: { items: [
      inv('Next annual prints', `IGAAP and IFRS PAT growth reconverging within a normal spread.`),
      conf('Underwriting line', `The combined ratio confirming the direction the IFRS line implies.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const solvencyRunway: Narrator = (f) => {
  const { s, g, t, headroom } = f.v
  const { name } = f.s
  return {
    shortHeadline: `${name} is running out of solvency road`,
    headline: `${name} holds ${f2(s)}x solvency vs the 1.5x floor — at ${pct(g)} growth the cushion lasts about ${f1(t)} years`,
    summary: `Solvency of ${f2(s)}x sounds safe next to the 1.5x regulatory floor — until growth is priced in. ${name} is compounding premium at ${pct(g)}, and premium growth consumes solvency capital mechanically. At that pace the ${f2(headroom)}x cushion erodes in roughly ${f1(t)} years without fresh capital.`,
    thesis: `Solvency is the growth governor of an insurer: the faster the book compounds, the faster the ratio falls toward the floor. A ~${f1(t)}-year runway makes a capital event — equity raise, sub-debt, or forced growth deceleration — a near-term planning item, not a tail scenario. Each path has a different owner: dilution for shareholders, coupon for earnings, multiple pressure for the growth story.`,
    whatConsensusMisses: `The market reads the level (${f2(s)}x, 'above the floor'); the binding constraint is the level divided by the growth rate — and on that measure the runway is ~${f1(t)} years, the real catalyst clock.`,
    consensusView: `A solvency ratio above the regulatory floor is filed under 'adequately capitalised'.`,
    variantBasis: `Growth-adjusted, the same number implies a dated capital event: ${f2(s)}x eroding at ${pct(g)} premium growth reaches 1.5x in about ${f1(t)} years.`,
    steelman: `Internal accruals lengthen the runway if profitability inflects, and management can throttle group business to slow capital burn. Handled: the runway is labelled a heuristic — its value is ranking names by capital urgency and dating the catalyst window, not forecasting the raise to the quarter.`,
    falsifier: `${name} raises capital, or profitability lifts internal accruals enough that the next solvency prints stabilise ${f2(s)}x instead of eroding.`,
    application: app(`A capital-event clock on ${name}.`, [
      { angle: 'Catalyst', detail: `Position for the raise window the ~${f1(t)}-year runway implies — dilution terms get set by whoever moves first.` },
      { angle: 'Relative value', detail: 'Rank the cohort by growth-adjusted runway, not by the headline solvency level.' },
    ]),
    watch: { items: [
      inv('Capital action', `An equity or sub-debt raise, or growth deceleration that visibly slows the erosion.`),
      conf('Next solvency print', `The ratio stepping down again from ${f2(s)}x.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const valuationDislocation: Narrator = (f) => {
  const { pb, roe, implied, gapPp } = f.v
  const { name } = f.s
  const ahead = f.direction === 'priced_ahead'
  return {
    shortHeadline: ahead ? `${name} prices a return it has yet to earn` : `${name} trades below its delivered returns`,
    headline: `${name} at ${f2(pb)}x statutory book vs ${pct(roe)} delivered ROE — the price implies a ~${pct(implied)} steady-state return`,
    summary: `Invert the multiple and the price becomes a forecast. At ${f2(pb)}x statutory book value, with a 12% cost of equity and 8% terminal growth, the market is underwriting a ~${pct(implied)} sustainable ROE. ${name} delivers ${pct(roe)} on that same statutory equity — a ${pp(gapPp)} gap the ${ahead ? 'price front-runs' : 'market ignores'}, measured on one accounting basis end-to-end.`,
    thesis: ahead
      ? `The multiple is a forward-ROE option: the equity works only if returns ramp from ${pct(roe)} toward ${pct(implied)} on schedule. That path runs through underwriting profitability and operating leverage — both observable quarterly — so the thesis is testable print by print, and each print that fails to close the gap shortens the option.`
      : `Delivered returns above what the multiple requires is the rarer dislocation — either the market doubts the ROE's durability or the name has slipped through the coverage net. The gap closes via re-rating or via returns fading; which one is the trade.`,
    whatConsensusMisses: `Multiples are quoted as levels; inverted into required returns, ${f2(pb)}x statutory book is a ~${pct(implied)} ROE claim standing against ${pct(roe)} delivered on the same equity — a live, falsifiable forecast most holders have never solved for.`,
    consensusView: `${f2(pb)}x book is discussed as expensive or fair by peer comparison, not solved for the return path it demands.`,
    variantBasis: `Reverse-engineering the Gordon multiple turns the price into a testable claim: implied ~${pct(implied)} vs delivered ${pct(roe)}, a ${pp(gapPp)} execution gap.`,
    steelman: `Young books earn depressed statutory ROEs while acquisition costs are expensed upfront — on the IFRS lens the same year's profit is materially higher, so the gap narrows on that basis. Handled: the read holds ONE basis end-to-end (statutory book, statutory return) and shows the IFRS multiple separately; the direction of the gap survives the lens change even where its size does not.`,
    falsifier: ahead
      ? `Delivered ROE ramps decisively toward ${pct(implied)} over coming prints — the market's forecast starts being earned.`
      : `The multiple re-rates upward toward what delivered returns support.`,
    application: app(`An expectations-investing read on ${name}.`, [
      { angle: 'Expectations gap', detail: `Track delivered ROE each print against the ~${pct(implied)} the price requires; the gap trend is the position signal.` },
      { angle: 'Risk flag', detail: ahead ? 'Priced-in ROE ramps leave no room for execution slips — small misses produce outsized de-ratings.' : 'Cheapness against delivered returns still needs a catalyst to close.' },
    ]),
    watch: { items: [
      inv('ROE trajectory', ahead ? `Delivered ROE climbing toward ${pct(implied)} — the gap closing by earnings, not de-rating.` : `Delivered returns fading toward what the multiple implies.`),
      conf('Multiple', `The book multiple holding near ${f2(pb)}x while the ROE gap persists.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const priceFundamentalsGap: Narrator = (f) => {
  const { ret, retailG, p0, p1 } = f.v
  const { name, proxy } = f.s
  const derate = f.direction === 'derating_despite_growth'
  const proxyNote = proxy ? ` (traded via ${proxy})` : ''
  return {
    shortHeadline: derate ? `The tape and ${name}'s book disagree` : `${name} rallies while the book weakens`,
    headline: derate
      ? `${name}${proxyNote} fell ${pct(Math.abs(ret))} in ${f.period} while its retail premium grew ${pct(retailG)}`
      : `${name}${proxyNote} rose ${pct(ret)} in ${f.period} while its retail premium fell ${pct(Math.abs(retailG))}`,
    summary: `Same quarter, two verdicts. Over ${f.period} the ${proxy ? `${proxy} line (the listed proxy)` : 'shares'} moved from ₹${f1(p0)} to ₹${f1(p1)} — ${signed(ret)}% — while the retail health book ${retailG > 0 ? 'grew' : 'shrank'} ${pct(Math.abs(retailG))} year-on-year. ${derate ? 'The market de-rated a franchise whose highest-quality premium line kept growing.' : 'The market re-rated a franchise whose highest-quality premium line went backwards.'}`,
    thesis: derate
      ? `Price-fundamental divergences resolve one of two ways: the tape knows something the filings don't yet show (margin, claims, governance), or sentiment overshot fundamentals. The premium print is an official industry filing; the price move is sentiment until proven otherwise. The divergence itself is the opportunity set — the work is establishing which side is wrong.`
      : `A rally against weakening premium fundamentals borrows from the future: either a re-rating story (margin, capital return) justifies it, or the tape mean-reverts to the book.`,
    whatConsensusMisses: `Screens read price momentum and fundamentals momentum separately; the information is in their disagreement — ${signed(ret)}% tape vs ${signed(retailG)}% retail premium over the identical window.`,
    consensusView: derate ? `A falling stock is read as deteriorating fundamentals — the price is treated as the evidence.` : `A rising stock is read as improving fundamentals.`,
    variantBasis: `The official premium print covers the same calendar window as the price move and points the other way; one of the two signals is wrong, and only one of them is a regulatory filing.`,
    steelman: `The tape may be pricing claims inflation, an expense problem, or supply of paper (lock-in expiries, block deals) that premium data cannot see${proxy ? '; and a listed-holding-company proxy adds its own discount noise' : ''}. Handled: the read claims divergence, not direction — its resolution items are the next ratio prints and shareholding data.`,
    falsifier: derate
      ? `The next results print validates the tape — combined ratio or claims deterioration that explains the de-rating.`
      : `The next results print validates the rally with margin improvement the premium line hid.`,
    application: app(`A dislocation read on ${name}.`, [
      { angle: 'Opportunity screen', detail: derate ? 'Filed fundamentals growing into a de-rating is the classic variant-perception setup — do the claims-side work.' : 'Fundamentals-blind rallies are funding sources when they lack a margin story.' },
      { angle: 'Resolution watch', detail: 'The next combined-ratio and shareholding prints arbitrate which signal was right.' },
    ]),
    watch: { items: [
      inv('Next results print', derate ? `Claims or expense deterioration that justifies the ${pct(Math.abs(ret))} fall.` : `Margin improvement that justifies the rally.`),
      conf('Premium persistence', `Retail growth holding near ${pct(retailG)} at the next quarterly print.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const ownershipRotation: Narrator = (f) => {
  const { cur, prev, delta, streak } = f.v
  const { name, holder, counterHolder } = f.s
  const accumulating = f.direction === 'accumulating'
  const institutional = holder === 'FIIs' || holder === 'DIIs'
  const who = holder === 'FIIs' ? 'Foreign institutions' : holder === 'DIIs' ? 'Domestic institutions' : holder === 'Promoters' ? 'The promoters' : 'Retail and public holders'
  const streakTxt = streak >= 2 ? ` — the ${streak >= 3 ? 'third-or-more' : 'second'} consecutive quarter in the same direction` : ''
  const counterTxt = counterHolder != null && f.v.counterDelta != null
    ? ` The other side of the trade: ${counterHolder} moved ${signed(f.v.counterDelta)}pp to ${pct(f.v.counterCur)}.`
    : ''
  // the closing read must match WHO moved: public selling into institutional
  // buying is a different signal from institutions heading for the exit.
  const closing = holder === 'Promoters' && !accumulating
    ? 'Promoter supply is the heaviest overhang a register can carry.'
    : institutional && accumulating
      ? 'Institutional accumulation is the quiet vote that precedes coverage and re-rating.'
      : institutional && !accumulating
        ? 'Institutional distribution is the quiet exit that precedes downgrades.'
        : accumulating
          ? 'A swelling public register usually means institutions are on the other side, supplying.'
          : counterHolder != null
            ? 'Retail supply moving into stronger hands is how registers institutionalise.'
            : 'Retail selling without a visible absorber leaves the float looser than before.'
  return {
    shortHeadline: accumulating ? `${who} are building ${name}` : `${who} are backing away from ${name}`,
    headline: `${holder} moved ${signed(delta)}pp to ${pct(cur)} of ${name} in ${f.period}${streakTxt}`,
    summary: `Registers move before narratives do. ${who} ${accumulating ? 'lifted' : 'cut'} their ${name} stake to ${pct(cur)} from ${pct(prev)} over the quarter${streakTxt}.${counterTxt} ${closing}`,
    thesis: institutional
      ? (accumulating
        ? `${pp(delta)} of a listed insurer's register changing hands in one quarter is real money making a real decision${streak >= 2 ? ', and a multi-quarter streak converts a data point into positioning' : ''}. Sustained institutional building tightens float, steadies the tape, and often front-runs sell-side initiation.`
        : `${pp(delta)} of institutional distribution in a quarter${streak >= 2 ? ' — extended across consecutive quarters —' : ''} is supply the rest of the register must absorb. Register pressure caps re-ratings independent of fundamentals.`)
      : `${pp(delta)} of the register rotating in one quarter is a positioning fact, not noise.${counterHolder != null ? ` Here the ${holder.toLowerCase()} side ${accumulating ? 'absorbed what ' + counterHolder + ' supplied' : 'supplied what ' + counterHolder + ' absorbed'} — the direction of travel between holder types is the signal.` : ''}`,
    whatConsensusMisses: `Shareholding filings are lagged and rarely parsed at the holder-group level; the ${signed(delta)}pp quarterly move${streak >= 2 ? ' and its streak' : ''} is public, datable evidence of positioning that most models ignore entirely.`,
    consensusView: `Ownership tables are compliance data, not signal.`,
    variantBasis: `Filing-to-filing holder-group deltas are among the few direct positioning reads available on this name — and they currently point one way.`,
    steelman: `A single block trade, an index event or a QIP allocation can move a holder group without any active view being taken. Handled: the streak dimension separates event effects from campaigns, and the read is weighed with the price action of the same window.`,
    falsifier: `The next quarterly filing reverses the move — ${holder} back toward ${pct(prev)}.`,
    application: app(`A register read on ${name}.`, [
      { angle: 'Positioning', detail: accumulating ? 'Institutional builds tighten free float — size entries before the register crowds.' : 'Distribution overhangs cap rallies — respect the supply when timing entries.' },
      { angle: 'Cross-check', detail: 'Match the register move against the same quarter\'s price action and block-deal disclosures for the mechanism.' },
    ]),
    watch: { items: [
      inv('Next shareholding filing', `${holder} reverting toward ${pct(prev)}.`),
      conf('Streak extension', `Another same-direction quarterly move beyond ${pct(cur)}.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const analystReprice: Narrator = (f) => {
  const { curT, prevT, move } = f.v
  const { name, broker, rating } = f.s
  const pack = f.direction === 'pack_up' || f.direction === 'pack_down'
  const split = f.direction === 'split'
  const raised = f.direction === 'raised' || f.direction === 'pack_up'
  const secondTxt = f.v.move2 != null && f.s.broker2
    ? ` ${f.s.broker2} moved ${signed(f.v.move2)}% to ₹${f1(f.v.curT2)} in the same window.`
    : ''
  return {
    shortHeadline: pack
      ? `Desks are re-baselining ${name} ${raised ? 'up' : 'down'} in a pack`
      : split
        ? `The desks just split on ${name}`
        : `${broker} ${raised ? 'raised' : 'cut'} its ${name} target hard`,
    headline: pack
      ? `${String(f.v.n)} desks moved ${name} targets the same direction in ${f.period} — led by ${broker} at ${signed(move)}%`
      : split
        ? `Covering desks moved ${name} targets in opposite directions in ${f.period} — ${broker} ${signed(move)}% against the tape`
        : `${broker} moved its ${name} target ${signed(move)}% — ₹${f1(prevT)} to ₹${f1(curT)}${rating !== 'n/a' ? ` (${rating})` : ''}`,
    summary: `Revision direction moves stocks more reliably than rating levels. ${broker} shifted its ${name} target from ₹${f1(prevT)} to ₹${f1(curT)} — a ${pct(Math.abs(move))} ${raised ? 'raise' : 'cut'} between consecutive notes from the same desk.${secondTxt}${pack ? ' Same-window moves in the same direction are how re-rating cycles start.' : split ? ' Opposite-direction moves in the same window mean the story is genuinely contested.' : ''}`,
    thesis: pack
      ? `When multiple desks re-baseline the same direction inside one window, the marginal buyer's anchor moves with them — pack revisions are the mechanism by which a data print becomes a re-rating. The lead move of ${signed(move)}% sets the new reference point.`
      : `Same-desk target revisions are the cleanest sell-side signal: they difference out the desk's house style and leave only the change in view. ${raised ? 'Upward revision cycles tend to run in packs — one desk re-baselines and the rest follow within weeks.' : 'Downward revisions from a covering desk often mark the start of an estimates-cut cycle, and stocks rarely bottom before the cuts stop.'}`,
    whatConsensusMisses: `Aggregated consensus smooths this away: the average target barely moves when a desk swings ${pct(Math.abs(move))}, yet the revision — not the average — is where the information sits.`,
    consensusView: `Coverage is summarised by the consensus average and rating mix.`,
    variantBasis: `The same-broker revision series shows the direction of change of conviction — a sharper, earlier read than any average level.`,
    steelman: `A desk's move can reflect a model refresh or analyst change rather than new information. Handled: each revision is attributed as one desk's opinion${pack ? ', and this card only fired because more than one desk moved together' : ' and gains weight only if other desks follow — that follow-through is the watch item'}.`,
    falsifier: pack
      ? `The next round of notes fails to extend the direction — the pack move exhausts itself.`
      : `No other covering desk moves the same direction within the next round of notes — the revision stays idiosyncratic.`,
    application: app(`A sell-side momentum read on ${name}.`, [
      { angle: 'Revision cycle', detail: raised ? 'Track whether further desks re-baseline upward — pack revisions precede re-ratings.' : 'Track whether estimate cuts spread — packs of cuts precede de-ratings.' },
      { angle: 'Attribution', detail: 'This is broker opinion, priced for its direction, never a house view of value.' },
    ]),
    watch: { items: [
      inv('Peer desks', `The next notes from other covering brokers failing to ${pack ? 'extend' : 'join'} the direction.`),
      conf('Follow-through', `Another desk revising ${raised ? 'up' : 'down'} within the following weeks.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const analystDispersion: Narrator = (f) => {
  const { hi, lo, mu, disp, n } = f.v
  const { name } = f.s
  return {
    shortHeadline: `The Street can't agree on ${name}`,
    headline: `Live targets on ${name} span ₹${f1(lo)} to ₹${f1(hi)} — ${pct(disp)} of the mean, across ${String(n)} desks`,
    summary: `Wide dispersion is information: ${String(n)} desks currently carry ${name} targets from ₹${f1(lo)} to ₹${f1(hi)} around a ₹${f1(mu)} mean — a ${pct(disp)} spread. The Street has not settled this story, which means the marginal research note still moves the stock.`,
    thesis: `Target dispersion measures how unresolved the equity story is. At ${pct(disp)}, ${name} trades on narrative, not consensus — surprises in either direction travel further because there is no agreed model to anchor the reaction. High-dispersion names reward primary work: the analyst who resolves the disagreement first captures the move.`,
    whatConsensusMisses: `Quoting the mean target hides that the desks disagree by ${pct(disp)} of it — the mean of an unresolved argument is not a forecast, it is an artifact.`,
    consensusView: `The consensus target is treated as the Street's answer on fair value.`,
    variantBasis: `The distribution around it — ₹${f1(lo)} to ₹${f1(hi)} — says there is no answer yet, only a live argument.`,
    steelman: `Dispersion can simply reflect stale notes that were never withdrawn. Handled: only each broker's latest note counts, and the read prices the disagreement, not any single target.`,
    falsifier: `The next round of notes converges the band materially toward the mean — the argument resolves.`,
    application: app(`A conviction-map read on ${name}.`, [
      { angle: 'Volatility', detail: 'High-dispersion names move harder on prints — size positions for the wider outcome distribution.' },
      { angle: 'Edge', detail: 'Where the Street disagrees, primary data (the quarterly premium and ratio prints in this dashboard) is the tiebreaker.' },
    ]),
    watch: { items: [
      inv('Band convergence', `New notes narrowing the ₹${f1(lo)}–₹${f1(hi)} band substantially.`),
      conf('Print reactions', `Outsized stock reactions to routine data — the signature of an unresolved story.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const channelShift: Narrator = (f) => {
  const { cur, prev, delta } = f.v
  const { name, channel, basisNote, prevPeriod, channel2 } = f.s
  const rising = f.direction === 'rising'
  const secondTxt = channel2 != null && f.v.delta2 != null
    ? ` The offsetting move: ${channel2} went ${signed(f.v.delta2)}pp to ${pct(f.v.cur2)}.`
    : ''
  return {
    shortHeadline: `${name} is rewiring its distribution`,
    headline: `${name}'s ${channel} share moved ${signed(delta)}pp to ${pct(cur)} (${basisNote})`,
    summary: `Distribution is destiny in retail insurance. ${name} sourced ${pct(cur)} of premium through ${channel} against ${pct(prev)} in the comparable ${prevPeriod} window — a ${pp(delta)} ${rising ? 'increase' : 'decrease'} in one year, on a like-for-like basis.${secondTxt}`,
    thesis: `Channel mix moves before economics do: each channel carries its own commission structure, persistency and claims profile. A ${pp(delta)} reallocation ${rising ? 'toward' : 'away from'} ${channel} re-prices acquisition economics and renewal durability with a lag the P&L only reveals quarters later.`,
    whatConsensusMisses: `Channel mix sits in a regulatory disclosure almost nobody models; the shift is visible now, while its margin consequences are still in front of the P&L.`,
    consensusView: `Distribution mix is a static descriptive fact from the last annual report.`,
    variantBasis: `The like-for-like disclosure shows it moving ${pp(delta)} within a year — distribution strategy is changing in real time.`,
    steelman: `Cumulative windows can shift on the timing of a single banca or broker campaign, and mix percentages move when another channel surges. Handled: the comparison holds the window fixed against the same period last year, and the read flags reallocation, not intent.`,
    falsifier: `The full-year disclosure shows ${channel} back near ${pct(prev)} — the shift was campaign timing, not strategy.`,
    application: app(`A distribution-economics read on ${name}.`, [
      { angle: 'Margin lead indicator', detail: 'Map the channel\'s commission and persistency profile onto the shift to pre-model the expense-ratio drift.' },
      { angle: 'Dependence', detail: 'Watch concentration: a franchise that leans harder on one channel inherits that channel\'s bargaining power.' },
    ]),
    watch: { items: [
      inv('Full-year mix', `${channel} share reverting toward ${pct(prev)} at the annual disclosure.`),
      conf('Expense ratio', `Commission and expense lines drifting the direction the new mix implies.`),
    ] },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const industryTide: Narrator = (f) => {
  const { cur, prev, delta, streak } = f.v
  const growthTxt = f.v.healthG != null && f.v.motorG != null
    ? ` Health premium grew ${pct(f.v.healthG)} against motor's ${pct(f.v.motorG)}.`
    : ''
  return {
    shortHeadline: 'Health is swallowing general insurance',
    headline: `Health reached ${pct(cur)} of all GI premium in ${f.period} — ${signed(delta)}pp in a year, ${String(streak)} consecutive rising years`,
    summary: `The quiet structural fact under every SAHI thesis: health insurance is ${pct(cur)} of India's general-insurance premium, up from ${pct(prev)} a year before — with ${String(streak)} consecutive rising years on record.${growthTxt} The industry's centre of gravity keeps moving toward the one segment the specialists own.`,
    thesis: `A ${String(streak)}-year run of consecutive share gains is not a cycle — it is a structural reallocation of the industry's premium pool (commonly attributed to medical inflation, under-penetration and post-pandemic awareness, though the segment data here shows the shift, not its drivers). Every year health outgrows the industry, the SAHI addressable market compounds ahead of GDP, and motor-led generalists' mix decays by default.`,
    whatConsensusMisses: `Sector debates fixate on within-cohort share fights; the pool itself growing ${signed(delta)}pp of industry share per year is the larger, quieter number that compounds under every name's terminal value.`,
    consensusView: `Health's rise within GI is known qualitatively — and then left out of terminal-growth math.`,
    variantBasis: `The printed segment shares quantify it: ${pct(cur)} and a ${String(streak)}-year rising streak — a compounding structural input, not a talking point.`,
    steelman: `Government-scheme premium and one-off group repricing can inflate a single year's health share. Handled: the streak — not any single year — carries the claim, and the segment split comes from the industry's own printed totals.`,
    falsifier: `Health's share of GI premium prints flat or lower next fiscal year, breaking the streak.`,
    application: app('The structural backdrop for all health-insurance positions.', [
      { angle: 'Terminal value', detail: 'A segment gaining industry share yearly justifies higher terminal growth for pure-plays than for the diversified peer set.' },
      { angle: 'Cycle context', detail: 'A growing pool cushions within-cohort share losses — erosion in a compounding market is survivable; in a flat one it is not.' },
    ]),
    watch: { items: [
      inv('Next FY segment print', `Health share flat or down versus ${pct(cur)}.`),
      conf('Monthly flash', `Health continuing to outgrow motor and fire through the year.`),
    ] },
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
