import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { products } from '../../catalog/db/products.table';
import { sellers } from '../../sellers/db/sellers.table';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../../offers/db/offers.table';
import { visibleOffersPredicate } from '../../offers/lifecycle/offer-lifecycle';
import type { SearchOffer } from '../contracts/search.contract';

// A read projection across the four owning modules; lifecycle semantics stay owned by Offers.
export async function findOffersByProductName(db: Database, query: string, cutoff: Date): Promise<SearchOffer[]> {
  const rows = await db.select({
    id: offers.id,
    product: { id: products.id, name: products.name },
    seller: { id: sellers.id, displayName: sellers.displayName },
    location: { id: locations.id, name: locations.name, addressText: locations.addressText },
    priceAmount: offers.priceAmount,
    priceCurrency: offers.priceCurrency,
    priceUnit: offers.priceUnit,
    sellerComment: offers.sellerComment,
  }).from(products)
    .innerJoin(offers, eq(offers.productId, products.id))
    .innerJoin(sellers, eq(sellers.id, offers.sellerId))
    .innerJoin(locations, eq(locations.id, offers.locationId))
    .where(and(
      sql`lower(${products.name}) = lower(${query})`,
      visibleOffersPredicate(cutoff),
    ))
    .orderBy(asc(offers.id));

  return rows.map(({ priceAmount, priceCurrency, priceUnit, ...row }) => {
    if (priceAmount !== null && priceCurrency === null) throw new Error('Invalid stored price');
    return {
      ...row,
      price: priceAmount !== null && priceCurrency !== null
        ? { amount: priceAmount, currency: priceCurrency, unit: priceUnit }
        : null,
    };
  });
}
