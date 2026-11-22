import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { createSupabaseServerClient } from '#/lib/supabase/server'
import { credentialsSchema, magicLinkSchema } from '#/lib/auth-schemas'

export type AuthResult = { error: string | null }

/** Current user, verified against Supabase Auth (not just the cookie). */
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const supabase = createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    return data.user ? { id: data.user.id, email: data.user.email ?? '' } : null
  },
)

export const signInWithPassword = createServerFn({ method: 'POST' })
  .validator(credentialsSchema)
  .handler(async ({ data }): Promise<AuthResult> => {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword(data)
    return { error: error ? 'Invalid email or password' : null }
  })

export const signUpWithPassword = createServerFn({ method: 'POST' })
  .validator(credentialsSchema)
  .handler(async (): Promise<AuthResult> => {
    // Sign-up disabled until launch. Re-enable via supabase.auth.signUp.
    return { error: 'Sign-up is coming soon.' }
  })

export const sendMagicLink = createServerFn({ method: 'POST' })
  .validator(magicLinkSchema)
  .handler(async ({ data }): Promise<AuthResult> => {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${getRequestUrl().origin}/auth/callback`,
      },
    })
    return { error: error?.message ?? null }
  })

export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
})
