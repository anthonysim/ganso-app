import { useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { NotebookPenIcon } from 'lucide-react'
import { toast } from 'sonner'
import { textareaClass } from '#/components/categories/note-dialog'
import { Button } from '#/components/ui/button'
import { saveMonthNote } from '#/server/budget-month'

/** Collapsible free-text note for the month. Saves when the field loses focus. */
export function MonthNote({
  budgetId,
  month,
  note,
  canEdit,
  actions,
}: {
  budgetId: string
  month: string
  note: string | null
  canEdit: boolean
  /** Optional toolbar actions placed opposite the note trigger. */
  actions?: ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const showTrigger = Boolean(note) || canEdit

  if (!showTrigger && !actions) return null

  function save(value: string) {
    const next = value.trim()
    if (next === (note ?? '')) return
    startTransition(async () => {
      try {
        await saveMonthNote({ data: { budgetId, month, note: next } })
        await router.invalidate()
        toast.success(next ? 'Note saved' : 'Note removed')
      } catch {
        toast.error('Could not save the note')
      }
    })
  }

  return (
    <>
      {showTrigger ? (
        <Button
          variant="ghost"
          size="sm"
          className="col-start-1 -ml-2 w-fit"
          aria-label={note ? 'Month note' : 'Add a note for this month'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <NotebookPenIcon />
          <span className="@max-md/main:hidden">
            {note ? 'Month note' : 'Add a note for this month'}
          </span>
          <span className="@md/main:hidden">
            {note ? 'Month note' : 'Note'}
          </span>
        </Button>
      ) : null}
      {actions}
      {!open && note ? (
        <p className="text-muted-foreground col-span-2 line-clamp-2 text-sm whitespace-pre-wrap">
          {note}
        </p>
      ) : null}
      {open ? (
        canEdit ? (
          <textarea
            // remount when the saved note or month changes so the field shows the new value
            key={`${month}-${note ?? ''}`}
            aria-label="Month note"
            className={`${textareaClass} col-span-2`}
            maxLength={2000}
            defaultValue={note ?? ''}
            onBlur={(e) => save(e.currentTarget.value)}
          />
        ) : (
          <p className="col-span-2 text-sm whitespace-pre-wrap">{note}</p>
        )
      ) : null}
    </>
  )
}
