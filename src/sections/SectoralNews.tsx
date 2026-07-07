import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ExternalLink, Newspaper, RefreshCw, Search, Sparkles } from 'lucide-react'
import { SourceTag } from '@/components/SourceTag'
import { InsightContextChip } from '@/components/insight/InsightContextChip'
import { useSectionInsight } from '@/components/insight/useSectionInsight'
import {
  sectoralNews,
  makeSectoralId,
  SECTORAL_CATEGORY_META,
  SECTORAL_CATEGORY_ORDER,
  type SectoralCategory,
  type SectoralNewsItem,
  type SectoralNewsSnapshot,
} from '@/data/sectoralNews'
import sectoralSnapshot from '@/data/snapshots/sectoral-news-snapshot.json'

// ---------------------------------------------------------------------------
//  Key Sectoral News — a calm, tone-coded briefing of the standalone-health
//  sector's moving parts, presented as month BLOCKS: each month is its own soft
//  powder-blue container (collapsible) holding a clean grid of white cards, so
//  the feed reads as a structured, scannable timeline rather than one long list.
//
//  SELF-UPDATING: the feed is the seed floor (31 curated portfolio-pack items)
//  merged with an auto-refreshed snapshot a scheduled web agent keeps current.
//  Seed items are curated; agent items are AI-gathered (web) and clearly tagged.
//  This file is presentation only — the dataset, classification, freshness,
//  counts, search and filter logic below are unchanged.
// ---------------------------------------------------------------------------

type Lens = SectoralCategory | 'all'

const NAVY = '#27457E'
// How many cards a month shows before "Show more" (2 full rows of the 3-col grid).
const INITIAL_CARDS = 6

