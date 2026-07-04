import { useMemo } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { buildAudit } from '@/lib/extractedDataAudit'
import { AuditSpreadsheet } from '@/sections/AuditSpreadsheet'
import { ExcelVerifierLauncher } from '@/components/ExcelVerifierLauncher'
import { useVerify } from '@/state/verifyState'
import type { AuditFocus } from '@/insights/sourceMap'

// ---------------------------------------------------------------------------
//  Extracted Data Audit — a source-mapping QA surface that mirrors the source
//  Excel template tab-for-tab and cell-for-cell. A reviewer can open their Excel
//  beside it and compare each cell: a filled cell shows the verified value; an
//  empty cell shows which source pipeline (IRDAI portal / company PPT / Screener)
//  should fill it and why it is still missing. Read-only — no data is changed.
//
//  The Excel Upload Verifier lives here too: uploading a workbook puts the grid
//  into a verification overlay (only problem cells highlighted) and clicking a
//  verifier row jumps to the exact cell. That coordination runs through
//  VerifyProvider (src/state/verifyState).
// ---------------------------------------------------------------------------

// Soft blue-tinted backdrop for the Data Audit tab — a light blue-white canvas,
// a couple of pale blue blobs and a single restrained warm-gold accent, so the
// QA surface sits in the same premium blue field as the Insights / Pulse page.
// Purely decorative; sits behind all content (-z-10), calmer than the Insights
// backdrop because this is a dense working surface, not an editorial read.
function AuditBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-x-2 -inset-y-2 -z-10 overflow-hidden rounded-3xl">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(165deg, #F3F8FE 0%, #E4EEFA 46%, #EFF5FD 100%)' }} />
      {/* soft diagonal blue wash behind the toolbars */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(118deg, transparent 0%, rgba(206,224,247,0.4) 38%, transparent 62%)' }} />
      {/* pale blue blobs along the top edge (where the controls sit) */}
      <div className="blob-a absolute -left-32 -top-28 h-[26rem] w-[26rem] opacity-90 blur-3xl" style={{ background: 'radial-gradient(circle at 42% 42%, rgba(176,205,244,0.68), transparent 70%)' }} />
      <div className="blob-b absolute -right-28 -top-12 h-[30rem] w-[30rem] opacity-80 blur-3xl" style={{ background: 'radial-gradient(circle at 52% 42%, rgba(193,216,246,0.7), transparent 72%)' }} />
      <div className="blob-c absolute -left-16 top-1/2 h-80 w-80 opacity-55 blur-3xl" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(200,220,246,0.58), transparent 72%)' }} />
      {/* one restrained warm-gold accent toward the lower-right */}
      <div className="blob-d absolute -bottom-28 right-4 h-[22rem] w-[22rem] opacity-55 blur-3xl" style={{ background: 'radial-gradient(circle at 58% 58%, rgba(226,196,128,0.4), rgba(214,182,110,0.12) 45%, transparent 72%)' }} />
    </div>
  )
}

function AuditBody({ focus }: { focus?: AuditFocus | null }) {
  const model = useMemo(() => buildAudit(), [])
  const v = useVerify()

  return (
    // Relative, isolated shell so the soft blue backdrop can sit behind the whole
    // audit surface — the same premium blue field the Insights / Pulse page uses.
    <div className="relative isolate space-y-2.5">
      <AuditBackdrop />
      <ExcelVerifierLauncher />

      {/* The Retail Mix cross-surface validation (chart vs peer grid can never
          silently disagree) still runs as a guard via `npm run check:retail-mix`
          in CI — the in-page workings card was retired as internal QA, not
          viewer content. See src/lib/retailMixAudit.ts. */}
      <AuditSpreadsheet model={model} focus={focus} />

      {/* Floating return — once a file is verified, jump back to the verifier
          result list from anywhere in the (tall) grid. */}
      {v.result && !v.open && (
        <button
          type="button"
          onClick={v.openVerifier}
          className="fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 rounded-full border border-[#9DB4D8] bg-gradient-to-br from-[#1E4079] to-[#143058] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_10px_30px_rgba(23,43,77,0.28)] transition-transform hover:-translate-y-0.5"
        >
          <FileSpreadsheet className="h-4 w-4" /> Back to Verifier
        </button>
      )}
    </div>
  )
}

export function ExtractedDataAudit({ focus }: { focus?: AuditFocus | null }) {
  // VerifyProvider is mounted at the app level (App.tsx) so an uploaded Excel
  // survives navigating between sections — this section just consumes it.
  return <AuditBody focus={focus} />
}

/**
 * Warm the cached audit model ahead of rendering the grid. `buildAudit()` caches
 * its result, so calling it here primes the cache: the subsequent grid render
 * (its own `useMemo(buildAudit)`) returns the cached model instantly with no
 * blocking compute. Used by DataAuditPane to run the heavy index build behind
 * the loading card. Pure cache priming — no data is read differently or changed.
 */
export function warmAudit(): void {
  buildAudit()
}
