import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { AuthCard } from '#/components/auth/auth-card'
import { safeRedirect } from '#/lib/auth-schemas'

export const Route = createFileRoute('/signup')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.user) throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: SignupPage,
})

function SignupPage() {
  const { redirect: redirectParam } = Route.useSearch()
  return (
    <AuthCard
      title="Sign-up coming soon"
      description="We're not accepting new accounts yet. Check back soon."
    >
      <p className="text-muted-foreground text-center text-sm">
        Have an account?{' '}
        <Link
          to="/login"
          search={{ redirect: redirectParam }}
          className="underline"
        >
          Log in
        </Link>
      </p>
    </AuthCard>
  )
}
