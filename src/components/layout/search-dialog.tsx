import { useEffect, useRef, useState, useTransition } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  LandmarkIcon,
  ListTreeIcon,
  ReceiptIcon,
  SearchIcon,
} from 'lucide-react'
import { Money } from '#/components/accounts/money'
import { useHotkey } from '#/hooks/use-hotkey'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { formatDateString } from '#/lib/date'
import type { SearchResults } from '#/lib/search'
import { searchBudget } from '#/server/search'

type Item =
  | { kind: 'account'; id: string; label: string; detail: string }
  | { kind: 'category'; id: string; label: string; detail: string }
  | {
      kind: 'transaction'
      id: string
      accountId: string
      label: string
      detail: string
      amount: number
      query: string
    }

function toItems(r: SearchResults, dateFormat: string): Array<Item> {
  return [
    ...r.accounts.map((a) => ({
      kind: 'account' as const,
      id: a.id,
      label: a.name,
      detail: 'Account',
    })),
    ...r.categories.map((c) => ({
      kind: 'category' as const,
      id: c.id,
      label: c.name,
      detail: c.groupName,
    })),
    ...r.transactions.map((t) => ({
      kind: 'transaction' as const,
      id: t.id,
      accountId: t.accountId,
      label: t.payeeName ?? t.memo ?? 'Transaction',
      detail: `${formatDateString(t.date, dateFormat)} · ${t.accountName}${t.categoryName ? ` · ${t.categoryName}` : ''}`,
      amount: t.amount,
      query: t.payeeName ?? t.memo ?? '',
    })),
  ]
}

/** Search accounts, categories and transactions. Open with the button or Cmd/Ctrl+K. */
export function SearchDialog({
  budgetId,
  currency,
  dateFormat,
}: {
  budgetId: string
  currency: string
  dateFormat: string
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Array<Item>>([])
  const [active, setActive] = useState(0)
  const [searched, setSearched] = useState('')
  const [, startTransition] = useTransition()
  const requestId = useRef(0)

  useHotkey('k', () => setOpen((o) => !o), { allowInInputs: true })

  // debounce typing, ignore results that arrive out of order
  useEffect(() => {
    const q = query.trim()
    if (q === '') {
      setItems([])
      setSearched('')
      return
    }
    const id = ++requestId.current
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const results = await searchBudget({ data: { budgetId, q } })
          if (id !== requestId.current) return
          setItems(toItems(results, dateFormat))
          setSearched(q)
          setActive(0)
        } catch {
          if (id === requestId.current) setItems([])
        }
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [query, budgetId, dateFormat])

  function choose(item: Item | undefined) {
    if (!item) return
    setOpen(false)
    if (item.kind === 'account') {
      void navigate({
        to: '/budgets/$budgetId/accounts/$accountId',
        params: { budgetId, accountId: item.id },
      })
    } else if (item.kind === 'category') {
      void navigate({
        to: '/budgets/$budgetId/categories',
        params: { budgetId },
      })
    } else {
      void navigate({
        to: '/budgets/$budgetId/accounts/$accountId',
        params: { budgetId, accountId: item.accountId },
        search: { q: item.query || undefined },
      })
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(items[active])
    }
  }

  const icon = (k: Item['kind']) =>
    k === 'account' ? (
      <LandmarkIcon />
    ) : k === 'category' ? (
      <ListTreeIcon />
    ) : (
      <ReceiptIcon />
    )

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label="Search"
        className="text-muted-foreground w-44 justify-start max-sm:size-9 max-sm:justify-center"
        onClick={() => setOpen(true)}
      >
        <SearchIcon /> <span className="max-sm:hidden">Search…</span>
        <kbd className="bg-muted ml-auto rounded px-1 text-[10px] max-sm:hidden pointer-coarse:hidden">
          ⌘K
        </kbd>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setQuery('')
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-[20%] translate-y-0 gap-3 p-4 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">
            Search accounts, categories and transactions
          </DialogDescription>
          <Input
            aria-label="Search accounts, categories and transactions"
            placeholder="Search payees, memos, categories, amounts…"
            autoFocus
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="search-results"
            aria-activedescendant={
              items[active] ? `search-item-${active}` : undefined
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <ul
            id="search-results"
            role="listbox"
            className="max-h-80 overflow-auto"
          >
            {items.map((it, i) => (
              <li
                key={`${it.kind}-${it.id}`}
                id={`search-item-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(it)}
                className="data-[active=true]:bg-accent flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm [&_svg]:size-4 [&_svg]:shrink-0"
                data-active={i === active}
              >
                {icon(it.kind)}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.label}</div>
                  <div className="text-muted-foreground truncate text-xs">
                    {it.detail}
                  </div>
                </div>
                {it.kind === 'transaction' ? (
                  <Money
                    value={it.amount}
                    currency={currency}
                    className="text-sm"
                  />
                ) : null}
              </li>
            ))}
          </ul>
          {searched !== '' && items.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-center text-sm">
              Nothing found for “{searched}”.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
