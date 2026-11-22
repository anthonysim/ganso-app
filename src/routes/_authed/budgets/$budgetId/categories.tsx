import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { CategoryManager } from '#/components/categories/category-manager'
import { listCategoryGroups } from '#/server/categories'

export const Route = createFileRoute('/_authed/budgets/$budgetId/categories')({
  loader: ({ params }) =>
    listCategoryGroups({ data: { budgetId: params.budgetId } }),
  component: CategoriesPage,
})

const layout = getRouteApi('/_authed/budgets/$budgetId')

function CategoriesPage() {
  const groups = Route.useLoaderData()
  const { budget } = layout.useLoaderData()
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 @xl/main:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-muted-foreground text-sm">
          Organize your budget into groups and categories. Drag the handle to
          reorder (keyboard: focus the handle, press Space, use arrow keys).
        </p>
      </div>
      <CategoryManager
        budgetId={budget.id}
        groups={groups}
        canEdit={budget.role !== 'viewer'}
      />
    </div>
  )
}