function fmtFull(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtMonth(key: string): string {
  // key is yyyy-mm or yyyy-mm-dd
  const d = new Date(`${key.slice(0, 7)}-01T00:00:00`)
  if (isNaN(d.getTime())) return key
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}
function monthKey(iso: string): string {
  return iso.slice(0, 7)
}
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
function shiftDays(iso: string, delta: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

// ── Live dataset — seed floor merged with the auto-refreshed snapshot, by id ──
// The seed (31 portfolio-pack items) is the permanent floor: even if the snapshot
// is empty it always shows. The scheduled agent appends fresh items into the
// snapshot; a re-reported seed item collapses on its id rather than double-listing.
const SNAP = sectoralSnapshot as unknown as SectoralNewsSnapshot

function buildItems(): SectoralNewsItem[] {
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
const ALL_ITEMS = buildItems()
// When the scheduled agent last completed a live pull (null until CI first runs).
const LAST_REFRESHED: string | null = SNAP?._meta?.last_successful_run ?? null
// "New" = an agent-gathered item that landed within ~30 days of the latest refresh.
const NEW_CUTOFF = shiftDays(LAST_REFRESHED ?? new Date().toISOString().slice(0, 10), -30)
function isNew(it: SectoralNewsItem): boolean {
  return it.origin === 'agent' && !!it.added_at && it.added_at >= NEW_CUTOFF
}

export function SectoralNews() {
  const [lens, setLens] = useState<Lens>('all')
  const [query, setQuery] = useState('')
  // Per-month collapse override (keyed by yyyy-mm). When absent, the default rule
  // applies: the latest month opens; while filtering/searching every matching
  // month opens so no match hides behind a collapsed block.
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})
  // Per-month "show all cards" override (else the first INITIAL_CARDS show).
  const [showAll, setShowAll] = useState<Record<string, boolean>>({})
  const { focus, ref: focusRef, arrived } = useSectionInsight('sector-news')

  const total = ALL_ITEMS.length
  const newCount = useMemo(() => ALL_ITEMS.filter(isNew).length, [])

  // Per-theme counts (kept in the canonical display order).
  const counts = useMemo(() => {
    const c = Object.fromEntries(SECTORAL_CATEGORY_ORDER.map((k) => [k, 0])) as Record<SectoralCategory, number>
    for (const n of ALL_ITEMS) c[n.category] += 1
    return c
  }, [])

  // Date span — computed live so the timeline always reaches the newest item.
  const { spanStart, spanEnd } = useMemo(() => {
    const sorted = ALL_ITEMS.map((i) => i.date).sort()
    return { spanStart: sorted[0], spanEnd: sorted[sorted.length - 1] }
  }, [])
  const windowLabel = `${fmtMonth(spanStart)} – ${fmtMonth(spanEnd)}`

  // Filter (theme + free-text) then sort newest-first.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ALL_ITEMS.filter((n) => (lens === 'all' ? true : n.category === lens))
      .filter((n) =>
        q === ''
          ? true
          : n.subject.toLowerCase().includes(q) ||
            n.summary.toLowerCase().includes(q) ||
            n.category.toLowerCase().includes(q),
      )
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.sn - a.sn))
  }, [lens, query])

  // Group the visible feed by month for an editorial timeline rhythm.
  const groups = useMemo(() => {
    const map = new Map<string, SectoralNewsItem[]>()
    for (const n of filtered) {
      const k = monthKey(n.date)
      const arr = map.get(k)
      if (arr) arr.push(n)
      else map.set(k, [n])
    }
    return Array.from(map.entries())
  }, [filtered])

  const filtering = lens !== 'all' || query.trim() !== ''
  // A month is open when the user has set it, else: while filtering every match
  // opens; otherwise only the latest (first) month opens and older ones collapse.
  const isMonthOpen = (key: string, idx: number) => openMonths[key] ?? (filtering ? true : idx === 0)
  const toggleMonth = (key: string, idx: number) =>
    setOpenMonths((p) => ({ ...p, [key]: !isMonthOpen(key, idx) }))
  const toggleShowAll = (key: string) => setShowAll((p) => ({ ...p, [key]: !p[key] }))

  // ── Deep-link from a source click (Daily Brief regulatory update / an insight) ─
  // Open the exact item's month (even if collapsed), reveal it past the "show more"
  // cap, scroll the card to centre and blip it — never landing on collapsed months.
  const targetItemId = focus?.targetItemId ?? null
  const [blipId, setBlipId] = useState<string | null>(null)
  useEffect(() => {
    if (!targetItemId) { setBlipId(null); return }
    const item = ALL_ITEMS.find((n) => (n.id ?? String(n.sn)) === targetItemId)
    const month = focus?.targetMonth ?? (item ? monthKey(item.date) : null)
    if (month) {
      setOpenMonths((p) => ({ ...p, [month]: true }))
      setShowAll((p) => ({ ...p, [month]: true }))
    }
    setBlipId(targetItemId)
    const scrollT = window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(`[data-source-id="${targetItemId.replace(/(["\\])/g, '\\$1')}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 140)
    const clearT = window.setTimeout(() => setBlipId(null), 5200) // long enough to relate insight → evidence
    return () => { window.clearTimeout(scrollT); window.clearTimeout(clearT) }
  }, [targetItemId, focus?.targetMonth])

  // The provenance shown at the highlighted card.
  const targetInfo = targetItemId
    ? { id: targetItemId, sourceDate: focus?.sourceDate, surfacedAt: focus?.surfacedAt, reason: focus?.reasonShownToday }
    : null

  return (
    // Relative, isolated shell so the soft powder-blue field sits behind the whole
    // section (Option A) — a calm tint, never a flat white page.
    <div ref={focusRef} className={`relative isolate space-y-4 ${arrived && !targetItemId ? 'insight-arrival rounded-2xl' : ''}`}>
      <SectoralBackdrop />
      {focus && <InsightContextChip focus={focus} />}

      {/* ── Self-updating status strip — slim, subtle warm gold ───────────── */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-[#E8D6AC]/70 bg-[#FCF9F0]/85 px-3 py-1.5 backdrop-blur-sm">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium leading-snug text-[#8A6516]">
          <RefreshCw className="h-3.5 w-3.5 shrink-0" /> Self-updating · fresh items are AI-gathered from public web sources and source-linked — verify before acting
        </span>
        <span className="shrink-0 text-[10.5px] text-ink-secondary">
          {newCount > 0 && <b className="font-semibold text-teal">{newCount} new</b>}
          {newCount > 0 && ' · '}
          {LAST_REFRESHED ? `Last refreshed ${fmtFull(LAST_REFRESHED)}` : 'Awaiting first auto-refresh'}
        </span>
      </div>

      {/* ── Filter + search — one clean row of pill chips ─────────────────── */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-[#D6E2F2] bg-white/70 p-2.5 shadow-soft backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <LensChip label="All" count={total} color={NAVY} active={lens === 'all'} onClick={() => setLens('all')} />
          {SECTORAL_CATEGORY_ORDER.map((c) => {
            const meta = SECTORAL_CATEGORY_META[c]
            return (
              <LensChip
                key={c}
                label={meta.short}
                count={counts[c]}
                color={meta.color}
                active={lens === c}
                onClick={() => setLens((p) => (p === c ? 'all' : c))}
              />
            )
          })}
        </div>
        <div className="relative md:w-60">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-secondary" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search sector updates"
            placeholder="Search updates…"
            className="w-full rounded-full border border-[#D6E2F2] bg-white/85 py-1.5 pl-8 pr-3 text-[12px] text-navy-deep outline-none transition-colors placeholder:text-ink-secondary/70 focus:border-navy-primary"
          />
        </div>
      </div>

      {/* ── Count + clear ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] text-ink-secondary">
          Showing <b className="font-semibold text-navy-deep">{filtered.length}</b> of {total} updates
          {lens !== 'all' && <> · {SECTORAL_CATEGORY_META[lens].label}</>}
        </p>
        {filtering && (
          <button
            type="button"
            onClick={() => {
              setLens('all')
              setQuery('')
            }}
            className="text-[11px] font-semibold text-navy-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Month blocks (newest first) or a clean empty state ───────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#CBDAEF] bg-white/55 py-14 text-center">
          <Newspaper className="h-5 w-5 text-ink-secondary/60" />
          <p className="text-[13px] font-semibold text-navy-deep">No updates found for this filter.</p>
          <p className="text-[11.5px] text-ink-secondary">Try a different theme or clear the search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([key, items], idx) => {
            const open = isMonthOpen(key, idx)
            const all = showAll[key]
            const visible = all ? items : items.slice(0, INITIAL_CARDS)
            const hidden = items.length - visible.length
            return (
              <section
                key={key}
                data-source-section-id={key}
                className="overflow-hidden rounded-2xl border border-[#D3E1F2] bg-gradient-to-b from-[#EFF5FD] to-[#F8FBFE] shadow-[0_1px_2px_rgba(23,43,77,0.04),0_10px_26px_rgba(23,43,77,0.06)]"
              >
                {/* Header — calendar · month · count · chevron (collapses the body) */}
                <button
                  type="button"
                  onClick={() => toggleMonth(key, idx)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/40"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-navy-primary/10 text-navy-primary">
                    <CalendarDays className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-display text-[14.5px] leading-none text-navy-deep">{fmtMonth(key)}</span>
                  <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-ink-secondary ring-1 ring-[#D6E2F2]">
                    {items.length} update{items.length === 1 ? '' : 's'}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-ink-secondary transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>

                {/* Body — a clean, equal-height card grid */}
                {open && (
                  <div className="px-3 pb-3.5 pt-0.5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {visible.map((n) => (
                        <NewsCard
                          key={n.id ?? n.sn}
                          item={n}
                          neu={isNew(n)}
                          targeted={targetInfo && (n.id ?? String(n.sn)) === targetInfo.id ? { ...targetInfo, blip: blipId === (n.id ?? String(n.sn)) } : null}
                        />
                      ))}
                    </div>
                    {items.length > INITIAL_CARDS && (
                      <div className="mt-3 flex justify-center">
                        <button
                          type="button"
                          onClick={() => toggleShowAll(key)}
                          className="inline-flex items-center gap-1 rounded-full border border-[#D6E2F2] bg-white/80 px-3 py-1 text-[11px] font-semibold text-navy-primary shadow-soft transition-colors hover:border-navy-primary/30"
                        >
                          {all ? 'Show less' : `Show ${hidden} more`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* ── Honest provenance footer ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D6E2F2] pt-3">
        <p className="max-w-[62ch] text-[11px] leading-relaxed text-ink-secondary">
          Self-updating feed. The {SNAP?._meta?.seed_count ?? 31}-item history is curated from the investor portfolio
          pack; ongoing updates are AI-gathered from public web sources on a schedule, each linking its source — verify
          before acting.
        </p>
        <SourceTag
          source="Portfolio + AI web"
          period={windowLabel}
          frequency="Event-based"
          status="available"
          confidence="medium"
          provenance={{ source_name: 'Seed: investor portfolio pack · Updates: muns web agent (AI, web search)' }}
          auditRoute={false}
        />
      </div>
    </div>
  )
}

// Soft powder-blue backdrop for the Key Sectoral News section (Option A) — a very
// light blue-white canvas with a couple of pale blue blobs. No warm accent here:
// gold is reserved for the AI / source badges. Decorative; sits behind all
// content (-z-10).
function SectoralBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-x-2 -inset-y-2 -z-10 overflow-hidden rounded-3xl">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(165deg, #F4F8FE 0%, #E7F0FB 52%, #F2F7FD 100%)' }} />
      <div className="blob-a absolute -left-28 -top-24 h-[24rem] w-[24rem] opacity-80 blur-3xl" style={{ background: 'radial-gradient(circle at 42% 42%, rgba(180,207,244,0.6), transparent 70%)' }} />
      <div className="blob-b absolute -right-24 -top-10 h-[26rem] w-[26rem] opacity-70 blur-3xl" style={{ background: 'radial-gradient(circle at 52% 42%, rgba(198,219,246,0.6), transparent 72%)' }} />
      <div className="blob-c absolute -left-10 bottom-8 h-72 w-72 opacity-55 blur-3xl" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(205,224,247,0.5), transparent 72%)' }} />
    </div>
  )
}

// ── Theme filter chip — navy when selected, soft blue-tinted white otherwise ──
function LensChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string
  count: number
  color: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'chip-soft inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-200',
        active
          ? 'text-white shadow-soft'
          : 'bg-white/70 text-ink-secondary ring-1 ring-[#D6E2F2] hover:text-navy-primary hover:ring-navy-primary/30',
      ].join(' ')}
      style={active ? { background: NAVY } : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? 'rgba(255,255,255,0.9)' : color }} />
      {label}
      <span className={`tabular-nums ${active ? 'text-white/80' : 'text-ink-secondary/60'}`}>{count}</span>
    </button>
  )
}

// ── Single update card — white with a slight blue tint; equal-height, with the
//    source pinned to the bottom so every row of cards lines up. ───────────────
interface TargetedInfo { sourceDate?: string; surfacedAt?: string; reason?: string; blip?: boolean }

function NewsCard({ item, neu, targeted = null }: { item: SectoralNewsItem; neu: boolean; targeted?: TargetedInfo | null }) {
  const meta = SECTORAL_CATEGORY_META[item.category]
  const domain = domainOf(item.reference)
  const rowKey = item.id ?? String(item.sn)

  return (
    <article
      data-source-id={rowKey}
      data-source-row-key={item.sn}
      data-source-highlight={targeted ? '1' : undefined}
      className={`flex h-full flex-col rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(23,43,77,0.1)] ${
        targeted
          ? `border-navy-primary/60 bg-soft-blue/60 shadow-[0_10px_26px_rgba(23,43,77,0.12)] ${targeted.blip ? 'insight-arrival' : ''}`
          : 'border-[#DCE7F4] bg-gradient-to-br from-white to-[#F4F9FE] shadow-[0_1px_2px_rgba(23,43,77,0.04)] hover:border-navy-primary/25'
      }`}
    >
      {/* Source-evidence label — shown when a source click opened this exact card.
          `reason` carries the honest new-vs-newly-surfaced explanation. */}
      {targeted && (
        <div className="mb-2 rounded-lg border border-[#E4CE93] bg-[#FBF6EA] px-2 py-1.5 leading-snug">
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-champagne-deep">Source for: Regulatory Update</span>
          {targeted.reason ? (
            <span className="mt-0.5 block text-[10px] text-navy-deep">{targeted.reason}</span>
          ) : (
            targeted.sourceDate && <span className="mt-0.5 block text-[10px] text-ink-secondary">Original source date: {fmtFull(targeted.sourceDate)}</span>
          )}
        </div>
      )}
      {/* Category (colored dot) · AI badge top-right */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: meta.color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
          {meta.short}
        </span>
        {item.origin === 'agent' && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#E8D6AC]/70 bg-[#FBF4E4] px-1.5 py-0.5 text-[9px] font-semibold text-[#8A6516]"
            title="AI-gathered from a public web source — verify before acting"
          >
            <Sparkles className="h-2.5 w-2.5" /> AI
          </span>
        )}
      </div>

      {/* Date · NEW */}
      <div className="mt-1.5 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-secondary">
          <CalendarDays className="h-3 w-3" /> {fmtFull(item.date)}
        </span>
        {neu && (
          <span className="rounded-full bg-teal-soft px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-teal">
            New
          </span>
        )}
      </div>

      {/* Title · summary */}
      <h4 className="mt-2 line-clamp-2 text-[12.5px] font-semibold leading-snug text-navy-deep" title={item.subject}>
        {item.subject}
      </h4>
      <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-ink-secondary" title={item.summary}>
        {item.summary}
      </p>

      {/* Source — pinned to the bottom so cards align across a row */}
      {item.reference && (
        <div className="mt-auto border-t border-[#EAF1F9] pt-2.5">
          <a
            href={item.reference}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-blue transition-colors hover:text-navy-primary hover:underline"
          >
            {domain ? `Read at ${domain}` : 'Read source'}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </article>
  )
}
