# Private Client Custom Fields Evidence

**Evidence label:** Implemented and validated at the application-contract level.

TrueAxis HQ now supports owner-managed private text and select fields on client profiles. Owners create a labeled field with an explicit key, then add values within the client profile. Select values are validated against the configured options. The interface explicitly states that these profile details do not appear in the client portal.

| Boundary | Evidence |
|---|---|
| Ownership | Field definitions and values carry the owner ID; protected queries and mutations require owner-scoped client and field records. |
| Privacy | The portal has no custom-field query or rendering path; a focused contract asserts that absence. |
| Validation | Select entries are rejected unless they match a configured option. |
| Scope | No public editing, custom formulas, conditional logic, reporting filters, import mapping, or full competitor parity is claimed. |

**Validation:** 38 test files and 131 tests passed, followed by strict TypeScript. An authenticated owner session is still needed to observe the live profile configuration flow in a browser.
