// useSectionInsight — one hook a destination section calls to receive the insight
// that opened it: the scoped focus, a ref to attach to the element to scroll to,
// and an `arrived` flag for the one-time soft ring. Optionally gated by a
// predicate (e.g. only accept a metric this section can actually resolve).

import { useSectionFocus } from '@/state/insightFocus'
import type { InsightFocus } from '@/insights/insightFocus'
import { useScrollIntoFocus } from './useScrollIntoFocus'

export function useSectionInsight(tab: string, accept?: (f: InsightFocus) => boolean) {
  const raw = useSectionFocus(tab)
  const on = raw ? (accept ? accept(raw) : true) : false
  const { ref, arrived } = useScrollIntoFocus<HTMLDivElement>(on)
  return { focus: on ? raw : null, ref, arrived }
}
