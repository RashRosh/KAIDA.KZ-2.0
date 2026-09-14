import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { products } from '../../catalog/db/products.table';
import { sellers } from '../../sellers/db/sellers.table';
import { projectSellerPublicContactProperty } from '../../sellers/contact/project-seller-public-contacts';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../../offers/db/offers.table';
import { visibleOffersPredicate } from '../../offers/lifecycle/offer-lifecycle';
import type { SearchOffer } from '../contracts/search.contract';
import type { SearchRankingCandidate } from '../ranking/search-ranking';

// A read projection across the four owning modules; lifecycle semantics stay owned by Offers.
// S9 adds private ranking metadata beside, never inside, the public SearchOffer payload.
export async function findOffersByProductId(
  db: Database,
  productId: string,
  cutoff: Date,
): Promise<SearchRankingCandidate[]> {
  const rows = await db.select({
    id: offers.id,
    product: { id: products.id, name: products.name },
    seller: { id: sellers.id, displayName: sellers.displayName },
    sellerContactPhoneE164: sellers.contactPhoneE164,
    sellerWhatsappPhoneE164: sellers.whatsappPhoneE164,
    sellerTelegramUsername: sellers.telegramUsername,
    sellerInstagramUsername: sellers.instagramUsername,
    location: { id: locations.id, name: locations.name, addressText: locations.addressText },
    priceAmount: offers.priceAmount,
    priceCurrency: offers.priceCurrency,
    priceUnit: offers.priceUnit,
    sellerComment: offers.sellerComment,
    lastConfirmedAt: offers.lastConfirmedAt,
    locationLatitude: locations.latitude,
    locationLongitude: locations.longitude,
  }).from(products)
    .innerJoin(offers, eq(offers.productId, products.id))
    .innerJoin(sellers, eq(sellers.id, offers.sellerId))
    .innerJoin(locations, eq(locations.id, offers.locationId))
    .where(and(
      eq(products.id, productId),
      visibleOffersPredicate(cutoff),
    ))
    .orderBy(asc(offers.id));

  return rows.map(({
    priceAmount,
    priceCurrency,
    priceUnit,
    sellerContactPhoneE164,
    sellerWhatsappPhoneE164,
    sellerTelegramUsername,
    sellerInstagramUsername,
    lastConfirmedAt,
    locationLatitude,
    locationLongitude,
    ...row
  }) => {
    if (priceAmount !== null && priceCurrency === null) throw new Error('Invalid stored price');

    const offer: SearchOffer = {
      ...row,
      seller: {
        ...row.seller,
        ...projectSellerPublicContactProperty({
          phoneE164: sellerContactPhoneE164,
          whatsappPhoneE164: sellerWhatsappPhoneE164,
          telegramUsername: sellerTelegramUsername,
          instagramUsername: sellerInstagramUsername,
        }),
      },
      price: priceAmount !== null && priceCurrency !== null
        ? { amount: priceAmount, currency: priceCurrency, unit: priceUnit }
        : null,
    };

    const locationGeo = locationLatitude === null || locationLongitude === null
      ? null
      : { latitude: locationLatitude, longitude: locationLongitude };

    return { offer, lastConfirmedAt, locationGeo };
  });
}
