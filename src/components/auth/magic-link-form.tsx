import { useState, useTransition } from 'react'
import { useHydrated } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { magicLinkSchema } from '#/lib/auth-schemas'
import { sendMagicLink } from '#/server/auth'

export function MagicLinkForm() {
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()
  // Submitting before hydration would be a native POST that only reloads the page.
  const hydrated = useHydrated()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const parsed = magicLinkSchema.safeParse({
      email: new FormData(e.currentTarget).get('email'),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid email')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await sendMagicLink({ data: parsed.data })
      if (result.error) setError(result.error)
      else setSent(true)
    })
  }

  if (sent) {
    return <p className="text-sm">Check your email for a sign-in link.</p>
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="magic-email">Email</Label>
        <Input
          id="magic-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={!hydrated || pending}>
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </Button>
    </form>
  )
}
