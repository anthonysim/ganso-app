import { Money } from '#/components/accounts/money'
import { cn } from '#/lib/utils'
import type { TargetView } from '#/lib/budget-month'

/** Thin progress bar plus a one-line status under a category name. */
export function TargetProgress({
  target,
  currency,
}: {
  target: TargetView
  currency: string
}) {
  const pct = Math.round(target.progress * 100)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      <div
        role="progressbar"
        aria-label="Target progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="bg-muted h-1.5 w-24 shrink-0 overflow-hidden rounded-full @max-md/main:w-20"
      >
        <div
          className={cn(
            'h-full rounded-full',
            target.status === 'underfunded' ? 'bg-warning' : 'bg-positive',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        data-testid="target-status"
        className={cn(
          target.status === 'underfunded'
            ? 'text-warning-foreground'
            : 'text-muted-foreground',
        )}
      >
        {target.status === 'underfunded' ? (
          <>
            Underfunded <Money value={target.underfunded} currency={currency} />
          </>
        ) : target.status === 'funded' ? (
          'Funded'
        ) : (
          'On target'
        )}
      </span>
    </div>
  )
}
