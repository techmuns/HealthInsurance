# Source-navigation live audit

_Clicked every internal source chip on the analysis surfaces and verified it lands on its Data Audit evidence. Base: http://localhost:5173/._

## Summary

| Category | Count |
| --- | ---: |
| Internal source chips clicked | 17 |
| · PASS (exact cell highlighted) | 17 |
| · FALLBACK (banner only — metric not an addressable cell) | 0 |
| · FAIL (did not navigate) | 0 |
| External source chips (open a document) | 22 |
| · without href | 0 |
| Documented feed provenance notes (intentional — per-item links carry the sources) | 1 |
| Silent source notes (no URL / no target) | 0 |
| Page errors | 0 |

## Documented provenance notes (not source gaps)

_A feed-level provenance label describes how an entire feed is sourced — it has no single cell or URL because the real per-item sources are the article links inside the feed. Listed here so it is an explained, intentional note, never an unverified gap._

- **SAHI · Key Sectoral News** — 1 feed-level provenance note(s) — real sources are the per-item article links

## Every source click

| Surface | Kind | id / target | Verdict | Detail |
| --- | --- | --- | --- | --- |
| SAHI · Companies | internal | audit::niva-bupa::GWP Growth::FY26 → niva-bupa::GWP Growth::FY26 | PASS | cell SAHIs comparison!F7 · "Verify this sourceNiva Bupa · Gross written premium · FY26 = FY26Highl" |
| SAHI · Premium & Distribution | internal | audit::niva-bupa::Gross written premium::FY26 → niva-bupa::Gross written premium::FY26 | PASS | cell SAHIs comparison!F7 · "Verify this sourceNiva Bupa · Gross written premium · FY26 = FY22–FY26" |
| SAHI · Premium & Distribution | internal | audit::niva-bupa::Retail health GWP → niva-bupa::Retail health GWP | PASS | cell SAHIs comparison!C5 · "Verify this sourceNiva Bupa · Retail health GWP = FY22–FY26Locate the " |
| SAHI · Premium & Distribution | internal | audit::niva-bupa::Agency channel GWP::FY25 → niva-bupa::Agency channel GWP::FY25 | PASS | cell Channel Mix!I32 · "Verify this sourceNiva Bupa · Agency / channel GWP · FY25 = FY25Highli" |
| SAHI · Profitability | internal | audit::niva-bupa::Combined ratio → niva-bupa::Combined ratio | PASS | cell SAHIs comparison!C21 · "Verify this sourceNiva Bupa · Combined ratio = FY23–FY26Locate the Com" |
| SAHI · Valuation | external | ext::unlisted-pending | EXTERNAL_OK |  |
| SAHI · Valuation | external | ext::unlisted-pending | EXTERNAL_OK |  |
| SAHI · Valuation | external | ext::unlisted-pending | EXTERNAL_OK |  |
| SAHI · Valuation | external | ext:: | EXTERNAL_OK |  |
| SAHI · Valuation | external | ext:: | EXTERNAL_OK |  |
| SAHI · Valuation | external | ext:: | EXTERNAL_OK |  |
| SAHI · Valuation | external | ext:: | EXTERNAL_OK |  |
| SAHI · Valuation | external | ext:: | EXTERNAL_OK |  |
| SAHI · Valuation | external | ext:: | EXTERNAL_OK |  |
| SAHI · Valuation | external | ext:: | EXTERNAL_OK |  |
| SAHI · Valuation | external | ext:: | EXTERNAL_OK |  |
| SAHI · Valuation | internal | audit::niva-bupa::Share price → niva-bupa::Share price | PASS | cell (pulsing) · "Verify this sourceNiva Bupa · Share price = as of 1 Jun 2026Locate the" |
| SAHI · Valuation | internal | audit::niva-bupa::Consensus target → niva-bupa::Consensus target | PASS | cell Analyst coverage!H4 · "Verify this sourceNiva Bupa · Analyst coverage = 4 brokers' latest vie" |
| SAHI · Valuation | internal | audit::niva-bupa::P / GWP::FY26 → niva-bupa::P / GWP::FY26 | PASS | cell Comps!J4 · "Verify this sourceNiva Bupa · Price / GWP · FY26Highlighted below — Pr" |
| SAHI · Valuation | internal | audit::star-health::P / GWP::FY26 → star-health::P / GWP::FY26 | PASS | cell Comps!J5 · "Verify this sourceStar Health · Price / GWP · FY26Highlighted below — " |
| SAHI · Valuation | internal | audit::niva-bupa::Consensus target → niva-bupa::Consensus target | PASS | cell Analyst coverage!H4 · "Verify this sourceNiva Bupa · Analyst coverage = 4 brokers' latest vie" |
| SAHI · Street View | external | ext::unlisted-pending | EXTERNAL_OK |  |
| SAHI · Street View | external | ext::unlisted-pending | EXTERNAL_OK |  |
| SAHI · Street View | external | ext::unlisted-pending | EXTERNAL_OK |  |
| SAHI · Street View | external | ext:: | EXTERNAL_OK |  |
| SAHI · Street View | external | ext:: | EXTERNAL_OK |  |
| SAHI · Street View | external | ext:: | EXTERNAL_OK |  |
| SAHI · Street View | external | ext:: | EXTERNAL_OK |  |
| SAHI · Street View | external | ext:: | EXTERNAL_OK |  |
| SAHI · Street View | external | ext:: | EXTERNAL_OK |  |
| SAHI · Street View | external | ext:: | EXTERNAL_OK |  |
| SAHI · Street View | external | ext:: | EXTERNAL_OK |  |
| SAHI · Street View | internal | audit::niva-bupa::Share price → niva-bupa::Share price | PASS | cell (pulsing) · "Verify this sourceNiva Bupa · Share price = as of 1 Jun 2026Locate the" |
| SAHI · Street View | internal | audit::niva-bupa::Consensus target → niva-bupa::Consensus target | PASS | cell Analyst coverage!H4 · "Verify this sourceNiva Bupa · Analyst coverage = 4 brokers' latest vie" |
| SAHI · Street View | internal | audit::niva-bupa::P / GWP::FY26 → niva-bupa::P / GWP::FY26 | PASS | cell Comps!J4 · "Verify this sourceNiva Bupa · Price / GWP · FY26Highlighted below — Pr" |
| SAHI · Street View | internal | audit::star-health::P / GWP::FY26 → star-health::P / GWP::FY26 | PASS | cell Comps!J5 · "Verify this sourceStar Health · Price / GWP · FY26Highlighted below — " |
| SAHI · Street View | internal | audit::niva-bupa::Consensus target → niva-bupa::Consensus target | PASS | cell Analyst coverage!H4 · "Verify this sourceNiva Bupa · Analyst coverage = 4 brokers' latest vie" |
| SAHI · Key Sectoral News | note |  | PROVENANCE_NOTE | 1 feed-level provenance note(s) — real sources are the per-item article links |
| Industry | internal | audit::niva-bupa::GI segment premium → niva-bupa::GI segment premium | PASS | cell Industry Growth!C4 · "Verify this sourceNiva Bupa · GI segment premium = FY22 → FY26Locate t" |
| Industry | internal | audit::niva-bupa::Overall health market share → niva-bupa::Overall health market share | PASS | cell SAHIs comparison!C9 · "Verify this sourceNiva Bupa · Overall health market share = FY22–FY27L" |