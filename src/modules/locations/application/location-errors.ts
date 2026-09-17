export class LocationNotFoundError extends Error {
  readonly code = 'LOCATION_NOT_FOUND' as const;

  constructor() {
    super('Точка не найдена.');
    this.name = 'LocationNotFoundError';
  }
}

export class SellerRequiredError extends Error {
  readonly code = 'SELLER_REQUIRED' as const;

  constructor() {
    super('Сначала создайте продавца.');
    this.name = 'SellerRequiredError';
  }
}
