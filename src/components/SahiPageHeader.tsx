import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
//  SahiPageHeader — the calm section header for SAHI Analysis pages, in the
//  Industry-page visual language: a slim champagne accent bar + a display title
//  + a short subtitle. NOT a glass cover panel — it replaces the old tall
//  PageHeadline hero, so the table / scorecard / chart sits higher on the page.
//  An optional `right` slot carries an inline section control (e.g. an
//  accounting-basis toggle) without a second row.
// ---------------------------------------------------------------------------

export interface SahiPageHeaderProps {
  title: string
  subtitle?: ReactNode
  /** Inline control rendered at the far right of the header row. */
  right?: ReactNode
}

export function SahiPageHeader({ title, subtitle, right }: SahiPageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden className="mt-0.5 h-8 w-[3px] shrink-0 rounded-full bg-gradient-to-b from-champagne to-champagne-deep" />
        <div className="min-w-0">
          <h2 className="font-display text-[20px] leading-tight text-navy-deep">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
