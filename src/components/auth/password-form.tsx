import { useState, useTransition } from 'react'
import { useHydrated, useRouter } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { credentialsSchema } from '#/lib/auth-schemas'
import {
  getCurrentUser,
  signInWithPassword,
  signUpWithPassword,
} from '#/server/auth'

export function PasswordForm({
  mode,
  redirectTo,
}: {
  mode: 'login' | 'signup'
  redirectTo: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // Submitting before hydration would be a native POST that only reloads the page.
  const hydrated = useHydrated()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const parsed = credentialsSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const action = mode === 'login' ? signInWithPassword : signUpWithPassword
      const result = await action({ data: parsed.data })
      if (result.error) {
        setError(result.error)
        return
      }
      // With email confirmation on, signup yields no session yet.
      if (mode === 'signup' && !(await getCurrentUser())) {
        setNotice('Check your email to confirm your account.')
        return
      }
      // Navigating re-runs the root auth lookup. Invalidating first would make this
      // page redirect by itself, and the destination would then load twice.
      await router.navigate({ href: redirectTo })
    })
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={8}
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm">{notice}</p> : null}
      <Button type="submit" disabled={!hydrated || pending}>
        {pending ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
      </Button>
    </form>
  )
}
