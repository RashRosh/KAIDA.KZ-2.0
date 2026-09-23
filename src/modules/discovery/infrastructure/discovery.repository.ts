import { asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { products } from '../../catalog/db/products.table';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../../offers/db/offers.table';
import { buyerVisibleOffersPredicate } from '../../offers/visibility/buyer-offer-visibility';
import { projectSellerPublicContactProperty } from '../../sellers/contact/project-seller-public-contacts';
import { sellers } from '../../sellers/db/sellers.table';
import type { SearchOffer } from '../../search/contracts/search.contract';
import type { NearbyDiscoveryCandidate } from '../ranking/nearby-discovery';

// Read-only Discovery projection. Owning modules keep lifecycle, buyer-visibility, geo and contact semantics.
export async function findVisibleDiscoveryCandidates(
  db: Database,
  cutoff: Date,
  locale: 'ru' | 'kk' = 'ru',
): Promise<NearbyDiscoveryCandidate[]> {
  const rows = await db.select({
    id: offers.id,
    productId: products.id,
    productName: locale === 'kk'
      ? sql<string>`coalesce((select pln.name from product_localized_names pln where pln.product_id = ${products.id} and pln.locale = 'kk'), ${products.name})`
      : products.name,
    productNameLocale: locale === 'kk'
      ? sql<'ru' | 'kk'>`case when exists (select 1 from product_localized_names pln where pln.product_id = ${products.id} and pln.locale = 'kk') then 'kk' else 'ru' end`
      : sql<'ru'>`'ru'`,
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
    .where(buyerVisibleOffersPredicate(cutoff))
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
    productId,
    productName,
    productNameLocale,
    ...rest
  }) => {
    if (priceAmount === null || priceCurrency !== 'KZT') {
      throw new Error('Buyer-visible Offer has invalid price');
    }

    const offer: SearchOffer = {
      ...rest,
      product: {
        id: productId,
        name: productName,
        ...(locale === 'kk' ? { nameLocale: productNameLocale } : {}),
      },
      seller: {
        ...rest.seller,
        ...projectSellerPublicContactProperty({
          phoneE164: sellerContactPhoneE164,
          whatsappPhoneE164: sellerWhatsappPhoneE164,
          telegramUsername: sellerTelegramUsername,
          instagramUsername: sellerInstagramUsername,
        }),
      },
      price: { amount: priceAmount, currency: 'KZT', unit: priceUnit },
    };

    const locationGeo = locationLatitude === null || locationLongitude === null
      ? null
      : { latitude: locationLatitude, longitude: locationLongitude };

    return { offer, lastConfirmedAt, locationGeo };
  });
}
