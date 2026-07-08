// ---------------------------------------------------------------------------
//  Insight relevance feedback — the reader-side training loop.
//
//  A sector specialist marks each insight relevant (👍) or not (👎). Votes are:
//   • PERSISTED in localStorage (survive reloads and sessions);
//   • PERIOD-INDEPENDENT — keyed on the detector family + the company set, NOT
//     the specific card — so a rating on this month's card automatically applies
//     to next month's card of the same kind. That is what makes the feed surface
//     better "as time goes forward and new data is added".
//   • SHARED via a tiny external store so the card buttons and the feed
//     re-ranker stay in sync, and cross-tab via the storage event.
//
//  Effect: 👍 floats a pattern to the top of its period and pins it as
//  "Marked relevant"; 👎 drops it into a collapsible "Set aside" group (never
//  deleted — honest and reversible). The same votes can be exported and folded
//  into the committed engine weights (insight-preferences.json) so the whole
//  generated feed learns, not just this browser.
// ---------------------------------------------------------------------------

import { useSyncExternalStore } from 'react'
import type { Insight } from '@/insights/types'

export type Vote = 'up' | 'down'
export type FeedbackStore = Record<string, Vote>

const KEY = 'insights.feedback.v1'
const hasWindow = typeof window !== 'undefined'

function read(): FeedbackStore {
  if (!hasWindow) return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FeedbackStore) : {}
  } catch {
    return {}
  }
}

// Module-level snapshot; replaced by a fresh object ref on every change so
// useSyncExternalStore detects the update and re-renders subscribers.
let snapshot: FeedbackStore = read()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) { snapshot = read(); cb() }
  }
  if (hasWindow) window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    if (hasWindow) window.removeEventListener('storage', onStorage)
  }
}

/** Stable, period-independent key for an insight — mirrors the engine's
 *  preferenceKey (src/insights/engine/preferences.ts) exactly. */
export function feedbackKeyOf(ins: Pick<Insight, 'family' | 'affectedInsurers'>): string {
  const co = [...(ins.affectedInsurers ?? [])].filter(Boolean).sort().join(',') || 'panel'
  return `${ins.family ?? 'insight'}::${co}`
}

/** Set (or clear, with null) the vote for a key; persists + notifies. */
export function setVote(key: string, vote: Vote | null): void {
  const next: FeedbackStore = { ...snapshot }
  if (vote) next[key] = vote
  else delete next[key]
  snapshot = next
  if (hasWindow) {
    try { window.localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* quota / private mode — stay in memory */ }
  }
  emit()
}

/** Live view of all votes (re-renders on any change, incl. other tabs). */
export function useFeedback(): FeedbackStore {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}

/** The current vote for one insight, live. */
export function useVote(key: string): Vote | undefined {
  return useFeedback()[key]
}

/** Export the raw votes (for folding into the committed engine weights). */
export function exportFeedback(): FeedbackStore {
  return { ...snapshot }
}
