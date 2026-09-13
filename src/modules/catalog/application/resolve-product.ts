import {
  findProductCandidatesByNormalizedTerm,
  type ProductReadDb,
} from '../infrastructure/products.repository';

export type ResolvedProduct = { id: string; name: string };

export type ProductResolution =
  | { status: 'resolved'; product: ResolvedProduct }
  | { status: 'not_found' }
  | { status: 'ambiguous' };

export async function resolveProduct(database: ProductReadDb, term: string): Promise<ProductResolution> {
  const candidates = await findProductCandidatesByNormalizedTerm(database, term);
  const distinctProducts = new Map<string, ResolvedProduct>();

  for (const product of candidates) {
    distinctProducts.set(product.id, product);
    if (distinctProducts.size > 1) return { status: 'ambiguous' };
  }

  const product = distinctProducts.values().next().value;
  return product
    ? { status: 'resolved', product }
    : { status: 'not_found' };
}
