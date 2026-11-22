import { Link } from '@tanstack/react-router'
import {
  BarChart3Icon,
  CalendarClockIcon,
  LandmarkIcon,
  ListTreeIcon,
  ReplaceIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '#/components/ui/sidebar'
import { SidebarAccounts } from '#/components/layout/sidebar-accounts'
import type { AccountWithBalances } from '#/server/accounts-query'
import type { BudgetSummary } from '#/components/budgets/budget-types'

const NAV = [
  { to: '/budgets/$budgetId/budget', label: 'Budget', icon: WalletIcon },
  { to: '/budgets/$budgetId/reports', label: 'Reports', icon: BarChart3Icon },
  {
    to: '/budgets/$budgetId/categories',
    label: 'Categories',
    icon: ListTreeIcon,
  },
  {
    to: '/budgets/$budgetId/members',
    label: 'Sharing',
    icon: UsersIcon,
  },
  {
    to: '/budgets/$budgetId/payee-rules',
    label: 'Payee rules',
    icon: ReplaceIcon,
  },
  {
    to: '/budgets/$budgetId/scheduled',
    label: 'Scheduled',
    icon: CalendarClockIcon,
  },
  {
    to: '/budgets/$budgetId/accounts',
    label: 'All Accounts',
    icon: LandmarkIcon,
    exact: true,
  },
] as const

export function AppSidebar({
  budget,
  accounts,
}: {
  budget: BudgetSummary
  accounts: Array<AccountWithBalances>
}) {
  const { setOpenMobile } = useSidebar()
  return (
    <Sidebar
      variant="floating"
      collapsible="icon"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]"
    >
      {/* Same left edge and size as the nav icons below, so the button stays put when collapsing. */}
      <SidebarHeader className="flex-row items-center justify-start">
        <SidebarTrigger aria-label="Toggle sidebar" className="size-8" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ to, label, icon: Icon, ...rest }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    asChild
                    tooltip={label}
                    className="pointer-coarse:h-10 group-data-[collapsible=icon]:pointer-coarse:h-8"
                  >
                    <Link
                      to={to}
                      params={{ budgetId: budget.id }}
                      onClick={() => setOpenMobile(false)}
                      activeProps={{ 'data-active': true }}
                      activeOptions={{ exact: 'exact' in rest }}
                    >
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarAccounts budget={budget} accounts={accounts} />
      </SidebarContent>
    </Sidebar>
  )
}
