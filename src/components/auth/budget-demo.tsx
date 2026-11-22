import { useState } from 'react'
import { CheckIcon, PlusIcon } from 'lucide-react'
import { Money } from '#/components/accounts/money'
import { RtaBanner } from '#/components/budget/rta-banner'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

const CURRENCY = 'USD'

// Sample numbers in milliunits. The categories add up to exactly the paycheck.
const CATEGORIES = [
  { id: 'rent', name: 'Rent', amount: 1_450_000 },
  { id: 'groceries', name: 'Groceries', amount: 520_000 },
  { id: 'utilities', name: 'Utilities', amount: 180_000 },
  { id: 'emergency', name: 'Emergency fund', amount: 500_000 },
  { id: 'car', name: 'Car repairs', amount: 250_000 },
  { id: 'fun', name: 'Fun money', amount: 300_000 },
]
const PAYCHECK = CATEGORIES.reduce((sum, c) => sum + c.amount, 0)
const NONE: ReadonlySet<string> = new Set()
const ALL: ReadonlySet<string> = new Set(CATEGORIES.map((c) => c.id))

/** A tiny working budget for the login page: click categories to give a paycheck its jobs. */
export function BudgetDemo() {
  const [funded, setFunded] = useState(NONE)
  const readyToAssign = CATEGORIES.reduce(
    (left, c) => (funded.has(c.id) ? left - c.amount : left),
    PAYCHECK,
  )
  const done = readyToAssign === 0

  function toggle(id: string) {
    setFunded((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  return (
    <section
      aria-labelledby="demo-title"
      className="bg-background text-foreground w-full max-w-md rounded-2xl p-4 shadow-2xl sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="demo-title" className="text-sm font-semibold">
          Try it: payday
        </h2>
        <RtaBanner
          readyToAssign={readyToAssign}
          currency={CURRENCY}
          overspentCount={0}
        />
      </div>
      <ul className="mt-3 flex flex-col">
        {CATEGORIES.map((c, i) => {
          const on = funded.has(c.id)
          return (
            <li
              key={c.id}
              style={{ animationDelay: `${150 + i * 60}ms` }}
              className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 fill-mode-both border-t duration-300 first:border-t-0"
            >
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.id)}
                className="hover:bg-accent focus-visible:ring-ring -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2 text-left text-sm outline-none focus-visible:ring-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    on
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {on ? (
                    <CheckIcon className="size-3" />
                  ) : (
                    <PlusIcon className="size-3" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span
                  className={cn(
                    'rounded-full px-3 py-0.5 font-medium transition-colors',
                    on
                      ? 'bg-positive-soft text-positive-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Money value={c.amount} currency={CURRENCY} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex min-h-9 items-center justify-between gap-3 border-t pt-3">
        <p className="text-muted-foreground text-xs">
          {done
            ? 'Every dollar has a job. That’s the whole idea.'
            : 'Pick a category to give it money.'}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setFunded(done ? NONE : ALL)}
        >
          {done ? 'Start over' : 'Assign the rest'}
        </Button>
      </div>
    </section>
  )
}
