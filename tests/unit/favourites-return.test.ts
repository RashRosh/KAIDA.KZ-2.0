import { expect, it } from 'vitest';
import { favouritesReturn } from '../../src/modules/favourites/safe-return';
it('only accepts the exact private-list return route, never external or ambiguous paths',()=>{
  expect(favouritesReturn('/favourites')).toBe('/favourites');
  for(const input of [null,'https://evil.invalid','//evil.invalid','/favourites/../seller','/favourites?userId=x','%2Ffavourites','/seller'])expect(favouritesReturn(input)).toBeNull();
});
