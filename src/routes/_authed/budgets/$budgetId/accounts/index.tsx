import {
  createFileRoute,
  getRouteApi,
  Link,
  useRouter,
} from '@tanstack/react-router'
import { useTransition } from 'react'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { AddAccountDialog } from '#/components/accounts/add-account-dialog'
import { Money } from '#/components/accounts/money'
import { Button } from '#/components/ui/button'
import { ACCOUNT_TYPE_INFO, moveWithinGroup } from '#/lib/accounts'
import { reorderAccounts } from '#/server/accounts'
import type { AccountWithBalances } from '#/server/accounts-query'

export const Route = createFileRoute('/_authed/budgets/$budgetId/accounts/')({
  component: AccountsPage,
})

const layout = getRouteApi('/_authed/budgets/$budgetId')

function AccountsPage() {
  const { budget, accounts } = layout.useLoaderData()
  const canEdit = budget.role !== 'viewer'
  const open = accounts.filter((a) => !a.closed)
  const groups = [
    { title: 'Budget accounts', items: open.filter((a) => a.onBudget) },
    { title: 'Tracking accounts', items: open.filter((a) => !a.onBudget) },
    { title: 'Closed accounts', items: accounts.filter((a) => a.closed) },
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-4 @xl/main:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">All Accounts</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link
              to="/budgets/$budgetId/transactions"
              params={{ budgetId: budget.id }}
            >
              All transactions
            </Link>
          </Button>
          {canEdit ? (
            <AddAccountDialog budgetId={budget.id}>
              <Button>
                <PlusIcon /> Add account
              </Button>
            </AddAccountDialog>
          ) : null}
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No accounts yet. Add your first account to start tracking balances.
        </p>
      ) : null}

      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <AccountGroup
            key={g.title}
            title={g.title}
            items={g.items}
            allIds={accounts.map((a) => a.id)}
            currency={budget.currency}
            budgetId={budget.id}
            canReorder={canEdit && g.title !== 'Closed accounts'}
          />
        ),
      )}
    </div>
  )
}

function AccountGroup({
  title,
  items,
  allIds,
  currency,
  budgetId,
  canReorder,
}: {
  title: string
  items: Array<AccountWithBalances>
  allIds: Array<string>
  currency: string
  budgetId: string
  canReorder: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const groupIds = items.map((a) => a.id)
  const total = items.reduce((sum, a) => sum + a.workingBalance, 0)

  function move(id: string, delta: -1 | 1) {
    const next = moveWithinGroup(allIds, groupIds, id, delta)
    startTransition(async () => {
      try {
        await reorderAccounts({ data: { budgetId, accountIds: next } })
        await router.invalidate()
      } catch {
        toast.error('Could not reorder accounts')
      }
    })
  }

  return (
    <section aria-labelledby={`group-${title}`} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 id={`group-${title}`} className="text-lg font-medium">
          {title}
        </h2>
        <Money value={total} currency={currency} className="font-medium" />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-balance-working/50 text-muted-foreground text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="bg-balance-cleared text-balance-cleared-foreground w-36 px-3 py-2 text-right font-medium @max-2xl/main:hidden">
                Cleared
              </th>
              <th className="w-36 px-3 py-2 text-right font-medium @max-2xl/main:hidden">
                Uncleared
              </th>
              <th className="bg-balance-working w-36 px-3 py-2 text-right font-medium @max-md/main:w-28">
                Working
              </th>
              {/* Always rendered so every group table shares the same column widths. */}
              <th className="w-24 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((a, i) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 wrap-anywhere">
                  <Link
                    to="/budgets/$budgetId/accounts/$accountId"
                    params={{ budgetId, accountId: a.id }}
                    className="font-medium hover:underline"
                  >
                    {a.name}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {ACCOUNT_TYPE_INFO[a.type].label}
                  </div>
                </td>
                <td className="bg-balance-cleared text-balance-cleared-foreground px-3 py-2 text-right @max-2xl/main:hidden">
                  <Money
                    value={a.clearedBalance}
                    currency={currency}
                    className="text-balance-cleared-foreground"
                  />
                </td>
                <td className="px-3 py-2 text-right @max-2xl/main:hidden">
                  <Money value={a.unclearedBalance} currency={currency} />
                </td>
                <td className="bg-balance-working/50 px-3 py-2 text-right font-medium">
                  <Money value={a.workingBalance} currency={currency} />
                </td>
                {canReorder ? (
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${a.name} up`}
                        disabled={pending || i === 0}
                        onClick={() => move(a.id, -1)}
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${a.name} down`}
                        disabled={pending || i === items.length - 1}
                        onClick={() => move(a.id, 1)}
                      >
                        <ArrowDownIcon />
                      </Button>
                    </div>
                  </td>
                ) : (
                  <td className="px-3 py-2" />
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
