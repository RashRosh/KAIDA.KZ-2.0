import { describe, expect, it } from 'vitest';
import { priceBasis, priceBasisText } from '../../src/modules/offers/price-unit/price-basis';

const NB = ' ';

// card-price-packaging rev 3 §3.2: the quantity wins over the unit; exactly one measurement unit drops the numeral.
describe('priceBasisText (contract 3.1, 3.2)', () => {
  it('a seller quantity is the basis, the container label is hidden', () => {
    expect(priceBasisText('упак.', '800 г')).toBe(`/${NB}800${NB}г`);
    expect(priceBasisText('упак.', '250 мл')).toBe(`/${NB}250${NB}мл`);
    expect(priceBasisText('упак.', '500 г')).toBe(`/${NB}500${NB}г`);
    expect(priceBasisText('шт', '200 г')).toBe(`/${NB}200${NB}г`);
    expect(priceBasisText('қапт.', '500 г')).toBe(`/${NB}500${NB}г`);
  });
  it('exactly one measurement unit drops the numeral', () => {
    expect(priceBasisText('упак.', '1 л')).toBe(`/${NB}л`);
    expect(priceBasisText('упак.', '1 кг')).toBe(`/${NB}кг`);
    expect(priceBasisText('шт', '1 г')).toBe(`/${NB}г`);
    expect(priceBasisText('дана', '1 мл')).toBe(`/${NB}мл`);
  });
  it('never converts or drops other numbers', () => {
    expect(priceBasisText('упак.', '1000 г')).toBe(`/${NB}1000${NB}г`);
    expect(priceBasisText('упак.', '1,5 л')).toBe(`/${NB}1,5${NB}л`);
    expect(priceBasisText('упак.', '10 л')).toBe(`/${NB}10${NB}л`);
    expect(priceBasisText('упак.', '0,5 кг')).toBe(`/${NB}0,5${NB}кг`);
  });
  it('without a quantity the seller unit follows the slash, as typed', () => {
    expect(priceBasisText('кг', undefined)).toBe(`/${NB}кг`);
    expect(priceBasisText('л', null)).toBe(`/${NB}л`);
    expect(priceBasisText('упак.', undefined)).toBe(`/${NB}упак.`);
    expect(priceBasisText('қапт.', undefined)).toBe(`/${NB}қапт.`);
    expect(priceBasisText('пучок', undefined)).toBe(`/${NB}пучок`);
    expect(priceBasisText('связка из трёх больших пучков зелени', undefined)).toBe(`/${NB}связка из трёх больших пучков зелени`);
  });
  it('neither unit nor quantity: price only', () => {
    expect(priceBasisText(null, undefined)).toBeNull();
    expect(priceBasisText(undefined, null)).toBeNull();
    expect(priceBasisText('', '')).toBeNull();
    expect(priceBasis(null, undefined)).toBeNull();
  });
});
