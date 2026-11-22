import { LoginHero } from '#/components/auth/login-hero'
import { Wordmark } from '#/components/layout/wordmark'

/** The pitch beside a narrow panel. Shared by the home and login pages. */
export function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    // The panel comes first in the DOM, so on phones it sits above the pitch.
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)]">
      <div className="flex flex-col px-6 py-10 sm:px-10 lg:sticky lg:top-0 lg:order-last lg:h-dvh lg:overflow-y-auto">
        <div className="m-auto flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1>
              <Wordmark size="lg" className="text-4xl" />
            </h1>
            <p className="text-muted-foreground lg:hidden">
              Budgeting, simplified.
            </p>
          </div>
          {children}
        </div>
      </div>
      <LoginHero />
    </main>
  )
}
