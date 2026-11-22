import { useImperativeHandle, useMemo, useState } from 'react'
import type { Ref } from 'react'
import { ConfirmDialog } from '#/components/categories/confirm-dialog'
import { TransactionDialog } from '#/components/register/transaction-dialog'
import type { CategoryGroupRow } from '#/server/categories-query'
import type {
  PayeeRow,
  SplitRow,
  TransactionRow,
} from '#/server/transactions-query'

export interface TransactionEditorHandle {
  /** Open the dialog for a transaction id, or 'new' to add one. */
  open: (id: string | 'new') => void
}

interface AccountOption {
  id: string
  name: string
  onBudget: boolean
  closed: boolean
}

/**
 * Owns the add/edit dialog state (and the reconciled-edit confirmation) so opening a dialog
 * does not re-render the whole register table. Open it through the ref.
 */
export function TransactionEditor({
  ref,
  budgetId,
  currency,
  fixedAccountId,
  accounts,
  transactions,
  splits,
  payees,
  categoryGroups,
  inflowCategoryId,
}: {
  ref: Ref<TransactionEditorHandle>
  budgetId: string
  currency: string
  fixedAccountId?: string
  accounts: Array<AccountOption>
  transactions: Array<TransactionRow>
  splits: Array<SplitRow>
  payees: Array<PayeeRow>
  categoryGroups: Array<CategoryGroupRow>
  inflowCategoryId: string | null
}) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [confirmEditId, setConfirmEditId] = useState<string | null>(null)
  const [editingReconciled, setEditingReconciled] = useState(false)

  useImperativeHandle(ref, () => ({
    open(id) {
      const t = id === 'new' ? undefined : transactions.find((x) => x.id === id)
      if (t?.cleared === 'reconciled') {
        setConfirmEditId(id)
      } else {
        setEditingReconciled(false)
        setEditingId(id)
      }
    },
  }))

  const splitsByTxn = useMemo(() => {
    const map = new Map<string, Array<SplitRow>>()
    for (const sp of splits) {
      const list = map.get(sp.transactionId) ?? []
      list.push(sp)
      map.set(sp.transactionId, list)
    }
    return map
  }, [splits])

  const editingTransaction =
    editingId !== null && editingId !== 'new'
      ? transactions.find((t) => t.id === editingId)
      : undefined

  return (
    <>
      {editingId !== null && (editingId === 'new' || editingTransaction) ? (
        <TransactionDialog
          key={editingId}
          open
          onOpenChange={(open) => {
            if (!open) setEditingId(null)
          }}
          budgetId={budgetId}
          fixedAccountId={fixedAccountId}
          accounts={accounts}
          payees={payees}
          categoryGroups={categoryGroups}
          inflowCategoryId={inflowCategoryId}
          currency={currency}
          transaction={editingTransaction}
          existingSplits={
            editingTransaction
              ? splitsByTxn.get(editingTransaction.id)
              : undefined
          }
          confirmReconciled={editingReconciled}
        />
      ) : null}
      <ConfirmDialog
        open={confirmEditId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmEditId(null)
        }}
        title="Edit a reconciled transaction?"
        description="This transaction is reconciled. Changing it can make your balance differ from your bank. Edit anyway?"
        confirmLabel="Edit anyway"
        onConfirm={() => {
          setEditingReconciled(true)
          setEditingId(confirmEditId)
          setConfirmEditId(null)
        }}
      />
    </>
  )
}
