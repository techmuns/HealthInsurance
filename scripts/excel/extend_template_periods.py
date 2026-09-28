#!/usr/bin/env python3
"""
Template PERIOD auto-extension (standing instruction, Neha, 2026-06-11).

When the data layer holds a period the template has no column for (a new
fiscal year on Industry Growth, a new FY quarter-group on the GWP tab, a new
Q1 month-group on the monthly tab), this script APPENDS the column group to
templates/niva-bupa-portfolio-review.xlsx in the established format, so the
next schema-map build binds it and the grid fills it on the same run — no
human in the loop. "Even if I see this whole dashboard after 2 years, I see
the best, highest-quality, live-updated data."

Safety rules:
  * Extend ONLY when real data for the new period exists in the snapshots —
    never a speculative empty column.
  * APPEND into virgin columns after the sheet's used range — existing cells,
    formulas and the analysis blocks (Mix %, YoY, CAGR) are never shifted or
    rewritten.
  * New cells are INPUTS (no formula cloning): every value they show comes
    from the sourced data layer, which already provides standalone quarters
    and single months by exact arithmetic over printed cumulatives.
  * Number formats / fonts / borders are copied from the equivalent cell of
    the donor (latest existing) period group, so the look stays identical.
  * Period-column replication only — never new rows, metrics or sections.

Company column-block sheets (SAHIs comparison, Channel Mix) grow one column
per company x new period. There "real data" means a value the fill step will
actually write into one of that column's cells on this same run — read from
the value store computed in memory (build_value_store.build_store), so every
source the store knows counts and every withholding gate is respected. The
new column sits after the used range; the grid keeps it with its company.
"""
from __future__ import annotations

import json
import re
import sys
from copy import copy
from datetime import date
from pathlib import Path

import openpyxl
from openpyxl.utils import column_index_from_string, get_column_letter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_schema_map as schema  # noqa: E402  (one definition of each sheet's layout)

REPO = Path(__file__).resolve().parents[2]
TEMPLATE = REPO / "templates" / "niva-bupa-portfolio-review.xlsx"
SNAP = REPO / "src" / "data" / "snapshots"


def load_periods(name: str, field: str) -> set[str]:
    try:
        rows = json.loads((SNAP / f"{name}.json").read_text()).get("data", [])
        return {str(r.get(field)) for r in rows if r.get(field)}
    except Exception:
        return set()


def copy_style(src, dst) -> None:
    if src.has_style:
        dst.font = copy(src.font)
        dst.border = copy(src.border)
        dst.fill = copy(src.fill)
        dst.number_format = src.number_format
        dst.alignment = copy(src.alignment)


def append_group(ws, donor_cols: list[int], headers: dict[int, dict[int, object]],
                 banner: str | None, first_data_row: int, last_row: int) -> list[str]:
    """Clone the donor columns' look into the first free columns; write the
    given header texts; leave every data cell empty (inputs for the grid)."""
    start = ws.max_column + 1
    added = []
    for offset, donor in enumerate(donor_cols):
        col = start + offset
        ws.column_dimensions[get_column_letter(col)].width = (
            ws.column_dimensions[get_column_letter(donor)].width)
        for row in range(1, last_row + 1):
            d = ws.cell(row=row, column=donor)
            c = ws.cell(row=row, column=col)
            copy_style(d, c)
            if row in headers.get(offset, {}):
                c.value = headers[offset][row]
        added.append(get_column_letter(col))
    if banner is not None:
        ws.cell(row=2, column=start).value = banner
    return added


def next_fy(fy: str) -> str:
    return f"FY{int(fy[2:]) + 1:02d}"


# ── Company column-block sheets ─────────────────────────────────────────────
# A period's "cut" is its kind: a full year (FY), a standalone quarter (Q1-Q4)
# or a year-to-date checkpoint (H1, 9M). Periods compare by their last month.
_PERIOD_RE = re.compile(r"^(Q[1-4]|H1|9M)?FY(\d{2})$")
_CUT_END = {  # cut -> (years after the FY's opening calendar year, last month)
    "Q1": (0, 6), "Q2": (0, 9), "H1": (0, 9), "Q3": (0, 12), "9M": (0, 12),
    "Q4": (1, 3), "FY": (1, 3),
}


def period_cut(period: str) -> str | None:
    m = _PERIOD_RE.match(period or "")
    return (m.group(1) or "FY") if m else None


