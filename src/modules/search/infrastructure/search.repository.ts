import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { products } from '../../catalog/db/products.table';
import { sellers } from '../../sellers/db/sellers.table';
import { projectSellerPublicContactProperty } from '../../sellers/contact/project-seller-public-contacts';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../../offers/db/offers.table';
import { formatPriceUnit, priceUnitFromColumns } from '../../offers/price-unit/price-unit';
import { buyerVisibleOffersPredicate } from '../../offers/visibility/buyer-offer-visibility';
import { offerCommentTranslations } from '../../offers/db/offer-comment-translations.table';
import {
  currentCommentTranslationJoin,
  currentCommentTranslationSelection,
  projectBuyerCommentTranslation,
} from '../../offers/translation/buyer-comment-translation.projection';
import { isSellerCommentTranslationEnabled } from '../../offers/translation/seller-comment-translation.config';
import type { SearchOffer } from '../contracts/search.contract';
import type { SearchRankingCandidate } from '../ranking/search-ranking';

// A read projection across the four owning modules; lifecycle and buyer-visibility semantics stay outside Search.
// S9 private ranking metadata remains beside, never inside, the public SearchOffer payload.
export async function findOffersByProductId(
  db: Database,
  productId: string,
  cutoff: Date,
  locale: 'ru' | 'kk' = 'ru',
  commentTranslationEnabled: boolean = isSellerCommentTranslationEnabled(),
): Promise<SearchRankingCandidate[]> {
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
    priceUnitCode: offers.priceUnitCode,
    priceUnitValue: offers.priceUnitValue,
    sellerComment: offers.sellerComment,
    ...currentCommentTranslationSelection,
    lastConfirmedAt: offers.lastConfirmedAt,
    locationLatitude: locations.latitude,
    locationLongitude: locations.longitude,
  }).from(products)
    .innerJoin(offers, eq(offers.productId, products.id))
    .innerJoin(sellers, eq(sellers.id, offers.sellerId))
    .innerJoin(locations, eq(locations.id, offers.locationId))
    .leftJoin(offerCommentTranslations, currentCommentTranslationJoin(locale))
    .where(and(
      eq(products.id, productId),
      buyerVisibleOffersPredicate(cutoff),
    ))
    .orderBy(asc(offers.id));

  return rows.map(({
    priceAmount,
    priceCurrency,
    priceUnitCode,
    priceUnitValue,
    sellerContactPhoneE164,
    sellerWhatsappPhoneE164,
    sellerTelegramUsername,
    sellerInstagramUsername,
    lastConfirmedAt,
    locationLatitude,
    locationLongitude,
    productId: selectedProductId,
    productName,
    productNameLocale,
    commentTranslationStatus,
    commentTranslationText,
    commentTranslationSourceLanguage,
    ...rest
  }) => {
    if (priceAmount === null || priceCurrency !== 'KZT') {
      throw new Error('Buyer-visible Offer has invalid price');
    }

    const offer: SearchOffer = {
      ...rest,
      product: {
        id: selectedProductId,
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
      price: { amount: priceAmount, currency: 'KZT', unit: formatPriceUnit(priceUnitFromColumns(priceUnitCode, priceUnitValue), locale) },
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
