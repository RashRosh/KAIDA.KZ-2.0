import { randomUUID } from 'node:crypto';
import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { resolveProduct } from '../../catalog/application/resolve-product';
import { findCatalogProductById } from '../../catalog/infrastructure/products.repository';
import { findOfferPhotoIdsByOffer, findOwnedOfferForManagement, lockCardOffers } from '../../offers/infrastructure/offers.repository';
import { samePack, type Pack } from '../../offers/pack/pack';
import { DraftNotFoundError, findOwnedDraft } from '../../offers/drafts/offer-drafts';
import { samePriceUnit, type PriceUnit } from '../../offers/price-unit/price-unit';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { assertPhotosOwnedBy } from './assert-photos-owned';
import {
  CardNotFoundError,
  CardPointAlreadyAddedError,
  CommonPriceMissingError,
  type CardCreateInput,
  type CardUpdateInput,
  type PointPriceInput,
} from '../contracts/seller-card.contract';
import {
  LocationNotFoundError,
  OfferChangedError,
  OfferNotFoundError,
  OfferUpdateNoChangesError,
  ProductNotFoundError,
  SellerInputInvariantError,
  SellerRequiredError,
  type SellerChangeSetView,
} from '../contracts/seller-change-set.contract';
import {
  createChangeItem,
  createChangeSet,
  createOfferManagementChangeItem,
  findChangeSetViewByIdAndSeller,
  findOwnedLocation,
  insertItemPhotos,
  type SellerInputDb,
} from '../infrastructure/seller-change-sets.repository';

// seller-showcase-editor: ChangeSets for one product card in one or more points. Every item carries the whole card
// snapshot, so a confirmed change leaves title, unit, pack, comment and photos equal across the card's Offers.

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export function canonicalAmount(value: string): string {
  const [rawWhole = '0', rawFraction = ''] = value.split('.');
  const whole = rawWhole.replace(/^0+(?=\d)/, '') || '0';
  const fraction = rawFraction.replace(/0+$/, '');
  return fraction === '' ? whole : `${whole}.${fraction}`;
}

const sameAmount = (left: string | null, right: string | null) =>
  left !== null && right !== null && canonicalAmount(left) === canonicalAmount(right);

// A chosen suggestion links to that product; otherwise an exact whole-name catalog match links silently (decision e).
async function catalogLink(tx: Tx, title: string, productId: string | null): Promise<string | null> {
  if (productId !== null) {
    const product = await findCatalogProductById(tx, productId);
    if (!product) throw new ProductNotFoundError();
    return product.id;
  }
  const resolution = await resolveProduct(tx, title);
  return resolution.status === 'resolved' ? resolution.product.id : null;
}

async function requireSeller(tx: Tx, ownerUserId: string) {
  const seller = await findSellerByOwner(tx, ownerUserId);
  if (!seller) throw new SellerRequiredError();
  return seller;
}

async function loadView(tx: SellerInputDb, changeSetId: string, sellerId: string, expectedItems: number) {
  const view = await findChangeSetViewByIdAndSeller(tx, changeSetId, sellerId);
  if (!view || view.items.length !== expectedItems || view.items.some((item) => item.resultOffer !== null)) {
    throw new SellerInputInvariantError('Созданный Seller Change Set карточки не удалось восстановить из базы.');
  }
  return view;
}

export async function createCardChangeSet(
  ownerUserId: string,
  input: CardCreateInput,
  dependencies: { database?: Database } = {},
): Promise<SellerChangeSetView> {
  const database = dependencies.database ?? getDatabase();
  return database.transaction(async (tx) => {
    const seller = await requireSeller(tx, ownerUserId);
    for (const point of input.points) {
      if (!await findOwnedLocation(tx, point.locationId, seller.id)) throw new LocationNotFoundError();
    }
    await assertPhotosOwnedBy(tx, input.photoIds, ownerUserId);
    const productId = await catalogLink(tx, input.title, input.productId);
    const cardId = randomUUID();
    if (input.draftId && !await findOwnedDraft(tx, input.draftId, seller.id)) throw new DraftNotFoundError();

    const changeSet = await createChangeSet(tx, seller.id, input.draftId ?? null);
    for (const point of input.points) {
      const own = point.ownPrice !== undefined && !sameAmount(point.ownPrice, input.price);
      const item = await createChangeItem(tx, {
        changeSetId: changeSet.id,
        card: { title: input.title, productId, cardId, priceOwn: own, pack: input.pack },
        locationId: point.locationId,
        priceAmount: own ? point.ownPrice! : input.price,
        priceCurrency: 'KZT',
        priceUnit: input.unit,
        sellerComment: input.sellerComment,
      });
      await insertItemPhotos(tx, item.id, input.photoIds);
    }
    return loadView(tx, changeSet.id, seller.id, input.points.length);
  });
}

type CardOffer = Awaited<ReturnType<typeof lockCardOffers>>[number];

function sharedFieldsUnchanged(
  offer: CardOffer,
  photoIds: string[],
  next: { title: string; productId: string | null; unit: PriceUnit; pack: Pack | null; sellerComment: string | null; photoIds: string[] },
) {
  return offer.title === next.title
    && offer.productId === next.productId
    && samePriceUnit(offer.priceUnit, next.unit)
    && samePack(offer.pack, next.pack)
    && (offer.sellerComment ?? null) === next.sellerComment
    && photoIds.length === next.photoIds.length && photoIds.every((id, index) => id === next.photoIds[index]);
}

