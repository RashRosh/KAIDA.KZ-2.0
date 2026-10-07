# Word-form dictionary generator

Offline tool for `src/modules/search/word-forms/word-forms.v1.csv` (slice contract `docs/slices/search-word-forms/SLICE_CONTRACT.md`, section 3). It is **not** part of the application, CI or `pnpm verify`; the application has no Python or pymorphy3 dependency.

## Regenerate

Needs Docker. From the repository root (Git Bash on Windows needs `MSYS_NO_PATHCONV=1`):

```sh
docker run --rm -v "$(pwd):/repo" python:3.12-slim sh -c \
  "pip install -q pymorphy3==2.0.6 pymorphy3-dicts-ru==2.4.417150.4580142 && python /repo/ops/word-forms/generate.py /repo"
```

The script refuses to run on other package versions. It reads the Russian words of the Production KB package (`products.csv` canonical names, `aliases.csv`), writes the sorted dictionary file and prints the number of groups and forms, the source words the dictionary does not know, and the forms removed because two groups shared them.

## Review (required before a dictionary change is merged)

1. Review the diff of `word-forms.v1.csv` and the printed report; regenerating on the pinned versions must give a byte-identical file.
2. Run `pnpm test:unit` (rules, caps, collision tests) and the Search integration tests.
3. Keep `src/modules/search/word-forms/PROVENANCE.md` in sync (source, versions, licence).

Rules, caps (15,000 forms, 100 per group), reviewed merges and the licence notice are in the contract and in `PROVENANCE.md`.

## Function words (rule R4)

A form that the dictionary also reads as a function word (preposition, conjunction, particle, pronoun, interjection, predicative) is removed from its group, so a stop word of a query never matches through a form of an unrelated noun. The generator prints the removed forms (currently only «из», a form of the noun «иза»). Reviewed exceptions kept because they are catalogue products: «хрен» (horseradish) and «апорт» (an apple variety) — the set `KEEP_AS_PRODUCT` in `generate.py`. Adding to that set is a reviewed change like any dictionary change. Covered by `tests/unit/word-forms.test.ts`.
