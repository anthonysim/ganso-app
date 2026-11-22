import { z } from 'zod'

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email'))

export const credentialsSchema = z.object({
  email: emailField,
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const magicLinkSchema = z.object({
  email: emailField,
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'New password must be different',
    path: ['newPassword'],
  })

/** Only allow same-origin relative paths to prevent open redirects. */
export function safeRedirect(path: unknown, fallback = '/budget'): string {
  if (typeof path !== 'string') return fallback
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return fallback
  }
  return path
}
