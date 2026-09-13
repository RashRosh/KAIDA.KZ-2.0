import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/db/client';
import { resolveProduct } from '../../src/modules/catalog/application/resolve-product';
import { calculateOfferCutoff } from '../../src/modules/offers/lifecycle/offer-lifecycle';
import { searchOffers } from '../../src/modules/search/application/search-offers';
import { findOffersByProductId } from '../../src/modules/search/infrastructure/search.repository';

const PRODUCT = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Баранина',
};

vi.mock('../../src/modules/catalog/application/resolve-product', () => ({
  resolveProduct: vi.fn().mockResolvedValue({
    status: 'resolved',
    product: {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Баранина',
    },
  }),
}));

vi.mock('../../src/modules/search/infrastructure/search.repository', () => ({
  findOffersByProductId: vi.fn().mockResolvedValue([]),
}));

const mockedResolveProduct = vi.mocked(resolveProduct);
const mockedFindOffers = vi.mocked(findOffersByProductId);

describe('S1 offer lifecycle', () => {
  beforeEach(() => {
    mockedResolveProduct.mockClear();
    mockedResolveProduct.mockResolvedValue({ status: 'resolved', product: PRODUCT });
    mockedFindOffers.mockClear();
    mockedFindOffers.mockResolvedValue([]);
  });

  it('calculates the cutoff from one fixed now and a validated 168 hour period', () => {
    const now = new Date('2026-09-11T12:00:00.000Z');
    expect(calculateOfferCutoff(now, 168)).toEqual(new Date('2026-09-04T12:00:00.000Z'));
  });

  it('captures the injected clock exactly once for one Search operation', async () => {
    const now = new Date('2026-09-11T12:00:00.000Z');
    const clock = vi.fn(() => now);
    const database = {} as Database;

    const result = await searchOffers('  Баранина  ', database, { clock, validityPeriodHours: 168 });

    expect(result).toEqual({ query: 'Баранина', offers: [] });
    expect(clock).toHaveBeenCalledTimes(1);
    expect(mockedResolveProduct).toHaveBeenCalledTimes(1);
    expect(mockedResolveProduct).toHaveBeenCalledWith(database, 'Баранина');
    expect(mockedFindOffers).toHaveBeenCalledTimes(1);
    expect(mockedFindOffers).toHaveBeenCalledWith(
      database,
      PRODUCT.id,
      new Date('2026-09-04T12:00:00.000Z'),
    );
  });

  it('rejects an invalid internal validity override before the repository is called', async () => {
    const database = {} as Database;
    await expect(searchOffers('Баранина', database, {
      clock: () => new Date('2026-09-11T12:00:00.000Z'),
      validityPeriodHours: 0,
    })).rejects.toThrow(/positive integer/i);
    expect(mockedFindOffers).not.toHaveBeenCalled();
  });
});
