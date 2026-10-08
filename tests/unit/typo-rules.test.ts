import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildVocabulary, costLimit, editCost, isCorrectableWord, isKnownWord, proposeCorrection, TYPO_LIMITS } from '../../src/modules/search/typo/typo-rules';
import { rawWordsOf } from '../../src/modules/search/typo/typo-vocabulary';

// search-typo-suggestions (docs/slices/search-typo-suggestions, contract rev 3 §3.4, §3.9): the correction rules against the
// public vocabulary of the Production KB v1 package (names, aliases) plus a few Offer-title words. The corpora below are the
// documented evidence; every claim of «no wrong correction» is bounded to them.

function csvRows(file: string): string[][] {
  const rows: string[][] = [];
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/u).slice(1)) {
    if (line === '') continue;
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (const character of line) {
      if (character === '"') quoted = !quoted;
      else if (character === ',' && !quoted) { cells.push(cell); cell = ''; } else cell += character;
    }
    cells.push(cell);
    rows.push(cells);
  }
  return rows;
}
const DIR = 'src/modules/catalog/kb-package/v1/';
const catalogWords = [
  ...csvRows(`${DIR}products.csv`).flatMap((row) => [row[1] ?? '', row[2] ?? '']),
  ...csvRows(`${DIR}aliases.csv`).map((row) => row[2] ?? ''),
].flatMap(rawWordsOf);
const OFFER_WORDS = ['свежее', 'свежий', 'тепличные', 'фермерское', 'домашний', 'мытый'];
const vocabulary = buildVocabulary([...catalogWords, ...OFFER_WORDS], 20_000);
const fix = (query: string) => proposeCorrection(query, vocabulary)?.to ?? null;

describe('edit classes and cost limits (contract 3.4)', () => {
  it('allows a missing or extra letter, a swap of neighbours and vowel pairs; nothing else for short words', () => {
    expect(editCost('помидр', 'помидор', 1)).toBe(1);
    expect(editCost('сметанна', 'сметана', 1)).toBe(1);
    expect(editCost('пмоидор', 'помидор', 1)).toBe(1);
    expect(editCost('малоко', 'молоко', 1)).toBe(0.5);
    expect(editCost('малако', 'молоко', 1)).toBe(1);
    expect(editCost('твораг', 'творог', 1)).toBe(0.5);
    expect(editCost('огурци', 'огурцы', 1)).toBe(0.5);
    // a replaced consonant is not an allowed class for words of 5–7 letters
    expect(editCost('машина', 'малина', 1)).toBe(Infinity);
    expect(editCost('груща', 'груша', 1)).toBe(Infinity);
    // for long words a replaced letter (missing + extra) fits the limit of 2
    expect(editCost('картофеля', 'картофелю', 2)).toBe(2);
  });
  it('limits by word length', () => {
    expect(costLimit(4)).toBe(-1);
    expect(costLimit(5)).toBe(1);
    expect(costLimit(7)).toBe(1);
    expect(costLimit(8)).toBe(2);
  });
  it('corrects only words of the letters а–я of at least 5 letters (no language detection)', () => {
    expect(isCorrectableWord('малако')).toBe(true);
    expect(isCorrectableWord('мкуа')).toBe(false);
    expect(isCorrectableWord('қойлар')).toBe(false);
    expect(isCorrectableWord('milk123')).toBe(false);
    expect(isCorrectableWord('a'.repeat(41))).toBe(false);
  });
});

describe('positive corpus: the reliable corrections', () => {
  const positives: [string, string][] = [
    ['малако', 'молоко'], ['малоко', 'молоко'], ['картофль', 'картофель'], ['кортофель', 'картофель'], ['говядна', 'говядина'],
    ['сметанна', 'сметана'], ['помидр', 'помидор'], ['пмидоры', 'помидоры'], ['яблко', 'яблоко'], ['твораг', 'творог'],
    ['морквь', 'морковь'], ['огурци', 'огурцы'], ['баранена', 'баранина'], ['свенина', 'свинина'], ['барнина', 'баранина'],
  ];
  it.each(positives)('%s → %s', (typed, expected) => {
    expect(fix(typed)).toBe(expected);
  });
  it('keeps the known words of a several-word query and corrects the unknown ones (at most two)', () => {
    expect(fix('малако свежее')).toBe('молоко свежее');
    expect(fix('пмидоры тепличные')).toBe('помидоры тепличные');
    expect(fix('малако свежее картофль')).toBe('молоко свежее картофель');
    expect(fix('малако твораг картофль')).toBeNull();
  });
});

