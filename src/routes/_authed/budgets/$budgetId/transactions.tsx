import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Register } from '#/components/register/register'
import { loadRegister } from '#/server/transactions'

export const Route = createFileRoute('/_authed/budgets/$budgetId/transactions')(
  {
    loader: ({ params }) =>
      loadRegister({ data: { budgetId: params.budgetId } }),
    component: AllTransactionsPage,
  },
)

const layout = getRouteApi('/_authed/budgets/$budgetId')

function AllTransactionsPage() {
  const data = Route.useLoaderData()
  const { budget, accounts } = layout.useLoaderData()
  return (
    <div className="flex flex-col gap-4 p-4 @xl/main:p-6">
      <h1 className="text-2xl font-semibold">All Transactions</h1>
      <Register budget={budget} accounts={accounts} data={data} />
    </div>
  )
}
