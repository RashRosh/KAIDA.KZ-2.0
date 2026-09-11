import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { seedDatabase, seedIds } from '../../src/db/seed';
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
      throw new Error('S3 clean database must keep the existing seven tables');
    }

    const users = await pool.query('SELECT count(*)::int AS count FROM users');
    if (users.rows[0]?.count !== 0) throw new Error('S3 seed must not create a User');

    const seller = (await pool.query('SELECT id, owner_user_id FROM sellers WHERE id=$1', [seedIds.seller])).rows[0];
    if (!seller || seller.owner_user_id !== null) throw new Error('S3 seed Seller must remain ownerless');

    const location = (await pool.query('SELECT id, seller_id, type FROM locations WHERE id=$1', [seedIds.location])).rows[0];
    if (!location || location.seller_id !== seedIds.seller || location.type !== 'pavilion') {
      throw new Error('S3 seed Location must point to seed Seller and be pavilion');
    }

    const sellerCount = Number((await pool.query('SELECT count(*) FROM sellers WHERE id=$1', [seedIds.seller])).rows[0].count);
    const locationCount = Number((await pool.query('SELECT count(*) FROM locations WHERE id=$1', [seedIds.location])).rows[0].count);
    const offerCount = Number((await pool.query('SELECT count(*) FROM offers WHERE id IN ($1,$2)', [seedIds.lambOffer, seedIds.beefOffer])).rows[0].count);
    if (sellerCount !== 1 || locationCount !== 1 || offerCount !== 2) throw new Error('S3 repeat seed must stay deterministic');

    console.log('PostgreSQL 18 kaida_test: clean S0→S1→S2→S3 migration chain, repeat migration and deterministic repeat seed completed.');
  } finally {
    await pool.end();
  }
}

prepare().catch((error: unknown) => {
  console.error('Test database preparation failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
