import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { seedDatabase } from '../../src/db/seed';
import { suggestCatalogProducts } from '../../src/modules/catalog/application/suggest-products';
import { importProductionKbPackage } from '../../src/modules/catalog/kb-import/production-kb-importer';
import { createOwnedLocation } from '../../src/modules/locations/application/create-owned-location';
import { listOwnedOffers } from '../../src/modules/offers/application/list-owned-offers';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { createCardChangeSet } from '../../src/modules/seller-input/application/card-change-sets';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { cardCreateBodySchema } from '../../src/modules/seller-input/contracts/seller-card.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { withMigrationTestDatabase } from './migration-test-database';

// catalog-runtime-loop: a Product that exists only in Production KB v1 (not in the old two-Product seed) travels
// Seller suggestion → SellerChangeSet publish → Offer.product_id → Buyer Search. The catalog comes from the existing
// Production KB importer in an isolated database; nothing is copied into seed or fixtures.

const T0 = new Date('2026-10-05T06:00:00.000Z');
const clock = () => T0;
const OWNER = { id: '75000000-0000-4000-8000-000000000001', phone: '+77010007501' };
const KB_PRODUCT = 'Мёд горный'; // KAIDA-P0697, KK «Тау балы»

describe('Catalog-backed Seller → Buyer runtime loop', () => {
  it('a non-seed KB Product chosen from suggestions is published and found by its RU and KK catalog names', async () => {
    await withMigrationTestDatabase({ name: 'kaida_catalog_runtime_loop_test', maxConnections: 8 }, async (pool, migrationDb) => {
      await migrate(migrationDb, { migrationsFolder: './drizzle/migrations' });
      const db = migrationDb as Database;
      await seedDatabase(db, T0);

      const before = await pool.query<{ id: string }>('SELECT id FROM products WHERE name = $1', [KB_PRODUCT]);
      expect(before.rowCount).toBe(0); // not part of the old seed

      const imported = await importProductionKbPackage(db);
      expect(imported).toMatchObject({ products: 682, aliases: 210, categories: 35 });
      const product = (await pool.query<{ id: string }>('SELECT id FROM products WHERE name = $1', [KB_PRODUCT])).rows;
      expect(product).toHaveLength(1);
      const productId = product[0]!.id;

      // Seller side: the typed prefix offers the KB Product from PostgreSQL.
      const suggestions = await suggestCatalogProducts(db, 'мёд гор', 'ru');
      expect(suggestions).toEqual([{ id: productId, name: KB_PRODUCT }]);

      await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [OWNER.id, OWNER.phone, T0]);
      const seller = await setupSeller(OWNER.id, {
        seller: { displayName: 'Пасека' },
        location: { name: 'Пасека A', type: 'shop', addressText: 'Almaty Pasika A' },
      }, { database: db });
      const second = await createOwnedLocation(OWNER.id, { name: 'Пасека B', type: 'shop', addressText: 'Almaty Pasika B' }, { database: db });
      await pool.query('UPDATE locations SET latitude=43.25, longitude=76.95 WHERE id = ANY($1::uuid[])', [[seller.locations[0]!.id, second.id]]);
      const base = { unit: { code: 'kg' }, pack: null, sellerComment: 'С пасеки', photoIds: [] };

      // Publish through the existing SellerChangeSet path with the chosen suggestion.
      const proposal = await createCardChangeSet(OWNER.id, cardCreateBodySchema.parse({
        ...base, title: suggestions[0]!.name, productId: suggestions[0]!.id, price: '9000', points: [{ locationId: seller.locations[0]!.id }],
      }), { database: db });
      await confirmSellerChangeSet(OWNER.id, proposal.id, { database: db, clock });

      const published = await pool.query<{ product_id: string }>('SELECT product_id FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id = $1)', [OWNER.id]);
      expect(published.rows).toEqual([{ product_id: productId }]);
      expect((await listOwnedOffers(OWNER.id, { database: db, clock })).map((offer) => offer.product.id)).toEqual([productId]);

      // Buyer side: the canonical name and the alternate catalog (Kazakh) name find the exact Offer.
      for (const query of [KB_PRODUCT, 'Тау балы']) {
        const found = await searchOffers(query, db, { clock, validityPeriodHours: 168 });
        expect(found.offers.map((offer) => [offer.product.id, offer.product.name, offer.price?.amount])).toEqual([[productId, KB_PRODUCT, '9000']]);
      }

      // Free-title publishing stays optional and unchanged: no suggestion chosen, found by the Seller's own words.
      const free = await createCardChangeSet(OWNER.id, cardCreateBodySchema.parse({
        ...base, productId: null, title: 'Мёд с пасеки у Иссыка', price: '7000', points: [{ locationId: second.id }],
      }), { database: db });
      await confirmSellerChangeSet(OWNER.id, free.id, { database: db, clock });
      const byWord = await searchOffers('пасеки', db, { clock, validityPeriodHours: 168 });
      expect(byWord.offers.map((offer) => [offer.product.id, offer.product.name])).toEqual([[null, 'Мёд с пасеки у Иссыка']]);
      expect((await searchOffers('Тау балы', db, { clock, validityPeriodHours: 168 })).offers).toHaveLength(1);
    });
  }, 60000);
});
