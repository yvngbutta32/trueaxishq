# TrueAxis HQ — Public Proposal Legal-Claim Correction

**Prepared:** August 26, 2026  
**Evidence labels:** Implemented and validated; Copy correction

## Correction

The public proposal signature screen previously made an unconditional statement that electronic signatures were legally binding and described the entered name as a legal name. That was not supported by a jurisdiction-specific legal review, validated contract configuration, or evidence of enforceability in every client circumstance.

The screen now makes only factual product statements: the client enters their full name to record acceptance, confirms that they want the sender to record acceptance in TrueAxis HQ, and sees that acceptance is recorded in the product. The workflow still records the existing proposal signature fields; the change does not make a legal conclusion about their effect.

## Validation Evidence

| Gate | Result |
|---|---|
| Deterministic suite | **48 test files / 157 tests passed**. |
| Focused contract | Confirms factual acceptance-record copy and the absence of the former universal “legally binding” and “full legal name” claims. |
| Strict TypeScript | Passed. |
| Production build | Passed. |
| Bundle budget | Passed: application entry 515.4 KiB / 560 KiB; dashboard route 573.6 KiB / 650 KiB; CSS 222.6 KiB / 240 KiB. |

## Boundary

This copy correction does not provide legal advice or determine the validity, enforceability, or suitability of any proposal, agreement, signature process, or jurisdiction. A qualified attorney should review any terms or workflow the owner intends to rely on legally.
