import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  CircleUserIcon,
  UserIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Button } from '#/components/ui/button'
import { useTheme } from '#/components/theme-provider'
import { parseTheme } from '#/lib/theme'
import { ProfileDialog } from '#/components/auth/profile-dialog'
import { signOut } from '#/server/auth'

export function UserMenu({ email }: { email: string }) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)

  async function onSignOut() {
    await signOut()
    await router.invalidate()
    await router.navigate({ to: '/login', search: { redirect: '/budget' } })
    toast.success('Signed out')
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account menu">
            <CircleUserIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            <UserIcon /> Profile
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SunIcon className="dark:hidden" />
              <MoonIcon className="hidden dark:block" /> Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(v) => setTheme(parseTheme(v))}
              >
                <DropdownMenuRadioItem value="light">
                  <SunIcon /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <MoonIcon /> Dark
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <MonitorIcon /> System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void onSignOut()}>
            <LogOutIcon /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileDialog
        email={email}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </>
  )
}
