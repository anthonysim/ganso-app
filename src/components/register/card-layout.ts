/**
 * Below this content width the register table is shown as a list of cards: each <tr> becomes a
 * grid and its cells are placed by column. The markup stays one table, so selection, keyboard
 * navigation and the columns are shared by both layouts.
 */
export const TABLE = '@max-[62rem]/main:block'

export const CARD_ROW =
  '@max-[62rem]/main:grid @max-[62rem]/main:grid-cols-[auto_minmax(0,1fr)_auto_auto] @max-[62rem]/main:items-center @max-[62rem]/main:gap-x-2 @max-[62rem]/main:px-2 @max-[62rem]/main:py-1.5'

/** A row with a single full-width cell. */
export const WIDE_ROW = '@max-[62rem]/main:block'
export const WIDE_CELL = '@max-[62rem]/main:block'

const DETAIL =
  '@max-[62rem]/main:text-muted-foreground @max-[62rem]/main:p-0 @max-[62rem]/main:text-xs'

/** Card position per column id. */
export const CELL: Record<string, string | undefined> = {
  select:
    '@max-[62rem]/main:col-start-1 @max-[62rem]/main:row-start-1 @max-[62rem]/main:flex @max-[62rem]/main:p-1',
  payeeName:
    '@max-[62rem]/main:col-start-2 @max-[62rem]/main:row-start-1 @max-[62rem]/main:p-0 @max-[62rem]/main:wrap-anywhere',
  outflow:
    '@max-[62rem]/main:col-start-3 @max-[62rem]/main:row-start-1 @max-[62rem]/main:p-0',
  inflow:
    '@max-[62rem]/main:col-start-3 @max-[62rem]/main:row-start-1 @max-[62rem]/main:p-0',
  cleared:
    '@max-[62rem]/main:col-start-4 @max-[62rem]/main:row-start-1 @max-[62rem]/main:p-1',
  categoryName: `@max-[62rem]/main:col-start-2 @max-[62rem]/main:row-start-2 ${DETAIL}`,
  date: `@max-[62rem]/main:col-start-3 @max-[62rem]/main:row-start-2 @max-[62rem]/main:text-right ${DETAIL}`,
  actions:
    '@max-[62rem]/main:col-start-4 @max-[62rem]/main:row-start-2 @max-[62rem]/main:p-0',
  accountName: `@max-[62rem]/main:col-span-2 @max-[62rem]/main:col-start-2 @max-[62rem]/main:row-start-3 ${DETAIL}`,
  memo: `@max-[62rem]/main:col-span-2 @max-[62rem]/main:col-start-2 @max-[62rem]/main:row-start-4 @max-[62rem]/main:wrap-anywhere ${DETAIL}`,
  balance: '@max-[62rem]/main:hidden',
}