export async function updateCardChangeSet(
  ownerUserId: string,
  cardId: string,
  input: CardUpdateInput,
  dependencies: { database?: Database } = {},
): Promise<SellerChangeSetView> {
  const database = dependencies.database ?? getDatabase();
  return database.transaction(async (tx) => {
    const seller = await requireSeller(tx, ownerUserId);
    const cardOffers = await lockCardOffers(tx, cardId, seller.id);
    if (cardOffers.length === 0) throw new CardNotFoundError();

    // The editor must have seen exactly these Offers at these revisions (§2 Confirm · Conflict).
    const seen = new Map(input.offers.map((offer) => [offer.offerId, offer]));
    if (seen.size !== cardOffers.length || cardOffers.some((offer) => seen.get(offer.id)?.revision !== offer.revision)) {
      throw new OfferChangedError();
    }

    const cardLocations = new Set(cardOffers.map((offer) => offer.locationId));
    for (const locationId of input.addPoints) {
      if (!await findOwnedLocation(tx, locationId, seller.id)) throw new LocationNotFoundError();
      if (cardLocations.has(locationId)) throw new CardPointAlreadyAddedError();
    }
    await assertPhotosOwnedBy(tx, input.photoIds, ownerUserId);
    const productId = await catalogLink(tx, input.title, input.productId);
    const next = { ...input, productId };

    const photosByOffer = await findOfferPhotoIdsByOffer(tx, cardOffers.map((offer) => offer.id));
    const planned = cardOffers.map((offer) => {
      if (offer.priceAmount === null) throw new SellerInputInvariantError('Offer карточки без цены.');
      const priceAmount = seen.get(offer.id)!.applyPrice ? input.price : offer.priceAmount;
      const priceOwn = !sameAmount(priceAmount, input.price);
      const unchanged = sharedFieldsUnchanged(offer, photosByOffer.get(offer.id) ?? [], next)
        && sameAmount(offer.priceAmount, priceAmount)
        && offer.priceOwn === priceOwn;
      return { offer, priceAmount, priceOwn, unchanged };
    });
    if (input.addPoints.length === 0 && planned.every((item) => item.unchanged)) throw new OfferUpdateNoChangesError();

    const changeSet = await createChangeSet(tx, seller.id);
    const shared = { title: input.title, productId, cardId, pack: input.pack };
    for (const { offer, priceAmount, priceOwn } of planned) {
      const item = await createOfferManagementChangeItem(tx, {
        changeSetId: changeSet.id,
        action: 'update_offer',
        card: { ...shared, priceOwn },
        locationId: offer.locationId,
        priceAmount,
        priceCurrency: 'KZT',
        priceUnit: input.unit,
        sellerComment: input.sellerComment,
        targetOfferId: offer.id,
        expectedOfferRevision: offer.revision,
        photosSpecified: true,
      });
      await insertItemPhotos(tx, item.id, input.photoIds);
    }
    for (const locationId of input.addPoints) {
      const item = await createChangeItem(tx, {
        changeSetId: changeSet.id,
        card: { ...shared, priceOwn: false },
        locationId,
        priceAmount: input.price,
        priceCurrency: 'KZT',
        priceUnit: input.unit,
        sellerComment: input.sellerComment,
      });
      await insertItemPhotos(tx, item.id, input.photoIds);
    }
    return loadView(tx, changeSet.id, seller.id, planned.length + input.addPoints.length);
  });
}

// «Изменить только в этой точке»: only the price of one Offer; null returns it to the card's common price.
export async function pointPriceChangeSet(
  ownerUserId: string,
  offerId: string,
  input: PointPriceInput,
  dependencies: { database?: Database } = {},
): Promise<SellerChangeSetView> {
  const database = dependencies.database ?? getDatabase();
  return database.transaction(async (tx) => {
    const seller = await requireSeller(tx, ownerUserId);
    const owned = await findOwnedOfferForManagement(tx, offerId, seller.id);
    if (!owned) throw new OfferNotFoundError();
    const cardId = owned.cardId;
    const cardOffers = await lockCardOffers(tx, cardId, seller.id);
    const offer = cardOffers.find((candidate) => candidate.id === offerId);
    if (!offer) throw new OfferNotFoundError();
    if (offer.revision !== input.revision) throw new OfferChangedError();
    if (offer.priceAmount === null) throw new SellerInputInvariantError('Offer карточки без цены.');

    const common = cardOffers.find((candidate) => candidate.id !== offer.id && !candidate.priceOwn)?.priceAmount
      ?? (offer.priceOwn ? null : offer.priceAmount);
    let priceAmount: string;
    let priceOwn: boolean;
    if (input.price === null) {
      if (common === null) throw new CommonPriceMissingError();
      priceAmount = common;
      priceOwn = false;
    } else {
      priceAmount = input.price;
      priceOwn = common === null || !sameAmount(input.price, common);
    }
    if (sameAmount(offer.priceAmount, priceAmount) && offer.priceOwn === priceOwn) throw new OfferUpdateNoChangesError();

    const changeSet = await createChangeSet(tx, seller.id);
    await createOfferManagementChangeItem(tx, {
      changeSetId: changeSet.id,
      action: 'update_offer',
      card: { title: offer.title, productId: offer.productId, cardId: offer.cardId, priceOwn, pack: offer.pack },
      locationId: offer.locationId,
      priceAmount,
      priceCurrency: 'KZT',
      priceUnit: offer.priceUnit,
      sellerComment: offer.sellerComment,
      targetOfferId: offer.id,
      expectedOfferRevision: offer.revision,
      photosSpecified: false,
    });
    return loadView(tx, changeSet.id, seller.id, 1);
  });
}
