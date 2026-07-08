// ---------------------------------------------------------------------------
//  Street View eligibility — which companies may appear in the Street View /
//  Analyst Views company selector.
//
//  The Valuation tab is a peer-WIDE comparison; only the Street View card has
//  its own company selector. A company is offered there ONLY when it carries
//  real, source-backed analyst/street coverage AND is investable as a listed
//  security — either directly listed, or through a VALID listed-parent / brand
//  proxy that already exists in config (never an invented mapping).
//
//  This list is DERIVED from live data, so a future listed insurer (or a newly
//  mapped listed-parent proxy that gains ingested coverage) appears
//  automatically — nothing here is hard-coded to Niva Bupa / Star Health.
//
//  Current data state → Niva Bupa + Star Health (listed + covered). Care Health
//  has a listed-parent proxy (Religare) but no analyst data tied to that
//  security, so it is correctly hidden until such coverage exists. Aditya Birla
//  and ManipalCigna have no proxy mapping, so they never qualify.
// ---------------------------------------------------------------------------

import { insurers } from '@/data/mockData'
import { FOCAL_VALUATION_ID, peerValuation } from '@/data/valuationData'
import { hasAnalystCoverage } from '@/lib/analystCoverage'
import { LISTED_INSURERS } from '@/lib/listedInsurers'

export interface StreetViewCompany {
  /** Brand / company id — the selector's option value. */
  id: string
  /** Id under which the analyst coverage + market quote live. Same as `id` for a
   *  directly listed name; the listed PARENT's id when the coverage is tied to a
   *  proxy security (e.g. Care Health → Religare). */
  coverageId: string
  /** Full company name (peer-table label). */
  name: string
  /** Compact label for the selector and card copy. */
  shortName: string
  /** True when the company is itself a listed security. */
  listed: boolean
  /** True when coverage is tied to a listed PARENT / brand proxy, not the company. */
  viaProxy: boolean
  /** The listed proxy's display name (e.g. "Religare"), or null when direct. */
  proxyParentLabel: string | null
  /** What the <option> shows: direct → shortName; proxy → "X — via listed parent". */
  optionLabel: string
}

/**
 * The listed PARENT id for an unlisted company's proxy mapping, or null.
 * Mirrors listedInsurers.ts: an entry whose `dataId` points at a DIFFERENT listed
 * security is a parent/proxy (e.g. Care Health → religare-enterprises). A
 * company's own direct listing carries no `dataId`, so it isn't a proxy. No
 * mapping is invented — only entries already present in LISTED_INSURERS count.
 */
function proxyParentIdFor(companyId: string): string | null {
  return LISTED_INSURERS[companyId]?.dataId ?? null
}

function shortNameFor(companyId: string, fallback: string): string {
  return insurers.find((i) => i.id === companyId)?.shortName ?? fallback
}

/**
 * The peer companies eligible for the Street View selector — data-driven.
 * Qualifies only when BOTH hold:
 *   1. it is directly listed OR has a valid listed-parent proxy in config, and
 *   2. source-backed analyst/street coverage exists for that listed security.
 */
export const streetViewCompanies: StreetViewCompany[] = peerValuation
  .map((row) => {
    const listed = row.listingStatus === 'Listed'
    const parentId = proxyParentIdFor(row.companyId)
    const viaProxy = !listed && parentId != null
    // Coverage lives under the actual listed security: the company itself when
    // directly listed, or its listed parent when shown via a proxy.
    const coverageId = listed ? row.companyId : parentId ?? row.companyId
    return { row, listed, viaProxy, coverageId, parentId }
  })
  .filter(({ listed, viaProxy, coverageId }) => (listed || viaProxy) && hasAnalystCoverage(coverageId))
  .map(({ row, listed, viaProxy, coverageId, parentId }): StreetViewCompany => {
    const shortName = shortNameFor(row.companyId, row.companyName)
    const proxyParentLabel = viaProxy && parentId ? shortNameFor(parentId, LISTED_INSURERS[row.companyId]?.short ?? parentId) : null
    return {
      id: row.companyId,
      coverageId,
      name: row.companyName,
      shortName,
      listed,
      viaProxy,
      proxyParentLabel,
      optionLabel: viaProxy ? `${shortName} — via listed parent` : shortName,
    }
  })

/** The eligible street-view company for an id, or null when not selectable. */
export function streetViewCompanyById(id: string): StreetViewCompany | null {
  return streetViewCompanies.find((c) => c.id === id) ?? null
}

/** The default Street View company id — the focal name when eligible, else the
 *  first eligible peer, else null (no eligible coverage at all). */
export const defaultStreetViewCompanyId: string | null =
  streetViewCompanies.find((c) => c.id === FOCAL_VALUATION_ID)?.id ?? streetViewCompanies[0]?.id ?? null
