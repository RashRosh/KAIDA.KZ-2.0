# KAIDA Product KB Production Export v1

This package is a deterministic projection of the closed Product KB checkpoint.
It is not a research corpus and it does not approve or create Products.

Source checkpoint: v0.1.0-kb-foundation
Source commit: 25a27637d3c131c6ab22f855e7d0d872745ea6e9
Package schema version: 1

## Datasets

- products.csv: only LEGACY_APPROVED Products with stable KAIDA-Pxxxx IDs.
- aliases.csv: ACTIVE aliases with safe_for_auto_match=YES whose Product is exported.
- categories.csv: category labels used by exported Products.
- manifest.json: provenance, counts, immutable corpus hashes, and package file hashes.

## Explicitly excluded

Raw 2GIS evidence, observations history, unresolved queues, provisional Products,
manual review queues, raw prices, full legacy workbooks, official XLS snapshots,
official mappings, parent hierarchy, crawler tooling, and WORKING_I3 attribute
definitions are not runtime export data.

Product hierarchy is omitted from v1 because the first production importer does
not consume hierarchy as a closed downstream contract.

Attribute definitions are omitted from v1 because the current WORKING_I3 schema
belongs to the future Offer attribute system, not the first Product identity import.

## Importer obligations

An importer must validate manifest hashes, schema version, unique Product and alias
IDs, category consistency, and absence of dangling alias Product references before import.
