import { useState, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import { ArrowLeftRightIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { MoneyInput } from '#/components/ui/money-input'
import { CategoryOptions } from '#/components/register/category-options'
import { NativeSelect } from '#/components/register/native-select'
import { todayString } from '#/lib/date'
import { parseMoneyExpression } from '#/lib/money'
import { dateSchema } from '#/lib/transactions'
import { createTransaction } from '#/server/transactions'
import type { CategoryGroupRow } from '#/server/categories-query'

interface AccountOption {
  id: string
  name: string
  onBudget: boolean
  closed: boolean
}

interface TransferProps {
  budgetId: string
  accounts: Array<AccountOption>
  /** Pre-selects the "From" account (the register's account). */
  defaultFromId?: string
  categoryGroups: Array<CategoryGroupRow>
  inflowCategoryId: string | null
}

/** "Transfer" toolbar button. Owns its open state so opening it does not re-render the register. */
export function TransferButton({
  className,
  ...props
}: TransferProps & { className?: string }) {
  const [open, setOpen] = useState(false)
  const openAccounts = props.accounts.filter((a) => !a.closed)
  if (openAccounts.length < 2) return null
  return (
    <>
      <Button
        variant="outline"
        className={className}
        onClick={() => setOpen(true)}
      >
        <ArrowLeftRightIcon /> Transfer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {/* mounted only while open, so the form starts fresh every time */}
          {open ? (
            <TransferForm
              {...props}
              accounts={openAccounts}
              onDone={() => setOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function TransferForm({
  budgetId,
  accounts,
  defaultFromId,
  categoryGroups,
  inflowCategoryId,
  onDone,
}: TransferProps & { onDone: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const initialFrom =
    accounts.find((a) => a.id === defaultFromId)?.id ?? accounts[0]?.id ?? ''
  const [fromId, setFromId] = useState(initialFrom)
  const [toId, setToId] = useState(
    accounts.find((a) => a.id !== initialFrom)?.id ?? '',
  )
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayString())
  const [memo, setMemo] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const from = accounts.find((a) => a.id === fromId)
  const to = accounts.find((a) => a.id === toId)
  // Only a transfer between an on-budget and a tracking account changes the budget,
  // so only then does the on-budget side need a category.
  const needsCategory =
    from !== undefined && to !== undefined && from.onBudget !== to.onBudget

  function changeFrom(id: string) {
    setFromId(id)
    // keep the two sides different
    if (id === toId) {
      setToId(accounts.find((a) => a.id !== id)?.id ?? '')
    }
  }

  function swap() {
    setFromId(toId)
    setToId(fromId)
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!from || !to) {
      setError('Choose both accounts')
      return
    }
    if (from.id === to.id) {
      setError('Choose two different accounts')
      return
    }
    if (!dateSchema.safeParse(date).success) {
      setError('Enter a valid date')
      return
    }
    const milli = parseMoneyExpression(amount)
    if (milli === null || milli <= 0) {
      setError('Enter an amount greater than zero, like 50.00')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await createTransaction({
          data: {
            budgetId,
            accountId: from.id,
            date,
            payeeName: '',
            categoryId: needsCategory && categoryId !== '' ? categoryId : null,
            transferAccountId: to.id,
            memo: memo.trim() === '' ? null : memo,
            amount: -milli,
            cleared: 'uncleared',
          },
        })
        await router.invalidate()
        toast.success('Transfer added', {
          description: `${from.name} → ${to.name}`,
        })
        onDone()
      } catch {
        setError('Could not save the transfer.')
      }
    })
  }

  return (
    <form method="post" onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Transfer between accounts</DialogTitle>
        <DialogDescription>
          Records an outflow from one account and a matching inflow in the
          other.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="grid gap-2">
          <Label htmlFor="transfer-from">From</Label>
          <NativeSelect
            id="transfer-from"
            value={fromId}
            onChange={(e) => changeFrom(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Swap accounts"
          onClick={swap}
        >
          <ArrowLeftRightIcon />
        </Button>
        <div className="grid gap-2">
          <Label htmlFor="transfer-to">To</Label>
          <NativeSelect
            id="transfer-to"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
          >
            {accounts
              .filter((a) => a.id !== fromId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="transfer-amount">Amount</Label>
          <MoneyInput
            id="transfer-amount"
            expressions
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="transfer-date">Date</Label>
          <Input
            id="transfer-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {needsCategory ? (
        <div className="grid gap-2">
          <Label htmlFor="transfer-category">Category</Label>
          <NativeSelect
            id="transfer-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <CategoryOptions
              groups={categoryGroups}
              inflowCategoryId={inflowCategoryId}
              selectedId={categoryId}
            />
          </NativeSelect>
          <p className="text-muted-foreground text-xs">
            Moving money to or from a tracking account counts as spending or
            income in your budget.
          </p>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="transfer-memo">Memo</Label>
        <Input
          id="transfer-memo"
          maxLength={500}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Transfer'}
        </Button>
      </DialogFooter>
    </form>
  )
}
