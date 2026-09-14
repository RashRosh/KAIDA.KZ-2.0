# UX1 — Marketplace shell / Buyer card layout — superseded

**Status:** `SUPERSEDED BEFORE IMPLEMENTATION`

Этот объединённый UX1 не реализовывался и не является действующим Slice Contract.

После review Product Owner согласовал более мелкую последовательность:

`S13 verified → UX1A App shell → UX1B Marketplace cards → UX1C Nearby cleanup → UX2 Seller onboarding → M1 Offer Media → M2 video при необходимости → S14`

Причина разделения: исходный UX1 смешивал независимые presentation/navigation задачи и Nearby privacy/geo boundary. Для Process v2 они должны закрываться отдельными проверяемыми slices.

Действующий следующий contract: `docs/slices/UX1A-app-shell/SLICE_CONTRACT.md`.

UX1B и UX1C не должны реализовываться до закрытия UX1A checkpoint.
