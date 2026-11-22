import {
  createFileRoute,
  getRouteApi,
  useRouterState,
} from '@tanstack/react-router'
import { BarList } from '#/components/reports/bar-list'
import {
  ChartCard,
  DataTable,
  EmptyState,
} from '#/components/reports/chart-card'
import { GroupedColumns } from '#/components/reports/grouped-columns'
import { LineChart } from '#/components/reports/line-chart'
import { ReportsFilters } from '#/components/reports/reports-filters'
import type { ReportFilters } from '#/components/reports/reports-filters'
import { StatTile } from '#/components/reports/stat-tile'
import { RANGE_PRESETS, rangeFromPreset } from '#/domain/reports'
import type { RangePreset } from '#/domain/reports'
import { formatAxisAmount, shortMonth } from '#/lib/chart'
import { todayString } from '#/lib/date'
import { formatMilliunits } from '#/lib/money'
import { GROUP_BYS, GROUP_BY_LABELS } from '#/lib/reports'
import type { GroupBy } from '#/lib/reports'
import { cn } from '#/lib/utils'
import { loadReports } from '#/server/reports'

interface ReportsSearch {
  range: RangePreset
  from?: string
  to?: string
  account?: string
  groupBy: GroupBy
}

const isDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isUuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

export const Route = createFileRoute('/_authed/budgets/$budgetId/reports')({
  validateSearch: (search: Record<string, unknown>): ReportsSearch => ({
    range: RANGE_PRESETS.find((r) => r === search.range) ?? '6m',
    from: isDate(search.from) ? search.from : undefined,
    to: isDate(search.to) ? search.to : undefined,
    account: isUuid(search.account) ? search.account : undefined,
    groupBy: GROUP_BYS.find((g) => g === search.groupBy) ?? 'category',
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => {
    const custom = deps.range === 'custom' && deps.from && deps.to
    const range = custom
      ? { from: deps.from ?? null, to: deps.to ?? todayString() }
      : rangeFromPreset(
          deps.range === 'custom' ? '6m' : deps.range,
          todayString(),
        )
    return loadReports({
      data: {
        budgetId: params.budgetId,
        from: range.from,
        to: range.to,
        accountId: deps.account,
        groupBy: deps.groupBy,
      },
    })
  },
  component: ReportsPage,
})

const layout = getRouteApi('/_authed/budgets/$budgetId')

function ReportsPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { budget, accounts } = layout.useLoaderData()
  const loading = useRouterState({ select: (s) => s.isLoading })
  const c = budget.currency
  const dollars = (v: number) => formatMilliunits(v, c)
  const compact = (v: number) => formatAxisAmount(v, c)

  const nw = data.netWorth
  const nwFirst = nw[0]
  const nwLast = nw.at(-1)
  const nwChange = nwFirst && nwLast ? nwLast.net - nwFirst.net : 0
  const aom = data.ageOfMoney
  const aomValues = aom.series.flatMap((s) => (s.days === null ? [] : [s.days]))
  const aomChange =
    aomValues.length > 1 ? (aomValues.at(-1) ?? 0) - (aomValues[0] ?? 0) : 0
  const sinceLabel = nwFirst ? shortMonth(nwFirst.month, true) : ''

  const filters: ReportFilters = search
  const hasFlow = data.incomeExpense.some((r) => r.income > 0 || r.expense > 0)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 @xl/main:p-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <ReportsFilters
        value={filters}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        onChange={(patch) =>
          void navigate({ search: (prev) => ({ ...prev, ...patch }) })
        }
      />

      <div
        className={cn(
          'flex flex-col gap-4 transition-opacity',
          loading && 'opacity-60',
        )}
        aria-busy={loading}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile
            label="Net worth"
            value={nwLast ? dollars(nwLast.net) : '—'}
            delta={
              nwFirst && nw.length > 1
                ? {
                    text: `${nwChange >= 0 ? '+' : '-'}${dollars(Math.abs(nwChange))} since ${sinceLabel}`,
                    direction:
                      nwChange > 0 ? 'up' : nwChange < 0 ? 'down' : 'flat',
                    good: nwChange >= 0,
                  }
                : null
            }
          />
          <StatTile
            label="Age of Money"
            value={aom.current === null ? '—' : `${aom.current} days`}
            delta={
              aomValues.length > 1
                ? {
                    text: `${aomChange >= 0 ? '+' : '-'}${Math.abs(aomChange)} days since ${sinceLabel}`,
                    direction:
                      aomChange > 0 ? 'up' : aomChange < 0 ? 'down' : 'flat',
                    good: aomChange >= 0,
                  }
                : null
            }
          />
        </div>

        <ChartCard
          title={`Spending by ${GROUP_BY_LABELS[search.groupBy].toLowerCase()}`}
          caption={`${dollars(data.spending.total)} spent, largest first`}
          chart={
            data.spending.rows.length === 0 ? (
              <EmptyState>No spending in this range.</EmptyState>
            ) : (
              <BarList
                rows={data.spending.rows}
                total={data.spending.total}
                currency={c}
                ariaLabel={`Spending by ${GROUP_BY_LABELS[search.groupBy].toLowerCase()}`}
              />
            )
          }
          table={
            <DataTable
              columns={[GROUP_BY_LABELS[search.groupBy], 'Spent', 'Share']}
              rows={data.spending.rows.map((r) => [
                r.label,
                dollars(r.amount),
                `${data.spending.total > 0 ? Math.round((r.amount / data.spending.total) * 100) : 0}%`,
              ])}
            />
          }
        />

        <ChartCard
          title="Income vs expense"
          caption="By month: money in (Ready to Assign) against category spending"
          chart={
            hasFlow ? (
              <GroupedColumns
                rows={data.incomeExpense.map((r) => ({
                  month: r.month,
                  a: r.income,
                  b: r.expense,
                }))}
                aLabel="Income"
                bLabel="Expense"
                currency={c}
                ariaLabel="Income and expense by month"
              />
            ) : (
              <EmptyState>No income or spending in this range.</EmptyState>
            )
          }
          table={
            <DataTable
              columns={['Month', 'Income', 'Expense', 'Net']}
              rows={data.incomeExpense.map((r) => [
                shortMonth(r.month, true),
                dollars(r.income),
                dollars(r.expense),
                dollars(r.income - r.expense),
              ])}
            />
          }
        />

        <ChartCard
          title="Net worth"
          caption="Balance of all accounts at the end of each month"
          chart={
            <LineChart
              points={nw.map((p) => ({ month: p.month, value: p.net }))}
              seriesLabel="Net worth"
              format={dollars}
              formatAxis={compact}
              ariaLabel="Net worth over time"
            />
          }
          table={
            <DataTable
              columns={['Month', 'Assets', 'Liabilities', 'Net worth']}
              rows={nw.map((p) => [
                shortMonth(p.month, true),
                dollars(p.assets),
                dollars(p.liabilities),
                dollars(p.net),
              ])}
            />
          }
        />

        <ChartCard
          title="Age of Money"
          caption="How long, on average, the dollars you spend had been sitting (last 10 spends)"
          chart={
            aomValues.length === 0 ? (
              <EmptyState>Not enough spending history yet.</EmptyState>
            ) : (
              <LineChart
                points={aom.series.map((s) => ({
                  month: s.month,
                  value: s.days,
                }))}
                seriesLabel="Age of Money"
                format={(v) => `${v} days`}
                formatAxis={(v) => `${v}d`}
                ariaLabel="Age of Money over time"
              />
            )
          }
          table={
            <DataTable
              columns={['Month', 'Age of Money']}
              rows={aom.series.map((s) => [
                shortMonth(s.month, true),
                s.days === null ? '—' : `${s.days} days`,
              ])}
            />
          }
        />
      </div>
    </div>
  )
}
