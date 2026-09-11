import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { seedDatabase } from '../../src/db/seed';
import { connectTestDatabase } from './database';

async function prepare() {
  const { db, pool } = await connectTestDatabase();
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public');
    const clean = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    if (clean.rowCount !== 0) throw new Error('Test database is not clean');
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    const seedNow = new Date();
    await seedDatabase(db, seedNow);
    await seedDatabase(db, seedNow);
    const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const expected = ['auth_otp_challenges', 'auth_sessions', 'locations', 'offers', 'products', 'sellers', 'users'];
    if (JSON.stringify(tables.rows.map((row) => row.tablename)) !== JSON.stringify(expected)) {
      throw new Error('S2 clean database must have four existing product tables and exactly three Identity tables');
    }
    const users = await pool.query('SELECT count(*)::int AS count FROM users');
    if (users.rows[0]?.count !== 0) throw new Error('S2 seed must not create a User');
    console.log('PostgreSQL 18 kaida_test: clean S0→S1→S2 migration chain, repeat migration and deterministic repeat seed completed.');
  } finally {
    await pool.end();
  }
}

prepare().catch((error: unknown) => {
  console.error('Test database preparation failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
