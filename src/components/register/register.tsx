import { Fragment, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { RowSelectionState } from '@tanstack/react-table'
import {
  CalendarClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { SearchInput } from '#/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { BulkBar } from '#/components/register/bulk-bar'
import { cn } from '#/lib/utils'
import {
  CARD_ROW,
  CELL,
  TABLE,
  WIDE_CELL,
  WIDE_ROW,
} from '#/components/register/card-layout'
import { buildColumns } from '#/components/register/columns'
import type { RegisterMeta } from '#/components/register/columns'
import { TransactionEditor } from '#/components/register/transaction-editor'
import type { TransactionEditorHandle } from '#/components/register/transaction-editor'
import { NativeSelect } from '#/components/register/native-select'
import {
  FLAGS,
  FLAG_COLORS,
  matchesSearch,
  runningBalances,
} from '#/lib/transactions'
import type { Flag } from '#/lib/transactions'
import { transferLabel } from '#/lib/transfers'
import { approveTransactions } from '#/server/import'
import {
  bulkUpdateTransactions,
  deleteTransactions,
  setTransactionFlag,
  updateTransaction,
} from '#/server/transactions'
import type { AccountWithBalances } from '#/server/accounts-query'
import type { CategoryGroupRow } from '#/server/categories-query'
import type { ScheduledListRow } from '#/server/scheduled-query'
import { UpcomingRows } from '#/components/register/upcoming-rows'
import type {
  PayeeRow,
  SplitRow,
  TransactionRow,
} from '#/server/transactions-query'
import { Money } from '#/components/accounts/money'

interface RegisterData {
  transactions: Array<TransactionRow>
  splits: Array<SplitRow>
  scheduled: Array<ScheduledListRow>
  payees: Array<PayeeRow>
  categoryGroups: Array<CategoryGroupRow>
  inflowCategoryId: string | null
}

type ClearedFilter = 'all' | 'uncleared' | 'cleared' | 'unapproved'

export function Register({
  budget,
  accounts,
  data,
  accountId,
  initialQuery = '',
}: {
  budget: { id: string; currency: string; dateFormat: string; role: string }
  accounts: Array<AccountWithBalances>
  data: RegisterData
  /** Set for a single-account register; omit for the all-accounts view. */
  accountId?: string
  /** Pre-fills the search box (from a global search result). */
  initialQuery?: string
}) {
  const router = useRouter()
  const canEdit = budget.role !== 'viewer'
  const singleAccount = accountId !== undefined
  const [query, setQuery] = useState(initialQuery)
  const [clearedFilter, setClearedFilter] = useState<ClearedFilter>('all')
  const [scheduledOpen, setScheduledOpen] = useState(false)
  const editor = useRef<TransactionEditorHandle>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [flagFilter, setFlagFilter] = useState<'all' | 'any' | Flag>('all')
  const [busy, startTransition] = useTransition()

  // Running balance is computed from the full list so filtering never changes it.
  const balances = useMemo(
    () => runningBalances(data.transactions),
    [data.transactions],
  )

  const splitsByTxn = useMemo(() => {
    const map = new Map<string, Array<SplitRow>>()
    for (const sp of data.splits) {
      const list = map.get(sp.transactionId) ?? []
      list.push(sp)
      map.set(sp.transactionId, list)
    }
    return map
  }, [data.splits])
  const splitCounts = useMemo(
    () => new Map([...splitsByTxn].map(([id, list]) => [id, list.length])),
    [splitsByTxn],
  )

  function requestEdit(id: string) {
    editor.current?.open(id)
  }

  // Newest first for display
  const rows = useMemo(
    () =>
      [...data.transactions]
        .reverse()
        .filter(
          (t) =>
            (clearedFilter === 'all' ||
              (clearedFilter === 'unapproved'
                ? !t.approved
                : clearedFilter === 'cleared'
                  ? t.cleared !== 'uncleared'
                  : t.cleared === 'uncleared')) &&
            (flagFilter === 'all' ||
              (flagFilter === 'any'
                ? t.flag !== null
                : t.flag === flagFilter)) &&
            matchesSearch(query, [
              t.payeeName,
              t.memo,
              t.categoryName,
              t.accountName,
            ]),
        ),
    [data.transactions, query, clearedFilter, flagFilter],
  )

  const columns = useMemo(
    () =>
      buildColumns({ showAccount: !singleAccount, showBalance: singleAccount }),
    [singleAccount],
  )

  function mutate(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action()
        await router.invalidate()
        setRowSelection({})
        toast.success(success)
      } catch {
        toast.error('Something went wrong. Try again.')
      }
    })
  }

  const tableMeta: RegisterMeta = {
    currency: budget.currency,
    dateFormat: budget.dateFormat,
    canEdit,
    inflowCategoryId: data.inflowCategoryId,
    balances,
    splitCounts,
    onEdit: requestEdit,
    onFlag: (t, flag) =>
      mutate(
        () =>
          setTransactionFlag({
            data: { budgetId: budget.id, transactionIds: [t.id], flag },
          }),
        flag ? `Flagged ${flag}` : 'Flag removed',
      ),
    onApprove: (t) =>
      mutate(
        () =>
          approveTransactions({
            data: { budgetId: budget.id, transactionIds: [t.id] },
          }),
        'Approved',
      ),
    onToggleCleared: (t) =>
      mutate(
        () =>
          updateTransaction({
            data: {
              budgetId: budget.id,
              transactionId: t.id,
              accountId: t.accountId,
              date: t.date,
              payeeName: t.payeeName ?? '',
              categoryId: t.categoryId,
              transferAccountId: t.transferAccountId,
              memo: t.memo,
              amount: t.amount,
              cleared: t.cleared === 'cleared' ? 'uncleared' : 'cleared',
            },
          }),
        t.cleared === 'cleared' ? 'Marked uncleared' : 'Marked cleared',
      ),
  }

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: (row) =>
      canEdit && row.original.cleared !== 'reconciled',
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    meta: tableMeta,
  })

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])
  const columnCount = table.getVisibleLeafColumns().length

  function moveFocus(
    e: React.KeyboardEvent<HTMLTableRowElement>,
    row: TransactionRow,
  ) {
    if (e.target !== e.currentTarget) return
    const el = e.currentTarget
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      ;(el.nextElementSibling as HTMLElement | null)?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      ;(el.previousElementSibling as HTMLElement | null)?.focus()
    } else if (e.key === 'Enter' && canEdit) {
      e.preventDefault()
      requestEdit(row.id)
    } else if (e.key === ' ' && canEdit && row.cleared !== 'reconciled') {
      e.preventDefault()
      setRowSelection((s) => ({ ...s, [row.id]: !s[row.id] }))
    }
  }

  return (
    <section aria-label="Transactions" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          aria-label="Search transactions"
          placeholder="Search payee, memo, category…"
          className="@xl/main:max-w-xs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
        />
        <NativeSelect
          aria-label="Filter by cleared status"
          className="w-40 @max-xl/main:flex-1"
          value={clearedFilter}
          onChange={(e) => setClearedFilter(e.target.value as ClearedFilter)}
        >
          <option value="all">All</option>
          <option value="uncleared">Uncleared</option>
          <option value="cleared">Cleared</option>
          <option value="unapproved">Needs approval</option>
        </NativeSelect>
        <Select
          value={flagFilter}
          onValueChange={(v) => setFlagFilter(v as 'all' | 'any' | Flag)}
        >
          <SelectTrigger
            aria-label="Filter by flag"
            size="sm"
            className="w-40 @max-xl/main:flex-1"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All flags</SelectItem>
            <SelectItem value="any">Any flag</SelectItem>
            {FLAGS.map((f) => (
              <SelectItem key={f} value={f}>
                <span
                  aria-hidden
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: FLAG_COLORS[f] }}
                />
                <span className="capitalize">{f} flag</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit ? (
          <Button
            className="ml-auto @max-xl/main:w-full"
            onClick={() => editor.current?.open('new')}
          >
            <PlusIcon /> Add transaction
          </Button>
        ) : null}
      </div>

      {selectedIds.length > 0 ? (
        <BulkBar
          count={selectedIds.length}
          categoryGroups={data.categoryGroups}
          inflowCategoryId={data.inflowCategoryId}
          busy={busy}
          onClear={() => setRowSelection({})}
          onFlag={(flag) =>
            mutate(
              () =>
                setTransactionFlag({
                  data: {
                    budgetId: budget.id,
                    transactionIds: selectedIds,
                    flag,
                  },
                }),
              'Flags updated',
            )
          }
          onApprove={() =>
            mutate(
              () =>
                approveTransactions({
                  data: { budgetId: budget.id, transactionIds: selectedIds },
                }),
              'Approved',
            )
          }
          onCategorize={(categoryId) =>
            mutate(
              () =>
                bulkUpdateTransactions({
                  data: {
                    budgetId: budget.id,
                    transactionIds: selectedIds,
                    categoryId,
                  },
                }),
              'Categories updated',
            )
          }
          onSetCleared={(cleared) =>
            mutate(
              () =>
                bulkUpdateTransactions({
                  data: {
                    budgetId: budget.id,
                    transactionIds: selectedIds,
                    cleared,
                  },
                }),
              'Transactions updated',
            )
          }
          onDelete={() =>
            mutate(
              () =>
                deleteTransactions({
                  data: { budgetId: budget.id, transactionIds: selectedIds },
                }),
              'Transactions deleted',
            )
          }
        />
      ) : null}

      <datalist id="register-payees">
        {accounts
          .filter((a) => !a.closed && a.id !== accountId)
          .map((a) => (
            <option key={`transfer-${a.id}`} value={transferLabel(a.name)} />
          ))}
        {data.payees.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>

      <div className="overflow-x-auto rounded-lg border">
        <table className={cn('w-full text-sm', TABLE)}>
          <thead
            className={cn('bg-muted/50 text-muted-foreground text-left', TABLE)}
          >
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className={WIDE_ROW}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className={cn(
                      'px-2 py-2 font-medium',
                      h.column.id === 'select'
                        ? '@max-[62rem]/main:block @max-[62rem]/main:px-3'
                        : '@max-[62rem]/main:hidden',
                    )}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className={TABLE}>
            {data.scheduled.length > 0 ? (
              <tr className={cn('bg-muted/50 border-t', WIDE_ROW)}>
                <td colSpan={columnCount} className={cn('p-0', WIDE_CELL)}>
                  <button
                    type="button"
                    aria-expanded={scheduledOpen}
                    onClick={() => setScheduledOpen((v) => !v)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left font-medium"
                  >
                    <CalendarClockIcon className="size-4" />
                    Scheduled Transactions ({data.scheduled.length})
                    {scheduledOpen ? (
                      <ChevronDownIcon className="size-4" />
                    ) : (
                      <ChevronRightIcon className="size-4" />
                    )}
                  </button>
                </td>
              </tr>
            ) : null}
            {scheduledOpen ? (
              <UpcomingRows
                scheduled={data.scheduled}
                accountId={accountId}
                budget={budget}
                accounts={accounts}
                payees={data.payees}
                categoryGroups={data.categoryGroups}
                inflowCategoryId={data.inflowCategoryId}
              />
            ) : null}
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  tabIndex={0}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  data-approved={row.original.approved}
                  onKeyDown={(e) => moveFocus(e, row.original)}
                  className={cn(
                    'data-[approved=false]:border-l-primary data-[approved=false]:border-l-4 data-[approved=false]:font-semibold data-[state=selected]:bg-muted/60 hover:bg-muted/30 focus-visible:ring-ring border-t outline-none focus-visible:ring-2 focus-visible:ring-inset',
                    CARD_ROW,
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn('px-2 py-1.5', CELL[cell.column.id])}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
                {(splitsByTxn.get(row.original.id) ?? []).map((sp) => (
                  <tr
                    key={sp.id}
                    data-testid="split-display-line"
                    className={cn(
                      'bg-muted/20 text-muted-foreground',
                      CARD_ROW,
                    )}
                  >
                    <td className="@max-[62rem]/main:hidden" />
                    {!singleAccount ? (
                      <td className="@max-[62rem]/main:hidden" />
                    ) : null}
                    <td className="@max-[62rem]/main:hidden" />
                    <td className="px-2 py-1 pl-6 text-xs @max-[62rem]/main:col-start-1">
                      Split
                    </td>
                    <td className="px-2 py-1 @max-[62rem]/main:col-start-2">
                      {sp.categoryName ?? 'Uncategorized'}
                    </td>
                    <td className="px-2 py-1 @max-[62rem]/main:col-start-2 @max-[62rem]/main:row-start-2 @max-[62rem]/main:py-0 @max-[62rem]/main:text-xs">
                      {sp.memo ?? ''}
                    </td>
                    <td className={cn('px-2 py-1 text-right', CELL.outflow)}>
                      {sp.amount < 0 ? (
                        <Money value={sp.amount} currency={budget.currency} />
                      ) : null}
                    </td>
                    <td className={cn('px-2 py-1 text-right', CELL.inflow)}>
                      {sp.amount > 0 ? (
                        <Money value={sp.amount} currency={budget.currency} />
                      ) : null}
                    </td>
                    <td className="@max-[62rem]/main:w-8" />
                    {singleAccount ? (
                      <td className="@max-[62rem]/main:hidden" />
                    ) : null}
                    <td className="@max-[62rem]/main:hidden" />
                  </tr>
                ))}
              </Fragment>
            ))}
            {rows.length === 0 ? (
              <tr className={WIDE_ROW}>
                <td
                  colSpan={columnCount}
                  className={cn(
                    'text-muted-foreground px-4 py-8 text-center',
                    WIDE_CELL,
                  )}
                >
                  {data.transactions.length === 0
                    ? 'No transactions yet.'
                    : 'No transactions match your filters.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TransactionEditor
        ref={editor}
        budgetId={budget.id}
        currency={budget.currency}
        fixedAccountId={accountId}
        accounts={accounts}
        transactions={data.transactions}
        splits={data.splits}
        payees={data.payees}
        categoryGroups={data.categoryGroups}
        inflowCategoryId={data.inflowCategoryId}
      />
    </section>
  )
}
