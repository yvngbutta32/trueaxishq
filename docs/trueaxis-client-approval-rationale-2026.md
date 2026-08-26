# Client Deliverable Approval Rationale

**Prepared:** August 26, 2026  
**Evidence label:** **Research-supported opportunity** and **implemented-and-validated workflow boundary**.

An official Moxie client-portal page states that clients can review deliverables and comment on projects in addition to scheduling, signing, and paying. [1] This supports the product hypothesis that an explicit client review step is a meaningful portal workflow for independent service businesses. It does **not** establish that TrueAxis HQ matches Moxie’s full portal, collaboration, branding, or mobile ecosystem.

TrueAxis HQ now implements a deliberately narrower approval workflow: an owner creates a job-linked request with a title and optional context; the token-scoped client portal presents only requests belonging to that client and job; the client can approve or request changes with an optional note; and the response is recorded in the owner-visible job history. The workflow intentionally omits staff assignments, internal dispatch notes, routing, internal job activities, file-delivery semantics, and automated notifications.

## Validation Evidence

| Gate | Result |
|---|---|
| Authorization and privacy contract | The portal query requires the active token’s owner and client IDs, filters request job IDs to the token-scoped client’s jobs, and returns only approval fields. The response mutation requires the same owner/client scope and a `pending` status predicate. |
| Owner workflow contract | Owner creation verifies the job under the authenticated owner, persists the job’s client ID, and records job activity. Deletion has a final owner predicate. |
| Deterministic tests | **34 Vitest files and 120 tests passed**, including three dedicated approval-request contracts. |
| Build and static validation | Strict TypeScript passed; production build passed; `pnpm audit --prod` reported no known vulnerabilities; production bundle budgets passed. |
| Remaining external evidence | An authenticated owner/client session is required to observe the request and response interaction on mobile with real data. No claim is made about actual client adoption or document-delivery behavior. |

| Claim | Evidence label | Boundary |
|---|---|---|
| Client approvals are a recognized portal workflow category. | Research-supported. | Based on Moxie’s official capability description, not an independent market-importance ranking. |
| TrueAxis approval requests are owner-scoped and portal-token/client scoped. | Implemented and validated. | Supported by schema, router predicates, and deterministic regression tests. |
| A client can approve or request changes once. | Implemented and validated. | The response requires pending state and a final status predicate; no claim is made about real-user usability without a controlled portal session. |
| The workflow completes full document collaboration or review lifecycle management. | Not claimed. | File/version annotation, multi-party approval, reminders, and staff account workflows remain separate future or externally validated scopes. |

## Reference

[1] [Moxie, “Client Portal for Freelancers”](https://www.withmoxie.com/product-pages/client-portal)
