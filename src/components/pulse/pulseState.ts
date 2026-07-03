// Per-company Pulse UI state, persisted in sessionStorage so a jump out to the
// dashboard ("View in dashboard") and back returns the reader to the exact same
// read: the active filter, the selected date, and the expanded conviction idea
// together with the page of its insight booklet they were on.
//
// sessionStorage (not localStorage) keeps this to the browsing session — it
// survives a PulseView unmount during navigation but resets on a fresh visit.

export const SS = {
  filter: 'pulse:filter',
  date: 'pulse:date',
  mode: 'pulse:mode',
  openIdea: 'pulse:openIdea',
  openPage: 'pulse:openPage',
} as const

export function readSS(key: string, company: string): string | null {
  try {
    return sessionStorage.getItem(`${key}:${company}`)
  } catch {
    return null
  }
}

export function writeSS(key: string, company: string, val: string): void {
  try {
    sessionStorage.setItem(`${key}:${company}`, val)
  } catch {
    /* storage unavailable — restoration simply falls back to defaults */
  }
}

export function clearSS(key: string, company: string): void {
  try {
    sessionStorage.removeItem(`${key}:${company}`)
  } catch {
    /* ignore */
  }
}
