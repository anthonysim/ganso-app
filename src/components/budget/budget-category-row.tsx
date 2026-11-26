import type { ReactNode } from 'react'
import {
  ArrowLeftRightIcon,
  EllipsisIcon,
  PencilIcon,
  StickyNoteIcon,
  TargetIcon,
  Trash2Icon,
} from 'lucide-react'
import { cn } from '#/lib/utils'
import { Money } from '#/components/accounts/money'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { AssignedCell } from '#/components/budget/assigned-cell'
import { AvailablePill } from '#/components/budget/available-pill'
import { TargetProgress } from '#/components/budget/target-progress'
import { DragHandle, SortableRow } from '#/components/categories/sortable'
import type { BudgetCategoryRow as CategoryRow } from '#/lib/budget-month'

// Non-draggable stand-in for SortableRow (viewers, system groups).
function PlainRow({
  className,
  children,
}: {
  id: string
  className?: string
  children: ReactNode
}) {
  return <tr className={className}>{children}</tr>
}

function IconAction({
  label,
  tip,
  onClick,
  children,
}: {
  label: string
  tip: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}

/** One category row: name, assigned, activity, available and per-row actions. */
export function CategoryLineRow({
  category: c,
  currency,
  canEdit,
  sortable,
  onCommitAssigned,
  onSetTarget,
  onMoveMoney,
  onRename,
  onDelete,
}: {
  category: CategoryRow
  currency: string
  canEdit: boolean
  /** Draggable within its group. */
  sortable: boolean
  onCommitAssigned: (category: CategoryRow, next: number) => void
  onSetTarget: (category: CategoryRow) => void
  onMoveMoney: (category: CategoryRow) => void
  /** Omitted for system categories, which cannot be renamed. */
  onRename?: (category: CategoryRow) => void
  /** Omitted for system categories, which cannot be deleted. */
  onDelete?: (category: CategoryRow) => void
}) {
  const Row = sortable ? SortableRow : PlainRow
  return (
    <Row id={c.id} className="border-t">
      <td
        className={cn(
          'px-3 py-1.5 @max-md/main:px-2',
          sortable ? 'pl-4 @max-md/main:pl-2' : 'pl-9 @max-md/main:pl-2',
          c.hidden && 'text-muted-foreground italic',
        )}
      >
        <div className="flex items-center gap-1">
          {sortable ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex @max-md/main:hidden">
                  <DragHandle label={`Reorder ${c.name}`} />
                </span>
              </TooltipTrigger>
              <TooltipContent>Drag to reorder</TooltipContent>
            </Tooltip>
          ) : null}
          <div className="min-w-0 wrap-anywhere">
            {c.name}
            {c.note ? (
              <span
                className="text-muted-foreground ml-2 inline-flex items-center"
                title={c.note}
              >
                <StickyNoteIcon className="size-3.5" aria-hidden />
                <span className="sr-only">Note: {c.note}</span>
              </span>
            ) : null}
            {c.target ? (
              <TargetProgress target={c.target} currency={currency} />
            ) : null}
            <div className="hidden text-xs @max-3xl/main:block">
              <span className="text-muted-foreground mr-1">Activity</span>
              <Money value={c.activity} currency={currency} />
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-1 text-right whitespace-nowrap @max-md/main:px-1.5">
        <AssignedCell
          name={c.name}
          assigned={c.assigned}
          currency={currency}
          canEdit={canEdit}
          onCommit={(next) => onCommitAssigned(c, next)}
        />
      </td>
      <td className="px-3 py-1.5 text-right whitespace-nowrap @max-3xl/main:hidden">
        <Money value={c.activity} currency={currency} />
      </td>
      <td className="px-3 py-1.5 text-right whitespace-nowrap @max-md/main:px-2">
        <AvailablePill category={c} currency={currency} />
      </td>
      <td className="px-2 py-1 @max-md/main:px-0.5">
        {canEdit ? (
          <div className="flex gap-0.5 @max-3xl/main:hidden">
            <IconAction
              label={`Set target for ${c.name}`}
              tip="Set target"
              onClick={() => onSetTarget(c)}
            >
              <TargetIcon />
            </IconAction>
            <IconAction
              label={`Move money from ${c.name}`}
              tip="Move money"
              onClick={() => onMoveMoney(c)}
            >
              <ArrowLeftRightIcon />
            </IconAction>
            {onRename ? (
              <IconAction
                label={`Rename ${c.name}`}
                tip="Rename category"
                onClick={() => onRename(c)}
              >
                <PencilIcon />
              </IconAction>
            ) : null}
            {onDelete ? (
              <IconAction
                label={`Delete ${c.name}`}
                tip="Delete category"
                onClick={() => onDelete(c)}
              >
                <Trash2Icon />
              </IconAction>
            ) : null}
          </div>
        ) : null}
        {canEdit ? (
          <div className="@3xl/main:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${c.name}`}
                >
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onSetTarget(c)}>
                  <TargetIcon /> Set target
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMoveMoney(c)}>
                  <ArrowLeftRightIcon /> Move money
                </DropdownMenuItem>
                {onRename ? (
                  <DropdownMenuItem onSelect={() => onRename(c)}>
                    <PencilIcon /> Rename category
                  </DropdownMenuItem>
                ) : null}
                {onDelete ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(c)}
                  >
                    <Trash2Icon /> Delete category
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </td>
    </Row>
  )
}
