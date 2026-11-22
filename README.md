# ganso

A simple budgeting app to manage personal finances. Zero-based envelope budgeting.

**Stack:** TanStack Start + Router, React, Tailwind v4 + shadcn/ui, Vitest. Supabase (Postgres + Auth) + Drizzle ORM. Hosted on Vercel.

## Prerequisites

- [Node.js](https://nodejs.org) 22+
- [pnpm](https://pnpm.io) 10+ (`npm i -g pnpm`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop) (runs local Supabase; must be open before `pnpm supabase:start`)

## Getting started

```bash
# 1. clone
git clone https://github.com/anthonysim/ganso-app.git
cd ganso-app

# 2. install deps
pnpm install

# 3. env vars (defaults point at local Supabase)
cp .env.example .env.local

# 4. start local Supabase (needs Docker running)
pnpm supabase:start

# 5. apply DB migrations
pnpm db:migrate

# 6. start dev server
pnpm dev
```

App runs at http://localhost:3000. Check DB wiring: http://localhost:3000/api/health should return `{"ok":true,"db":"up"}`.

### Local Supabase

`pnpm supabase:start` runs a private copy of Supabase on your machine using Docker containers: a Postgres database (port 54322), the auth server, and the API gateway (port 54321). The app talks to it the same way it talks to hosted Supabase; only the URL and keys differ (see `.env.example`).

- No Supabase account needed. Free, works offline, safe to wipe and rebuild.
- First start downloads Docker images (a few minutes). Later starts take seconds.
- Data persists in a Docker volume between `supabase:stop` and `supabase:start`.
- Fully separate from any hosted/production project. Nothing syncs between them.
- Stop it with `pnpm supabase:stop` to free RAM. Reset the DB with `pnpm exec supabase db reset`, then `pnpm db:migrate`.

### Auth

Email + password and magic-link sign in via Supabase Auth. Routes: `/login`, `/signup`, `/auth/callback`; everything under `src/routes/_authed/` requires a session (`/budget` for now). Server functions that touch user data must call `requireUser()` from `src/server/require-user.ts`.

Local emails (magic links, confirmations) are not really sent. Open the inbox at http://127.0.0.1:54324.

Hosted Supabase: in the dashboard under Authentication > URL Configuration, set the Site URL to your Vercel domain and add `https://<your-domain>/auth/callback` to Redirect URLs.

### Database workflow

Schema lives in `src/db/schema/*.ts` (Drizzle). After changing it:

```bash
pnpm db:generate   # writes SQL migration to drizzle/
pnpm db:migrate    # applies it
```

The hosted database is not migrated automatically. Run migrations against it by hand, using the **session pooler** URL (port 5432):

```bash
DATABASE_URL='<session pooler url>' pnpm db:migrate
```

The Drizzle client (`src/db/index.ts`) uses node-postgres (`pg`). Don't switch it to postgres.js: that driver pipelines queries, which [Supabase warns](https://supabase.com/docs/guides/database/postgres-js) can hang or return mismatched rows through the transaction pooler.

## Scripts

| Command                         | What it does                            |
| ------------------------------- | --------------------------------------- |
| `pnpm dev`                      | Dev server on port 3000                 |
| `pnpm build`                    | Production build (output in `.output/`) |
| `pnpm preview`                  | Serve the production build locally      |
| `pnpm typecheck`                | TypeScript check                        |
| `pnpm lint`                     | ESLint                                  |
| `pnpm check`                    | Prettier check                          |
| `pnpm format`                   | Prettier write + ESLint fix             |
| `pnpm test`                     | Run Vitest once                         |
| `pnpm test:watch`               | Vitest watch mode                       |
| `pnpm db:generate`              | Generate SQL migration from schema      |
| `pnpm db:migrate`               | Apply migrations                        |
| `pnpm supabase:start` / `:stop` | Local Supabase (Docker)                 |

Before opening a PR, run: `pnpm build && pnpm typecheck && pnpm lint && pnpm check && pnpm test` (same as CI).

## Budget math

Pure functions in `src/domain/budget-math.ts` (unit tested in `budget-math.test.ts`); all amounts are integer milliunits.

- **Available** = carried-in + assigned + activity. Positive Available rolls to next month; negative resets to 0.
- **Overspending** is "credit" up to what was spent on credit accounts that month, the rest is "cash". Only cash overspending reduces Ready to Assign, starting the next month. Credit overspending becomes card debt (credit card payment categories, a later PR).
- **Ready to Assign** (month) = income through that month - assigned through that month - cash overspending of earlier months.
- **Targets** (`src/domain/targets.ts`): needed for spending (weekly, monthly, yearly or once; _set aside_ each cycle or _refill up to_), have a balance (optionally by a date), or fund every month (also used for monthly debt payments). The monthly need spreads a shortfall over the months left, rounded up. _Underfunded_ = needed this month minus assigned.
- **Auto-assign** quick actions: Underfunded, Assigned/Spent last month, Average assigned/spent (3 months), Reset. Each is one undoable step.
- Assigned cells accept expressions relative to the current value: `+50`, `-20`, `*2`, `/2`, `100+25`.

## Scheduled transactions and the cron job

Scheduled transactions are entered as real (uncleared) transactions when they come due:

- **Lazily**: whenever a budget is opened, anything due up to yesterday (UTC) is entered.
- **Daily cron** (`vercel.json`, 08:00 UTC): `GET /api/cron/scheduled` enters everything due today for all budgets.
  It requires `Authorization: Bearer $CRON_SECRET`; Vercel sends this automatically when the `CRON_SECRET`
  env var is set. Generate a long random value, add it under Settings > Environment Variables (Production),
  and never commit it. Without it the endpoint returns 503.

## Sharing

Owners invite people by email from **Sharing** (sidebar) as **Editor** (can change anything) or **Viewer** (read only). There is exactly one owner: the creator, who alone manages members and deletes the budget.

- **No email is sent.** An invitation is a pending row; the invitee sees it as a banner after signing in with that address and can Accept or Decline. Owners can withdraw invitations, change roles, and remove members; members other than the owner can leave.
- **Security requirement for hosted Supabase:** turn on **Confirm email** (Authentication > Providers > Email). Accepting an invitation requires the signed-in user's email to be confirmed and to match the invitation; without confirmation anyone could claim an invitation by signing up with someone else's address. Local Supabase auto-confirms, so this is only enforced when confirmation is on.
- Access is enforced on the server for every write (`requireBudgetRole`); the UI hides controls a viewer cannot use. RLS policies are a backstop.

## Payoff planner, notes, flags and search

- **Debt accounts** (credit card, line of credit, liability, mortgage, loan): set the APR and minimum payment under Edit. The account page then shows a payoff planner (`src/domain/payoff.ts`): monthly interest at APR/12, payoff date, total interest, and an "extra each month" what-if with months and interest saved. A payment that does not cover the interest is flagged.
- **Notes**: a note per category (Categories page; shown as an icon on the budget screen) and a note per budget month (saved when the field loses focus).
- **Flags**: six colors on transactions (flag menu per row, bulk "Flag as", filter by flag). The color is always paired with its name for screen readers.
- **Search**: Cmd/Ctrl+K or the Search button finds accounts, categories and transactions (payee, memo, category, amount); wildcard characters match literally. Enter opens the result with the register search pre-filled.

## Reports

Reports page: Net worth and Age of Money tiles, spending breakdown (by category, category group or payee), income vs expense by month, net worth over time, and Age of Money over time. One filter row (date range presets or custom, account, spending dimension) scopes everything; the URL holds the filters. Every chart has a Table view.

- Math is pure and tested in `src/domain/reports.ts`. Age of Money is FIFO: each spend uses the oldest unspent dollars; the figure is the dollar-weighted average age of the last 10 spends (cash movements in on-budget asset accounts; transfers between them are ignored except card payments).
- Charts are small hand-written SVG components in `src/components/reports/` (no chart library). Colors are the validated blue/orange pair defined as `--viz-*` tokens in `src/styles.css` (light and dark).
- Starting balances are not counted as income.

## Importing transactions

Account page > **Import** accepts CSV, OFX and QFX. Files are parsed in the browser (`src/lib/import/`); only parsed rows are sent.

- CSV: a column mapping step (date column and format, payee, memo, one signed amount column or separate outflow/inflow columns, optional sign flip). The mapping is remembered per account.
- Duplicates are skipped using a per-account import id (the bank's id for OFX, otherwise amount + date + occurrence).
- A bank row that matches a transaction you entered by hand (same amount, date within 10 days) is matched to it instead of duplicated.
- New transactions arrive **cleared but unapproved**; approve them one by one, in bulk, or with **Approve all**.
- **Payee rules** (sidebar): rename a bank payee (contains, starts with, exactly) and set a default category. First matching rule wins.

## Adding shadcn/ui components

```bash
pnpm dlx shadcn@latest add <name>
```

After adding, check that new files import `cn` from `#/lib/utils`. shadcn has wrongly generated `import { cn } from 'cn'` (an unrelated npm package) here before; if you see that, rewrite the import and `pnpm remove cn`.

## Project layout

```
src/
  routes/        file-based routes (TanStack Router)
  components/ui/ shadcn/ui components (add more: pnpm dlx shadcn@latest add <name>)
  components/layout/ app shell: sidebar, top bar, user menu
  db/            Drizzle client + schema
  server/        server functions (from PR 3)
  lib/           helpers (money.ts, env.server.ts, supabase/ clients)
supabase/        local Supabase config
drizzle/         generated SQL migrations
  styles.css     Tailwind + theme tokens
```

Money is stored as integer **milliunits** ($1.00 = 1000). Never use floats for amounts. See `src/lib/money.ts`.

## Deploy (Vercel)

Merging to `main` deploys to production. Every PR gets a preview build.

First-time setup:

1. Import the repo at [vercel.com/new](https://vercel.com/new). `vercel.json` sets the **TanStack Start** framework and the function region (`pdx1`, next to the `us-west-2` database).
2. Add these under **Settings > Environment Variables**:

   | Name                            | Type   | Value                                             |
   | ------------------------------- | ------ | ------------------------------------------------- |
   | `VITE_SUPABASE_URL`             | Config | Supabase project URL                              |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Config | Supabase publishable key                          |
   | `DATABASE_URL`                  | Secret | **Transaction pooler** URL (port 6543)            |
   | `CRON_SECRET`                   | Secret | `openssl rand -hex 32` (see the cron job section) |

3. Run the migrations against the hosted database (see Database workflow).
4. Set the Supabase Auth URLs (see Auth).
5. Deploy, then check that `/api/health` returns `{"ok":true,"db":"up"}`.

- Use the pooler URLs. The direct `db.<ref>.supabase.co` host is IPv6 only without the paid IPv4 add-on, and Vercel can't reach it.
- Environment variable changes only apply to new deployments, so redeploy after editing one.
- Variables set for Production only are missing from previews. Such a preview can build successfully and still not work.

Variables prefixed `VITE_` ship to the browser. Keep secrets unprefixed (server-only).

## Learn more

- [TanStack Start](https://tanstack.com/start) · [Router](https://tanstack.com/router) · [Query](https://tanstack.com/query)
- [shadcn/ui](https://ui.shadcn.com) · [Tailwind CSS](https://tailwindcss.com)
