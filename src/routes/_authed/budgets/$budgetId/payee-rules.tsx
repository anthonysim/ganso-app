import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useState, useTransition } from 'react'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '#/components/categories/confirm-dialog'
import {
  MATCH_LABELS,
  PayeeRuleDialog,
} from '#/components/import/payee-rule-dialog'
import type { RuleRow } from '#/components/import/payee-rule-dialog'
import { Button } from '#/components/ui/button'
import { deletePayeeRule, loadPayeeRules } from '#/server/import'

export const Route = createFileRoute('/_authed/budgets/$budgetId/payee-rules')({
  loader: ({ params }) =>
    loadPayeeRules({ data: { budgetId: params.budgetId } }),
  component: PayeeRulesPage,
})

const layout = getRouteApi('/_authed/budgets/$budgetId')

function PayeeRulesPage() {
  const { rules, categoryGroups } = Route.useLoaderData()
  const { budget } = layout.useLoaderData()
  const router = useRouter()
  const canEdit = budget.role !== 'viewer'
  const [deleting, setDeleting] = useState<RuleRow | null>(null)
  const [, startTransition] = useTransition()

  const categoryName = (id: string | null) =>
    id
      ? (categoryGroups.flatMap((g) => g.categories).find((c) => c.id === id)
          ?.name ?? '—')
      : '—'

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 @xl/main:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Payee rules</h1>
          <p className="text-muted-foreground text-sm">
            Applied when you import a file: rename messy bank payees and set a
            default category. The first matching rule wins.
          </p>
        </div>
        {canEdit ? (
          <PayeeRuleDialog budgetId={budget.id} categoryGroups={categoryGroups}>
            <Button>
              <PlusIcon /> Add rule
            </Button>
          </PayeeRuleDialog>
        ) : null}
      </div>

      {rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">No rules yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm @max-lg/main:block">
            <thead className="bg-muted/50 text-muted-foreground text-left @max-lg/main:hidden">
              <tr>
                <th className="px-3 py-2 font-medium">When the bank payee</th>
                <th className="px-3 py-2 font-medium">Rename to</th>
                <th className="px-3 py-2 font-medium">Category</th>
                {canEdit ? <th className="w-24 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody className="@max-lg/main:block">
              {rules.map((r) => (
                <tr
                  key={r.id}
                  className="border-t @max-lg/main:grid @max-lg/main:grid-cols-[minmax(0,1fr)_auto] @max-lg/main:gap-x-3 @max-lg/main:p-3 @max-lg/main:first:border-t-0"
                >
                  <td className="px-3 py-2 @max-lg/main:text-muted-foreground @max-lg/main:col-start-1 @max-lg/main:p-0 @max-lg/main:wrap-anywhere">
                    {MATCH_LABELS[r.matchType]} “{r.pattern}”
                  </td>
                  <td className="px-3 py-2 @max-lg/main:col-start-1 @max-lg/main:row-start-1 @max-lg/main:p-0 @max-lg/main:font-medium @max-lg/main:wrap-anywhere">
                    {r.payeeName}
                  </td>
                  <td className="px-3 py-2 @max-lg/main:text-muted-foreground @max-lg/main:col-start-1 @max-lg/main:p-0">
                    {categoryName(r.categoryId)}
                  </td>
                  {canEdit ? (
                    <td className="px-3 py-1 @max-lg/main:col-start-2 @max-lg/main:row-span-3 @max-lg/main:row-start-1 @max-lg/main:p-0">
                      <div className="flex justify-end gap-1">
                        <PayeeRuleDialog
                          budgetId={budget.id}
                          categoryGroups={categoryGroups}
                          rule={r}
                        >
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Edit rule ${r.pattern}`}
                          >
                            <PencilIcon />
                          </Button>
                        </PayeeRuleDialog>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete rule ${r.pattern}`}
                          onClick={() => setDeleting(r)}
                        >
                          <Trash2Icon />
                        </Button>
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
        title="Delete this rule?"
        description="Transactions you already imported keep their payee names."
        confirmLabel="Delete"
        onConfirm={() => {
          if (!deleting) return
          const id = deleting.id
          startTransition(async () => {
            try {
              await deletePayeeRule({
                data: { budgetId: budget.id, ruleId: id },
              })
              await router.invalidate()
              toast.success('Rule deleted')
            } catch {
              toast.error('Could not delete the rule')
            }
          })
        }}
      />
    </div>
  )
}
