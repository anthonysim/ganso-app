import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { changePasswordSchema } from '#/lib/auth-schemas'
import { changePassword } from '#/server/auth'

export function ProfileDialog({
  email,
  open,
  onOpenChange,
}: {
  email: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    if (!next) setError(null)
    onOpenChange(next)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const parsed = changePasswordSchema.safeParse({
      currentPassword: form.get('currentPassword'),
      newPassword: form.get('newPassword'),
      confirmPassword: form.get('confirmPassword'),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        const result = await changePassword({ data: parsed.data })
        if (result.error) {
          setError(result.error)
          return
        }
        formEl.reset()
        toast.success('Password updated')
      } catch {
        setError('Could not update your password.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>Your account details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} readOnly disabled />
        </div>
        <Separator />
        <form
          method="post"
          onSubmit={onSubmit}
          noValidate
          className="grid gap-4"
        >
          <h3 className="text-sm font-medium">Change password</h3>
          <div className="grid gap-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="justify-self-end">
            {pending ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
