import { Fragment, useState, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  WandSparklesIcon,
  Redo2Icon,
  Undo2Icon,
} from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { toast } from 'sonner'
import { CategoryLineRow } from '#/components/budget/budget-category-row'
import { GroupHeaderRow } from '#/components/budget/budget-group-row'
import { useHotkey } from '#/hooks/use-hotkey'
import { Money } from '#/components/accounts/money'
import { Button } from '#/components/ui/button'
import { useAssignmentHistory } from '#/components/budget/history'
import { MonthNav } from '#/components/budget/month-nav'
import { TargetDialog } from '#/components/budget/target-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { AUTO_ASSIGN_LABELS, autoAssignChanges } from '#/lib/auto-assign'
import { applyCategoryOrder } from '#/lib/category-order'
import type { AutoAssignAction } from '#/lib/auto-assign'
import { MonthNote } from '#/components/budget/month-note'
import { MoveMoneyDialog } from '#/components/budget/move-money-dialog'
import { RtaBanner } from '#/components/budget/rta-banner'
import { DeleteCategoryDialog } from '#/components/categories/delete-category-dialog'
import { NameDialog } from '#/components/categories/name-dialog'
import { setAssignments } from '#/server/budget-month'
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
} from '#/server/categories'
import type {
  BudgetCategoryRow,
  BudgetGroupRow,
  BudgetMonthView,
} from '#/lib/budget-month'

// System-managed group; the server rejects new categories in it.
const PAYMENT_GROUP_NAME = 'Credit Card Payments'

