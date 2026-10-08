import type { Locale } from '../../../i18n/config';
import type { OpeningHours } from '../../locations/hours/opening-hours';
import { projectPointPublicContacts } from '../../locations/details/point-public-contacts';
import { formatPack, packFromColumns } from '../../offers/pack/pack';
import { formatPriceUnit, priceUnitFromColumns } from '../../offers/price-unit/price-unit';
import type { SearchOffer } from '../contracts/search.contract';

// The buyer's public view of ONE Offer, built from plain fields by one pure function. It is the only place where the stored
// columns become what a buyer sees (price unit label, pack text, public contacts, route capability), used by Search, the buyer
// Offer page and the Seller's private pre-publication preview (docs/slices/pre-publication-buyer-preview §3.3) — so the preview
// cannot drift from the real page. Behavior-preserving extraction from search.repository.

export type BuyerOfferFields = {
  id: string;
  // the catalog link of the card, when it has one
  productId: string | null;
  title: string;
  packAmount: string | null;
  packUnit: string | null;
  seller: { id: string; displayName: string };
  location: { id: string; name: string; addressText: string; openingHours: OpeningHours };
  locationPhoneE164: string | null;
  locationWhatsappPhoneE164: string | null;
  // the verified phone numbers of the Seller: only a verified number becomes a public contact
  verifiedPhones: Set<string> | undefined;
  priceAmount: string;
  priceUnitCode: string | null;
  priceUnitValue: string | null;
  sellerComment: string | null;
  coverPhotoId: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
};

export function projectBuyerOffer(fields: BuyerOfferFields, locale: Locale): { offer: SearchOffer; locationGeo: { latitude: number; longitude: number } | null } {
  const locationGeo = fields.locationLatitude === null || fields.locationLongitude === null
    ? null
    : { latitude: fields.locationLatitude, longitude: fields.locationLongitude };
  const pack = formatPack(packFromColumns(fields.packAmount, fields.packUnit), locale);
  const offer: SearchOffer = {
    id: fields.id,
    // The card title is the Seller's own text in every interface language; id is the optional catalog link.
    product: { id: fields.productId, name: fields.title },
    ...(pack === null ? {} : { pack }),
    seller: fields.seller,
    location: {
      ...fields.location,
      ...projectPointPublicContacts({ phoneE164: fields.locationPhoneE164, whatsappPhoneE164: fields.locationWhatsappPhoneE164 }, fields.verifiedPhones),
    },
    price: { amount: fields.priceAmount, currency: 'KZT', unit: formatPriceUnit(priceUnitFromColumns(fields.priceUnitCode, fields.priceUnitValue), locale) },
    sellerComment: fields.sellerComment,
    // stage 5A: public route capability, derived from the existing route prerequisite (complete Location coordinates);
    // the coordinates themselves never enter the public payload.
    routeAvailable: locationGeo !== null,
    ...(fields.coverPhotoId ? { coverPhotoId: fields.coverPhotoId } : {}),
  };
  return { offer, locationGeo };
}
