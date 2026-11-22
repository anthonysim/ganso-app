import { addMonths } from '#/lib/month'
import { allocateProportionally } from '#/domain/allocate'
import type { MonthString } from '#/lib/month'

/**
 * Pure zero-based budgeting math. No I/O, all amounts are integer milliunits.
 *
 * Rules:
 * - Available(category, month) = carried-in + assigned + activity
 * - A positive Available carries into the next month. A negative one resets to 0.
 * - Overspending is "credit" up to the amount spent on credit accounts that month, the rest is "cash".
 *   Only cash overspending reduces Ready to Assign (from the NEXT month onward).
 *   Credit overspending becomes credit-card debt (handled by credit card payment categories, PR 10).
 * - Ready to Assign is one pool shared by every month: all income - all assigned - cash
 *   overspending, across every month with data. It does not matter which month the money was
 *   assigned in, so every month shows the same number.
 * - Credit card payment categories: spending on a card moves the FUNDED part (spend minus credit
 *   overspending) from the spending category into that card's payment category; refunds move it back.
 *   Payments (categorized transfers) are negative activity in the payment category.
 */

export interface AssignmentInput {
  categoryId: string
  month: MonthString
  assigned: number
}

/** Per credit account totals inside one category-month. */
export interface CreditAccountActivity {
  accountId: string
  /** Sum of the negative amounts on this account (<= 0). */
  spend: number
  /** Sum of the positive amounts on this account (>= 0). */
  refund: number
}

export interface ActivityInput {
  categoryId: string
  month: MonthString
  /** Net of all on-budget transactions in the category this month (outflows negative). */
  amount: number
  /** Sum of the negative amounts on credit accounts this month (<= 0). */
  creditAmount: number
  /** Optional per-account breakdown, needed to feed credit card payment categories. */
  credit?: ReadonlyArray<CreditAccountActivity>
}

export interface PaymentCategory {
  /** The payment category (must also be listed in categoryIds). */
  categoryId: string
  /** The credit card account it belongs to. */
  accountId: string
}

export interface IncomeInput {
  month: MonthString
  /** Net inflow-category (Ready to Assign) transactions this month. */
  amount: number
}

export interface BudgetMathInput {
  /** All user categories plus credit card payment categories (system inflow category excluded). */
  categoryIds: ReadonlyArray<string>
  /** Which of categoryIds are credit card payment categories. */
  paymentCategories?: ReadonlyArray<PaymentCategory>
  assignments: ReadonlyArray<AssignmentInput>
  activity: ReadonlyArray<ActivityInput>
  income: ReadonlyArray<IncomeInput>
}

export type OverspendKind = 'cash' | 'credit' | null

export interface CategoryMonth {
  carriedIn: number
  assigned: number
  activity: number
  available: number
  overspent: OverspendKind
}

export interface BudgetMonthResult {
  month: MonthString
  readyToAssign: number
  categories: Map<string, CategoryMonth>
  totals: {
    assigned: number
    activity: number
    available: number
    /** Cash overspending in this month (reduces next month's Ready to Assign). */
    cashOverspent: number
  }
}

const key = (categoryId: string, month: MonthString) => `${categoryId}|${month}`

