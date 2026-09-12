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
    const expected = ['auth_otp_challenges', 'auth_sessions', 'locations', 'offers', 'products', 'seller_change_items', 'seller_change_sets', 'sellers', 'users'];
    if (JSON.stringify(tables.rows.map((row) => row.tablename)) !== JSON.stringify(expected)) {
      throw new Error('S4 clean database must contain exactly the existing seven tables plus Seller Change Set and Item');
    }

    const users = await pool.query('SELECT count(*)::int AS count FROM users');
    if (users.rows[0]?.count !== 0) throw new Error('S4 seed must not create a User');

    const seller = (await pool.query('SELECT id, owner_user_id FROM sellers WHERE id=$1', [seedIds.seller])).rows[0];
    if (!seller || seller.owner_user_id !== null) throw new Error('S4 seed Seller must remain ownerless');

    const location = (await pool.query('SELECT id, seller_id, type FROM locations WHERE id=$1', [seedIds.location])).rows[0];
    if (!location || location.seller_id !== seedIds.seller || location.type !== 'pavilion') {
      throw new Error('S4 seed Location must still point to seed Seller and be pavilion');
    }

    const sellerCount = Number((await pool.query('SELECT count(*) FROM sellers WHERE id=$1', [seedIds.seller])).rows[0].count);
    const locationCount = Number((await pool.query('SELECT count(*) FROM locations WHERE id=$1', [seedIds.location])).rows[0].count);
    const offerCount = Number((await pool.query('SELECT count(*) FROM offers WHERE id IN ($1,$2)', [seedIds.lambOffer, seedIds.beefOffer])).rows[0].count);
    const changeSetCount = Number((await pool.query('SELECT count(*) FROM seller_change_sets')).rows[0].count);
    const changeItemCount = Number((await pool.query('SELECT count(*) FROM seller_change_items')).rows[0].count);
    if (sellerCount !== 1 || locationCount !== 1 || offerCount !== 2) throw new Error('S4 repeat seed must keep S0/S3 fixtures deterministic');
    if (changeSetCount !== 0 || changeItemCount !== 0) throw new Error('S4 seed must not create Seller Change Sets or Items');

    console.log('PostgreSQL 18 kaida_test: clean S0→S1→S2→S3→S4 migration chain, repeat migration and deterministic repeat seed completed.');
  } finally {
    await pool.end();
  }
}

prepare().catch((error: unknown) => {
  console.error('Test database preparation failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
