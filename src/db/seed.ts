import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { createDatabase, type Database } from './client';
import { productAliases, products, sellers, locations, offers } from './schema';

export const seedIds = {
  lambProduct: '10000000-0000-4000-8000-000000000001',
  beefProduct: '10000000-0000-4000-8000-000000000002',
  lambAlias: '11000000-0000-4000-8000-000000000001',
  seller: '20000000-0000-4000-8000-000000000001',
  location: '30000000-0000-4000-8000-000000000001',
  lambOffer: '40000000-0000-4000-8000-000000000001',
  beefOffer: '40000000-0000-4000-8000-000000000002',
} as const;

// Only these deterministic fictional records are upserted; no table is cleared.
export async function seedDatabase(db: Database, seedNow: Date = new Date()) {
  await db.transaction(async (tx) => {
    for (const product of [
      { id: seedIds.lambProduct, name: 'Баранина' },
      { id: seedIds.beefProduct, name: 'Говядина' },
    ]) {
      await tx.insert(products).values(product).onConflictDoUpdate({ target: products.id, set: product });
    }
    const lambAlias = { id: seedIds.lambAlias, productId: seedIds.lambProduct, name: 'мясо барана' };
    await tx.insert(productAliases).values(lambAlias).onConflictDoUpdate({ target: productAliases.id, set: lambAlias });

    const seller = {
      id: seedIds.seller,
      displayName: 'Асыл Ет, тестовый продавец',
      ownerUserId: null,
      contactPhoneE164: '+77000000001',
    };
    await tx.insert(sellers).values(seller).onConflictDoUpdate({ target: sellers.id, set: seller });
    const location = {
      id: seedIds.location,
      sellerId: seedIds.seller,
      name: 'Тестовая мясная точка',
      addressText: 'Алматы, Зелёный базар, тестовый павильон 12',
      type: 'pavilion',
      latitude: 43.2636,
      longitude: 76.9568,
    };
    await tx.insert(locations).values(location).onConflictDoUpdate({ target: locations.id, set: location });
    const timestamps = { createdAt: new Date('2026-09-11T00:00:00Z'), updatedAt: new Date('2026-09-11T00:00:00Z') };
    for (const offer of [
      { id: seedIds.lambOffer, productId: seedIds.lambProduct, priceAmount: '4200.00', priceCurrency: 'KZT', priceUnit: 'кг', sellerComment: 'Свежий привоз.' },
      { id: seedIds.beefOffer, productId: seedIds.beefProduct, priceAmount: null, priceCurrency: null, priceUnit: null, sellerComment: 'Есть мякоть и мясо на кости.' },
    ]) {
      const row = {
        ...offer,
        sellerId: seedIds.seller,
        locationId: seedIds.location,
        status: 'active' as const,
        lastConfirmedAt: seedNow,
        ...timestamps,
      };
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
    console.log('UX1D seed complete: 2 products, 1 alias, 1 buyer-eligible seller/location, 2 fresh active offers.');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('UX1D seed failed. Check PostgreSQL, DATABASE_URL and migrations.');
    process.exitCode = 1;
  });
}
