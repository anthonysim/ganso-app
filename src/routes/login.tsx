import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthCard } from '#/components/auth/auth-card'
import { MagicLinkForm } from '#/components/auth/magic-link-form'
import { PasswordForm } from '#/components/auth/password-form'
import { safeRedirect } from '#/lib/auth-schemas'

export const Route = createFileRoute('/login')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect?: string; error?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.user) throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: redirectParam, error } = Route.useSearch()
  const redirectTo = safeRedirect(redirectParam)
  return (
    <AuthCard title="Log in" description="Welcome back.">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          That sign-in link is invalid or expired. Try again.
        </p>
      ) : null}
      <PasswordForm mode="login" redirectTo={redirectTo} />
      <div className="text-muted-foreground text-center text-xs">or</div>
      <MagicLinkForm />
      <p className="text-muted-foreground text-center text-sm">
        Sign-up is coming soon.
      </p>
    </AuthCard>
  )
}
