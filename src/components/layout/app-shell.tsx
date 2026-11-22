import type { CSSProperties, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Wordmark } from '#/components/layout/wordmark'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import { BudgetSwitcher } from '#/components/layout/budget-switcher'
import { AppSidebar } from '#/components/layout/app-sidebar'
import type { BudgetSummary } from '#/components/budgets/budget-types'
import type { AccountWithBalances } from '#/server/accounts-query'
import { SearchDialog } from '#/components/layout/search-dialog'
import { ShortcutsDialog } from '#/components/layout/shortcuts-dialog'
import { InvitesBanner } from '#/components/sharing/invites-banner'
import type { MyInvite } from '#/lib/sharing'
import { UserMenu } from '#/components/layout/user-menu'

export function AppShell({
  email,
  budget,
  budgets,
  accounts,
  invites,
  children,
}: {
  email: string
  budget: BudgetSummary & { dateFormat: string }
  budgets: Array<BudgetSummary>
  accounts: Array<AccountWithBalances>
  invites: Array<MyInvite>
  children: ReactNode
}) {
  return (
    <SidebarProvider
      className="bg-canvas h-svh flex-col overflow-hidden"
      style={{ '--header-height': '3.5rem' } as CSSProperties}
    >
      <header className="bg-canvas flex h-(--header-height) shrink-0 items-center gap-2 px-3 md:px-4">
        <div className="flex w-full min-w-0 items-center gap-1 sm:gap-2">
          {/* Desktop toggle lives in the sidebar; the sidebar is a sheet on mobile, so keep one here. */}
          <SidebarTrigger
            aria-label="Open sidebar"
            className="size-9 shrink-0 md:hidden"
          />
          <Link
            to="/budget"
            aria-label="ganso home"
            title="간소 · simplicity"
            className="shrink-0 rounded-md px-1 whitespace-nowrap sm:mr-1"
          >
            <Wordmark />
          </Link>
          <span
            aria-hidden
            className="bg-border hidden h-5 w-px shrink-0 sm:block"
          />
          <BudgetSwitcher current={budget} budgets={budgets} />
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <SearchDialog
              budgetId={budget.id}
              currency={budget.currency}
              dateFormat={budget.dateFormat}
            />
            <UserMenu email={email} />
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <AppSidebar budget={budget} accounts={accounts} />
        <SidebarInset className="m-2 min-h-0 md:m-3 min-w-0 md:ml-0 bg-background overflow-y-auto overscroll-contain rounded-xl border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {invites.length > 0 ? (
            <div className="px-4 pt-4 md:px-6">
              <InvitesBanner invites={invites} />
            </div>
          ) : null}
          {/* Pages size themselves to this box (@container/main), so an open sidebar counts. */}
          <div className="@container/main flex-1">{children}</div>
        </SidebarInset>
      </div>
      <ShortcutsDialog />
    </SidebarProvider>
  )
}
