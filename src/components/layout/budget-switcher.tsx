import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  CheckIcon,
  ChevronsUpDownIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Button } from '#/components/ui/button'
import { DeleteBudgetDialog } from '#/components/budgets/delete-budget-dialog'
import { RenameBudgetDialog } from '#/components/budgets/rename-budget-dialog'
import type { BudgetSummary } from '#/components/budgets/budget-types'

export function BudgetSwitcher({
  current,
  budgets,
}: {
  current: BudgetSummary
  budgets: Array<BudgetSummary>
}) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isOwner = current.role === 'owner'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="max-w-64 min-w-0 shrink gap-2 max-sm:px-2"
          >
            <span className="truncate font-semibold">{current.name}</span>
            <ChevronsUpDownIcon className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>Budgets</DropdownMenuLabel>
          {budgets.map((b) => (
            <DropdownMenuItem key={b.id} asChild>
              <Link to="/budgets/$budgetId/budget" params={{ budgetId: b.id }}>
                <span className="truncate">{b.name}</span>
                {b.id === current.id ? <CheckIcon className="ml-auto" /> : null}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/budgets/new">
              <PlusIcon /> New budget
            </Link>
          </DropdownMenuItem>
          {isOwner ? (
            <>
              <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                <PencilIcon /> Rename budget…
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2Icon /> Delete budget…
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {isOwner ? (
        <>
          <RenameBudgetDialog
            budgetId={current.id}
            currentName={current.name}
            open={renameOpen}
            onOpenChange={setRenameOpen}
          />
          <DeleteBudgetDialog
            budgetId={current.id}
            name={current.name}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
          />
        </>
      ) : null}
    </>
  )
}