def period_end(period: str) -> int:
    """The period's last month as a sortable month count (FY27 ends Mar 2027)."""
    m = _PERIOD_RE.match(period)
    years, month = _CUT_END[m.group(1) or "FY"]
    return (2000 + int(m.group(2)) - 1 + years) * 12 + month


def data_by_entity() -> dict[str, dict[str, set[str]]] | None:
    """entity -> period -> metrics a REAL value fills on this run.

    The value store is computed in memory by the very code the next pipeline
    step runs (same collectors, same withholding gates; it never reads the
    template, so it cannot drift from what gets filled). A value flagged
    conflict_needs_review is withheld at the cell, so it does not count. If the
    store cannot be computed, None: the block sheets are left untouched — no
    proof of data, no column."""
    try:
        import build_value_store
        store, _held, _stats = build_value_store.build_store()
    except Exception as e:  # never let this step break the pipeline
        print(f"value store unavailable ({e}) — SAHIs comparison / Channel Mix not extended")
        return None
    out: dict[str, dict[str, set[str]]] = {}
    for key, v in store.items():
        if v.get("normalized_value") is None or v.get("conflict_status") == "conflict_needs_review":
            continue
        entity, rest = key.split("::", 1)
        metric, period = rest.rsplit("::", 1)
        if period_cut(period):
            out.setdefault(entity, {}).setdefault(period, set()).add(metric)
    return out


def pick_donor(axis: dict[str, str], period: str) -> str:
    """The company's latest column of the same cut, else of the same kind (full
    year vs part-year), else its latest column — its cells lend the new column
    their number formats, fonts and borders."""
    cut = period_cut(period)
    for same in (lambda p: period_cut(p) == cut,
                 lambda p: (period_cut(p) == "FY") == (cut == "FY"),
                 lambda p: True):
        cols = [c for c, p in axis.items() if same(p)]
        if cols:
            return max(cols, key=lambda c: (period_end(axis[c]), column_index_from_string(c)))
    raise ValueError("empty block")


def header_label(period: str, donor_label, donor_period: str) -> str:
    """Write the period the way the donor column writes its own: the same cut
    keeps the donor's wording ('upto Q3FY26' -> 'upto Q3FY27'), a new cut takes
    the donor's spacing ('9M FY26' -> 'Q1 FY27'; 'Q4FY26' -> 'Q1FY27')."""
    fy = f"FY{period[-2:]}"
    cut = period_cut(period)
    if cut == period_cut(donor_period):
        return re.sub(r"FY\d{2}", fy, str(donor_label))
    if cut == "FY":
        return fy
    sep = " " if re.search(r" FY\d{2}", str(donor_label)) else ""
    return f"{cut}{sep}{fy}"


def new_periods(axis: dict[str, str], periods: dict[str, set[str]], cuts: set[str], counts,
                this_month: int) -> list[str]:
    """The periods a company's block gains, oldest first:
      * a fiscal year after its latest full-year column — the year sequence
        stays complete even when a later quarter's column landed first;
      * a part-year cut its block carries, at least as recent as its latest
        column (older checkpoints are history, not new columns; Q4 and the
        full year end in the same month, so either may land first);
    and in both cases only a FINISHED period (a value filed under a period
    still running can only be partial) with at least one real value in a
    metric the new column binds."""
    have = set(axis.values())
    latest = max(period_end(p) for p in axis.values())
    latest_fy = max((period_end(p) for p in axis.values() if period_cut(p) == "FY"), default=-1)

    def wanted(p: str) -> bool:
        cut = period_cut(p)
        if p in have or cut not in cuts or period_end(p) >= this_month:
            return False
        return period_end(p) > latest_fy if cut == "FY" else period_end(p) >= latest

    return sorted((p for p, metrics in periods.items() if wanted(p) and any(map(counts, metrics))),
                  key=lambda p: (period_end(p), period_cut(p) == "FY"))


