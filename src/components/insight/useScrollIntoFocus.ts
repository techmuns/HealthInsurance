// useScrollIntoFocus — when a section opens from an insight, gently scroll the
// target chart into view once and flash a one-time soft ring on it, so the reader
// lands on the exact thing the insight was talking about. Respects reduced motion.

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/components/pulse/hooks'

export function useScrollIntoFocus<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null)
  const [arrived, setArrived] = useState(false)
  const handled = useRef(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!active) {
      handled.current = false
      setArrived(false)
      return
    }
    if (handled.current) return
    handled.current = true
    // Let the section (and the highlight) paint before we scroll to it.
    const raf = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
      setArrived(true)
    })
    const t = window.setTimeout(() => setArrived(false), 2600)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [active, reduced])

  return { ref, arrived }
}
