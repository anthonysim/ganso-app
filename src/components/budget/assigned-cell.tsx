import { useRef, useState } from 'react'
import { evalAssignedInput } from '#/lib/assign-expression'
import { Money } from '#/components/accounts/money'
import { cn } from '#/lib/utils'

function plain(milli: number): string {
  return (milli / 1000).toFixed(2)
}

/**
 * Editable Assigned amount. Accepts expressions ("+50", "*2", "100+25").
 * Commits on Enter or blur; Escape reverts. Remounts (via key) when the saved value changes.
 * Below @md/main, displays as plain text until double-clicked/tapped to edit.
 */
export function AssignedCell({
  name,
  assigned,
  currency,
  canEdit,
  onCommit,
}: {
  name: string
  assigned: number
  currency: string
  canEdit: boolean
  /** Called with the new absolute milliunits when the value changed. */
  onCommit: (next: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const lastTapRef = useRef(0)

  if (!canEdit) {
    return <Money value={assigned} currency={currency} />
  }

  function commit(input: HTMLInputElement) {
    const next = evalAssignedInput(input.value, assigned)
    if (next === null) {
      input.value = plain(assigned)
      input.setAttribute('aria-invalid', 'true')
      setEditing(false)
      return
    }
    input.removeAttribute('aria-invalid')
    input.value = plain(next)
    setEditing(false)
    if (next !== assigned) onCommit(next)
  }

  function startEditing() {
    lastTapRef.current = 0
    setEditing(true)
  }

  const input = (
    <input
      key={`${assigned}-${editing}`}
      ref={
        editing
          ? (el) => {
              if (el) {
                el.focus()
                el.select()
              }
            }
          : undefined
      }
      aria-label={`Assigned for ${name}`}
      inputMode="decimal"
      autoComplete="off"
      defaultValue={plain(assigned)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => commit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.currentTarget.value = plain(assigned)
          e.currentTarget.blur()
        }
      }}
      className={cn(
        'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-[invalid=true]:border-destructive -mr-[9px] h-8 w-28 rounded-md border px-2 text-right text-sm tabular-nums shadow-xs outline-none focus-visible:ring-[3px]',
        editing
          ? '@max-md/main:mr-0 @max-md/main:h-7 @max-md/main:w-20 @max-md/main:px-1.5'
          : '@max-md/main:hidden',
      )}
    />
  )

  if (editing) {
    return input
  }

  return (
    <>
      {input}
      <button
        type="button"
        aria-label={`Assigned for ${name}, double-tap to edit`}
        title="Double-click to edit"
        onDoubleClick={startEditing}
        onPointerUp={(e) => {
          if (e.pointerType !== 'touch') return
          const now = Date.now()
          if (now - lastTapRef.current < 350) {
            startEditing()
          } else {
            lastTapRef.current = now
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            startEditing()
          }
        }}
        className="hover:bg-muted/60 focus-visible:ring-ring/50 -mr-1 inline-flex touch-manipulation items-center justify-end rounded px-1 py-0.5 text-right text-sm tabular-nums outline-none select-none focus-visible:ring-[3px] @md/main:hidden"
      >
        <Money value={assigned} currency={currency} />
      </button>
    </>
  )
}
