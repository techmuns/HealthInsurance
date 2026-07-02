// AuditSource context — the "source tags route to Data Audit" wiring for the
// SAHI Analysis and Industry Data pages. Data Audit is the single source-of-truth
// hub, so on those pages a source tag doesn't open a PDF/PPT/external URL; it
// navigates to Data Audit and highlights the exact mapped row/cell (falling back
// to the nearest section). Insights / Pulse / Data Insights keep their own source
// links — they read the default inactive context, so their tags are unchanged.

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { AuditFocus } from '@/insights/sourceMap'

export interface AuditSourceValue {
  /** True on SAHI Analysis / Industry Data — source tags route to Data Audit. */
  active: boolean
  /** Active company id — the fallback when a source tag doesn't name its own. */
  company?: string
  /** Where the reader is coming from ("SAHI Analysis" / "Industry Data"). */
  fromLabel?: string
  /** Navigate to Data Audit, highlight `focus`, and remember the return route. */
  goToAudit: (focus: AuditFocus) => void
}

const NOOP: AuditSourceValue = { active: false, goToAudit: () => {} }

const AuditSourceContext = createContext<AuditSourceValue>(NOOP)

export function AuditSourceProvider({ value, children }: { value: AuditSourceValue; children: ReactNode }) {
  return <AuditSourceContext.Provider value={value}>{children}</AuditSourceContext.Provider>
}

export function useAuditSource(): AuditSourceValue {
  return useContext(AuditSourceContext)
}
