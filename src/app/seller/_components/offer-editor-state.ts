// Point helpers shared by the card editor and the points screen (#35 / #36).

// The Seller display name a first-run setup will send: the typed name, or the first point name when left blank.
export function derivedSellerName(sellerName: string, pointName: string): string {
  return sellerName.trim() || pointName.trim();
}

// #36 point rule: exactly one point is shown chosen; with none or several nothing is pre-selected.
export function automaticLocationId(seller: { locations: { id: string }[] } | null): string {
  return seller?.locations.length === 1 ? seller.locations[0]!.id : '';
}
