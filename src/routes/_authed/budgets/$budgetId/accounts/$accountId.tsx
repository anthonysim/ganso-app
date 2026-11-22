import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useTransition } from 'react'
import { PencilIcon } from 'lucide-react'
import { toast } from 'sonner'
import { EditAccountDialog } from '#/components/accounts/edit-account-dialog'
import { Money } from '#/components/accounts/money'
import { NotFoundView } from '#/components/not-found-view'
import { Button } from '#/components/ui/button'
import { ACCOUNT_TYPE_INFO } from '#/lib/accounts'
import { LoanPlanner } from '#/components/accounts/loan-planner'
import { ImportDialog } from '#/components/import/import-dialog'
import { approveTransactions } from '#/server/import'
import { ReconcileDialog } from '#/components/accounts/reconcile-dialog'
import { Register } from '#/components/register/register'
import { closeAccount, reopenAccount } from '#/server/accounts'
import { loadRegister } from '#/server/transactions'

const layout = getRouteApi('/_authed/budgets/$budgetId')

export const Route = createFileRoute(
  '/_authed/budgets/$budgetId/accounts/$accountId',
)({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q:
      typeof search.q === 'string' && search.q !== ''
        ? search.q.slice(0, 100)
        : undefined,
  }),
  loader: ({ params }) =>
    loadRegister({
      data: { budgetId: params.budgetId, accountId: params.accountId },
    }),
  component: AccountPage,
})

function AccountPage() {
  const { accountId } = Route.useParams()
  const { q } = Route.useSearch()
  const register = Route.useLoaderData()
  const { budget, accounts } = layout.useLoaderData()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const account = accounts.find((a) => a.id === accountId)
  if (!account) return <NotFoundView />
  const canEdit = budget.role !== 'viewer'
  const unapprovedCount = register.transactions.filter(
    (t) => !t.approved,
  ).length
  const wasClosed = account.closed

  function toggleClosed() {
    startTransition(async () => {
      try {
        const action = wasClosed ? reopenAccount : closeAccount
        await action({ data: { budgetId: budget.id, accountId } })
        await router.invalidate()
        toast.success(wasClosed ? 'Account reopened' : 'Account closed')
      } catch {
        toast.error('Could not update the account')
      }
    })
  }

  const balances = [
    {
      label: 'Cleared',
      value: account.clearedBalance,
      tint: 'bg-balance-cleared text-balance-cleared-foreground',
      solid: true,
    },
    {
      label: 'Uncleared',
      value: account.unclearedBalance,
      tint: '',
      solid: false,
    },
    {
      label: 'Working',
      value: account.workingBalance,
      tint: 'bg-balance-working',
      solid: false,
    },
  ]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 @xl/main:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {account.name}
            {account.closed ? (
              <span className="text-muted-foreground ml-2 text-base font-normal">
                (closed)
              </span>
            ) : null}
          </h1>
          <p className="text-muted-foreground text-sm">
            {ACCOUNT_TYPE_INFO[account.type].label} ·{' '}
            {account.onBudget ? 'On budget' : 'Tracking'}
          </p>
          {account.note ? <p className="mt-2 text-sm">{account.note}</p> : null}
          {account.lastReconciledAt ? (
            <p className="text-muted-foreground mt-1 text-xs">
              Last reconciled{' '}
              {new Date(account.lastReconciledAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <EditAccountDialog
              budgetId={budget.id}
              accountId={account.id}
              name={account.name}
              note={account.note}
              debt={ACCOUNT_TYPE_INFO[account.type].debt}
              aprBps={account.aprBps}
              minPayment={account.minPayment}
            >
              <Button variant="outline">
                <PencilIcon /> Edit
              </Button>
            </EditAccountDialog>
            {!account.closed ? (
              <ImportDialog
                budgetId={budget.id}
                accountId={account.id}
                savedMapping={account.importMapping}
                currency={budget.currency}
              />
            ) : null}
            {!account.closed ? (
              <ReconcileDialog
                budgetId={budget.id}
                accountId={account.id}
                accountType={account.type}
                clearedBalance={account.clearedBalance}
                currency={budget.currency}
              />
            ) : null}
            <Button variant="outline" disabled={pending} onClick={toggleClosed}>
              {account.closed ? 'Reopen account' : 'Close account'}
            </Button>
          </div>
        ) : null}
      </div>

      {unapprovedCount > 0 && canEdit ? (
        <div
          role="status"
          className="bg-muted flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2 text-sm"
        >
          <span>
            {unapprovedCount} transaction{unapprovedCount === 1 ? '' : 's'} to
            approve
          </span>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await approveTransactions({
                    data: { budgetId: budget.id, accountId: account.id },
                  })
                  await router.invalidate()
                  toast.success('Approved')
                } catch {
                  toast.error('Could not approve')
                }
              })
            }
          >
            Approve all
          </Button>
        </div>
      ) : null}

      <dl className="grid grid-cols-1 gap-2 @md/main:grid-cols-3 @3xl/main:gap-4">
        {balances.map((b) => (
          <div
            key={b.label}
            className={`rounded-lg border p-3 @max-md/main:flex @max-md/main:items-baseline @max-md/main:justify-between @3xl/main:p-4 ${b.tint}`}
          >
            <dt
              className={`text-sm ${b.solid ? 'text-balance-cleared-foreground/80' : 'text-muted-foreground'}`}
            >
              {b.label}
            </dt>
            <dd className="text-base font-semibold @md/main:mt-1 @3xl/main:text-xl">
              <Money
                value={b.value}
                currency={budget.currency}
                className={
                  b.solid ? 'text-balance-cleared-foreground' : undefined
                }
              />
            </dd>
          </div>
        ))}
      </dl>

      {ACCOUNT_TYPE_INFO[account.type].debt && account.workingBalance < 0 ? (
        <LoanPlanner
          key={`${account.aprBps}-${account.minPayment}`}
          owed={-account.workingBalance}
          aprBps={account.aprBps}
          minPayment={account.minPayment}
          currency={budget.currency}
        />
      ) : null}

      <Register
        key={q}
        initialQuery={q}
        budget={budget}
        accounts={accounts}
        data={register}
        accountId={account.id}
      />
    </div>
  )
}
