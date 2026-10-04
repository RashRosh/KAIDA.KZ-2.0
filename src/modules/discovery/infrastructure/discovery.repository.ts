import { asc, eq } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../../offers/db/offers.table';
import { formatPriceUnit, priceUnitFromColumns } from '../../offers/price-unit/price-unit';
import { formatPack, packFromColumns } from '../../offers/pack/pack';
import { offerCoverPhotoIdSelection } from '../../offers/infrastructure/offer-cover-photo.projection';
import { buyerGeoVisibleOffersPredicate } from '../../offers/visibility/buyer-offer-visibility';
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
    productId: offers.productId,
    title: offers.title,
    packAmount: offers.packAmount,
    packUnit: offers.packUnit,
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
    .innerJoin(sellers, eq(sellers.id, offers.sellerId))
    .innerJoin(locations, eq(locations.id, offers.locationId))
    .leftJoin(offerCommentTranslations, currentCommentTranslationJoin(locale))
    .where(buyerGeoVisibleOffersPredicate(cutoff))
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
    title,
    packAmount,
    packUnit,
    commentTranslationStatus,
    commentTranslationText,
    commentTranslationSourceLanguage,
    coverPhotoId,
    ...rest
  }) => {
    if (priceAmount === null || priceCurrency !== 'KZT') {
      throw new Error('Buyer-visible Offer has invalid price');
    }
    const pack = formatPack(packFromColumns(packAmount, packUnit), locale);

    const offer: SearchOffer = {
      ...rest,
      // seller-showcase-editor: the Seller's own title; free-name cards appear in Nearby like any other Offer.
      product: { id: productId, name: title },
      ...(pack === null ? {} : { pack }),
      location: {
        ...rest.location,
        ...projectPointPublicContacts({ phoneE164: locationPhoneE164, whatsappPhoneE164: locationWhatsappPhoneE164 }, verifiedBySeller.get(rest.seller.id)),
      },
      price: { amount: priceAmount, currency: 'KZT', unit: formatPriceUnit(priceUnitFromColumns(priceUnitCode, priceUnitValue), locale) },
      // Nearby requires complete Location coordinates (geo overlay), so the route capability is always available here.
      routeAvailable: true,
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
