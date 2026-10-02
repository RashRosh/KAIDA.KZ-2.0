import { z } from 'zod';

export const ADDRESS_DIRECTORY_MIN_QUERY = 3;
export const ADDRESS_DIRECTORY_LIMIT = 8;

export const addressDirectoryQuerySchema = z.string().trim().min(ADDRESS_DIRECTORY_MIN_QUERY).max(120);
export const addressDirectoryEntryIdSchema = z.string().trim().min(1).max(240);

export const ADDRESS_DIRECTORY_KINDS = ['address', 'street', 'marketplace', 'retail'] as const;
export type AddressDirectoryKind = (typeof ADDRESS_DIRECTORY_KINDS)[number];

export type AddressDirectorySuggestion = {
  id: string;
  kind: AddressDirectoryKind;
  displayName: string;
  addressText: string;
  latitude: number;
  longitude: number;
};

export type AddressDirectoryEntry = AddressDirectorySuggestion;
