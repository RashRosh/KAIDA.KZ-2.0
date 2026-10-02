import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import type { AddressDirectorySuggestion } from '../contracts/address-directory.contract';
import { searchActiveAddressDirectory } from '../infrastructure/address-directory.repository';

export function searchAddressDirectory(
  query: string,
  dependencies: { database?: Database } = {},
): Promise<AddressDirectorySuggestion[]> {
  return searchActiveAddressDirectory(dependencies.database ?? getDatabase(), query);
}
