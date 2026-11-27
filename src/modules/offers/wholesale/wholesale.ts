import { z } from 'zod';
import type { Locale } from '../../../i18n/config';

// wholesale-price: the optional wholesale line of a card next to its retail price. The wholesale price is in the
// retail price's basis; the minimum batch is N containers, and a container other than the retail unit itself carries
// how many retail units it holds. The buyer sees the batch with the total volume of the minimum batch.

export const WHOLESALE_CONTAINERS = ['box', 'bag', 'carton', 'net', 'package', 'unit', 'other'] as const;
export type WholesaleContainer = (typeof WHOLESALE_CONTAINERS)[number];
export const WHOLESALE_LISTED_CONTAINERS = ['box', 'bag', 'carton', 'net', 'package'] as const;
export type ListedContainer = (typeof WHOLESALE_LISTED_CONTAINERS)[number];

export const WHOLESALE_BATCH_MAX = 9999;
export const WHOLESALE_CONTAINER_TEXT_MAX_LENGTH = 20;
export const WHOLESALE_PER_CONTAINER_PATTERN = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,3})?$/;
const AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export type Wholesale = {
  amount: string;
  batchCount: number;
  container: WholesaleContainer;
  // «Другое» only: the Seller's own word for the container.
  containerText: string | null;
  // How many retail units one container holds; null when the container is the retail unit itself.
  perContainer: string | null;
};

const wholesaleBaseSchema = z.object({
  amount: z.string().trim().regex(AMOUNT_PATTERN).refine((value) => Number(value) > 0, 'Wholesale price must be greater than 0'),
  batchCount: z.number().int().min(1).max(WHOLESALE_BATCH_MAX),
  container: z.enum(WHOLESALE_CONTAINERS),
  containerText: z.string().trim().min(1).max(WHOLESALE_CONTAINER_TEXT_MAX_LENGTH).optional(),
  perContainer: z.string().trim().regex(WHOLESALE_PER_CONTAINER_PATTERN).refine((value) => Number(value) > 0, 'Must be positive').optional(),
}).strict()
  .refine((value) => (value.container === 'other') === (value.containerText !== undefined), 'Own container text goes with «Другое» only')
  .refine((value) => value.container !== 'unit' || value.perContainer === undefined, 'Unit container does not take per-container quantity');

const toWholesale = (value: z.infer<typeof wholesaleBaseSchema>): Wholesale => ({
  amount: canonicalDecimal(value.amount),
  batchCount: value.batchCount,
  container: value.container,
  containerText: value.containerText ?? null,
  perContainer: value.perContainer === undefined ? null : canonicalDecimal(value.perContainer),
});

export const wholesaleInputSchema = wholesaleBaseSchema
  .refine((value) => value.container === 'unit' || value.perContainer !== undefined, 'A container other than the unit needs its quantity')
  .transform(toWholesale);

// wholesale-only: when there is no retail price, perContainer is optional for containers other than the unit itself.
export const wholesaleFlexibleInputSchema = wholesaleBaseSchema.transform(toWholesale);

export function wholesaleNeedsPerContainer(wholesale: Wholesale): boolean {
  return wholesale.container !== 'unit' && wholesale.perContainer === null;
}

export function canonicalDecimal(value: string): string {
  const [rawWhole = '0', rawFraction = ''] = value.split('.');
  const whole = rawWhole.replace(/^0+(?=\d)/, '') || '0';
  const fraction = rawFraction.replace(/0+$/, '');
  return fraction === '' ? whole : `${whole}.${fraction}`;
}

type WholesaleColumns = {
  wholesalePriceAmount: string | null;
  wholesaleBatchCount: number | null;
  wholesaleContainer: string | null;
  wholesaleContainerText: string | null;
  wholesalePerContainer: string | null;
};

export function wholesaleToColumns(wholesale: Wholesale | null): WholesaleColumns & { wholesaleContainer: WholesaleContainer | null } {
  return {
    wholesalePriceAmount: wholesale?.amount ?? null,
    wholesaleBatchCount: wholesale?.batchCount ?? null,
    wholesaleContainer: wholesale?.container ?? null,
    wholesaleContainerText: wholesale?.containerText ?? null,
    wholesalePerContainer: wholesale?.perContainer ?? null,
  };
}

export function wholesaleFromColumns(columns: WholesaleColumns): Wholesale | null {
  if (columns.wholesalePriceAmount === null) return null;
  if (columns.wholesaleBatchCount === null || !(WHOLESALE_CONTAINERS as readonly string[]).includes(columns.wholesaleContainer ?? '')) {
    throw new Error('Stored wholesale price has an unsupported shape');
  }
  return {
    amount: canonicalDecimal(columns.wholesalePriceAmount),
    batchCount: columns.wholesaleBatchCount,
    container: columns.wholesaleContainer as WholesaleContainer,
    containerText: columns.wholesaleContainerText,
    perContainer: columns.wholesalePerContainer === null ? null : canonicalDecimal(columns.wholesalePerContainer),
  };
}