describe('negative corpus: no correction is safer (contract 3.4, 3.9; «машина» is a blocking case)', () => {
  const realWordsNotInCatalog = ('машина телефон ноутбук квартира работа автобус книга сумка одежда обувь диван шкаф велосипед зарядка наушники коврик лампа кровать подушка одеяло телевизор холодильник стиральная пылесос чайник кастрюля сковорода тарелка ложка вилка стол стул окно дверь замок ключ ремонт доставка аренда продажа покупка школа больница аптека магазин рынок базар площадь улица дорога мост парк театр кино музей футбол хоккей теннис плавание бассейн пляж море озеро река гора лес поле цветы роза тюльпан ромашка собака кошка попугай хомяк аквариум игрушка конструктор пазл карандаш ручка тетрадь рюкзак портфель куртка джинсы платье футболка свитер шапка перчатки ботинки кроссовки сапоги часы браслет кольцо серьги духи помада шампунь мыло полотенце щётка расчёска зеркало ковёр шторы мебель дерево камень песок цемент кирпич краска обои плитка ламинат гвозди шуруп молоток отвёртка пила дрель станок бензин шины колёса бампер фара двигатель аккумулятор ремень фильтр свечи тормоз кузов прицеп трактор комбайн плуг насос шланг теплица верблюд машинка тележка тротуар светофор пешеход самокат мотоцикл грузовик самолёт вертолёт корабль лодка якорь палатка спальник костёр фонарь компас бинокль').split(/\s+/u);
  it('has at least 150 words and includes «машина»', () => {
    expect(realWordsNotInCatalog.length).toBeGreaterThanOrEqual(150);
    expect(realWordsNotInCatalog).toContain('машина');
  });
  it('corrects none of them', () => {
    const wrong = realWordsNotInCatalog.filter((word) => fix(word) !== null);
    expect(wrong).toEqual([]);
  });
  it('does not correct «машина» to «малина»', () => {
    expect(fix('машина')).toBeNull();
    expect(fix('Машина')).toBeNull();
  });
  it('does not correct ties, words without a close word, known words and prefixes, short words, digits and Latin', () => {
    expect(fix('бараина')).toBeNull(); // «барана» and «баранина» are two different words
    expect(fix('единорог')).toBeNull();
    expect(fix('ксуркап')).toBeNull();
    expect(fix('абрикос')).toBeNull(); // known
    expect(fix('баран')).toBeNull(); // a start of a known word
    expect(fix('мкуа')).toBeNull(); // shorter than 5 letters
    expect(fix('кумс')).toBeNull();
    expect(fix('сыр')).toBeNull();
    expect(fix('qwerty')).toBeNull();
    expect(fix('молоко3.2%')).toBeNull();
    expect(fix('груща')).toBeNull(); // a replaced consonant in a short word (documented gap)
    expect(fix('молоко бетон')).toBeNull(); // every word is known or not correctable: not a typo
  });
  it('never corrects or uses words with Kazakh letters', () => {
    expect(fix('қойлар')).toBeNull();
    expect(fix('малако қойлар')).toBeNull(); // an unknown word with Kazakh letters blocks the correction of the others
    expect(fix('малако қой')).toBe('молоко қой'); // a KNOWN word with Kazakh letters is simply kept
    expect(isKnownWord('қой', buildVocabulary(['қой'], 10))).toBe(true);
  });
  it('gives up on more than six words or more than two corrections', () => {
    expect(fix('малако свежее мытый домашний фермерское тепличные свежий')).toBeNull();
    expect(fix('малако твораг картофль')).toBeNull();
  });
  it('treats the forms of one word as one candidate, not a tie', () => {
    const forms = { formsOf: (word: string) => (['тунец', 'тунца'].includes(word) ? ['тунец', 'тунца'] : null), groupCount: 1, formCount: 2 };
    const local = buildVocabulary(['тунец', 'тунца', 'свежий'], 100);
    expect(proposeCorrection('тунецц', local, { forms })?.to).toBeDefined();
  });
});

describe('bounds: CPU and retrieval (contract 3.11)', () => {
  it('gives up when the CPU budget is exceeded', () => {
    let tick = 0;
    const slow = () => { tick += TYPO_LIMITS.cpuBudgetMs; return tick; };
    expect(proposeCorrection('малако', vocabulary, { now: slow })).toBeNull();
  });
  it('compares only words with the same first letter and a close length', () => {
    const many = buildVocabulary(Array.from({ length: 5000 }, (_, index) => `мало${index.toString(36).padStart(3, 'а')}`.replace(/[0-9]/gu, 'б')), 20_000);
    // must finish and respect the per-word comparison cap (no throw, deterministic null or a proposal)
    expect(() => proposeCorrection('малако', many)).not.toThrow();
  });
  it('caps the dictionary at its size limit', () => {
    const big = buildVocabulary(Array.from({ length: 30_000 }, (_, index) => `слово${index}ааа`), 20_000);
    expect(big.wordCount).toBeLessThanOrEqual(20_000);
  });
});

function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

describe('synthetic mutations of catalog words (precision, contract 3.9)', () => {
  it('never produces a wrong correction for a missing letter, a swap or a vowel-pair replacement', () => {
    let seed = 7;
    const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const base = [...vocabulary.candidates.values()].flat().filter((word) => word.length >= 6);
    const vowel: Record<string, string> = { а: 'о', о: 'а', е: 'и', и: 'е', ы: 'и' };
    let tried = 0;
    let right = 0;
    const wrong: [string, string, string][] = [];
    for (let n = 0; n < 900; n += 1) {
      const word = base[Math.floor(random() * base.length)]!;
      const i = 1 + Math.floor(random() * (word.length - 2));
      let typed: string;
      if (n % 3 === 0) typed = word.slice(0, i) + word.slice(i + 1);
      else if (n % 3 === 1) typed = word.slice(0, i) + word[i + 1]! + word[i]! + word.slice(i + 2);
      else {
        const j = [...word].findIndex((character, index) => index > 0 && vowel[character] !== undefined);
        if (j < 0) continue;
        typed = word.slice(0, j) + vowel[word[j]!]! + word.slice(j + 1);
      }
      if (typed === word || isKnownWord(typed, vocabulary)) continue;
      tried += 1;
      const result = fix(typed)?.replace(/ё/gu, 'е') ?? null;
      // the same word in another form is not a wrong correction (the typed text fits both forms)
      const sameWord = (other: string) => other === word || (commonPrefix(other, word) >= Math.max(other.length, word.length) - 2 && isKnownWord(other, vocabulary));
      if (result !== null && sameWord(result)) right += 1;
      else if (result !== null) wrong.push([word, typed, result]);
    }
    expect(tried).toBeGreaterThan(300);
    expect(wrong).toEqual([]);
    expect(right / tried).toBeGreaterThan(0.85);
  });
});
