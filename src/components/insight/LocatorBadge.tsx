// LocatorBadge — the "here it is" marker an insight drops next to the exact row,
// card or event it points at when there's no metric to compare (a count, an
// event, a development). A gently pulsing blip + a compact label = the simple
// popup + highlight blip. Place it inside/next to the target element.

export function LocatorBadge({ label = 'Here', className = '' }: { label?: string; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-champagne/50 bg-champagne-soft/70 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-champagne-deep shadow-soft ${className}`}
    >
      <span className="locator-blip inline-block h-2 w-2" />
      {label}
    </span>
  )
}
