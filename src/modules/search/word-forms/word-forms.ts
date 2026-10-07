import { readFileSync } from 'node:fs';
import path from 'node:path';

// search-word-forms: reviewed grammatical forms of one Russian word, generated offline (ops/word-forms) into
// word-forms.v1.csv. There is no stemming and no locale input: a word is either in the dictionary, with exactly the forms
// of its group, or it is not and keeps today's prefix-only matching.
export type WordFormDictionary = {
  // Every form of the group of `word` (the word itself included), or null when the word is not in the dictionary.
  formsOf(word: string): readonly string[] | null;
  readonly groupCount: number;
  readonly formCount: number;
};

export function parseWordForms(csv: string): WordFormDictionary {
  const groups = new Map<string, string[]>();
  const groupOfForm = new Map<string, string>();
  for (const [index, line] of csv.split(/\r?\n/u).entries()) {
    if (index === 0 || line === '') continue;
    const separator = line.lastIndexOf(',');
    const group = line.slice(0, separator);
    const form = line.slice(separator + 1);
    if (separator <= 0 || form === '') throw new Error(`Malformed word-forms line ${index + 1}`);
    if (groupOfForm.has(form)) throw new Error(`Word form "${form}" is in two groups`);
    groupOfForm.set(form, group);
    const forms = groups.get(group);
    if (forms === undefined) groups.set(group, [form]);
    else forms.push(form);
  }
  return {
    formsOf: (word) => {
      const group = groupOfForm.get(word);
      return group === undefined ? null : groups.get(group) ?? null;
    },
    groupCount: groups.size,
    formCount: groupOfForm.size,
  };
}

const DICTIONARY_FILE = path.join(process.cwd(), 'src', 'modules', 'search', 'word-forms', 'word-forms.v1.csv');

let loaded: WordFormDictionary | undefined;

// Loaded once into memory; the file is part of the repository and of the production build directory.
export function getWordFormDictionary(): WordFormDictionary {
  loaded ??= parseWordForms(readFileSync(DICTIONARY_FILE, 'utf8'));
  return loaded;
}

// Evidence of one query word against the words of one title: E equals a title word, F is another form of the same word,
// P is neither (a prefix match, or no match at all for a candidate that only a Product signal brought in).
export type WordEvidence = 'E' | 'F' | 'P';

export function wordEvidence(word: string, titleWords: ReadonlySet<string>, dictionary: WordFormDictionary = getWordFormDictionary()): WordEvidence {
  if (titleWords.has(word)) return 'E';
  const forms = dictionary.formsOf(word);
  return forms !== null && forms.some((form) => titleWords.has(form)) ? 'F' : 'P';
}
