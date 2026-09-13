import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../src/db/client';
import { seedIds } from '../../src/db/seed';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { confirmSellerChangeSet } from '../../src/modules/seller-input/application/confirm-seller-change-set';
import { createOfferManagementChangeSet } from '../../src/modules/seller-input/application/create-offer-management-change-set';
import { createSellerChangeSet } from '../../src/modules/seller-input/application/create-seller-change-set';
import {
  sellerChangeSetCreateBodySchema,
  sellerOfferChangeBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';
import { setupSeller } from '../../src/modules/sellers/application/setup-seller';
import { connectTestDatabase } from './database';

let db: Database;
let pool: Awaited<ReturnType<typeof connectTestDatabase>>['pool'];

const T0 = new Date('2026-09-13T08:00:00.000Z');
const T1 = new Date('2026-09-13T09:00:00.000Z');
const searchOptions = { clock: () => T1, validityPeriodHours: 168 };

async function cleanupUser(userId: string, phone: string) {
  await pool.query('DELETE FROM seller_change_items WHERE change_set_id IN (SELECT cs.id FROM seller_change_sets cs JOIN sellers s ON s.id=cs.seller_id WHERE s.owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM seller_change_sets WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM offers WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM locations WHERE seller_id IN (SELECT id FROM sellers WHERE owner_user_id=$1)', [userId]);
  await pool.query('DELETE FROM sellers WHERE owner_user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
  await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
  await pool.query('DELETE FROM users WHERE id=$1 OR phone_e164=$2', [userId, phone]);
}

function containsIdentity(
  result: Awaited<ReturnType<typeof searchOffers>>,
  identity: { sellerId: string; locationId: string; sellerComment: string },
) {
  return result.offers.some((offer) => (
    offer.seller.id === identity.sellerId
    && offer.location.id === identity.locationId
    && offer.sellerComment === identity.sellerComment
  ));
}

beforeAll(async () => {
  const connection = await connectTestDatabase();
  db = connection.db;
  pool = connection.pool;
});

afterAll(async () => { await pool.end(); });

describe.sequential('S7 real Seller-created Offer through existing Search on PostgreSQL 18', () => {
  it('proves proposal -> confirmation -> canonical/alias Search -> proposed/confirmed deactivation on the exact Offer', async () => {
    const userId = randomUUID();
    const phone = '+77000000771';
    const fixtureSuffix = userId.slice(0, 8);
    const sellerName = `S7 Seller ${fixtureSuffix}`;
    const locationName = `S7 Point ${fixtureSuffix}`;
    const sellerComment = `S7 unique comment ${fixtureSuffix}`;

    await cleanupUser(userId, phone);
    await pool.query('DELETE FROM auth_otp_challenges WHERE phone_e164=$1', [phone]);
    await pool.query('DELETE FROM users WHERE phone_e164=$1', [phone]);
    await pool.query('INSERT INTO users (id, phone_e164, created_at) VALUES ($1,$2,$3)', [userId, phone, T0]);

    const seller = await setupSeller(userId, {
      seller: { displayName: sellerName },
      location: { name: locationName, type: 'shop', addressText: `Almaty S7 ${fixtureSuffix}` },
    }, { database: db });
    const locationId = seller.locations[0]!.id;
    const identity = { sellerId: seller.id, locationId, sellerComment };

    try {
      const proposal = await createSellerChangeSet(userId, sellerChangeSetCreateBodySchema.parse({
        productName: 'мясо барана',
        locationId,
        price: { amount: '4777.00', unit: 'кг' },
        sellerComment,
      }), { database: db });

      expect(proposal.status).toBe('proposed');
      expect(proposal.items[0]).toMatchObject({
        action: 'create_offer',
        product: { id: seedIds.lambProduct, name: 'Баранина' },
        resultOffer: null,
      });

      const beforeConfirmation = await searchOffers('Баранина', db, searchOptions);
      expect(containsIdentity(beforeConfirmation, identity)).toBe(false);

      const confirmed = await confirmSellerChangeSet(userId, proposal.id, { database: db, clock: () => T0 });
      const resultOffer = confirmed.items[0]!.resultOffer;
      expect(resultOffer).not.toBeNull();
      const offerId = resultOffer!.id;

      const canonical = await searchOffers('Баранина', db, searchOptions);
      const alias = await searchOffers('мясо барана', db, searchOptions);
      const canonicalOffer = canonical.offers.find((offer) => offer.id === offerId);
      const aliasOffer = alias.offers.find((offer) => offer.id === offerId);

      expect(canonicalOffer).toMatchObject({
        id: offerId,
        product: { id: seedIds.lambProduct, name: 'Баранина' },
        seller: { id: seller.id, displayName: sellerName },
        location: { id: locationId, name: locationName },
        sellerComment,
      });
      expect(aliasOffer).toEqual(canonicalOffer);

      const deactivateProposal = await createOfferManagementChangeSet(
        userId,
        offerId,
        sellerOfferChangeBodySchema.parse({ action: 'deactivate_offer' }),
        { database: db },
      );
      expect(deactivateProposal.status).toBe('proposed');
      expect(deactivateProposal.items[0]).toMatchObject({
        action: 'deactivate_offer',
        resultOffer: null,
      });

      const canonicalWhileProposed = await searchOffers('Баранина', db, searchOptions);
      const aliasWhileProposed = await searchOffers('мясо барана', db, searchOptions);
      expect(canonicalWhileProposed.offers.some((offer) => offer.id === offerId)).toBe(true);
      expect(aliasWhileProposed.offers.some((offer) => offer.id === offerId)).toBe(true);

      const deactivated = await confirmSellerChangeSet(userId, deactivateProposal.id, { database: db, clock: () => T1 });
      expect(deactivated.items[0]!.resultOffer).toMatchObject({ id: offerId, status: 'inactive' });

      const canonicalAfterDeactivation = await searchOffers('Баранина', db, searchOptions);
      const aliasAfterDeactivation = await searchOffers('мясо барана', db, searchOptions);
      expect(canonicalAfterDeactivation.offers.some((offer) => offer.id === offerId)).toBe(false);
      expect(aliasAfterDeactivation.offers.some((offer) => offer.id === offerId)).toBe(false);
    } finally {
      await cleanupUser(userId, phone);
    }
  });
});
