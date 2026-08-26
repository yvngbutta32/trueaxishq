# Owner Proposal Reuse Research — August 26, 2026

## Official Sources Reviewed

| Provider | Documented workflow | Source |
|---|---|---|
| Housecall Pro | A user can copy an estimate to a new estimate, carrying relevant pricing inputs; the copied estimate remains distinct and receives its own sequence. | [How to Copy or Convert Jobs and Estimates](https://help.housecallpro.com/en/articles/2883009-how-to-copy-or-convert-jobs-and-estimates) |
| HoneyBook | Templates allow owners to reuse common client documents and pricing while keeping brand content distinct. | [Manage and use templates in HoneyBook](https://help.honeybook.com/en/articles/9664257-manage-and-use-templates-in-honeybook) |

## Bounded TrueAxis Direction

The lowest-risk owner-efficiency implementation is a **proposal duplication action**, not a public template library. It could duplicate only owner-scoped content fields (title, scope, ordinary line items, package alternatives, currency, tax rate, and notes) into a fresh draft with a fresh token. It should deliberately clear client identity, validity date, view/signature state, invoice linkage, selected package, and decline feedback; it should not copy provider delivery history, files, external payments, or any public/share state.
