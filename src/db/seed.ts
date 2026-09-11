import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createDatabase, type Database } from './client';
import { products, sellers, locations, offers } from './schema';

export const seedIds = {
  lambProduct: '10000000-0000-4000-8000-000000000001',
  beefProduct: '10000000-0000-4000-8000-000000000002',
  seller: '20000000-0000-4000-8000-000000000001',
  location: '30000000-0000-4000-8000-000000000001',
  lambOffer: '40000000-0000-4000-8000-000000000001',
  beefOffer: '40000000-0000-4000-8000-000000000002',
} as const;

// Only these deterministic fictional records are upserted; no table is cleared.
export async function seedDatabase(db: Database) {
  await db.transaction(async (tx) => {
    for (const product of [
      { id: seedIds.lambProduct, name: 'Баранина' },
      { id: seedIds.beefProduct, name: 'Говядина' },
    ]) {
      await tx.insert(products).values(product).onConflictDoUpdate({ target: products.id, set: product });
    }
    const seller = { id: seedIds.seller, displayName: 'Асыл Ет, тестовый продавец' };
    await tx.insert(sellers).values(seller).onConflictDoUpdate({ target: sellers.id, set: seller });
    const location = {
      id: seedIds.location,
      name: 'Тестовая мясная точка',
      addressText: 'Алматы, Зелёный базар, тестовый павильон 12',
    };
    await tx.insert(locations).values(location).onConflictDoUpdate({ target: locations.id, set: location });
    const timestamps = { createdAt: new Date('2026-09-11T00:00:00Z'), updatedAt: new Date('2026-09-11T00:00:00Z') };
    for (const offer of [
      { id: seedIds.lambOffer, productId: seedIds.lambProduct, priceAmount: '4200.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Свежий привоз.' },
      { id: seedIds.beefOffer, productId: seedIds.beefProduct, priceAmount: null, priceCurrency: null, priceUnit: null, sellerComment: 'Есть мякоть и мясо на кости.' },
    ]) {
      const row = { ...offer, sellerId: seedIds.seller, locationId: seedIds.location, ...timestamps };
      await tx.insert(offers).values(row).onConflictDoUpdate({ target: offers.id, set: row });
    }
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const { db, pool } = createDatabase(url);
  try {
    await seedDatabase(db);
    console.log('S0 seed complete: 2 products, 1 seller, 1 location, 2 offers.');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('S0 seed failed. Check PostgreSQL, DATABASE_URL and migrations.');
    process.exitCode = 1;
  });
}
