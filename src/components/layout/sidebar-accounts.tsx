import { useOptimistic, useTransition } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, Modifier } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { AddAccountDialog } from '#/components/accounts/add-account-dialog'
import { Money } from '#/components/accounts/money'
import type { BudgetSummary } from '#/components/budgets/budget-types'
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '#/components/ui/sidebar'
import { reorderWithinGroup } from '#/lib/accounts'
import { cn } from '#/lib/utils'
import { reorderAccounts } from '#/server/accounts'
import type { AccountWithBalances } from '#/server/accounts-query'

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
})

function SortableAccountItem({
  id,
  disabled,
  children,
}: {
  id: string
  disabled: boolean
  children: React.ReactNode
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled })
  return (
    <SidebarMenuItem
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'bg-sidebar relative z-10 opacity-80')}
      {...listeners}
    >
      {children}
    </SidebarMenuItem>
  )
}

export function SidebarAccounts({
  budget,
  accounts,
}: {
  budget: BudgetSummary
  accounts: Array<AccountWithBalances>
}) {
  const router = useRouter()
  const { setOpenMobile } = useSidebar()
  const [, startReorder] = useTransition()
  const [ordered, setOrdered] = useOptimistic(accounts)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )
  const open = ordered.filter((a) => !a.closed)
  const canEdit = budget.role !== 'viewer'

  function onDragEnd(groupIds: Array<string>, { active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const allIds = ordered.map((a) => a.id)
    const nextIds = reorderWithinGroup(
      allIds,
      groupIds,
      String(active.id),
      String(over.id),
    )
    const byId = new Map(ordered.map((a) => [a.id, a]))
    const next = nextIds.flatMap((id) => byId.get(id) ?? [])
    startReorder(async () => {
      setOrdered(next)
      try {
        await reorderAccounts({
          data: { budgetId: budget.id, accountIds: nextIds },
        })
      } catch {
        toast.error('Could not reorder accounts')
      }
      await router.invalidate()
    })
  }
  const groups = [
    { title: 'Budget', items: open.filter((a) => a.onBudget) },
    { title: 'Tracking', items: open.filter((a) => !a.onBudget) },
  ]

  return (
    <>
      {open.length === 0 ? (
        <SidebarGroup>
          <SidebarGroupLabel>Accounts</SidebarGroupLabel>
          {canEdit ? (
            <AddAccountDialog budgetId={budget.id}>
              <SidebarGroupAction title="Add account">
                <PlusIcon /> <span className="sr-only">Add account</span>
              </SidebarGroupAction>
            </AddAccountDialog>
          ) : null}
          <SidebarGroupContent>
            <p className="text-sidebar-foreground/60 px-2 text-xs group-data-[collapsible=icon]:hidden">
              No accounts yet
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : (
        groups.map((g, i) =>
          g.items.length === 0 ? null : (
            <SidebarGroup key={g.title}>
              <SidebarGroupLabel>{g.title}</SidebarGroupLabel>
              {i === 0 && canEdit ? (
                <AddAccountDialog budgetId={budget.id}>
                  <SidebarGroupAction title="Add account">
                    <PlusIcon /> <span className="sr-only">Add account</span>
                  </SidebarGroupAction>
                </AddAccountDialog>
              ) : null}
              <SidebarGroupContent>
                <DndContext
                  id={`sidebar-accounts-${g.title}`}
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis]}
                  onDragEnd={(e) =>
                    onDragEnd(
                      g.items.map((a) => a.id),
                      e,
                    )
                  }
                >
                  <SortableContext
                    items={g.items.map((a) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <SidebarMenu>
                      {g.items.map((a) => (
                        <SortableAccountItem
                          key={a.id}
                          id={a.id}
                          disabled={!canEdit}
                        >
                          <SidebarMenuButton
                            asChild
                            tooltip={a.name}
                            size="sm"
                            className="pointer-coarse:h-10 group-data-[collapsible=icon]:pointer-coarse:h-8"
                          >
                            <Link
                              to="/budgets/$budgetId/accounts/$accountId"
                              params={{ budgetId: budget.id, accountId: a.id }}
                              onClick={() => setOpenMobile(false)}
                              activeProps={{ 'data-active': true }}
                            >
                              <span
                                aria-hidden
                                className="hidden size-4 shrink-0 items-center justify-center text-xs font-semibold group-data-[collapsible=icon]:flex"
                              >
                                {a.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate group-data-[collapsible=icon]:hidden">
                                {a.name}
                              </span>
                              <Money
                                value={a.workingBalance}
                                currency={budget.currency}
                                className="ml-auto text-xs group-data-[collapsible=icon]:hidden"
                              />
                            </Link>
                          </SidebarMenuButton>
                        </SortableAccountItem>
                      ))}
                    </SidebarMenu>
                  </SortableContext>
                </DndContext>
              </SidebarGroupContent>
            </SidebarGroup>
          ),
        )
      )}
    </>
  )
}
