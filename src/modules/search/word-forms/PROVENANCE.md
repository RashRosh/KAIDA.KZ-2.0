# Provenance and licence of `word-forms.v1.csv`

`word-forms.v1.csv` lists, for each Russian word of the Production KB package, the grammatical forms of that word (`group,form`). It is generated offline; the application only reads the file.

## Licence of this file

**Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)** — <https://creativecommons.org/licenses/by-sa/3.0/legalcode>.

Attribution (required): this file is derived from morphological dictionary data of **OpenCorpora** (<https://opencorpora.org>, dictionary version 0.92, revision 417150), compiled for pymorphy by the pymorphy2/pymorphy3 projects into the package `pymorphy3-dicts-ru` 2.4.417150.4580142. **Changes made:** the dictionary was reduced to lists of grammatical forms of the words of this project's catalogue (nouns, adjectives, participles), normalized (lower case, `ё` folded to `е`), with forms shared between two lexemes removed and two reviewed same-lexeme merges applied (`сом|сома`, `белый|белые`). No endorsement by OpenCorpora or the pymorphy authors is implied.

ShareAlike: if you distribute this file or an adaptation of it, distribute it under CC BY-SA 3.0 (or a licence Creative Commons lists as compatible), keep this notice, and mark your own changes.

## Sources and versions

| Item | Version | Licence as published |
|---|---|---|
| `pymorphy3` (analyzer, used offline) | 2.0.6 | MIT |
| `pymorphy3-dicts-ru` (code of the package) | 2.4.417150.4580142 (released 2022-01-08) | MIT |
| `pymorphy3-dicts-ru` (dictionary **data**) | same; `meta.json`: source `opencorpora.org`, source version 0.92, revision 417150, compiled 2022-01-08 | "The data is licensed under Creative Commons Attribution-Share Alike" (CC BY-SA 3.0), as stated in the package description on PyPI |
| Word list | Production KB v1 in this repository (`src/modules/catalog/kb-package/v1`): Russian canonical names and aliases | this project |

## Licence gate decision (Product Owner, 2026-10-07)

The Product Owner accepted the licence statement published with `pymorphy3-dicts-ru` 2.4.417150.4580142 as sufficient evidence to proceed. A secondary quotation of the OpenCorpora FAQ (CC BY-SA 3.0, attribution, same-terms redistribution) is supplementary evidence only.

- **Primary-source confirmation by OpenCorpora was unavailable** (opencorpora.org returned HTTP 522 on every attempt on 2026-10-07).
- **The interpretation for the application code is preliminary and is not a settled legal conclusion.** Working reading: the dictionary is a separate data file loaded at runtime with its own licence and attribution, pymorphy3 and its data are not part of the application, and the licence conditions are therefore treated as applying to this file, not to the application code. This was not reviewed by a lawyer.
- **Follow-up (before any public distribution of the product or of the dictionary):** re-check opencorpora.org, save a dated copy of its licence/FAQ page, and re-confirm that it matches this notice. Stop and report if it differs.

Evidence and the measured effects of the dictionary: `docs/slices/search-word-forms/EVALUATION_EVIDENCE.md` (sections 7-10).

## Generation

`ops/word-forms/generate.py` (instructions and review steps: `ops/word-forms/README.md`) on the pinned versions above. Re-running it must produce a byte-identical file. A change of this file is reviewed as a diff in a pull request; limits: 15,000 forms, 100 forms per group.
