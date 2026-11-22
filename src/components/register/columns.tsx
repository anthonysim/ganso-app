import { createColumnHelper } from '@tanstack/react-table'
import { CheckCheckIcon, FlagIcon, LockIcon, PencilIcon } from 'lucide-react'
import { Money } from '#/components/accounts/money'
import { FlagDot } from '#/components/register/flag-dot'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { formatDateString } from '#/lib/date'
import { FLAGS, FLAG_COLORS, splitAmount } from '#/lib/transactions'
import type { Flag } from '#/lib/transactions'
import { cn } from '#/lib/utils'
import type { TransactionRow } from '#/server/transactions-query'

export interface RegisterMeta {
  currency: string
  dateFormat: string
  canEdit: boolean
  inflowCategoryId: string | null
  /** Running balance by transaction id (account view only). */
  balances: Map<string, number>
  /** Number of split lines per transaction id. */
  splitCounts: Map<string, number>
  onEdit: (id: string) => void
  onApprove: (row: TransactionRow) => void
  onFlag: (row: TransactionRow, flag: Flag | null) => void
  onToggleCleared: (row: TransactionRow) => void
}

const helper = createColumnHelper<TransactionRow>()

function meta(table: { options: { meta?: unknown } }) {
  return table.options.meta as RegisterMeta
}

export function buildColumns({
  showAccount,
  showBalance,
}: {
  showAccount: boolean
  showBalance: boolean
}) {
  return [
    helper.display({
      id: 'select',
      header: ({ table }) => (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            aria-label="Select all transactions"
            className="size-4 pointer-coarse:size-5"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
          <span aria-hidden className="hidden @max-[62rem]/main:inline">
            Select all
          </span>
        </label>
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label="Select transaction"
          className="size-4 pointer-coarse:size-5"
          disabled={!row.getCanSelect()}
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    }),
    ...(showAccount
      ? [
          helper.accessor('accountName', {
            header: 'Account',
            cell: (c) => <span className="truncate">{c.getValue()}</span>,
          }),
        ]
      : []),
    helper.accessor('date', {
      header: 'Date',
      cell: (c) => (
        <span className="tabular-nums">
          {formatDateString(c.getValue(), meta(c.table).dateFormat)}
        </span>
      ),
    }),
    helper.accessor('payeeName', {
      header: 'Payee',
      cell: (c) => (
        <>
          <FlagDot flag={c.row.original.flag} />
          {c.getValue() ?? <span className="text-muted-foreground">—</span>}
        </>
      ),
    }),
    helper.accessor('categoryName', {
      header: 'Category',
      cell: (c) => {
        const row = c.row.original
        const splitCount = meta(c.table).splitCounts.get(row.id)
        if (splitCount) return `Split (${splitCount})`
        if (
          row.categoryId &&
          row.categoryId === meta(c.table).inflowCategoryId
        ) {
          return 'Inflow: Ready to Assign'
        }
        return (
          c.getValue() ?? (
            <span className="text-muted-foreground">Uncategorized</span>
          )
        )
      },
    }),
    helper.accessor('memo', {
      header: 'Memo',
      cell: (c) => (
        <span className="text-muted-foreground">{c.getValue() ?? ''}</span>
      ),
    }),
    helper.display({
      id: 'outflow',
      header: () => <div className="text-right">Outflow</div>,
      cell: ({ row, table }) => {
        const { outflow } = splitAmount(row.original.amount)
        return (
          <div className="text-right">
            {outflow ? (
              <Money value={-outflow} currency={meta(table).currency} />
            ) : null}
          </div>
        )
      },
    }),
    helper.display({
      id: 'inflow',
      header: () => <div className="text-right">Inflow</div>,
      cell: ({ row, table }) => {
        const { inflow } = splitAmount(row.original.amount)
        return (
          <div className="text-right">
            {inflow ? (
              <Money value={inflow} currency={meta(table).currency} />
            ) : null}
          </div>
        )
      },
    }),
    helper.display({
      id: 'cleared',
      header: () => <div className="text-center">C</div>,
      cell: ({ row, table }) => {
        const r = row.original
        const m = meta(table)
        if (r.cleared === 'reconciled') {
          return (
            <div
              className="text-muted-foreground flex justify-center @max-[62rem]/main:justify-end"
              title="Reconciled"
            >
              <LockIcon className="size-4" />
            </div>
          )
        }
        return (
          <div className="flex justify-center @max-[62rem]/main:justify-end">
            <button
              type="button"
              disabled={!m.canEdit}
              aria-label={
                r.cleared === 'cleared' ? 'Mark uncleared' : 'Mark cleared'
              }
              aria-pressed={r.cleared === 'cleared'}
              onClick={() => m.onToggleCleared(r)}
              className={cn(
                'size-5 rounded-full border text-xs font-semibold pointer-coarse:size-7',
                r.cleared === 'cleared'
                  ? 'border-positive bg-positive text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              C
            </button>
          </div>
        )
      },
    }),
    ...(showBalance
      ? [
          helper.display({
            id: 'balance',
            header: () => <div className="text-right">Balance</div>,
            cell: ({ row, table }) => (
              <div className="text-right">
                <Money
                  value={meta(table).balances.get(row.original.id) ?? 0}
                  currency={meta(table).currency}
                />
              </div>
            ),
          }),
        ]
      : []),
    helper.display({
      id: 'actions',
      header: () => null,
      cell: ({ row, table }) => {
        const m = meta(table)
        if (!m.canEdit) return null
        return (
          <div className="flex justify-end gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Flag transaction"
                  className="@max-[62rem]/main:hidden"
                >
                  <FlagIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {FLAGS.map((f) => (
                  <DropdownMenuItem
                    key={f}
                    onSelect={() => m.onFlag(row.original, f)}
                  >
                    <span
                      aria-hidden
                      className="inline-block size-2.5 rounded-full"
                      style={{ background: FLAG_COLORS[f] }}
                    />
                    <span className="capitalize">{f}</span>
                  </DropdownMenuItem>
                ))}
                {row.original.flag ? (
                  <DropdownMenuItem
                    onSelect={() => m.onFlag(row.original, null)}
                  >
                    No flag
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            {!row.original.approved ? (
              <Button
                variant="outline"
                size="sm"
                aria-label="Approve transaction"
                onClick={() => m.onApprove(row.original)}
              >
                <CheckCheckIcon />{' '}
                <span className="@max-[62rem]/main:hidden">Approve</span>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={
                row.original.cleared === 'reconciled'
                  ? 'Edit reconciled transaction'
                  : 'Edit transaction'
              }
              onClick={() => m.onEdit(row.original.id)}
            >
              <PencilIcon />
            </Button>
          </div>
        )
      },
    }),
  ]
}
