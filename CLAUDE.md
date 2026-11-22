# ganso

Zero-based envelope budgeting app.

## Tech stack

- **Framework:** TanStack Start (React 19) with TanStack Router (file-based routes in `src/routes`) and server functions (`createServerFn`) in `src/server`
- **Language:** TypeScript (strict), `zod` for validation
- **UI:** Tailwind CSS v4, shadcn/ui components (`src/components/ui`, built on Radix), `lucide-react` icons, `sonner` toasts
- **Tables / drag and drop:** TanStack Table, dnd-kit
- **Database:** Postgres via Supabase, Drizzle ORM (schema in `src/db/schema`, migrations in `drizzle/`)
- **Build / hosting:** Vite, Nitro, deployed on Vercel
- **Tooling:** pnpm, ESLint, Prettier, Vitest

## Before writing code

Invoke the `/vercel-react-best-practices` skill before writing or changing any React or UI code. This project uses TanStack Start, not Next.js, so ignore the Next.js-specific rules (`next/dynamic`, RSC, `after()`).

## Commands

- `pnpm dev` starts the dev server on port 3000
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (Vitest)
- `pnpm format` runs Prettier and ESLint fix; run it before committing
- `pnpm db:generate` / `pnpm db:migrate` for Drizzle migrations

## Conventions

- Import app code with the `#/` alias (maps to `src/`)
- Never commit secrets. Real credentials live only in `.env.local` and Vercel; `.env.example` holds placeholders
