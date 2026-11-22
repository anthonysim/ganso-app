import { z } from 'zod'

const schema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  /** Shared secret for the Vercel Cron endpoint. Optional locally. */
  CRON_SECRET: z.string().min(16).optional(),
})

let cached: z.infer<typeof schema> | undefined

/** Validated server-only env. Throws a readable error if misconfigured. */
export function serverEnv() {
  cached ??= schema.parse(process.env)
  return cached
}
