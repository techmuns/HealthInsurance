# Daily Brief source-click audit

_Clicks each "Since Yesterday" row and verifies where it lands. Base: http://localhost:5173/._

## Summary

| Category | Count |
| --- | ---: |
| PASS — exact card highlighted + labelled | 2 |
| SECTION — opened the right section/tab, no exact-item highlight (follow-up) | 0 |
| FAIL — did not land | 0 |
| External rows (open the article) | 1 |
| Rows absent today | 0 |
| Page errors | 0 |

## External sources (Path 2 — open the exact article, by design)

_These rows are external-only: the source is a document/article with no internal card to deep-link to. Opening the exact URL is the precise verification path, not a gap._

- **company (newly surfaced relevant update)** — opens https://www.moneycontrol.com/news/business/stock
  - _Why external:_ A company update is a news article. The dashboard has no internal card that reproduces the article body (the Companies tab is a financial scorecard, not a news feed; raw market-intelligence signals are not rendered as addressable cards). The exact article IS the precise evidence, so the row opens it — the zero-confusion path for external-only news.

## Every row

| Row | Verdict | Detail |
| --- | --- | --- |
| regulatory (newly surfaced regulatory updates) | PASS | card 09ab2a69576da1 · month 2026-07 · inView · labelled |
| company (newly surfaced relevant update) | EXTERNAL_OK | opens https://www.moneycontrol.com/news/business/stock |
| management (management change) | PASS | card mgmt-18a39c2ef3ac12 · month — · inView · labelled |