import { Link, createFileRoute } from '@tanstack/react-router'
import { LandingLayout } from '#/components/auth/landing-layout'
import { LoginPanel } from '#/components/auth/login-panel'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { user } = Route.useRouteContext()
  return (
    <LandingLayout>
      {user ? (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">Welcome back</h2>
            <p className="text-muted-foreground text-sm">
              You’re already logged in.
            </p>
          </div>
          <Button asChild>
            <Link to="/budget">Open budget</Link>
          </Button>
        </>
      ) : (
        <LoginPanel redirectTo="/budget" />
      )}
    </LandingLayout>
  )
}
