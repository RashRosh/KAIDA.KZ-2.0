import { asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { products } from '../../catalog/db/products.table';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../../offers/db/offers.table';
import { formatPriceUnit, priceUnitFromColumns } from '../../offers/price-unit/price-unit';
import { offerCoverPhotoIdSelection } from '../../offers/infrastructure/offer-cover-photo.projection';
import { buyerVisibleOffersPredicate } from '../../offers/visibility/buyer-offer-visibility';
import { offerCommentTranslations } from '../../offers/db/offer-comment-translations.table';
import {
  currentCommentTranslationJoin,
  currentCommentTranslationSelection,
  projectBuyerCommentTranslation,
} from '../../offers/translation/buyer-comment-translation.projection';
import { isSellerCommentTranslationEnabled } from '../../offers/translation/seller-comment-translation.config';
import { findVerifiedPhonesBySellers } from '../../locations/details/point-details.repository';
import { projectPointPublicContacts } from '../../locations/details/point-public-contacts';
import { sellers } from '../../sellers/db/sellers.table';
import type { SearchOffer } from '../../search/contracts/search.contract';
import type { NearbyDiscoveryCandidate } from '../ranking/nearby-discovery';

// Read-only Discovery projection. Owning modules keep lifecycle, buyer-visibility, geo and contact semantics.
export async function findVisibleDiscoveryCandidates(
  db: Database,
  cutoff: Date,
  locale: 'ru' | 'kk' = 'ru',
  commentTranslationEnabled: boolean = isSellerCommentTranslationEnabled(),
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
    location: { id: locations.id, name: locations.name, addressText: locations.addressText, openingHours: locations.openingHours },
    locationPhoneE164: locations.phoneE164,
    locationWhatsappPhoneE164: locations.whatsappPhoneE164,
    priceAmount: offers.priceAmount,
    priceCurrency: offers.priceCurrency,
    priceUnitCode: offers.priceUnitCode,
    priceUnitValue: offers.priceUnitValue,
    sellerComment: offers.sellerComment,
    coverPhotoId: offerCoverPhotoIdSelection,
    ...currentCommentTranslationSelection,
    lastConfirmedAt: offers.lastConfirmedAt,
    locationLatitude: locations.latitude,
    locationLongitude: locations.longitude,
  }).from(offers)
    .innerJoin(products, eq(products.id, offers.productId))
    .innerJoin(sellers, eq(sellers.id, offers.sellerId))
    .innerJoin(locations, eq(locations.id, offers.locationId))
    .leftJoin(offerCommentTranslations, currentCommentTranslationJoin(locale))
    .where(buyerVisibleOffersPredicate(cutoff))
    .orderBy(asc(offers.id));

  const verifiedBySeller = await findVerifiedPhonesBySellers(db, [...new Set(rows.map((row) => row.seller.id))]);

  return rows.map(({
    priceAmount,
    priceCurrency,
    priceUnitCode,
    priceUnitValue,
    locationPhoneE164,
    locationWhatsappPhoneE164,
    lastConfirmedAt,
    locationLatitude,
    locationLongitude,
    productId,
    productName,
    productNameLocale,
    commentTranslationStatus,
    commentTranslationText,
    commentTranslationSourceLanguage,
    coverPhotoId,
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
      location: {
        ...rest.location,
        ...projectPointPublicContacts({ phoneE164: locationPhoneE164, whatsappPhoneE164: locationWhatsappPhoneE164 }, verifiedBySeller.get(rest.seller.id)),
      },
      price: { amount: priceAmount, currency: 'KZT', unit: formatPriceUnit(priceUnitFromColumns(priceUnitCode, priceUnitValue), locale) },
      ...(coverPhotoId ? { coverPhotoId } : {}),
    };
    const sellerCommentTranslation = projectBuyerCommentTranslation({
      enabled: commentTranslationEnabled,
      locale,
      sellerComment: rest.sellerComment,
      status: commentTranslationStatus,
      translatedText: commentTranslationText,
      detectedSourceLanguage: commentTranslationSourceLanguage,
    });
    if (sellerCommentTranslation) offer.sellerCommentTranslation = sellerCommentTranslation;

    const locationGeo = locationLatitude === null || locationLongitude === null
      ? null
      : { latitude: locationLatitude, longitude: locationLongitude };

    return { offer, lastConfirmedAt, locationGeo };
  });
}
