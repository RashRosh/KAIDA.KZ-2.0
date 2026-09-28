import type { SellerOfferView } from '../../../modules/offers/contracts/seller-offer.contract';
import type { OfferDraftPayload, OfferDraftView } from '../../../modules/offers/drafts/offer-draft.contract';
import { pluralForm } from '../../../i18n/format';
import type { MessageKey } from '../../../i18n/messages';

// seller-showcase-editor: the Seller's Offers grouped into product cards (one product in one or more points).

export type SellerCard = {
  cardId: string;
  offers: SellerOfferView[];
  // Shared fields, read from the first Offer: every card change writes them to all Offers together.
  lead: SellerOfferView;
  commonPrice: string | null;
  // Lowest price when every point has its own price.
  lowestPrice: string | null;
  live: boolean;
  // offer-actuality: the card's oldest switched-on point decides its age; archived only when every such point is.
  // null for a removed or fully switched-off card (outside actuality).
  actuality: CardActuality | null;
  // operator-post-check: the whole card is off the showcase until the Seller fixes and republishes it.
  removal: SellerOfferView['removal'];
  updatedAt: string;
};

export type CardActuality = {
  days: number;
  stage: SellerOfferView['actuality']['stage'];
  due: boolean;
  archived: boolean;
  lastConfirmedAt: string;
};

export function cardActuality(offers: SellerOfferView[]): CardActuality | null {
  if (offers.some((offer) => offer.removal)) return null;
  const active = offers.filter((offer) => offer.status === 'active');
  if (active.length === 0) return null;
  const oldest = active.reduce((a, b) => (b.lastConfirmedAt < a.lastConfirmedAt ? b : a));
  return {
    days: oldest.actuality.days,
    stage: oldest.actuality.stage,
    due: oldest.actuality.due,
    archived: active.every((offer) => offer.actuality.stage === 'archived'),
    lastConfirmedAt: oldest.lastConfirmedAt,
  };
}

export function groupCards(offers: SellerOfferView[]): SellerCard[] {
  const byCard = new Map<string, SellerOfferView[]>();
  for (const offer of offers) byCard.set(offer.cardId, [...(byCard.get(offer.cardId) ?? []), offer]);
  const cards = [...byCard.entries()].map(([cardId, group]) => {
    const sorted = [...group].sort((a, b) => a.location.name.localeCompare(b.location.name));
    const common = sorted.find((offer) => !offer.priceOwn && offer.price)?.price?.amount ?? null;
    const prices = sorted.flatMap((offer) => offer.price ? [Number(offer.price.amount)] : []);
    return {
      cardId,
      offers: sorted,
      lead: sorted[0]!,
      commonPrice: common,
      lowestPrice: common === null && prices.length > 0 ? String(Math.min(...prices)) : null,
      live: sorted.some((offer) => offer.status === 'active'),
      removal: sorted[0]!.removal,
      actuality: cardActuality(sorted),
      updatedAt: sorted.map((offer) => offer.updatedAt).sort().at(-1)!,
    };
  });
  // Newest change first (§2 «Моя витрина»).
  return cards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.cardId.localeCompare(b.cardId));
}

export function findCard(cards: SellerCard[], id: string | null): SellerCard | undefined {
  if (!id) return undefined;
  return cards.find((card) => card.cardId === id || card.offers.some((offer) => offer.id === id));
}

export function pluralKey<K extends 'showcase.points' | 'points.cards' | 'card.willCreate' | 'card.willChange' | 'card.summary' | 'confirm.willPublish' | 'actuality.days' | 'actuality.taskCount' | 'actuality.taskHidden'>(
  base: K,
  count: number,
): MessageKey {
  return `${base}.${pluralForm(count)}` as MessageKey;
}

// What a draft still needs before it can be published, as field labels.
export function missingDraftFields(payload: OfferDraftPayload): MessageKey[] {
  const missing: MessageKey[] = [];
  if (payload.title.trim().length < 2) missing.push('showcase.fieldName');
  if (!(Number(payload.price.replace(',', '.')) > 0)) missing.push('showcase.fieldPrice');
  if (!payload.unit || (payload.unit.code === 'other' && payload.unit.value.trim() === '')) missing.push('showcase.fieldUnit');
  if (payload.points.length === 0) missing.push('showcase.fieldPoint');
  return missing;
}

export type ShowcaseEntry =
  | { kind: 'card'; card: SellerCard; at: string }
  | { kind: 'draft'; draft: OfferDraftView; at: string };

export function showcaseEntries(cards: SellerCard[], drafts: OfferDraftView[]): ShowcaseEntry[] {
  return [
    ...cards.map((card) => ({ kind: 'card' as const, card, at: card.updatedAt })),
    ...drafts.map((draft) => ({ kind: 'draft' as const, draft, at: draft.updatedAt })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}
