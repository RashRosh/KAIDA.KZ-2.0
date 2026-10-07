import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getWordFormDictionary, parseWordForms, wordEvidence } from '../../src/modules/search/word-forms/word-forms';

// search-word-forms (docs/slices/search-word-forms): the reviewed dictionary file, its rules and the E/F/P evidence.
const FILE = 'src/modules/search/word-forms/word-forms.v1.csv';
// a Windows checkout may turn the file's LF into CRLF (autocrlf); the dictionary itself is committed with LF
const lines = readFileSync(FILE, 'utf8').split(/\r?\n/u);
const rows = lines.slice(1).filter(Boolean).map((line) => line.split(','));
const dictionary = getWordFormDictionary();

describe('word-forms.v1.csv rules (contract 3.1, 3.9)', () => {
  it('has the header, two columns everywhere, sorted unique rows', () => {
    expect(lines[0]).toBe('group,form');
    expect(rows.every((row) => row.length === 2)).toBe(true);
    const keys = rows.map((row) => row.join(','));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });
  it('R2: forms are normalized like searchWords (lower case, no ё, letters а-я only, length >= 2)', () => {
    for (const [, form] of rows) expect(form).toMatch(/^[а-я]{2,}$/u);
  });
  it('R3: no form is in two groups', () => {
    const owner = new Map<string, string>();
    for (const [group, form] of rows) {
      expect(owner.get(form), form).toBeUndefined();
      owner.set(form, group);
    }
  });
  it('R4: function words are not in the dictionary', () => {
    for (const word of ['на', 'для', 'из', 'без', 'под', 'над', 'при', 'про', 'или', 'не', 'по', 'от', 'до', 'за', 'он', 'она', 'мой', 'этот'])
      expect(dictionary.formsOf(word), word).toBeNull();
  });
  it('R4: «из» (also a form of the noun «иза») is removed; «хрен» and «апорт» stay as reviewed product names', () => {
    expect(dictionary.formsOf('из')).toBeNull();
    expect(dictionary.formsOf('иза') ?? []).not.toContain('из');
    expect(dictionary.formsOf('хрен')).toEqual(expect.arrayContaining(['хрен', 'хрена']));
    expect(dictionary.formsOf('апорт')).toContain('апорт');
    // no form of the dictionary equals a Russian preposition, conjunction or particle
    for (const word of ['в', 'во', 'и', 'а', 'но', 'то', 'ли', 'же', 'бы', 'ни', 'у', 'о', 'об', 'со', 'ко', 'вы', 'мы', 'ты', 'им', 'их', 'ее', 'его', 'нам', 'вам', 'нас', 'вас', 'это', 'что', 'как', 'так', 'все', 'вот', 'уж', 'ей', 'ему', 'ним', 'нее', 'тут', 'там'])
      expect(dictionary.formsOf(word), word).toBeNull();
  });
  it('applies the reviewed merges and the exclusion of shared forms', () => {
    expect(dictionary.formsOf('сом')).toEqual(expect.arrayContaining(['сом', 'сома', 'сомы']));
    expect(dictionary.formsOf('белые')).toContain('белый');
    for (const shared of ['осетров', 'зеленей', 'абрикосов', 'гранатов', 'кокосов', 'рисов', 'арахисов', 'медов'])
      expect(dictionary.formsOf(shared), shared).toBeNull();
  });
  it('stays inside the caps: 15,000 forms and 100 forms per group', () => {
    expect(rows.length).toBeLessThanOrEqual(15000);
    const sizes = new Map<string, number>();
    for (const [group] of rows) sizes.set(group, (sizes.get(group) ?? 0) + 1);
    expect(Math.max(...sizes.values())).toBeLessThanOrEqual(100);
    expect(dictionary.formCount).toBe(rows.length);
    expect(dictionary.groupCount).toBe(sizes.size);
  });
  it('covers the grammatical forms of the observed and the irregular cases', () => {
    expect(dictionary.formsOf('груша')).toEqual(expect.arrayContaining(['груша', 'груши', 'грушу', 'грушей']));
    expect(dictionary.formsOf('огурец')).toEqual(expect.arrayContaining(['огурцы', 'огурцов']));
    expect(dictionary.formsOf('перец')).toEqual(expect.arrayContaining(['перцы', 'перца']));
    expect(dictionary.formsOf('морковь')).toContain('моркови');
    expect(dictionary.formsOf('яйцо')).toEqual(expect.arrayContaining(['яйца', 'яиц']));
  });
  it('R5: no semantic expansion — derived words and related words are never in a group', () => {
    const apart: [string, string][] = [
      ['зелень', 'зеленый'], ['печень', 'печенье'], ['варенье', 'вареный'], ['крупа', 'крупный'], ['груша', 'грушевый'], ['мясо', 'масло'],
      ['макароны', 'макаронный'], ['говядина', 'говяжий'], ['баранина', 'бараний'], ['свинина', 'свиной'], ['конина', 'конский'],
      ['курица', 'куриный'], ['утка', 'утиный'], ['рис', 'рисовый'],
    ];
    for (const [word, other] of apart) expect(dictionary.formsOf(word) ?? [], `${word} / ${other}`).not.toContain(other);
    // «чай» and its forms stay a single small group: no «ча» stem exists anywhere
    expect(dictionary.formsOf('ча')).toBeNull();
  });
});

describe('parseWordForms', () => {
  it('reads LF and CRLF files, ignores the header and blank lines', () => {
    const parsed = parseWordForms('group,form\r\nгруша|NOUN,груша\r\nгруша|NOUN,груши\r\n\r\n');
    expect(parsed.formsOf('груши')).toEqual(['груша', 'груши']);
    expect(parsed.formsOf('грушевый')).toBeNull();
    expect(parsed.groupCount).toBe(1);
    expect(parsed.formCount).toBe(2);
  });
  it('rejects a form in two groups and a malformed line', () => {
    expect(() => parseWordForms('group,form\na|NOUN,x\nb|NOUN,x\n')).toThrow(/two groups/u);
    expect(() => parseWordForms('group,form\nbroken\n')).toThrow(/Malformed/u);
  });
});

describe('word evidence E / F / P', () => {
  const title = new Set(['копченые', 'груши', 'на', 'кости']);
  it('E: equals a title word', () => expect(wordEvidence('груши', title)).toBe('E'));
  it('F: another form of the same word', () => expect(wordEvidence('груша', title)).toBe('F'));
  it('P: a word outside the dictionary, a partial word, or another word', () => {
    expect(wordEvidence('гру', title)).toBe('P');
    expect(wordEvidence('кос', title)).toBe('P');
    expect(wordEvidence('грушевый', title)).toBe('P');
    expect(wordEvidence('cheeses', new Set(['cheese']))).toBe('P');
  });
});
