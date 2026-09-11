import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export function createDatabase(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
  pool.on('error', () => console.error('PostgreSQL pool connection error'));
  return { db: drizzle({ client: pool, schema }), pool };
}

export type Database = ReturnType<typeof createDatabase>['db'];

let connection: ReturnType<typeof createDatabase> | undefined;

export function getDatabase(): Database {
  if (!connection) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required');
    connection = createDatabase(url);
  }
  return connection.db;
}
