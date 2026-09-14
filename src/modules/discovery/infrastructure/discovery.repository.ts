import { asc, eq } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { products } from '../../catalog/db/products.table';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../../offers/db/offers.table';
import { visibleOffersPredicate } from '../../offers/lifecycle/offer-lifecycle';
import { projectSellerPublicContactProperty } from '../../sellers/contact/project-seller-public-contacts';
import { sellers } from '../../sellers/db/sellers.table';
import type { SearchOffer } from '../../search/contracts/search.contract';
import type { NearbyDiscoveryCandidate } from '../ranking/nearby-discovery';

// Read-only Discovery projection. Owning modules keep lifecycle, geo and contact semantics.
export async function findVisibleDiscoveryCandidates(
  db: Database,
  cutoff: Date,
): Promise<NearbyDiscoveryCandidate[]> {
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
  }).from(offers)
    .innerJoin(products, eq(products.id, offers.productId))
    .innerJoin(sellers, eq(sellers.id, offers.sellerId))
    .innerJoin(locations, eq(locations.id, offers.locationId))
    .where(visibleOffersPredicate(cutoff))
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
