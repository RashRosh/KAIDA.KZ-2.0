"""Offline generator of the Search word-form dictionary (search-word-forms slice contract, section 3.1).

Reads the Russian words of the Production KB package and writes `word-forms.v1.csv` (`group,form`, sorted).
Run it manually in a disposable container (see README.md); it is not part of the application, CI or `pnpm verify`.
The result is reviewed by a human as a diff before it is merged.

Rules (contract R1-R5):
  R1  only dictionary-known parses (`is_known`) of NOUN, ADJF, ADJS, PRTF, PRTS; a group is every form of the lexeme of
      the top such parse of a source word.
  R2  forms are normalized like `searchWords`: lower case, e -> yo folded, letters a-ya only, length >= 2.
  R3  a form that belongs to two groups is removed from both, except the reviewed same-lexeme merges below.
  R4  function words never enter a group (guaranteed by the part-of-speech filter, checked by the tests).
  R5  no semantic expansion: only grammatical forms of one lexeme.
"""
import csv
import re
import sys
from importlib.metadata import version
from pathlib import Path

PINNED = {'pymorphy3': '2.0.6', 'pymorphy3-dicts-ru': '2.4.417150.4580142'}
for package, expected in PINNED.items():
    actual = version(package)
    if actual != expected:
        sys.exit(f'{package} {actual} is installed, {expected} is required')

import pymorphy3  # noqa: E402  (after the version check)

ALLOWED_POS = {'NOUN', 'ADJF', 'ADJS', 'PRTF', 'PRTS'}
# R4: a form that the dictionary also reads as a function word (preposition, conjunction, particle, pronoun, interjection,
# predicative) is removed, so a stop word of a query can never match through a form of an unrelated noun.
FUNCTION_POS = {'PREP', 'CONJ', 'PRCL', 'NPRO', 'INTJ', 'PRED'}
# Reviewed exceptions: catalogue product names that the dictionary also reads as an interjection (horseradish, an apple variety).
KEEP_AS_PRODUCT = {'хрен', 'апорт'}
# Reviewed splits of ONE lexeme: the second group is merged into the first.
MERGES = [('сом|NOUN', 'сома|NOUN'), ('белый|ADJF', 'белые|NOUN')]
MAX_FORMS = 15000
MAX_GROUP = 100

repo = Path(sys.argv[1] if len(sys.argv) > 1 else '/repo')
kb = repo / 'src/modules/catalog/kb-package/v1'
out_path = repo / 'src/modules/search/word-forms/word-forms.v1.csv'


def normalize(value: str) -> str:
    return value.lower().replace('ё', 'е')


def valid(word: str) -> bool:
    return re.fullmatch(r'[а-я]{2,}', word) is not None


def kb_words() -> list[str]:
    words: set[str] = set()
    with open(kb / 'products.csv', encoding='utf-8', newline='') as handle:
        texts = [row['canonical_name_ru'] for row in csv.DictReader(handle)]
    with open(kb / 'aliases.csv', encoding='utf-8', newline='') as handle:
        texts += [row['alias'] for row in csv.DictReader(handle)]
    for text in texts:
        for token in re.split(r'[^\w]+', normalize(text)):
            if valid(token):
                words.add(token)
    return sorted(words)


morph = pymorphy3.MorphAnalyzer()
groups: dict[str, set[str]] = {}
unknown: list[str] = []
for word in kb_words():
    parses = morph.parse(word)
    known = [p for p in parses if p.is_known and p.tag.POS in ALLOWED_POS]
    if not known:
        unknown.append(word)
        continue
    best = known[0]
    forms = groups.setdefault(f'{normalize(best.normal_form)}|{best.tag.POS}', set())
    for item in best.lexeme:
        form = normalize(item.word)
        if valid(form):
            forms.add(form)

for first, second in MERGES:
    if first in groups and second in groups:
        groups[first] |= groups.pop(second)

function_forms = sorted({
    form for forms in groups.values() for form in forms
    if form not in KEEP_AS_PRODUCT and any(p.is_known and p.tag.POS in FUNCTION_POS for p in morph.parse(form))
})
for forms in groups.values():
    forms.difference_update(function_forms)

owners: dict[str, set[str]] = {}
for key, forms in groups.items():
    for form in forms:
        owners.setdefault(form, set()).add(key)
shared = sorted(form for form, keys in owners.items() if len(keys) > 1)
rows = sorted((key, form) for key, forms in groups.items() for form in forms if len(owners[form]) == 1)

sizes: dict[str, int] = {}
for key, _ in rows:
    sizes[key] = sizes.get(key, 0) + 1
if len(rows) > MAX_FORMS or max(sizes.values()) > MAX_GROUP:
    sys.exit(f'caps exceeded: {len(rows)} forms (max {MAX_FORMS}), largest group {max(sizes.values())} (max {MAX_GROUP})')

out_path.parent.mkdir(parents=True, exist_ok=True)
with open(out_path, 'w', encoding='utf-8', newline='') as handle:
    writer = csv.writer(handle, lineterminator='\n')
    writer.writerow(['group', 'form'])
    writer.writerows(rows)

print(f'groups {len(sizes)}, forms {len(rows)}, largest group {max(sizes.values())}')
print(f'source words unknown to the dictionary or of another part of speech: {len(unknown)}')
print(f'R4 forms read as function words and removed ({len(function_forms)}): {" ".join(function_forms)}')
print(f'forms shared by two groups and removed from both ({len(shared)}): {" ".join(shared)}')
