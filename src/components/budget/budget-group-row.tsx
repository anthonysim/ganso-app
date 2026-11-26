import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from 'lucide-react'
import { Money } from '#/components/accounts/money'
import { Button } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import type { BudgetGroupRow as GroupRow } from '#/lib/budget-month'

/** Group header row: collapse toggle, group totals and an "add category" button. */
export function GroupHeaderRow({
  group,
  currency,
  collapsed,
  canAdd,
  onToggle,
  onAdd,
}: {
  group: GroupRow
  currency: string
  collapsed: boolean
  canAdd: boolean
  onToggle: (groupId: string) => void
  onAdd: (group: GroupRow) => void
}) {
  return (
    <tr className="bg-muted/70 border-t font-medium">
      <td className="px-3 py-2 @max-md/main:px-2">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.name}`}
          onClick={() => onToggle(group.id)}
          className="flex items-center gap-1 text-left pointer-coarse:py-1"
        >
          {collapsed ? (
            <ChevronRightIcon className="size-4" />
          ) : (
            <ChevronDownIcon className="size-4" />
          )}
          {group.name}
        </button>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap @max-md/main:px-1.5">
        <Money value={group.assigned} currency={currency} />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap @max-3xl/main:hidden">
        <Money value={group.activity} currency={currency} />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap @max-md/main:px-2">
        <Money value={group.available} currency={currency} />
      </td>
      <td className="px-2 py-1 @max-md/main:px-0.5">
        {canAdd ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Add category to ${group.name}`}
                onClick={() => onAdd(group)}
              >
                <PlusIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add category</TooltipContent>
          </Tooltip>
        ) : null}
      </td>
    </tr>
  )
}
