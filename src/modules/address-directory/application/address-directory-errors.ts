export class AddressDirectoryEntryNotFoundError extends Error {
  readonly code = 'ADDRESS_DIRECTORY_ENTRY_NOT_FOUND' as const;

  constructor() {
    super('Выбранный адрес больше недоступен. Найдите его снова или сохраните адрес вручную.');
    this.name = 'AddressDirectoryEntryNotFoundError';
  }
}