export function sameWholesale(left: Wholesale | null, right: Wholesale | null): boolean {
  if (left === null || right === null) return left === right;
  return canonicalDecimal(left.amount) === canonicalDecimal(right.amount)
    && left.batchCount === right.batchCount
    && left.container === right.container
    && left.containerText === right.containerText
    && (left.perContainer === null ? right.perContainer === null
      : right.perContainer !== null && canonicalDecimal(left.perContainer) === canonicalDecimal(right.perContainer));
}

// Wire shape for the seller card API and the editor (perContainer / containerText omitted when absent).
export function wholesaleToInput(wholesale: Wholesale) {
  return {
    amount: wholesale.amount,
    batchCount: wholesale.batchCount,
    container: wholesale.container,
    ...(wholesale.containerText === null ? {} : { containerText: wholesale.containerText }),
    ...(wholesale.perContainer === null ? {} : { perContainer: wholesale.perContainer }),
  };
}

// Russian: nominative (editor list), genitive singular and plural after «от N». Kazakh text is preliminary (§18.5).
export const WHOLESALE_CONTAINER_LABELS: Record<Locale, Record<ListedContainer, { name: string; one: string; many: string }>> = {
  ru: {
    box: { name: 'ящик', one: 'ящика', many: 'ящиков' },
    bag: { name: 'мешок', one: 'мешка', many: 'мешков' },
    carton: { name: 'коробка', one: 'коробки', many: 'коробок' },
    net: { name: 'сетка', one: 'сетки', many: 'сеток' },
    package: { name: 'упаковка', one: 'упаковки', many: 'упаковок' },
  },
  kk: {
    box: { name: 'жәшік', one: 'жәшік', many: 'жәшік' },
    bag: { name: 'қап', one: 'қап', many: 'қап' },
    carton: { name: 'қорап', one: 'қорап', many: 'қорап' },
    net: { name: 'тор', one: 'тор', many: 'тор' },
    package: { name: 'қаптама', one: 'қаптама', many: 'қаптама' },
  },
};

// «от 1 ящика», «от 2 ящиков», «от 21 ящика» — the genitive after «от» is singular only for 1, 21, 31 … (not 11).
function genitive(count: number, labels: { one: string; many: string }) {
  return count % 10 === 1 && count % 100 !== 11 ? labels.one : labels.many;
}

// The total volume of the minimum batch, N × M retail units; M has at most three decimals.
export function batchTotal(wholesale: Wholesale): string | null {
  if (wholesale.perContainer === null) return null;
  const thousandths = Math.round(Number(wholesale.perContainer) * 1000) * wholesale.batchCount;
  const whole = Math.floor(thousandths / 1000);
  const fraction = String(thousandths % 1000).padStart(3, '0').replace(/0+$/, '');
  return fraction === '' ? String(whole) : `${whole}.${fraction}`;
}

const NBSP = ' ';
const decimal = (value: string) => value.replace('.', ',');

// «от 1 ящика (≈ 10 кг)», «от 10 кг», «от 3 × лоток (≈ 15 кг)»; Kazakh: «кемінде 1 жәшік (≈ 10 кг)».
export function formatWholesaleBatch(wholesale: Wholesale, unitLabel: string | null, locale: Locale = 'ru'): string {
  const from = locale === 'kk' ? 'кемінде' : 'от';
  const count = wholesale.batchCount;
  const unit = unitLabel ?? '';
  let container: string;
  if (wholesale.container === 'unit') container = `${count}${NBSP}${unit}`;
  else if (wholesale.container === 'other') container = `${count}${NBSP}×${NBSP}${wholesale.containerText}`;
  else {
    const labels = WHOLESALE_CONTAINER_LABELS[locale][wholesale.container];
    container = `${count}${NBSP}${locale === 'kk' ? labels.name : genitive(count, labels)}`;
  }
  const total = batchTotal(wholesale);
  const volume = total === null ? '' : ` (≈${NBSP}${decimal(total)}${NBSP}${unit})`;
  return `${from} ${container}${volume}`;
}

// «в одном ящике» for the editor's quantity field and its review message.
const WHOLESALE_CONTAINER_IN_ONE: Record<Locale, Record<ListedContainer, string>> = {
  ru: { box: 'в одном ящике', bag: 'в одном мешке', carton: 'в одной коробке', net: 'в одной сетке', package: 'в одной упаковке' },
  kk: { box: 'бір жәшікте', bag: 'бір қапта', carton: 'бір қорапта', net: 'бір торда', package: 'бір қаптамада' },
};

export function wholesaleInOne(container: ListedContainer, locale: Locale = 'ru'): string {
  return WHOLESALE_CONTAINER_IN_ONE[locale][container];
}

export function isListedContainer(container: string): container is ListedContainer {
  return (WHOLESALE_LISTED_CONTAINERS as readonly string[]).includes(container);
}

// The container name for the editor list.
export function wholesaleContainerName(container: ListedContainer, locale: Locale = 'ru'): string {
  return WHOLESALE_CONTAINER_LABELS[locale][container].name;
}
