// ---------------------------------------------------------------------------
//  sourceRegistry — the central, inspectable map that gives every source
//  reference a stable id and an explicit destination (internal cell/card, and/or
//  external document). A developer can read this to see exactly where each source
//  points, without chasing scroll offsets or visual positions.
//
//  It reflects what the dashboard already contains — it never invents a value or a
//  target — so it can't drift from the shown data. Two internal populations are
//  covered:
//    1. Data-Audit cells (every extracted number) — the audit grid.
//    2. Regulatory feed items (Key Sectoral News) — the regulatory cards.
//  Everything else is an external document (opened as-is).
// ---------------------------------------------------------------------------

import { buildAudit, type AuditCell } from './extractedDataAudit'
import { buildSectoralItems, sectoralItemKey, sectoralMonthKey } from '@/insights/regulatoryFeed'
import type { SectoralNewsItem } from '@/data/sectoralNews'

export type SourceType = 'audit_cell' | 'regulatory_item' | 'external_document'

/** A standardized source reference — the stable mapping behind every source link. */
export interface SourceRef {
  sourceId: string
  sourceLabel: string
  sourceType: SourceType
  // ── provenance / recency ──
  sourceDate?: string // original publication/filing/event date
  firstSeenAt?: string // when the dashboard first detected it
  surfacedAt?: string // when it was added/surfaced into the feed
  reasonShownToday?: string
  // ── context ──
  company?: string
  peerGroup?: string
  metric?: string
  period?: string
  value?: string | number | null
  sourceContext?: string
  // ── internal target (where the evidence lives in the dashboard) ──
  isInternal: boolean
  internalTargetRoute?: string // top-level page id, e.g. 'audit' | 'sahi'
  internalTargetTab?: string // sub-tab id, e.g. 'sector-news'
  internalTargetSectionId?: string // e.g. the month key '2026-07'
  internalTargetAccordionId?: string // collapsible container to open
  internalTargetDrawerId?: string
  internalTargetTableId?: string // audit sheet name
  internalTargetRowKey?: string // metric id / item id (data-source-row-key)
  internalTargetColumnKey?: string // period (audit column)
  internalTargetCellKey?: string // `${sheet}!${cellRef}` (data-cell-id)
  // ── external target ──
  externalUrl?: string
  externalPdfUrl?: string
  externalPageHint?: string
}

const cellValue = (c: AuditCell): number | string | null => c.normalizedValue ?? c.rawValue
const isPdf = (u?: string | null): boolean => !!u && /\.pdf(\?|#|$)/i.test(u)

/** The one stable id scheme for an internal audit source. */
export const auditSourceId = (company?: string, metric?: string, period?: string): string =>
  ['audit', company, metric, period].filter(Boolean).join('::')

/** Turn one audit cell into a standardized SourceRef. */
export function refFromAuditCell(cell: AuditCell): SourceRef {
  return {
    sourceId: auditSourceId(cell.entityId, cell.metricId, cell.period),
    sourceLabel: `${cell.entityLabel} · ${cell.metricLabel} · ${cell.period}`,
    sourceType: 'audit_cell',
    sourceDate: cell.sourceDate ?? undefined,
    company: cell.entityId,
    metric: cell.metricId,
    period: cell.period,
    value: cellValue(cell),
    sourceContext: cell.sourceName ?? undefined,
    isInternal: true,
    internalTargetRoute: 'audit',
    internalTargetTableId: cell.sheet,
    internalTargetRowKey: cell.metricId,
    internalTargetColumnKey: cell.period,
    internalTargetCellKey: cell.id,
    externalUrl: isPdf(cell.sourceUrl) ? undefined : cell.sourceUrl ?? undefined,
    externalPdfUrl: isPdf(cell.sourceUrl) ? cell.sourceUrl ?? undefined : undefined,
  }
}

/** Turn one regulatory / sectoral-news feed item into a SourceRef. */
export function refFromRegulatory(item: SectoralNewsItem): SourceRef {
  const month = sectoralMonthKey(item.date)
  const older = item.added_at && item.added_at.slice(0, 10) !== item.date.slice(0, 10)
  return {
    sourceId: `regulatory::${sectoralItemKey(item)}`,
    sourceLabel: item.subject,
    sourceType: 'regulatory_item',
    sourceDate: item.date,
    firstSeenAt: item.added_at,
    surfacedAt: item.added_at,
    reasonShownToday: older ? `Older source (dated ${item.date}) — added to the feed ${item.added_at}.` : `Published ${item.date}.`,
    metric: item.category,
    sourceContext: item.origin === 'agent' ? 'AI-gathered from a public web source' : 'Investor portfolio pack',
    isInternal: true,
    internalTargetRoute: 'sahi',
    internalTargetTab: 'sector-news',
    internalTargetSectionId: month,
    internalTargetAccordionId: month,
    internalTargetRowKey: sectoralItemKey(item),
    externalUrl: isPdf(item.reference) ? undefined : item.reference,
    externalPdfUrl: isPdf(item.reference) ? item.reference : undefined,
  }
}

/** The full internal source catalog — every audit cell that carries a value, plus
 *  every regulatory feed item. Deterministic + inspectable; the basis for the
 *  source-link audits. */
export function buildSourceRegistry(): SourceRef[] {
  const out: SourceRef[] = []
  const model = buildAudit()
  for (const g of model.groups) for (const c of g.cells) if (cellValue(c) != null) out.push(refFromAuditCell(c))
  for (const it of buildSectoralItems()) if (it.category === 'Regulatory') out.push(refFromRegulatory(it))
  return out
}
