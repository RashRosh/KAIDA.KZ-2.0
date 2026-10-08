import { PACK_UNIT_LABELS } from '../pack/pack';

const NBSP = ' ';
const EXACTLY_ONE = new RegExp(`^1 (?:${[...new Set(Object.values(PACK_UNIT_LABELS).flatMap((labels) => Object.values(labels)))].join('|')})$`, 'u');

// card-price-packaging (rev 3): what the displayed price buys, read after the slash. Presentation only: the seller's
// quantity wins over the unit (the container label is hidden); exactly one measurement unit drops the numeral;
// «1000 г» is never turned into «кг»; nothing is converted or derived from the title.
export function priceBasis(unit: string | null | undefined, pack: string | null | undefined): string | null {
  if (pack) return (EXACTLY_ONE.test(pack) ? pack.slice(2) : pack).replace(/ /gu, NBSP);
  return unit ? unit : null;
}

// «/ л», «/ 800 г», «/ упак.», «/ пучок»; the slash stays with the first word (never alone at a line end).
export function priceBasisText(unit: string | null | undefined, pack: string | null | undefined): string | null {
  const basis = priceBasis(unit, pack);
  return basis === null ? null : `/${NBSP}${basis}`;
}
