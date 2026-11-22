import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useState, useTransition } from 'react'
import { PencilIcon, PlusIcon, SkipForwardIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Money } from '#/components/accounts/money'
import { ConfirmDialog } from '#/components/categories/confirm-dialog'
import { ScheduledDialog } from '#/components/scheduled/scheduled-dialog'
import { Button } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { formatDateString } from '#/lib/date'
import { FREQUENCY_LABELS } from '#/lib/schedule'
import {
  deleteScheduled,
  enterScheduledNow,
  loadScheduledPage,
  skipScheduled,
} from '#/server/scheduled'
import type { ScheduledListRow } from '#/server/scheduled-query'

export const Route = createFileRoute('/_authed/budgets/$budgetId/scheduled')({
  loader: ({ params }) =>
    loadScheduledPage({ data: { budgetId: params.budgetId } }),
  component: ScheduledPage,
})

const layout = getRouteApi('/_authed/budgets/$budgetId')

function ScheduledPage() {
  const data = Route.useLoaderData()
  const { budget, accounts } = layout.useLoaderData()
  const router = useRouter()
  const canEdit = budget.role !== 'viewer'
  const [pending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState<ScheduledListRow | null>(null)

  const dialogProps = {
    budgetId: budget.id,
    accounts,
    payees: data.payees,
    categoryGroups: data.categoryGroups,
    inflowCategoryId: data.inflowCategoryId,
  }

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action()
        await router.invalidate()
        toast.success(success)
      } catch {
        toast.error('Something went wrong. Try again.')
      }
    })
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 @xl/main:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Scheduled transactions</h1>
          <p className="text-muted-foreground text-sm">
            Recurring bills and income. They are entered as uncleared
            transactions when they come due.
          </p>
        </div>
        {canEdit ? (
          <ScheduledDialog {...dialogProps}>
            <Button>
              <PlusIcon /> Add scheduled
            </Button>
          </ScheduledDialog>
        ) : null}
      </div>

      {data.scheduled.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing scheduled yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm @max-3xl/main:block">
            <thead className="bg-muted/50 text-muted-foreground text-left @max-3xl/main:hidden">
              <tr>
                <th className="px-3 py-2 font-medium">Next date</th>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Payee</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Repeats</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                {canEdit ? <th className="w-40 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody className="@max-3xl/main:block">
              {data.scheduled.map((s) => (
                <tr
                  key={s.id}
                  className="border-t @max-3xl/main:grid @max-3xl/main:grid-cols-[minmax(0,1fr)_auto] @max-3xl/main:gap-x-3 @max-3xl/main:p-3 @max-3xl/main:first:border-t-0"
                >
                  <td className="px-3 py-2 tabular-nums @max-3xl/main:text-muted-foreground @max-3xl/main:col-start-2 @max-3xl/main:row-start-2 @max-3xl/main:p-0 @max-3xl/main:text-right">
                    {formatDateString(s.nextDate, budget.dateFormat)}
                  </td>
                  <td className="px-3 py-2 @max-3xl/main:text-muted-foreground @max-3xl/main:col-start-1 @max-3xl/main:row-start-3 @max-3xl/main:p-0">
                    {s.accountName}
                  </td>
                  <td className="px-3 py-2 @max-3xl/main:col-start-1 @max-3xl/main:row-start-1 @max-3xl/main:p-0 @max-3xl/main:font-medium @max-3xl/main:wrap-anywhere">
                    {s.transferAccountName
                      ? `Transfer: ${s.transferAccountName}`
                      : (s.payeeName ?? '—')}
                  </td>
                  <td className="px-3 py-2 @max-3xl/main:text-muted-foreground @max-3xl/main:col-start-1 @max-3xl/main:row-start-2 @max-3xl/main:p-0">
                    {s.categoryName ?? '—'}
                  </td>
                  <td className="px-3 py-2 @max-3xl/main:text-muted-foreground @max-3xl/main:col-start-2 @max-3xl/main:row-start-3 @max-3xl/main:p-0 @max-3xl/main:text-right">
                    {FREQUENCY_LABELS[s.frequency]}
                  </td>
                  <td className="px-3 py-2 text-right @max-3xl/main:col-start-2 @max-3xl/main:row-start-1 @max-3xl/main:p-0 @max-3xl/main:font-medium">
                    <Money value={s.amount} currency={budget.currency} />
                  </td>
                  {canEdit ? (
                    <td className="px-3 py-1 @max-3xl/main:col-span-2 @max-3xl/main:row-start-4 @max-3xl/main:p-0 @max-3xl/main:pt-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () =>
                                enterScheduledNow({
                                  data: {
                                    budgetId: budget.id,
                                    scheduledId: s.id,
                                  },
                                }),
                              'Transaction entered',
                            )
                          }
                        >
                          Enter now
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Skip next ${s.payeeName ?? 'occurrence'}`}
                              disabled={pending}
                              onClick={() =>
                                run(
                                  () =>
                                    skipScheduled({
                                      data: {
                                        budgetId: budget.id,
                                        scheduledId: s.id,
                                      },
                                    }),
                                  'Skipped',
                                )
                              }
                            >
                              <SkipForwardIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Skip next occurrence</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <ScheduledDialog {...dialogProps} scheduled={s}>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Edit scheduled ${s.payeeName ?? ''}`}
                              >
                                <PencilIcon />
                              </Button>
                            </TooltipTrigger>
                          </ScheduledDialog>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Delete scheduled ${s.payeeName ?? ''}`}
                              onClick={() => setDeleting(s)}
                            >
                              <Trash2Icon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete scheduled transaction?"
        description="Future occurrences will not be entered. Transactions already entered stay."
        confirmLabel="Delete"
        onConfirm={() => {
          if (!deleting) return
          const id = deleting.id
          run(
            () =>
              deleteScheduled({
                data: { budgetId: budget.id, scheduledId: id },
              }),
            'Scheduled transaction deleted',
          )
        }}
      />
    </div>
  )
}
