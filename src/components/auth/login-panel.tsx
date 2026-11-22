import { useState } from 'react'
import { MagicLinkForm } from '#/components/auth/magic-link-form'
import { PasswordForm } from '#/components/auth/password-form'
import { Button } from '#/components/ui/button'

/** Password login, with a switch to an emailed sign-in link. */
export function LoginPanel({
  redirectTo,
  linkError = false,
}: {
  redirectTo: string
  /** The visitor followed a sign-in link that is invalid or expired. */
  linkError?: boolean
}) {
  const [method, setMethod] = useState<'password' | 'link'>('password')
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Log in</h2>
        <p className="text-muted-foreground text-sm">Welcome back.</p>
      </div>
      {linkError ? (
        <p role="alert" className="text-destructive text-sm">
          That sign-in link is invalid or expired. Try again.
        </p>
      ) : null}
      {method === 'password' ? (
        <PasswordForm mode="login" redirectTo={redirectTo} />
      ) : (
        <MagicLinkForm />
      )}
      <Button
        type="button"
        variant="link"
        className="h-auto p-0"
        onClick={() =>
          setMethod((m) => (m === 'password' ? 'link' : 'password'))
        }
      >
        {method === 'password'
          ? 'Email me a sign-in link instead'
          : 'Use my password instead'}
      </Button>
      <p className="text-muted-foreground border-t pt-6 text-center text-sm">
        New here? Sign-up is coming soon.
      </p>
    </>
  )
}
