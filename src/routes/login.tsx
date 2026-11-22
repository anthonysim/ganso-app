import { createFileRoute, redirect } from '@tanstack/react-router'
import { LandingLayout } from '#/components/auth/landing-layout'
import { LoginPanel } from '#/components/auth/login-panel'
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
  return (
    <LandingLayout>
      <LoginPanel
        redirectTo={safeRedirect(redirectParam)}
        linkError={Boolean(error)}
      />
    </LandingLayout>
  )
}
