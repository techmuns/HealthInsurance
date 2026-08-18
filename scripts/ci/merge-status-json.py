#!/usr/bin/env python3
"""
Field-merge the two ACCUMULATING status files when two runs race.

data-health.json and watchdog-streaks.json are read-modify-write: each run
updates only the entries for the sources IT ran and leaves the rest alone. So
on a push race neither side is "the right one" — each holds fresher truth for
a different set of sources, and taking either wholesale silently reverts the
other run's updates. They also cannot simply be rebuilt, because that would
mean re-running the fetchers.

Merging them by key is the only resolution that loses nothing:
  * data-health.per_source  — per source_id, keep the entry with the later
    last_attempt_at (the more recent observation of that source).
  * watchdog-streaks        — per source_id, keep the LONGER bad-run streak,
    so a race can never shorten a streak and delay an alert.

Usage: merge-status-json.py <path> <ours.json> <theirs.json>
Writes the merged document to <path>. On anything unexpected it exits
non-zero and writes nothing, so the caller falls back to refusing the merge.
"""
import json
import sys
from pathlib import Path


def newer(a, b, field):
    """The entry with the later timestamp; a missing timestamp loses."""
    ta, tb = (a or {}).get(field) or "", (b or {}).get(field) or ""
    return a if ta >= tb else b


def merge_health(ours: dict, theirs: dict) -> dict:
    out = dict(theirs)  # scalars from the side that ran later; corrected below
    by_id: dict[str, dict] = {}
    for side in (ours, theirs):
        for entry in side.get("per_source", []) or []:
            sid = entry.get("source_id")
            if not sid:
                continue
            by_id[sid] = newer(by_id.get(sid), entry, "last_attempt_at") if sid in by_id else entry
    out["per_source"] = [by_id[k] for k in sorted(by_id)]
    out["sources_checked"] = len(out["per_source"])
    out["sources_success"] = sum(1 for e in out["per_source"] if e.get("status") == "success")
    out["sources_failed"] = sum(1 for e in out["per_source"] if e.get("status") == "failed")
    for field in ("last_successful_run", "last_failed_run"):
        out[field] = (newer({field: ours.get(field)}, {field: theirs.get(field)}, field) or {}).get(field)
    for field in ("metrics_updated", "parser_warnings"):
        vals = list(dict.fromkeys((ours.get(field) or []) + (theirs.get(field) or [])))
        if vals or field in ours or field in theirs:
            out[field] = vals
    return out


def merge_streaks(ours: dict, theirs: dict) -> dict:
    out = {}
    for sid in set(ours) | set(theirs):
        a, b = ours.get(sid), theirs.get(sid)
        if not isinstance(a, dict):
            out[sid] = b
        elif not isinstance(b, dict):
            out[sid] = a
        else:
            # Longer streak wins; never shorten one and delay an alert.
            out[sid] = a if (a.get("bad_runs") or 0) >= (b.get("bad_runs") or 0) else b
    return out


def main() -> int:
    path, ours_f, theirs_f = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    ours, theirs = json.loads(ours_f.read_text()), json.loads(theirs_f.read_text())
    name = path.name
    if name == "data-health.json":
        merged = merge_health(ours, theirs)
    elif name == "watchdog-streaks.json":
        merged = merge_streaks(ours, theirs)
    else:
        print(f"merge-status-json: no rule for {name}", file=sys.stderr)
        return 2
    path.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n")
    print(f"  merged {name} without losing either side")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
