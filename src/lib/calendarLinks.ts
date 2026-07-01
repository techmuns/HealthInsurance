// ── Calendar links — keyless "Add to Calendar" for dated Signal Stack items ───
//
// Pure, frontend-only helpers: no Google API, no OAuth, no access keys, no
// backend calendar writes. We only build a pre-filled Google Calendar URL (the
// user reviews + saves it themselves) and an .ics blob the user can open in
// Apple Calendar / Outlook / Google Calendar manually.
//
// The whole feature is gated on an EXACT date. `exactDateISO` is the single
// source of truth for "does this item have a real calendar date?" — an
// approximate phrase ("late September 2026", "expected next quarter") or a
// missing date returns null, and the UI shows no calendar affordance at all.

/** A minimal, calendar-agnostic event shape (all-day, single day). */
export interface CalendarEvent {
  /** Event title (the signal headline). */
  title: string
  /** Exact calendar date, `YYYY-MM-DD`. */
  dateISO: string
  /** Multi-line, pre-formatted description. */
  description: string
  /** Optional location (we use the source name). */
  location?: string
  /** Optional canonical link (the signal source URL). */
  url?: string
  /** Stable id used for the .ics UID. */
  uid?: string
}

/** The fields a Signal Stack item contributes to a pre-filled calendar event. */
export interface SignalCalendarInput {
  title: string
  /** The item's exact ISO date (must already be validated via exactDateISO). */
  dateISO: string
  /** Focal company display name, e.g. "Niva Bupa". */
  company: string
  /** Which Signal Stack lane this sits in, e.g. "Risk Watch". */
  signalType: string
  /** Source-backed confidence, shown as the event priority, e.g. "High". */
  priority: string
  /** Human source name, e.g. "transactions.nivabupa.com". */
  sourceName: string
  /** Source link, when one is on record. */
  sourceUrl?: string
  /** Stable id (the signal id) → deterministic .ics UID. */
  uid?: string
}

/**
 * Return a validated `YYYY-MM-DD` string when `raw` is a real, exact calendar
 * date, else `null`. This is intentionally strict:
 *   - requires a full year-month-day (a bare `2026-09` year-month is NOT exact),
 *   - rejects impossible dates (e.g. `2026-02-30`),
 *   - rejects empty / phrase / partial values.
 * The calendar UI keys entirely off this — no button for anything it rejects.
 */
export function exactDateISO(raw?: string | null): string | null {
  if (!raw) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  // Round-trip through a UTC date to reject non-existent days (e.g. 31 Apr).
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null
  }
  return `${m[1]}-${m[2]}-${m[3]}`
}

/** `2026-09-25` → `20260925`. */
function compact(dateISO: string): string {
  return dateISO.replace(/-/g, '')
}

/** The day after `dateISO`, compact (`YYYYMMDD`) — the exclusive all-day end. */
function nextDayCompact(dateISO: string): string {
  const [y, mo, d] = dateISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d + 1))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}`
}

/**
 * Compose the standard Signal Stack calendar event: the title stays the
 * headline; the description carries company / signal type / priority / source /
 * dashboard context so the saved event is self-explanatory.
 */
export function signalCalendarEvent(input: SignalCalendarInput): CalendarEvent {
  const lines = [
    `Company: ${input.company}`,
    `Signal type: ${input.signalType}`,
    `Priority: ${input.priority}`,
    `Source: ${input.sourceName}`,
  ]
  if (input.sourceUrl) lines.push(`Link: ${input.sourceUrl}`)
  lines.push('From: Healthcare Dashboard Signal Stack')
  return {
    title: input.title,
    dateISO: input.dateISO,
    description: lines.join('\n'),
    location: input.sourceName || undefined,
    url: input.sourceUrl || undefined,
    uid: input.uid,
  }
}

/**
 * A Google Calendar "create event" URL, pre-filled. Opening it takes the user
 * to their OWN calendar with the details filled in; they save it manually. No
 * API, no auth, no permissions.
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const start = compact(event.dateISO)
  const end = nextDayCompact(event.dateISO)
  const params = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(event.title)}`,
    // All-day span; the slash is query-safe, left literal for readability.
    `dates=${start}/${end}`,
    `details=${encodeURIComponent(event.description)}`,
  ]
  if (event.location) params.push(`location=${encodeURIComponent(event.location)}`)
  if (event.url) params.push(`sprop=${encodeURIComponent(event.url)}`)
  return `https://calendar.google.com/calendar/render?${params.join('&')}`
}

/** Escape a value per RFC 5545 text rules (backslash, comma, semicolon, LF). */
function icsEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Compact UTC timestamp `YYYYMMDDTHHMMSSZ` for DTSTAMP. */
function icsStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

/** A URL/filename-safe slug from the title, for the downloaded .ics name. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Build a single-event VCALENDAR (all-day) as an .ics string. */
export function buildIcs(event: CalendarEvent): string {
  const start = compact(event.dateISO)
  const end = nextDayCompact(event.dateISO)
  const uid = `${event.uid ?? start}@healthcare-dashboard`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Healthcare Dashboard//Signal Stack//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description)}`,
  ]
  if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`)
  if (event.url) lines.push(`URL:${icsEscape(event.url)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

/**
 * Trigger a browser download of the event as an .ics file. Client-only; no
 * network, no keys. Lets the user add it to Apple Calendar / Outlook / Google
 * Calendar by opening the file.
 */
export function downloadIcs(event: CalendarEvent): void {
  const blob = new Blob([buildIcs(event)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugify(event.title) || 'signal'}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Give the browser a tick to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