def extend_sahis_comparison(wb, data, this_month: int) -> list[str]:
    """One column per company x new period. A block takes a new fiscal year,
    any quarter cut it already carries (Niva Bupa / Star: H1, 9M, Q4; Care: Q1,
    9M, Q4; ManipalCigna / Aditya Birla: Q1) and Q1 — the first quarter is at
    once a standalone quarter (the shape of the Q4 columns) and the first
    year-to-date checkpoint (the shape of H1 / 9M), and it is the only cut that
    shows a new fiscal year until H1 lands. Q2 / Q3 standalone cuts are in no
    block's layout and are not added."""
    ws = wb["SAHIs comparison"]
    company_row, period_row = schema.SAHI_CMP_COMPANY_ROW, schema.SAHI_CMP_PERIOD_ROW
    blocks, _ = schema.sahi_cmp_blocks(ws)
    bound = {m for m, _, _ in schema.SAHI_CMP_ROWS.values()}
    # The cell carrying each company's name (C3 'Niva Bupa', AP3 'Manipal Cigna', ...).
    name_cell = {}
    for col in range(1, ws.max_column + 1):
        c = ws.cell(row=company_row, column=col)
        entity = schema.entity_from_label(str(c.value or ""))
        if entity and entity not in name_cell:
            name_cell[entity] = c
    added = []
    for entity, axis in blocks:
        cuts = {period_cut(p) for p in axis.values()} | {"FY", "Q1"}
        name = name_cell.get(entity)
        for period in new_periods(axis, data.get(entity, {}), cuts, bound.__contains__, this_month):
            donor = pick_donor(axis, period)
            label = header_label(period, ws[f"{donor}{period_row}"].value, axis[donor])
            if name is None or schema._parse_sahi_period(label) != period:
                print(f"SAHIs comparison: {entity} {period} skipped — its header would not bind")
                continue
            col = append_group(ws, [column_index_from_string(donor)],
                               {0: {company_row: name.value, period_row: label}}, None, 5, ws.max_row)[0]
            copy_style(name, ws[f"{col}{company_row}"])  # the company's header band
            added.append(f"{col} {name.value} {label}")
    return [f"SAHIs comparison + {'; '.join(added)}"] if added else []


def extend_channel_mix(wb, data, this_month: int) -> list[str]:
    """One column per company x new period: a new fiscal year, or a new
    year-to-date cut (Q1 / H1 / 9M) — each block's '9M FY26' column is a
    year-to-date column and every YTD cut is that same shape. Only the
    automatically-sourced channel metrics count as data (the rows an appended
    column binds — see build_schema_map.CHANNEL_AUTOMATED_*)."""
    ws = wb["Channel Mix"]
    company_row, period_row = schema.CHANNEL_COMPANY_ROW, schema.CHANNEL_PERIOD_ROW

    def bound(metric: str) -> bool:
        return (metric.split("::")[0] in schema.CHANNEL_AUTOMATED_SECTIONS
                or metric in schema.CHANNEL_AUTOMATED_AGENT_METRICS)

    blocks, _ = schema.channel_mix_blocks(ws)
    added = []
    for entity, axis in blocks:
        for period in new_periods(axis, data.get(entity, {}), {"FY", "Q1", "H1", "9M"}, bound, this_month):
            donor = pick_donor(axis, period)
            label = header_label(period, ws[f"{donor}{period_row}"].value, axis[donor])
            company = ws[f"{donor}{company_row}"].value
            if schema._parse_channel_period(label) != period or schema.entity_from_label(str(company or "")) != entity:
                print(f"Channel Mix: {entity} {period} skipped — its header would not bind")
                continue
            # Each section repeats the period header (rows 3 / 12 / 21).
            headers = {company_row: company, **{r: label for r in schema.CHANNEL_SECTIONS}}
            col = append_group(ws, [column_index_from_string(donor)], {0: headers}, None, 4, ws.max_row)[0]
            added.append(f"{col} {company} {label}")
    return [f"Channel Mix + {'; '.join(added)}"] if added else []


