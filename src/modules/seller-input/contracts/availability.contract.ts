import type { Pack } from '../../offers/pack/pack';

// text-availability: a «нет в наличии» statement of any seller-input channel and its candidates at one point.

export type AvailabilitySaleUnit = 'kg' | 'liter' | 'piece' | 'package';

// none — no pack or unit words; bound — confirmed by the channel's safeguards; uncertain — written but not recognised or
// not bound with confidence (`words` are the Seller's own words for the warning, when known).
export type AvailabilityVariant =
  | { state: 'none' }
  | { state: 'bound'; unit: { code: AvailabilitySaleUnit } | null; pack: Pack | null }
  | { state: 'uncertain'; words: string | null };

export type AvailabilityStatement = {
  label: string;
  sourceQuote: string | null;
  variant: AvailabilityVariant;
};

// live — on sale and selectable; pending — in an unconfirmed switch-off proposal of this list; off_here — switched off
// by a confirmed proposal of this list; off_before — switched off otherwise.
export type AvailabilityCandidateStatus = 'live' | 'pending' | 'off_here' | 'off_before';

export type AvailabilityCandidate = {
  offerId: string;
  revision: number;
  title: string;
  packLabel: string | null;
  price: { amount: string; unit: string | null } | null;
  status: AvailabilityCandidateStatus;
  selectable: boolean;
  blocked?: { kind: 'contradiction' } | { kind: 'pending'; changeSetId: string; action: 'activate_offer' | 'update_offer' | 'deactivate_offer' };
};

// The same product in another pack or unit: shown so the Seller sees it stays as it is; never selectable.
export type AvailabilityOther = { offerId: string; title: string; packLabel: string | null };

export type AvailabilityStatementView = AvailabilityStatement & {
  index: number;
  candidates: AvailabilityCandidate[];
  others: AvailabilityOther[];
};

// A switch-off proposal recorded for this list, as the change-set tables hold it now.
export type TrackedAvailabilityItem = {
  changeSetId: string;
  changeSetStatus: 'proposed' | 'confirmed';
  offerId: string;
  expectedRevision: number;
};
