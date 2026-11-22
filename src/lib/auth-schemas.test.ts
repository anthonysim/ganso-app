import { describe, expect, it } from 'vitest'
import {
  changePasswordSchema,
  credentialsSchema,
  magicLinkSchema,
  safeRedirect,
} from './auth-schemas'

describe('credentialsSchema', () => {
  it('normalizes email and accepts valid input', () => {
    const r = credentialsSchema.parse({
      email: '  Me@Example.COM ',
      password: 'longenough',
    })
    expect(r.email).toBe('me@example.com')
  })

  it('rejects short passwords and bad emails', () => {
    expect(
      credentialsSchema.safeParse({ email: 'a@b.co', password: 'short' })
        .success,
    ).toBe(false)
    expect(
      credentialsSchema.safeParse({ email: 'nope', password: 'longenough' })
        .success,
    ).toBe(false)
  })
})

describe('magicLinkSchema', () => {
  it('requires a valid email', () => {
    expect(magicLinkSchema.safeParse({ email: 'x' }).success).toBe(false)
    expect(magicLinkSchema.safeParse({ email: 'x@y.co' }).success).toBe(true)
  })
})

describe('safeRedirect', () => {
  it('allows relative paths', () => {
    expect(safeRedirect('/budget/abc?x=1')).toBe('/budget/abc?x=1')
  })
  it('blocks external and protocol-relative urls', () => {
    expect(safeRedirect('https://evil.com')).toBe('/budget')
    expect(safeRedirect('//evil.com')).toBe('/budget')
    expect(safeRedirect('/\\evil.com')).toBe('/budget')
    expect(safeRedirect(undefined)).toBe('/budget')
  })
})

describe('changePasswordSchema', () => {
  const ok = {
    currentPassword: 'oldpassword',
    newPassword: 'newpassword',
    confirmPassword: 'newpassword',
  }

  it('accepts a valid change', () => {
    expect(changePasswordSchema.safeParse(ok).success).toBe(true)
  })

  it('rejects short, mismatched, or unchanged passwords', () => {
    expect(
      changePasswordSchema.safeParse({
        ...ok,
        newPassword: 'short',
        confirmPassword: 'short',
      }).success,
    ).toBe(false)
    expect(
      changePasswordSchema.safeParse({ ...ok, confirmPassword: 'different1' })
        .success,
    ).toBe(false)
    expect(
      changePasswordSchema.safeParse({
        ...ok,
        newPassword: 'oldpassword',
        confirmPassword: 'oldpassword',
      }).success,
    ).toBe(false)
  })
})
