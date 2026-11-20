import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { env } from '../env.js';

// A pool keeps a few open connections to Postgres and reuses them.
// Opening a new connection for every request would be slow.
export const pool = new Pool({ connectionString: env.databaseUrl });
// Drizzle sends its queries through the pool. Import `db` everywhere you query.
export const db = drizzle({ client: pool });
