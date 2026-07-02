// InsightFocus context — the active "insight-linked" highlight, provided at the
// app level so ANY dashboard section / chart deep in the tree can read the focus
// that opened it (via useSectionFocus) without prop-drilling. Mirrors the shape
// of FilterProvider. When no focus is active every consumer reads `null` and the
// dashboard renders in its normal, clean state.

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { InsightFocus } from '@/insights/insightFocus'

export interface InsightFocusValue {
  /** The active insight-linked focus, or null in normal mode. */
  focus: InsightFocus | null
  /** Dismiss the current highlight (keeps the user on the section, clean view). */
  clearFocus: () => void
  /** Return to the origin (Pulse / insight) that opened this focus — restores the
   *  reader's company, date and scroll position. */
  returnToOrigin: () => void
  /** True when the origin was Pulse (drives "Back to Pulse" vs "Back to Insight"). */
  fromPulse: boolean
}

const NOOP: InsightFocusValue = { focus: null, clearFocus: () => {}, returnToOrigin: () => {}, fromPulse: false }

const InsightFocusContext = createContext<InsightFocusValue>(NOOP)

export function InsightFocusProvider({ value, children }: { value: InsightFocusValue; children: ReactNode }) {
  return <InsightFocusContext.Provider value={value}>{children}</InsightFocusContext.Provider>
}

export function useInsightFocus(): InsightFocusValue {
  return useContext(InsightFocusContext)
}

/**
 * The active focus scoped to a given SAHI sub-tab — returns null unless the live
 * focus actually targets this section, so a section only lights up when the
 * insight that opened it points here.
 */
export function useSectionFocus(sahiTab: string): InsightFocus | null {
  const { focus } = useInsightFocus()
  if (!focus) return null
  if (focus.sahiTab && focus.sahiTab !== sahiTab) return null
  return focus
}
