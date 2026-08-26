# Owner Clarity: Client Collaboration Audit

**Evidence label:** Research-supported comparison; implementation boundary verified from current source and tests.

Moxie’s official client-collaboration documentation supports an owner problem worth addressing: work that needs client input should be isolated from internal work, presented in the client portal, and leave a traceable approval history.[1] Its broader implementation includes project access settings, task comments, attachments, notification email, automated status progression, and task-level approval history.

TrueAxis HQ already implements the bounded core of this concept through client approval requests. An owner creates a job-linked request, the token-scoped portal shows only the client’s relevant pending request, and the client can approve or request changes with an optional note. The response is retained in job activity history. This directly serves the clarity goal without exposing internal assignments, dispatch notes, or task lists.

| Capability | TrueAxis HQ evidence | Boundary |
|---|---|---|
| Explicit client input request | Implemented and tested through owner-created client approval requests. | Not a general-purpose portal task assignment system. |
| Approve or request changes | Implemented and tested with a one-response pending-state predicate and client notes. | No automated job-status progression is claimed. |
| Client data isolation | Token query limits data to the owner and portal client; internal operations remain private. | Full per-project portal access configuration is not implemented. |
| Approval history | Owner-visible job activity records approval actions. | No client attachment/comment thread is claimed. |

The appropriate next improvement is therefore not a duplicate task-approval feature. It is usability evidence: an authenticated owner/client walkthrough to observe the existing approval flow with real data, which remains an external-session gate. No autonomous scope expansion is justified from this evidence alone.

## References

[1] [Moxie Help Center, “Client project collaboration”](https://help.withmoxie.com/en/articles/6566142-client-project-collaboration)
