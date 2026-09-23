import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import type { Locale } from '../../../i18n/config';
import { findSellerByOwner } from '../../sellers/infrastructure/sellers.repository';
import { ChangeSetNotFoundError, SellerInputInvariantError, SellerRequiredError, type SellerChangeSetView } from '../contracts/seller-change-set.contract';
import { findChangeSetViewByIdAndSeller } from '../infrastructure/seller-change-sets.repository';

function assertReadableState(changeSet: SellerChangeSetView) {
  if (changeSet.items.length === 0) throw new SellerInputInvariantError('Seller Change Set не содержит обязательных изменений.');
  if (changeSet.status === 'confirmed' && changeSet.items.some((item) => item.resultOffer === null)) {
    throw new SellerInputInvariantError('Confirmed Seller Change Set не содержит применённого Offer.');
  }
  if (changeSet.status === 'proposed' && changeSet.items.some((item) => item.resultOffer !== null)) {
    throw new SellerInputInvariantError('Proposed Seller Change Set уже содержит применённый Offer.');
  }
}

export async function getSellerChangeSet(
  ownerUserId: string,
  changeSetId: string,
  dependencies: { database?: Database; locale?: Locale } = {},
): Promise<SellerChangeSetView> {
  const database = dependencies.database ?? getDatabase();
  const seller = await findSellerByOwner(database, ownerUserId);
  if (!seller) throw new SellerRequiredError();

  const changeSet = await findChangeSetViewByIdAndSeller(database, changeSetId, seller.id, dependencies.locale);
  if (!changeSet) throw new ChangeSetNotFoundError();
  assertReadableState(changeSet);
  return changeSet;
}
