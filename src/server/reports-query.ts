import { sql } from 'drizzle-orm'
import { db } from '#/db'
import {
  ageOfMoneyAt,
  ageOfMoneyTimeline,
  foldTopN,
  monthsInRange,
  netWorthSeries,
} from '#/domain/reports'
import type { GroupBy, ReportsData } from '#/lib/reports'

// Server-only query helpers (no createServerFn; see accounts-query.ts for why).

const SPENDING_ROWS = 8

/**
 * Split-aware transaction lines: a split parent is replaced by its lines. Transfers keep their
 * transfer flag so the payee report can label them.
 */
function linesCte(budgetId: string) {
  return sql`
    lines as (
      select t.account_id, t.date, t.category_id, t.amount, t.payee_id,
             (t.transfer_transaction_id is not null) as is_transfer
      from transactions t
      where t.budget_id = ${budgetId}
        and not exists (select 1 from subtransactions s where s.transaction_id = t.id)
      union all
      select t.account_id, t.date, s.category_id, s.amount, t.payee_id, false
      from subtransactions s
      join transactions t on t.id = s.transaction_id and t.budget_id = s.budget_id
      where s.budget_id = ${budgetId}
    )`
}

export async function queryReports(params: {
  budgetId: string
  from: string | null
  to: string
  accountId?: string
  groupBy: GroupBy
}): Promise<ReportsData> {
  const { budgetId, to, accountId, groupBy } = params
  const accountFilter = accountId ? sql`and l.account_id = ${accountId}` : sql``

  // "all time" starts at the first transaction
  let from = params.from
  if (!from) {
    const { rows } = await db().execute(
      sql`select min(date)::text as d from transactions where budget_id = ${budgetId}`,
    )
    from =
      ((rows[0] as { d: string | null } | undefined)?.d ?? to).slice(0, 7) +
      '-01'
  }
  const months = monthsInRange(from, to)
  const start = months[0] ?? from
  const rangeStart = start

  const label =
    groupBy === 'category'
      ? sql`c.name`
      : groupBy === 'group'
        ? sql`g.name`
        : sql`case when l.is_transfer then 'Transfer' else coalesce(p.name, 'No payee') end`

  const [spendingResult, flowResult, netResult, openingResult, eventResult] =
    await Promise.all([
      db().execute(sql`
        with ${linesCte(budgetId)}
        select ${label} as label, (-sum(l.amount))::float8 as amount
        from lines l
        join accounts a on a.id = l.account_id and a.on_budget
        join categories c on c.id = l.category_id and c.system_kind is null
        join category_groups g on g.id = c.group_id
        left join payees p on p.id = l.payee_id
        where l.date >= ${rangeStart} and l.date <= ${to} ${accountFilter}
        group by 1
        having -sum(l.amount) > 0
      `),
      db().execute(sql`
        with ${linesCte(budgetId)}
        select to_char(l.date, 'YYYY-MM-01') as month,
               coalesce(sum(case when c.system_kind = 'inflow' and lower(coalesce(p.name, '')) <> 'starting balance' then l.amount else 0 end), 0)::float8 as income,
               coalesce(-sum(case when c.system_kind is null then l.amount else 0 end), 0)::float8 as expense
        from lines l
        join accounts a on a.id = l.account_id and a.on_budget
        join categories c on c.id = l.category_id
        left join payees p on p.id = l.payee_id
        where l.date >= ${rangeStart} and l.date <= ${to} ${accountFilter}
        group by 1
      `),
      db().execute(sql`
        select to_char(t.date, 'YYYY-MM-01') as month,
               coalesce(sum(case when a.type in ('credit_card','line_of_credit','liability','mortgage','loan') then 0 else t.amount end), 0)::float8 as assets,
               coalesce(sum(case when a.type in ('credit_card','line_of_credit','liability','mortgage','loan') then t.amount else 0 end), 0)::float8 as liabilities
        from transactions t
        join accounts a on a.id = t.account_id
        where t.budget_id = ${budgetId} and t.date >= ${rangeStart} and t.date <= ${to}
          ${accountId ? sql`and t.account_id = ${accountId}` : sql``}
        group by 1
      `),
      db().execute(sql`
        select coalesce(sum(case when a.type in ('credit_card','line_of_credit','liability','mortgage','loan') then 0 else t.amount end), 0)::float8 as assets,
               coalesce(sum(case when a.type in ('credit_card','line_of_credit','liability','mortgage','loan') then t.amount else 0 end), 0)::float8 as liabilities
        from transactions t
        join accounts a on a.id = t.account_id
        where t.budget_id = ${budgetId} and t.date < ${rangeStart}
          ${accountId ? sql`and t.account_id = ${accountId}` : sql``}
      `),
      // Age of Money uses cash movements in on-budget asset accounts: not transfers between
      // them (except credit card payments, which are categorized), and never tracking accounts.
      db().execute(sql`
        select to_char(t.date, 'YYYY-MM-DD') as date, t.amount::float8 as amount
        from transactions t
        join accounts a on a.id = t.account_id
        where t.budget_id = ${budgetId}
          and a.on_budget
          and a.type not in ('credit_card', 'line_of_credit')
          and (t.transfer_transaction_id is null or t.category_id is not null)
        order by t.date, t.created_at
      `),
    ])

  const spending = foldTopN(
    (
      spendingResult.rows as unknown as Array<{ label: string; amount: number }>
    ).map((r) => ({ label: r.label, amount: r.amount })),
    SPENDING_ROWS,
  )

  const flowBy = new Map(
    (
      flowResult.rows as unknown as Array<{
        month: string
        income: number
        expense: number
      }>
    ).map((r) => [r.month, r]),
  )
  const incomeExpense = months.map((month) => ({
    month,
    income: flowBy.get(month)?.income ?? 0,
    expense: flowBy.get(month)?.expense ?? 0,
  }))

  const opening = (openingResult.rows[0] ?? { assets: 0, liabilities: 0 }) as {
    assets: number
    liabilities: number
  }
  const netWorth = netWorthSeries(
    opening,
    netResult.rows as unknown as Array<{
      month: string
      assets: number
      liabilities: number
    }>,
    months,
  )

  const timeline = ageOfMoneyTimeline(
    eventResult.rows as unknown as Array<{ date: string; amount: number }>,
  )
  const lastDay = (month: string) => {
    const [y = 0, m = 1] = month.split('-').map(Number)
    return `${y}-${String(m).padStart(2, '0')}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
  }
  const series = months.map((month) => ({
    month,
    days: ageOfMoneyAt(timeline, lastDay(month)),
  }))

  return {
    from: rangeStart,
    to,
    months,
    spending: {
      rows: spending,
      total: spending.reduce((s, r) => s + r.amount, 0),
    },
    incomeExpense,
    netWorth,
    ageOfMoney: {
      current: ageOfMoneyAt(timeline, to),
      series,
    },
  }
}
