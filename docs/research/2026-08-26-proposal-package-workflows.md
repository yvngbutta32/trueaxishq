# Proposal Package Workflow Research — August 26, 2026

## Official Sources Reviewed

| Provider | Observed documented workflow | Source |
|---|---|---|
| HoneyBook | Proposals can offer packages and add-ons; the platform describes them as part of a broader proposal, contract, invoice, payment, scheduling, and template workflow. | [Proposal software](https://www.honeybook.com/proposal-software) |
| Dubsado | A proposal can show a list of offers; package templates can be added to a proposal, edited locally without altering the template, optionally limited to one or multiple selections, and connected to contract/invoice steps. | [Build a proposal in 2.0](https://help.dubsado.com/en/articles/467057-build-a-proposal-in-2-0) |
| Housecall Pro | Its sales proposal tool presents multiple service options in a side-by-side proposal view and identifies estimate-specific client-approval options. | [Sales Proposal Tool](https://help.housecallpro.com/en/articles/7216553-sales-proposal-tool) |

## Implications for a Bounded TrueAxis Scope

The current TrueAxis proposal model provides one set of line items and a token-scoped signature. A safe non-parity extension could allow an owner to define bounded package options for one proposal, then allow a token holder to select exactly one option before signing. It must make the selected option authoritative on signature; keep unselected package details out of client-visible post-signing state if they are no longer relevant; and avoid claiming payment, automatic job creation, scheduling, email delivery, or broader template-marketplace behavior.

Any implementation should preserve existing public-token recovery, validity, signature, owner-scope, invoice conversion, and client-portal privacy controls. It should distinguish implemented selection behavior from provider-dependent delivery and from feature parity with the cited products.