export function BudgetGrid({
  budget,
  view,
}: {
  budget: { id: string; currency: string; role: string }
  view: BudgetMonthView
}) {
  const router = useRouter()
  const canEdit = budget.role !== 'viewer'
  const history = useAssignmentHistory(budget.id)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [moveFrom, setMoveFrom] = useState<BudgetCategoryRow | null>(null)
  const [targetFor, setTargetFor] = useState<BudgetCategoryRow | null>(null)
  const [addTo, setAddTo] = useState<BudgetGroupRow | null>(null)
  const [renaming, setRenaming] = useState<BudgetCategoryRow | null>(null)
  const [deleting, setDeleting] = useState<BudgetCategoryRow | null>(null)
  const [, startSave] = useTransition()
  // Reordering only changes `sort`, so keep the new order locally instead of
  // reloading every route (which re-renders the whole page and resets scroll).
  const [order, setOrder] = useState<Record<string, Array<string>>>({})
  const groups = applyCategoryOrder(view.groups, order)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const allCategories = view.groups.flatMap((g) => g.categories)
  const overspentCount = allCategories.filter(
    (c) => c.overspent === 'cash',
  ).length

  // Cmd/Ctrl+Z undo, Shift+Cmd/Ctrl+Z or Ctrl+Y redo (ignored while typing in a field)
  const { undo, redo } = history
  useHotkey('z', undo, { shift: false, enabled: canEdit })
  useHotkey('z', redo, { shift: true, enabled: canEdit })
  useHotkey('y', redo, { enabled: canEdit })

  function commitAssigned(category: BudgetCategoryRow, next: number) {
    const before = [
      {
        categoryId: category.id,
        month: view.month,
        assigned: category.assigned,
      },
    ]
    const after = [{ ...before[0]!, assigned: next }]
    startSave(async () => {
      try {
        await setAssignments({ data: { budgetId: budget.id, changes: after } })
        history.record({ label: `assign ${category.name}`, before, after })
      } catch {
        toast.error('Could not save the assignment')
      }
      await router.invalidate()
    })
  }

  function runAutoAssign(action: AutoAssignAction) {
    const rows = allCategories
      .filter((c) => !c.hidden)
      .map((c) => ({
        id: c.id,
        assigned: c.assigned,
        underfunded: c.target?.underfunded ?? 0,
        ...c.history,
      }))
    const changes = autoAssignChanges(action, rows)
    if (changes.length === 0) {
      toast('Nothing to change')
      return
    }
    const before = changes.map((c) => ({
      categoryId: c.categoryId,
      month: view.month,
      assigned: c.from,
    }))
    const after = changes.map((c) => ({
      categoryId: c.categoryId,
      month: view.month,
      assigned: c.to,
    }))
    startSave(async () => {
      try {
        await setAssignments({ data: { budgetId: budget.id, changes: after } })
        history.record({
          label: AUTO_ASSIGN_LABELS[action].toLowerCase(),
          before,
          after,
        })
        toast.success(
          `Updated ${changes.length} categor${changes.length === 1 ? 'y' : 'ies'}`,
        )
      } catch {
        toast.error('Could not apply that')
      }
      await router.invalidate()
    })
  }

  function onMoved(from: BudgetCategoryRow, toId: string, amount: number) {
    const to = allCategories.find((c) => c.id === toId)
    if (!to) return
    history.record({
      label: `move money from ${from.name} to ${to.name}`,
      before: [
        { categoryId: from.id, month: view.month, assigned: from.assigned },
        { categoryId: to.id, month: view.month, assigned: to.assigned },
      ],
      after: [
        {
          categoryId: from.id,
          month: view.month,
          assigned: from.assigned - amount,
        },
        {
          categoryId: to.id,
          month: view.month,
          assigned: to.assigned + amount,
        },
      ],
    })
  }

  // Reorder categories within their own group; dropping onto another group is ignored.
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const group = groups.find((g) =>
      g.categories.some((c) => c.id === active.id),
    )
    if (!group) return
    const from = group.categories.findIndex((c) => c.id === active.id)
    const to = group.categories.findIndex((c) => c.id === over.id)
    if (from === -1 || to === -1) return
    const categoryIds = arrayMove(group.categories, from, to).map((c) => c.id)
    setOrder((prev) => ({ ...prev, [group.id]: categoryIds }))
    startSave(async () => {
      try {
        await reorderCategories({
          data: { budgetId: budget.id, groupId: group.id, categoryIds },
        })
      } catch {
        toast.error('Could not reorder categories')
        setOrder((prev) => {
          const { [group.id]: _discarded, ...rest } = prev
          return rest
        })
        await router.invalidate()
      }
    })
  }

  async function confirmDelete(
    category: BudgetCategoryRow,
    reassignTo: string | undefined,
  ) {
    setDeleting(null)
    try {
      await deleteCategory({
        data: {
          budgetId: budget.id,
          categoryId: category.id,
          reassignToCategoryId: reassignTo,
        },
      })
      toast.success(`Deleted ${category.name}`)
    } catch {
      toast.error('Could not delete the category')
    }
    await router.invalidate()
  }

  const allCollapsed =
    groups.length > 0 && groups.every((g) => collapsed.has(g.id))

  function toggleAll() {
    setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.id)))
  }

  function toggle(groupId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4 @xl/main:p-6">
      <div className="grid gap-3 @3xl/main:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center justify-between gap-3 @3xl/main:col-span-2">
          <MonthNav budgetId={budget.id} month={view.month} />
          <RtaBanner
            readyToAssign={view.readyToAssign}
            currency={budget.currency}
            overspentCount={overspentCount}
          />
        </div>

        <div className="-mt-1 min-w-0">
          <MonthNote
            budgetId={budget.id}
            month={view.month}
            note={view.monthNote}
            canEdit={canEdit}
          />
        </div>

        <div className="flex items-end gap-1 @3xl/main:justify-self-end">
          <div className="flex gap-1">
            {canEdit ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <WandSparklesIcon /> Auto-assign <ChevronsUpDownIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(
                      Object.keys(AUTO_ASSIGN_LABELS) as Array<AutoAssignAction>
                    ).map((action) => (
                      <DropdownMenuItem
                        key={action}
                        onSelect={() => runAutoAssign(action)}
                      >
                        {AUTO_ASSIGN_LABELS[action]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!history.canUndo}
                  onClick={history.undo}
                  aria-label="Undo"
                >
                  <Undo2Icon />{' '}
                  <span className="@max-md/main:hidden">Undo</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!history.canRedo}
                  onClick={history.redo}
                  aria-label="Redo"
                >
                  <Redo2Icon />{' '}
                  <span className="@max-md/main:hidden">Redo</span>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-clip rounded-lg border">
        <DndContext
          id="budget-categories"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground sticky top-0 z-10 text-left">
              <tr>
                <th className="px-3 py-2 font-medium @max-md/main:px-2">
                  Category
                </th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap @max-md/main:px-1.5">
                  Assigned
                </th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap @max-3xl/main:hidden">
                  Activity
                </th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap @max-md/main:px-2">
                  Available
                </th>
                <th className="w-10 px-2 py-1 text-right @max-md/main:w-8 @max-md/main:px-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleAll}
                    aria-label={allCollapsed ? 'Expand all' : 'Collapse all'}
                    title={allCollapsed ? 'Expand all' : 'Collapse all'}
                  >
                    {allCollapsed ? (
                      <ChevronsUpDownIcon />
                    ) : (
                      <ChevronsDownUpIcon />
                    )}
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isCollapsed = collapsed.has(g.id)
                const sortable = canEdit && g.name !== PAYMENT_GROUP_NAME
                return (
                  <Fragment key={g.id}>
                    <GroupHeaderRow
                      group={g}
                      currency={budget.currency}
                      collapsed={isCollapsed}
                      canAdd={sortable}
                      onToggle={toggle}
                      onAdd={setAddTo}
                    />
                    {isCollapsed ? null : (
                      <SortableContext
                        items={g.categories.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {g.categories.map((c) => (
                          <CategoryLineRow
                            key={c.id}
                            category={c}
                            currency={budget.currency}
                            canEdit={canEdit}
                            sortable={sortable}
                            onCommitAssigned={commitAssigned}
                            onSetTarget={setTargetFor}
                            onMoveMoney={setMoveFrom}
                            onRename={sortable ? setRenaming : undefined}
                            onDelete={sortable ? setDeleting : undefined}
                          />
                        ))}
                      </SortableContext>
                    )}
                  </Fragment>
                )
              })}
              <tr className="bg-muted/50 border-t font-semibold">
                <td className="px-3 py-2 @max-md/main:px-2">
                  Total
                  <div className="hidden text-xs font-normal @max-3xl/main:block">
                    <span className="text-muted-foreground mr-1">Activity</span>
                    <Money
                      value={view.totals.activity}
                      currency={budget.currency}
                    />
                  </div>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap @max-md/main:px-1.5">
                  <Money
                    value={view.totals.assigned}
                    currency={budget.currency}
                  />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap @max-3xl/main:hidden">
                  <Money
                    value={view.totals.activity}
                    currency={budget.currency}
                  />
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap @max-md/main:px-2">
                  <Money
                    value={view.totals.available}
                    currency={budget.currency}
                  />
                </td>
                <td className="px-2 py-1 @max-md/main:px-0.5" />
              </tr>
            </tbody>
          </table>
        </DndContext>
      </div>

      {targetFor ? (
        <TargetDialog
          key={targetFor.id}
          open
          onOpenChange={(open) => {
            if (!open) setTargetFor(null)
          }}
          budgetId={budget.id}
          category={targetFor}
          isPaymentCategory={view.groups.some(
            (g) =>
              g.name === PAYMENT_GROUP_NAME &&
              g.categories.some((c) => c.id === targetFor.id),
          )}
        />
      ) : null}

      {addTo ? (
        <NameDialog
          key={addTo.id}
          open
          onOpenChange={(open) => {
            if (!open) setAddTo(null)
          }}
          title={`Add category to ${addTo.name}`}
          label="Category name"
          submitLabel="Add category"
          onSubmit={async (name) => {
            await createCategory({
              data: { budgetId: budget.id, groupId: addTo.id, name },
            })
            await router.invalidate()
            toast.success('Category added')
          }}
        />
      ) : null}

      {renaming ? (
        <NameDialog
          key={renaming.id}
          open
          onOpenChange={(open) => {
            if (!open) setRenaming(null)
          }}
          title="Rename category"
          label="Category name"
          initialValue={renaming.name}
          submitLabel="Save"
          onSubmit={async (name) => {
            await updateCategory({
              data: {
                budgetId: budget.id,
                categoryId: renaming.id,
                name,
              },
            })
            await router.invalidate()
            toast.success('Category renamed')
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteCategoryDialog
          key={deleting.id}
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
          category={deleting}
          groups={view.groups.filter((g) => g.name !== PAYMENT_GROUP_NAME)}
          onConfirm={(reassignTo) => confirmDelete(deleting, reassignTo)}
        />
      ) : null}

      {moveFrom ? (
        <MoveMoneyDialog
          key={moveFrom.id}
          open
          onOpenChange={(open) => {
            if (!open) setMoveFrom(null)
          }}
          budgetId={budget.id}
          month={view.month}
          from={moveFrom}
          groups={view.groups}
          onMoved={(toId, amount) => onMoved(moveFrom, toId, amount)}
        />
      ) : null}
    </div>
  )
}
