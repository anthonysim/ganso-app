import { attachDatabasePool } from '@vercel/functions'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { serverEnv } from '../lib/env.server'
import * as schema from './schema'

let _db: ReturnType<typeof create> | undefined

function create() {
  // node-postgres, not postgres.js: postgres.js pipelines queries, which Supabase documents as
  // able to hang or return mismatched rows through the transaction-mode pooler (port 6543).
  const pool = new Pool({
    connectionString: serverEnv().DATABASE_URL,
    // Close idle connections quickly so a suspended function doesn't wake up with dead sockets.
    idleTimeoutMillis: 5_000,
    // Fail instead of hanging until the function times out.
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
  })
  // Without a listener, an error on an idle connection would crash the process.
  pool.on('error', (error) => console.error('idle database connection', error))
  // Keeps a Vercel function alive until idle connections have closed. No-op elsewhere.
  attachDatabasePool(pool)
  return drizzle(pool, { schema })
}

/** Lazy Drizzle client. Server only. */
export function db() {
  _db ??= create()
  return _db
}