def main() -> None:
    wb = openpyxl.load_workbook(TEMPLATE)
    changed: list[str] = []

    portfolio_fys = load_periods("gic-health-portfolio", "fiscal_year")
    quarterly = load_periods("gic-health-quarterly", "period")
    monthly = load_periods("gic-health-monthly", "period")

    # ── Industry Growth: one column per fiscal year ─────────────────────────
    ws = wb["Industry Growth"]
    # Current last FY column: header row 3 runs 15..N as a +1 formula chain
    # anchored at C3=15; the chain length gives the last covered FY.
    fy_cols = 0
    col = 3
    while ws.cell(row=3, column=col).value is not None and (
            isinstance(ws.cell(row=3, column=col).value, (int, float))
            or str(ws.cell(row=3, column=col).value).startswith("=")):
        fy_cols += 1
        col += 1
    last_fy = 14 + fy_cols  # C3 = 15
    nxt = f"FY{last_fy + 1 - 2000 if last_fy + 1 >= 2000 else last_fy + 1:02d}"
    if nxt in portfolio_fys:
        donor = 2 + fy_cols  # the last FY column index
        # Header rows: every section repeats its own year-header row — find
        # all rows whose donor-column cell is part of the +1 chain or a year
        # number, and bump them.
        headers: dict[int, dict[int, object]] = {0: {}}
        for row in range(1, ws.max_row + 1):
            v = ws.cell(row=row, column=donor).value
            if isinstance(v, (int, float)) and 15 <= v <= 99:
                headers[0][row] = int(v) + 1
            elif isinstance(v, str) and v.startswith("=") and "+1" in v:
                headers[0][row] = last_fy + 1
        added = append_group(ws, [donor], headers, None, 4, ws.max_row)
        changed.append(f"Industry Growth + {nxt} column ({added[0]})")

    # ── FY26 GWP: a 6-column group per fiscal year ──────────────────────────
    ws = wb["FY26 GWP"]
    hdr_row = 3
    existing = {str(ws.cell(row=hdr_row, column=c).value) for c in range(1, ws.max_column + 1)}
    gwp_fys = sorted({p[-4:] for p in existing if p.startswith("Q1FY")})
    if gwp_fys:
        last = gwp_fys[-1]  # e.g. 'FY26'
        nxt = next_fy(last)
        has_data = any(p.endswith(nxt) for p in quarterly) or nxt in portfolio_fys
        if has_data and f"Q1{nxt}" not in existing:
            donors = [c for c in range(1, ws.max_column + 1)
                      if str(ws.cell(row=hdr_row, column=c).value).endswith(last)
                      and ("FY" in str(ws.cell(row=hdr_row, column=c).value))]
            labels = [str(ws.cell(row=hdr_row, column=c).value).replace(last, nxt) for c in donors]
            headers = {i: {hdr_row: labels[i]} for i in range(len(donors))}
            added = append_group(ws, donors, headers, nxt, 4, ws.max_row)
            changed.append(f"FY26 GWP + {nxt} group ({added[0]}..{added[-1]}: {', '.join(labels)})")

    # ── Q1'26 GWP: a 4-column month group per fiscal year ───────────────────
    ws = wb["Q1'26 GWP"]
    hdr_row = 3
    existing = {str(ws.cell(row=hdr_row, column=c).value) for c in range(1, ws.max_column + 1)}
    q1_fys = sorted({p[-4:] for p in existing if p.startswith("Q1FY")})
    if q1_fys:
        last = q1_fys[-1]
        nxt = next_fy(last)
        # months of FY27 are Apr'26..Jun'26 → calendar yy = FY - 1
        cal = int(nxt[2:]) - 1
        wanted = [f"Apr'{cal}", f"May'{cal}", f"Jun'{cal}", f"Q1{nxt}"]
        has_data = any(p in monthly for p in (f"Apr-{nxt}", f"May-{nxt}", f"Jun-{nxt}")) \
            or f"Q1{nxt}" in quarterly
        if has_data and f"Q1{nxt}" not in existing:
            # Donor = the CURRENT-FY group: the FIRST occurrence of each label
            # (the YoY block on the right repeats the month labels — skip it by
            # taking the first match per label, scanning from the left).
            prev_cal = cal - 1
            donor_labels = [f"Apr'{prev_cal}", f"May'{prev_cal}", f"Jun'{prev_cal}", f"Q1{last}"]
            donors = []
            for lbl in donor_labels:
                for c in range(1, ws.max_column + 1):
                    if str(ws.cell(row=hdr_row, column=c).value) == lbl:
                        donors.append(c)
                        break
            if len(donors) == 4:
                headers = {i: {hdr_row: wanted[i]} for i in range(4)}
                added = append_group(ws, donors, headers, nxt, 4, ws.max_row)
                changed.append(f"Q1'26 GWP + {nxt} month group ({added[0]}..{added[-1]}: {', '.join(wanted)})")

    # ── SAHIs comparison / Channel Mix: a column per company x new period ──
    data = data_by_entity()
    if data is not None:
        today = date.today()
        this_month = today.year * 12 + today.month  # same scale as period_end()
        changed += extend_sahis_comparison(wb, data, this_month)
        changed += extend_channel_mix(wb, data, this_month)

    if changed:
        wb.save(TEMPLATE)
        for c in changed:
            print(f"extended: {c}")
    else:
        print("no new periods with data — template unchanged")


if __name__ == "__main__":
    main()
