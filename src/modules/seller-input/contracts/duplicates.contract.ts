import type { Pack } from '../../offers/pack/pack';
import type { PriceUnit } from '../../offers/price-unit/price-unit';

// text-duplicates: a new-product line of a seller-input channel compared with the Seller's cards at one point.

// The line as the comparison needs it; `uncertain` names fields the channel could not bind with confidence.
export type DuplicateLineInput = {
  title: string;
  price: string | null;
  unit: { code: string } | null;
  pack: Pack | null;
  uncertain: ('price' | 'unit' | 'pack' | 'title')[];
  priceChoices?: string[];
  possiblyMerged?: boolean;
};

// A difference between the line and one card, localised by the client. Comment and photos are never compared.
export type DuplicateDifference =
  | { kind: 'price'; card: string; text: string }
  | { kind: 'priceNotStated' }
  | { kind: 'priceUncertain' }
  | { kind: 'priceConflict'; prices: string[] }
  | { kind: 'nameLonger'; cardTitle: string }
  | { kind: 'nameShorter'; cardTitle: string }
  | { kind: 'nameDiffers'; cardTitle: string }
  | { kind: 'nameUncertain' }
  | { kind: 'packNotInText' }
  | { kind: 'packNotInCard' }
  | { kind: 'packUncertain' }
  | { kind: 'unitDiffers'; card: string | null; text: string }
  | { kind: 'unitNotInText' }
  | { kind: 'unitUncertain' };

export type DuplicateCandidate = {
  offerId: string;
  cardId: string;
  title: string;
  packLabel: string | null;
  price: { amount: string; unit: string | null; unitChoice: PriceUnit | null } | null;
  status: 'live' | 'off';
  differences: DuplicateDifference[];
};

// same — «Без изменений»; sameNoPrice — the same after comparing name, pack and unit, price not stated; differs —
// «Карточка уже есть»; several — «Похожие карточки»; off — «Есть выключенная карточка»; gone — no candidate any more.
export type DuplicateOutcome = 'same' | 'sameNoPrice' | 'differs' | 'several' | 'off' | 'gone';

export type DuplicateCheck = {
  candidates: DuplicateCandidate[];
  // The same product in another known pack: never a candidate, only a note on a draft.
  otherPacks: { offerId: string; title: string; packLabel: string | null }[];
};
