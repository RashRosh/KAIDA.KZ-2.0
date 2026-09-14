import { describe, expect, it } from 'vitest';
import { assertNoBatchOfferConflicts } from '../../src/modules/seller-input/application/create-batch-seller-change-set';
import {
  BatchOfferConflictError,
  sellerBatchChangeSetCreateBodySchema,
} from '../../src/modules/seller-input/contracts/seller-change-set.contract';

const LOCATION_ID = '30000000-0000-4000-8000-000000000001';
const OFFER_A = '40000000-0000-4000-8000-000000000001';
const OFFER_B = '40000000-0000-4000-8000-000000000002';

describe('S12 batch seller input contract', () => {
  it('requires at least two strict action-specific items', () => {
    expect(sellerBatchChangeSetCreateBodySchema.safeParse({ items: [] }).success).toBe(false);
    expect(sellerBatchChangeSetCreateBodySchema.safeParse({
      items: [{ action: 'activate_offer', offerId: OFFER_A }],
    }).success).toBe(false);
    expect(sellerBatchChangeSetCreateBodySchema.safeParse({
      items: [
        { action: 'activate_offer', offerId: OFFER_A, extra: true },
        { action: 'deactivate_offer', offerId: OFFER_B },
      ],
    }).success).toBe(false);
  });

  it('accepts a mixed batch while preserving S4/S5 shapes', () => {
    const parsed = sellerBatchChangeSetCreateBodySchema.parse({
      items: [
        {
          action: 'create_offer',
          productName: 'Баранина',
          locationId: LOCATION_ID,
          price: { amount: '4500.00', unit: 'кг' },
          sellerComment: 'Новая партия',
        },
        {
          action: 'update_offer',
          offerId: OFFER_A,
          price: null,
          sellerComment: null,
        },
      ],
    });

    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0]).toMatchObject({ action: 'create_offer', productName: 'Баранина' });
    expect(parsed.items[1]).toEqual({ action: 'update_offer', offerId: OFFER_A, price: null, sellerComment: null });
  });

  it('rejects duplicate management targets before persistence but does not deduplicate create_offer tuples', () => {
    const conflict = sellerBatchChangeSetCreateBodySchema.parse({
      items: [
        { action: 'update_offer', offerId: OFFER_A, price: null, sellerComment: null },
        { action: 'activate_offer', offerId: OFFER_A },
      ],
    });
    expect(() => assertNoBatchOfferConflicts(conflict.items)).toThrow(BatchOfferConflictError);

    const creates = sellerBatchChangeSetCreateBodySchema.parse({
      items: [
        { action: 'create_offer', productName: 'Баранина', locationId: LOCATION_ID },
        { action: 'create_offer', productName: 'Баранина', locationId: LOCATION_ID },
      ],
    });
    expect(() => assertNoBatchOfferConflicts(creates.items)).not.toThrow();
  });
});