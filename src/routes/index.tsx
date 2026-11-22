import { createFileRoute, redirect } from '@tanstack/react-router'
import { LandingLayout } from '#/components/auth/landing-layout'
import { LoginPanel } from '#/components/auth/login-panel'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.user) throw redirect({ to: '/budget' })
  },
  component: Home,
})

function Home() {
  return (
    <LandingLayout>
      <LoginPanel redirectTo="/budget" />
    </LandingLayout>
  )
}
