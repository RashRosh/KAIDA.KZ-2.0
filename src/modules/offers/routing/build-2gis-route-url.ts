import { locationGeoSchema } from '../../locations/contracts/location.contract';
import type { BuyerOfferRouteDestination } from '../infrastructure/buyer-offer-route.repository';

export function build2GisRouteUrl(destination: BuyerOfferRouteDestination): string {
  const point = locationGeoSchema.parse(destination);
  const longitude = encodeURIComponent(String(point.longitude));
  const latitude = encodeURIComponent(String(point.latitude));
  return `dgis://2gis.ru/routeSearch/rsType/car/to/${longitude},${latitude}`;
}
