#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Land the current commit on origin/main, surviving push races.
#
# A dozen scheduled workflows push to main through the day, so racing is
# routine, not exceptional. The pattern this replaces looked like a 5-attempt
# retry but was really a 1-attempt one:
#
#     for i in 1 2 3 4 5; do
#       if git pull --rebase --autostash origin main && git push; then ... fi
#       sleep 5
#     done
#
# A conflicting rebase STOPS and leaves unmerged files in the tree, and nothing
# cleared them — so attempts 2..5 each died instantly on "Pulling is not
# possible because you have unmerged files". On 2026-08-18 that lost a finished
# 9-minute ingest to a race it was supposed to survive.
#
# Here every attempt starts from a clean state, and a conflict confined to
# GENERATED artefacts is resolved by rebuilding them on the new tip rather than
# by a meaningless textual merge of a multi-megabyte JSON. A conflict anywhere
# else is never guessed at: it aborts, retries, and finally fails loudly.
#
# Usage:  scripts/ci/push-with-retry.sh [rebuild-command]
#   rebuild-command  optional shell run after a successful rebase to regenerate
#                    derived artefacts so they reflect BOTH sides of the race.
# ---------------------------------------------------------------------------
set -uo pipefail

ATTEMPTS="${PUSH_ATTEMPTS:-5}"
REBUILD="${1:-}"
# Artefacts that are a pure function of the committed source data — safe to
# resolve by rebuilding.
GENERATED_RE='^(data/processed/|src/data/snapshots/extracted-data-audit\.json|src/data/snapshots/ifrs-valuation-multiples\.json|schema-map\.json|templates/)'
# Accumulating STATUS / LINEAGE files: each run updates only the keys it ran, so
# neither side of a race is wholly right and neither can be rebuilt (that would
# mean re-running the fetchers). These are merged key-by-key instead.
MERGEABLE_RE='^(src/data/snapshots/data-health\.json|src/data/snapshots/watchdog-streaks\.json|src/data/snapshots/data-provenance\.json)$'
# Anything outside BOTH sets needs a human.

rebuild_and_stage() {
  [ -n "$REBUILD" ] || return 0
  echo "  rebuilding derived artefacts on the new base ..."
  bash -c "$REBUILD" >/dev/null 2>&1 || echo "  (rebuild reported an error; continuing with what it produced)"
  git add -A
  git diff --staged --quiet || git commit --amend --no-edit >/dev/null
}

for i in $(seq 1 "$ATTEMPTS"); do
  if ! git fetch origin main; then
    echo "attempt $i: fetch failed; retrying ..."; sleep 5; continue
  fi

  if git rebase origin/main; then
    rebuild_and_stage
  else
    unmerged="$(git diff --name-only --diff-filter=U)"
    foreign="$(echo "$unmerged" | grep -vE "$GENERATED_RE" | grep -vE "$MERGEABLE_RE" || true)"
    if [ -z "$unmerged" ] || [ -n "$foreign" ]; then
      echo "attempt $i: conflict outside generated artefacts - not guessing:"
      echo "$unmerged" | sed 's/^/    /'
      git rebase --abort 2>/dev/null || true
      sleep 5; continue
    fi
    # Every conflicted path is regenerated below, so which side we take here is
    # irrelevant - we just need the rebase to finish.
    merge_failed=""
    for f in $unmerged; do
      if echo "$f" | grep -qE "$MERGEABLE_RE"; then
        # Stage 2 is the upstream tip, stage 3 is this run's commit (rebase
        # inverts ours/theirs). Merge them rather than pick a winner.
        git show ":2:$f" > /tmp/pwr-ours.json 2>/dev/null || : > /tmp/pwr-ours.json
        git show ":3:$f" > /tmp/pwr-theirs.json 2>/dev/null || : > /tmp/pwr-theirs.json
        if ! python3 scripts/ci/merge-status-json.py "$f" /tmp/pwr-ours.json /tmp/pwr-theirs.json; then
          echo "  could not merge $f - refusing to pick a side"
          merge_failed=1; break
        fi
      else
        # Regenerated below, so which side we take here is irrelevant.
        git checkout --theirs -- "$f" 2>/dev/null || git checkout --ours -- "$f" 2>/dev/null || true
      fi
      git add -- "$f" 2>/dev/null || true
    done
    if [ -n "$merge_failed" ]; then
      git rebase --abort 2>/dev/null || true
      sleep 5; continue
    fi
    if ! GIT_EDITOR=true git rebase --continue; then
      git rebase --abort 2>/dev/null || true
      echo "attempt $i: could not continue the rebase; retrying ..."; sleep 5; continue
    fi
    echo "  resolved generated-artefact conflict by rebuilding"
    rebuild_and_stage
  fi

  if git push; then
    echo "pushed on attempt $i"
    exit 0
  fi
  echo "attempt $i: push rejected (someone landed first); retrying ..."
  sleep 5
done

echo "ERROR: could not land the commit after $ATTEMPTS attempts."
echo "       The work IS committed locally but is not on main - re-run this workflow."
exit 1