export function computeBudgetMonth(
  input: BudgetMathInput,
  target: MonthString,
): BudgetMonthResult {
  const assignedBy = new Map<string, number>()
  for (const a of input.assignments) {
    const k = key(a.categoryId, a.month)
    assignedBy.set(k, (assignedBy.get(k) ?? 0) + a.assigned)
  }
  const activityBy = new Map<
    string,
    {
      amount: number
      credit: number
      byAccount: Map<string, { spend: number; refund: number }>
    }
  >()
  for (const a of input.activity) {
    const k = key(a.categoryId, a.month)
    const cur = activityBy.get(k) ?? {
      amount: 0,
      credit: 0,
      byAccount: new Map(),
    }
    cur.amount += a.amount
    cur.credit += a.creditAmount
    for (const c of a.credit ?? []) {
      const acc = cur.byAccount.get(c.accountId) ?? { spend: 0, refund: 0 }
      acc.spend += c.spend
      acc.refund += c.refund
      cur.byAccount.set(c.accountId, acc)
    }
    activityBy.set(k, cur)
  }
  const paymentByCategory = new Map<string, string>() // categoryId -> accountId
  const paymentByAccount = new Map<string, string>() // accountId -> categoryId
  for (const p of input.paymentCategories ?? []) {
    paymentByCategory.set(p.categoryId, p.accountId)
    paymentByAccount.set(p.accountId, p.categoryId)
  }
  const incomeBy = new Map<MonthString, number>()
  for (const i of input.income) {
    incomeBy.set(i.month, (incomeBy.get(i.month) ?? 0) + i.amount)
  }

  // Walk from the earliest month that has any data (or the target) up to the target.
  // Also walk past the target to the last month with data: money assigned in future months
  // comes out of the same Ready to Assign pool.
  let start = target
  let end = target
  for (const m of [
    ...input.assignments.map((a) => a.month),
    ...input.activity.map((a) => a.month),
    ...input.income.map((i) => i.month),
  ]) {
    if (m < start) start = m
    if (m > end) end = m
  }

  const carry = new Map<string, number>()
  let cumIncome = 0
  let cumAssigned = 0
  let cumCashOverBefore = 0
  let result: BudgetMonthResult | undefined
  let finalRta = 0

  for (let m = start; m <= end; m = addMonths(m, 1)) {
    cumIncome += incomeBy.get(m) ?? 0
    let monthAssigned = 0
    let monthActivity = 0
    let monthAvailable = 0
    let monthCashOver = 0
    const categories = new Map<string, CategoryMonth>()

    // money moved into each card's payment category by this month's credit spending
    const paymentFlow = new Map<string, number>() // payment categoryId -> milliunits

    // Pass 1: regular categories (also computes funded credit spending). Pass 2: payment categories.
    const ordered = [
      ...input.categoryIds.filter((id) => !paymentByCategory.has(id)),
      ...input.categoryIds.filter((id) => paymentByCategory.has(id)),
    ]

    for (const id of ordered) {
      const isPayment = paymentByCategory.has(id)
      const carriedIn = carry.get(id) ?? 0
      const assigned = assignedBy.get(key(id, m)) ?? 0
      const act = activityBy.get(key(id, m))
      const txnActivity = act?.amount ?? 0
      const flow = isPayment ? (paymentFlow.get(id) ?? 0) : 0
      const activity = txnActivity + flow
      const creditSpend = isPayment ? 0 : Math.max(0, -(act?.credit ?? 0))

      const available = carriedIn + assigned + activity
      const overspent = Math.max(0, -available)
      const creditOver = Math.min(overspent, creditSpend)
      const cashOver = overspent - creditOver

      if (!isPayment && act) {
        // funded credit spending flows into each card's payment category
        const funded = creditSpend - creditOver
        const cards = [...act.byAccount.entries()].filter(
          ([, v]) => v.spend < 0,
        )
        const weights = cards.map(([, v]) => -v.spend)
        const shares = allocateProportionally(funded, weights)
        cards.forEach(([accountId], i) => {
          const payCat = paymentByAccount.get(accountId)
          if (payCat) {
            paymentFlow.set(
              payCat,
              (paymentFlow.get(payCat) ?? 0) + (shares[i] ?? 0),
            )
          }
        })
        // refunds move money back out of the card's payment category
        for (const [accountId, v] of act.byAccount) {
          const payCat = paymentByAccount.get(accountId)
          if (payCat && v.refund > 0) {
            paymentFlow.set(payCat, (paymentFlow.get(payCat) ?? 0) - v.refund)
          }
        }
      }

      carry.set(id, Math.max(0, available))
      monthAssigned += assigned
      monthActivity += activity
      monthAvailable += available
      monthCashOver += cashOver

      categories.set(id, {
        carriedIn,
        assigned,
        activity,
        available,
        overspent: cashOver > 0 ? 'cash' : creditOver > 0 ? 'credit' : null,
      })
    }

    cumAssigned += monthAssigned
    const readyToAssign = cumIncome - cumAssigned - cumCashOverBefore
    cumCashOverBefore += monthCashOver

    finalRta = readyToAssign
    if (m === target) {
      result = {
        month: m,
        readyToAssign,
        categories,
        totals: {
          assigned: monthAssigned,
          activity: monthActivity,
          available: monthAvailable,
          cashOverspent: monthCashOver,
        },
      }
    }
  }

  // The loop always reaches the target because start <= target <= end.
  const final = result as BudgetMonthResult
  return { ...final, readyToAssign: finalRta }
}
