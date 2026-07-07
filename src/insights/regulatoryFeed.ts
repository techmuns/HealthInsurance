// ---------------------------------------------------------------------------
//  regulatoryFeed — the ONE place that builds the sectoral-news feed (seed +
//  auto-refreshed snapshot, merged by id) and classifies which regulatory items
//  are genuinely NEW vs NEWLY SURFACED vs already known.
//
//  Why it exists: the Daily Brief's "Since Yesterday · regulatory" row and the
//  "Key Sectoral News" (Regulatory) page must agree — the same items, keyed the
//  same way — so a click can deep-link from the brief to the exact card. Both
//  read this module.
//
//  Honesty (see CLAUDE.md): "new" means the SOURCE itself was published within the
//  window; "newly surfaced" means the dashboard first ADDED it within the window
//  but the source is older (an old item we only just picked up). An item whose
//  source date AND surfaced date are both older than the window is ALREADY KNOWN
//  and is never shown as a "since yesterday" change.
// ---------------------------------------------------------------------------

import { sectoralNews, makeSectoralId, type SectoralNewsItem, type SectoralNewsSnapshot } from '@/data/sectoralNews'
import sectoralSnapshot from '@/data/snapshots/sectoral-news-snapshot.json'

const SNAP = sectoralSnapshot as unknown as SectoralNewsSnapshot

/** Merge the seed floor (portfolio-pack items) with the auto-refreshed snapshot,
 *  keyed by stable id so a re-reported item collapses instead of double-listing.
 *  This is the single source of truth for the sectoral / regulatory feed. */
export function buildSectoralItems(): SectoralNewsItem[] {
  const byId = new Map<string, SectoralNewsItem>()
  for (const s of sectoralNews) {
    const id = makeSectoralId(s.subject, s.date)
    byId.set(id, { ...s, id, origin: s.origin ?? 'seed', added_at: s.added_at ?? s.date })
  }
  for (const it of SNAP.data ?? []) {
    const id = it.id ?? makeSectoralId(it.subject, it.date)
    byId.set(id, { ...it, id, origin: it.origin ?? 'agent', added_at: it.added_at ?? it.date })
  }
  return [...byId.values()]
}

/** The stable dom/scroll key for a feed item (matches SectoralNews card keys). */
export const sectoralItemKey = (it: Pick<SectoralNewsItem, 'id' | 'sn'>): string => it.id ?? String(it.sn)

/** Month accordion key (yyyy-mm) an item lives under, from its SOURCE date. */
export const sectoralMonthKey = (isoDate: string): string => isoDate.slice(0, 7)

// ── recency classification ───────────────────────────────────────────────────

export type RegSurfacing = 'new' | 'newly-surfaced'

export interface RegTarget {
  /** Stable id (deep-link key) of the exact regulatory item. */
  itemId: string
  /** Month accordion key (yyyy-mm) to open before scrolling. */
  month: string
  subject: string
  category: string
  /** Original publication/event date of the source. */
  sourceDate: string
  /** When the dashboard first added/surfaced it (feed added_at). */
  surfacedAt?: string
  surfacing: RegSurfacing
  /** Plain-English reason this appears in today's brief. */
  reasonShownToday: string
  /** External original article, kept as a secondary action. */
  reference?: string
}

/** Whole-day gap from an ISO date (yyyy-mm-dd) to the reference day. Negative =
 *  the date is in the future; large positive = long ago. NaN → treated as old. */
function dayGap(iso: string | undefined, refIso: string): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const a = Date.parse(iso.slice(0, 10))
  const b = Date.parse(refIso.slice(0, 10))
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY
  return Math.round((b - a) / 86_400_000)
}

const fmtDate = (iso?: string): string => {
  if (!iso) return 'unknown'
  const d = new Date(iso.slice(0, 10))
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Regulatory items to show in today's "Since Yesterday", newest first.
 * - 'new'            : the source was published within the window.
 * - 'newly-surfaced' : the source is older, but we first added it within the window.
 * - (excluded)       : both source date AND surfaced date are older → already known.
 *
 * `lookbackDays` is inclusive (0..lookback days before the reference day). Items
 * dated in the future (bad data) are ignored.
 */
export function recentRegulatory(refIso: string, lookbackDays = 1, items: SectoralNewsItem[] = buildSectoralItems()): RegTarget[] {
  const inWindow = (gap: number) => gap >= 0 && gap <= lookbackDays
  const out: RegTarget[] = []
  for (const it of items) {
    if (it.category !== 'Regulatory') continue
    const sourceGap = dayGap(it.date, refIso)
    const surfacedGap = dayGap(it.added_at, refIso)
    let surfacing: RegSurfacing | null = null
    let reason = ''
    if (inWindow(sourceGap)) {
      surfacing = 'new'
      reason = `Published ${fmtDate(it.date)} — a genuinely new regulatory development.`
    } else if (inWindow(surfacedGap)) {
      surfacing = 'newly-surfaced'
      reason = `Older source (dated ${fmtDate(it.date)}) — first added to the feed ${fmtDate(it.added_at)}, so it's newly surfaced, not newly published.`
    }
    if (!surfacing) continue // both source + surfaced are older than the window → already known
    out.push({
      itemId: sectoralItemKey(it),
      month: sectoralMonthKey(it.date),
      subject: it.subject,
      category: it.category,
      sourceDate: it.date,
      surfacedAt: it.added_at,
      surfacing,
      reasonShownToday: reason,
      reference: it.reference,
    })
  }
  // Newest first — by the more recent of (surfaced, source) so a just-surfaced old
  // item and a just-published one both rank by when they became relevant.
  const rank = (t: RegTarget) => (t.surfacedAt && t.surfacedAt > t.sourceDate ? t.surfacedAt : t.sourceDate)
  return out.sort((a, b) => (rank(a) < rank(b) ? 1 : rank(a) > rank(b) ? -1 : 0))
}
