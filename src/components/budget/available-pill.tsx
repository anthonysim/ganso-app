import { Money } from '#/components/accounts/money'
import { cn } from '#/lib/utils'
import type { BudgetCategoryRow } from '#/lib/budget-month'

/** Green = money available, grey = empty, red = cash overspent, yellow = credit overspent. */
export function AvailablePill({
  category,
  currency,
}: {
  category: Pick<BudgetCategoryRow, 'available' | 'overspent'>
  currency: string
}) {
  const tone =
    category.overspent === 'cash'
      ? 'red'
      : category.overspent === 'credit'
        ? 'yellow'
        : category.available > 0
          ? 'green'
          : 'grey'
  return (
    <span
      data-tone={tone}
      className={cn(
        '-mr-3 inline-block min-w-24 rounded-full px-3 py-0.5 text-right text-sm font-medium tabular-nums @max-md/main:-mr-2 @max-md/main:min-w-16 @max-md/main:px-2',
        tone === 'green' && 'bg-positive-soft text-positive-foreground',
        tone === 'grey' && 'bg-muted text-muted-foreground',
        tone === 'red' && 'bg-negative-soft text-negative-foreground',
        tone === 'yellow' && 'bg-warning-soft text-warning-foreground',
      )}
    >
      <Money
        value={category.available}
        currency={currency}
        className="text-inherit"
      />
    </span>
  )
}
