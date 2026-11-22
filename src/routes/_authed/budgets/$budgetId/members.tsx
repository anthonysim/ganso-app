import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useState, useTransition } from 'react'
import { Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '#/components/categories/confirm-dialog'
import { NativeSelect } from '#/components/register/native-select'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  INVITE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  canLeave,
  canManageMembers,
  canModifyMember,
  inviteSchema,
} from '#/lib/sharing'
import type { InviteRole, MemberRow } from '#/lib/sharing'
import {
  inviteMember,
  leaveBudget,
  loadMembers,
  removeMember,
  revokeInvite,
  updateMemberRole,
} from '#/server/members'

export const Route = createFileRoute('/_authed/budgets/$budgetId/members')({
  loader: ({ params }) => loadMembers({ data: { budgetId: params.budgetId } }),
  component: MembersPage,
})

const layout = getRouteApi('/_authed/budgets/$budgetId')

function MembersPage() {
  const { role, currentUserId, members, invites } = Route.useLoaderData()
  const { budget } = layout.useLoaderData()
  const router = useRouter()
  const isOwner = canManageMembers(role)
  const [pending, startTransition] = useTransition()
  const [removing, setRemoving] = useState<MemberRow | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteRole, setInviteRole] = useState<InviteRole>('editor')

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action()
        await router.invalidate()
        toast.success(success)
      } catch {
        toast.error('Something went wrong. Try again.')
      }
    })
  }

  function onInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const parsed = inviteSchema.safeParse({
      budgetId: budget.id,
      email: new FormData(form).get('email'),
      role: inviteRole,
    })
    if (!parsed.success) {
      setInviteError(parsed.error.issues[0]?.message ?? 'Check the email')
      return
    }
    setInviteError(null)
    startTransition(async () => {
      try {
        await inviteMember({ data: parsed.data })
        await router.invalidate()
        form.reset()
        toast.success(`Invited ${parsed.data.email}`)
      } catch {
        setInviteError(
          'Could not invite that person. They may already be a member.',
        )
      }
    })
  }

  const actor = { userId: currentUserId, role }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 @xl/main:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Sharing</h1>
        <p className="text-muted-foreground text-sm">
          Share “{budget.name}” with a partner or family. You are{' '}
          {ROLE_LABELS[role].toLowerCase()}:{' '}
          {ROLE_DESCRIPTIONS[role].toLowerCase()}.
        </p>
      </div>

      {isOwner ? (
        <form
          method="post"
          onSubmit={onInvite}
          noValidate
          className="flex flex-col gap-3 rounded-lg border p-4"
          aria-label="Invite someone"
        >
          <h2 className="font-medium">Invite someone</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-56 flex-1 gap-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                autoComplete="off"
                placeholder="partner@example.com"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="invite-role">Role</Label>
              <NativeSelect
                id="invite-role"
                className="w-32"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as InviteRole)}
              >
                {INVITE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" disabled={pending}>
              Invite
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            No email is sent. They will see the invitation after signing in with
            this address (their email must be confirmed).
          </p>
          {inviteError ? (
            <p role="alert" className="text-destructive text-sm">
              {inviteError}
            </p>
          ) : null}
        </form>
      ) : null}

      <section aria-label="Members" className="flex flex-col gap-2">
        <h2 className="font-medium">Members</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const editable = canModifyMember(actor, m)
                return (
                  <tr key={m.userId} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium wrap-anywhere">
                        {m.displayName ?? m.email ?? 'Unknown'}
                        {m.userId === currentUserId ? ' (you)' : ''}
                      </div>
                      <div className="text-muted-foreground text-xs wrap-anywhere">
                        {m.email}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {editable ? (
                        <NativeSelect
                          aria-label={`Role for ${m.email ?? 'member'}`}
                          className="w-32"
                          value={m.role}
                          disabled={pending}
                          onChange={(e) =>
                            run(
                              () =>
                                updateMemberRole({
                                  data: {
                                    budgetId: budget.id,
                                    userId: m.userId,
                                    role: e.target.value as InviteRole,
                                  },
                                }),
                              'Role updated',
                            )
                          }
                        >
                          {INVITE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        ROLE_LABELS[m.role]
                      )}
                    </td>
                    <td className="px-3 py-1">
                      {editable ? (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Remove ${m.email ?? 'member'}`}
                          onClick={() => setRemoving(m)}
                        >
                          <Trash2Icon />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isOwner && invites.length > 0 ? (
        <section
          aria-label="Pending invitations"
          className="flex flex-col gap-2"
        >
          <h2 className="font-medium">Pending invitations</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id} className="border-t first:border-t-0">
                    <td className="px-3 py-2 wrap-anywhere">{i.email}</td>
                    <td className="px-3 py-2">{ROLE_LABELS[i.role]}</td>
                    <td className="px-3 py-1 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              revokeInvite({
                                data: { budgetId: budget.id, inviteId: i.id },
                              }),
                            'Invitation withdrawn',
                          )
                        }
                      >
                        Withdraw
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canLeave(role) ? (
        <div>
          <Button variant="outline" onClick={() => setLeaving(true)}>
            Leave this budget
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title={`Remove ${removing?.email ?? 'this person'}?`}
        description="They lose access to this budget immediately. Their past entries stay."
        confirmLabel="Remove"
        onConfirm={() => {
          if (!removing) return
          const userId = removing.userId
          run(
            () => removeMember({ data: { budgetId: budget.id, userId } }),
            'Member removed',
          )
        }}
      />
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title="Leave this budget?"
        description="You will lose access unless an owner invites you again."
        confirmLabel="Leave"
        onConfirm={() =>
          startTransition(async () => {
            try {
              await leaveBudget({ data: { budgetId: budget.id } })
              await router.navigate({ to: '/budget' })
              await router.invalidate()
              toast.success('You left the budget')
            } catch {
              toast.error('Could not leave the budget')
            }
          })
        }
      />
    </div>
  )
}
