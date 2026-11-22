import type { ReactNode } from 'react'

/**
 * The budget table has three layouts, by content width (@container/main):
 * - @3xl and up: every column, with row actions as icons
 * - @md to @3xl (tablets): Activity moves under the name, row actions move into a menu
 * - below @md (phones): each row is a card, name and Available above Activity and Assigned
 */
export const CARD_ROW =
  '@max-md/main:grid @max-md/main:grid-cols-[minmax(0,1fr)_auto_2.5rem] @max-md/main:items-center'

export const AVAILABLE_CELL =
  '@max-md/main:col-start-2 @max-md/main:row-start-1'

export const ASSIGNED_CELL = '@max-md/main:col-start-2 @max-md/main:row-start-2'

export const ACTIVITY_CELL =
  '@md/main:@max-3xl/main:hidden @max-md/main:col-start-1 @max-md/main:row-start-2 @max-md/main:text-left @max-md/main:text-xs'

export const ACTIONS_CELL =
  '@max-md/main:col-start-3 @max-md/main:row-span-2 @max-md/main:row-start-1'

/** Names a value whose column heading is hidden in the card layout. */
export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted-foreground mr-1 font-normal @md/main:hidden">
      {children}
    </span>
  )
}
