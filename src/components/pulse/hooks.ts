// Subtle-motion hooks for the AI briefing — count-up numbers, a calm typewriter
// reveal, and a reduced-motion guard. All effects no-op (jump to final state) when
// the user prefers reduced motion.

import { useEffect, useRef, useState } from 'react'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

/** Ease a number from 0 → target on mount / whenever target changes. */
export function useCountUp(target: number, durationMs = 900): number {
  const reduced = useReducedMotion()
  const [val, setVal] = useState(target)
  useEffect(() => {
    if (reduced) {
      setVal(target)
      return
    }
    let raf = 0
    let start = 0
    setVal(0)
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min(1, (ts - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(target * eased)
      if (p < 1) raf = requestAnimationFrame(step)
      else setVal(target)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, reduced])
  return val
}

/** Reveal `text` character-by-character (calm pace). Resets when text changes. */
export function useTypewriter(text: string, charsPerTick = 2, tickMs = 18): { shown: string; done: boolean } {
  const reduced = useReducedMotion()
  const [count, setCount] = useState(text.length)
  const timer = useRef<number>()
  useEffect(() => {
    if (reduced) {
      setCount(text.length)
      return
    }
    setCount(0)
    let n = 0
    const tick = () => {
      n = Math.min(text.length, n + charsPerTick)
      setCount(n)
      if (n < text.length) timer.current = window.setTimeout(tick, tickMs)
    }
    timer.current = window.setTimeout(tick, tickMs)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [text, charsPerTick, tickMs, reduced])
  return { shown: text.slice(0, count), done: count >= text.length }
}
