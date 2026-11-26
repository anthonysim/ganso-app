import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { addMonths, firstOfMonth, formatMonth, monthToParam } from '#/lib/month'

export function MonthNav({
  budgetId,
  month,
}: {
  budgetId: string
  month: string
}) {
  const current = firstOfMonth()
  return (
    <nav
      aria-label="Month"
      className="flex items-center gap-1 @max-md/main:w-full"
    >
      <Button asChild variant="outline" size="icon" aria-label="Previous month">
        <Link
          to="/budgets/$budgetId/budget"
          params={{ budgetId }}
          search={{ month: monthToParam(addMonths(month, -1)) }}
        >
          <ChevronLeftIcon />
        </Link>
      </Button>
      <h2
        className="min-w-40 text-center text-lg font-semibold @max-md/main:min-w-0 @max-md/main:flex-1"
        aria-live="polite"
      >
        {formatMonth(month)}
      </h2>
      <Button asChild variant="outline" size="icon" aria-label="Next month">
        <Link
          to="/budgets/$budgetId/budget"
          params={{ budgetId }}
          search={{ month: monthToParam(addMonths(month, 1)) }}
        >
          <ChevronRightIcon />
        </Link>
      </Button>
      {month !== current ? (
        <Button asChild variant="ghost" size="sm" className="ml-1">
          <Link
            to="/budgets/$budgetId/budget"
            params={{ budgetId }}
            search={{ month: monthToParam(current) }}
          >
            This month
          </Link>
        </Button>
      ) : null}
    </nav>
  )
}
