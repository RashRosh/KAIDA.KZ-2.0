import { and, asc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { sellers } from '../../sellers/db/sellers.table';
import { findVerifiedPhonesBySellers } from '../../locations/details/point-details.repository';
import { projectPointPublicContacts } from '../../locations/details/point-public-contacts';
import { locations } from '../../locations/db/locations.table';
import { offers } from '../../offers/db/offers.table';
import { formatPriceUnit, priceUnitFromColumns } from '../../offers/price-unit/price-unit';
import { formatPack, packFromColumns } from '../../offers/pack/pack';
import { offerCoverPhotoIdSelection } from '../../offers/infrastructure/offer-cover-photo.projection';
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
import { getWordFormDictionary } from '../word-forms/word-forms';

// A read projection across the four owning modules; lifecycle and buyer-visibility semantics stay outside Search.
// S9 private ranking metadata remains beside, never inside, the public SearchOffer payload.
// seller-showcase-editor: Offers linked to the resolved catalog product, or whose own title has every query word as
// the start of one of its words or is one of the reviewed forms of a word of the title
// (words are already normalized: letters and digits only).
export async function findOffersByProductOrTitleWords(
  db: Database,
  match: { productIds: string[]; words: string[] },
  cutoff: Date,
  locale: 'ru' | 'kk' = 'ru',
  commentTranslationEnabled: boolean = isSellerCommentTranslationEnabled(),
): Promise<SearchRankingCandidate[]> {
  return findBuyerVisibleOffers(db, match, cutoff, locale, commentTranslationEnabled);
}

function withPack(pack: string | null) {
  return pack === null ? {} : { pack };
}

// search-word-forms: a query word matches by prefix (as before) OR, when the reviewed dictionary knows it, when the title
// has exactly one of the forms of its group. A word outside the dictionary matches by prefix only; every word is required.
// No locale takes part here.
// Cost (contract 3.6): forms are grouped by their first three letters and each group is guarded by a plain substring test
// of that core, so the title is split into words only for rows that contain a candidate core. A title that holds a form
// always holds the form's core, so the guard never changes the result. Forms are letters only (searchWords), safe in a
// `{a,b}` array literal that is still passed as one bound parameter.
function wordMatch(word: string): SQL {
  const prefix = sql`(' ' || ${offers.titleSearch}) like ${`% ${word}%`}`;
  const forms = getWordFormDictionary().formsOf(word);
  if (forms === null) return prefix;
  const byCore = new Map<string, string[]>();
  for (const form of forms) {
    const core = form.slice(0, 3);
    const list = byCore.get(core);
    if (list === undefined) byCore.set(core, [form]);
    else list.push(form);
  }
  const formMatches = [...byCore].map(([core, list]) =>
    sql`(strpos(${offers.titleSearch}, ${core}) > 0 and string_to_array(${offers.titleSearch}, ' ') && ${`{${list.join(',')}}`}::text[])`);
  return sql`(${sql.join([prefix, ...formMatches], sql` or `)})`;
}

function titleWordsMatch(words: string[]): SQL | undefined {
  if (words.length === 0) return undefined;
  return and(...words.map(wordMatch));
}

function productOrWords(filter: { productIds: string[]; words: string[] }): SQL {
  const conditions = [
    filter.productIds.length === 0 ? undefined : inArray(offers.productId, filter.productIds),
    titleWordsMatch(filter.words),
  ].filter((condition): condition is SQL => condition !== undefined);
  return conditions.length === 0 ? sql`false` : or(...conditions)!;
}

// The same buyer projection for the buyer Offer page: one Offer, same visibility policy, never a hidden one.
export async function findBuyerVisibleOfferById(
  db: Database,
  offerId: string,
  cutoff: Date,
  locale: 'ru' | 'kk' = 'ru',
  commentTranslationEnabled: boolean = isSellerCommentTranslationEnabled(),
): Promise<SearchRankingCandidate | null> {
  const rows = await findBuyerVisibleOffers(db, { offerId }, cutoff, locale, commentTranslationEnabled);
  return rows[0] ?? null;
}

async function findBuyerVisibleOffers(
  db: Database,
  filter: { productIds: string[]; words: string[] } | { offerId: string },
  cutoff: Date,
  locale: 'ru' | 'kk',
  commentTranslationEnabled: boolean,
): Promise<SearchRankingCandidate[]> {
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
    .where(and(
      'offerId' in filter ? eq(offers.id, filter.offerId) : productOrWords(filter),
      buyerVisibleOffersPredicate(cutoff),
    ))
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
    productId: selectedProductId,
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

    const locationGeo = locationLatitude === null || locationLongitude === null
      ? null
      : { latitude: locationLatitude, longitude: locationLongitude };

    const offer: SearchOffer = {
      ...rest,
      // The card title is the Seller's own text in every interface language; id is the optional catalog link.
      product: { id: selectedProductId, name: title },
      ...withPack(formatPack(packFromColumns(packAmount, packUnit), locale)),
      location: {
        ...rest.location,
        ...projectPointPublicContacts({ phoneE164: locationPhoneE164, whatsappPhoneE164: locationWhatsappPhoneE164 }, verifiedBySeller.get(rest.seller.id)),
      },
      price: { amount: priceAmount, currency: 'KZT', unit: formatPriceUnit(priceUnitFromColumns(priceUnitCode, priceUnitValue), locale) },
      // stage 5A: public route capability, derived from the existing route prerequisite (complete Location
      // coordinates); the coordinates themselves never enter the public payload.
      routeAvailable: locationGeo !== null,
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

    return { offer, lastConfirmedAt, locationGeo };
  });
}
