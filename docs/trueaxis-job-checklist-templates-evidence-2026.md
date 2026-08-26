# TrueAxis HQ Reusable Job Checklist Templates

**Evidence label:** **Research-supported workflow improvement; implemented and validated at the application-contract level.**

## Research Rationale

Moxie’s official project-template documentation describes creating templates from repeatable task sets and using them when starting a project, including task timelines derived from the template’s completion frame.[1] TrueAxis HQ previously allowed task creation inside each job but did not provide a bounded way to reuse an owner’s existing job checklist. The resulting implementation adopts only the evidence-supported repeatable-checklist concept; it does not claim full project-template, agreement-template, pricing, subtasks, task-relative-date, or project-finance parity.

## Implemented Boundary

An owner can save the active job’s task titles as a private checklist template and select that template when creating a new job. Only task title and order are copied. Client identity, schedule, scope notes, proof media, client approvals, internal updates, team assignments, costs, statuses, completion state, and billing links are deliberately excluded. Applying a template creates new `todo` tasks for the newly created job and records the event in that job’s activity history.

| Control | Evidence |
|---|---|
| Owner isolation | Templates and template items carry `userId`; list, create-from-job, deletion, and application queries use owner predicates. |
| Source job isolation | Saving a template first verifies the source job under the authenticated owner and copies only task title/order. |
| Application isolation | A selected template is queried under the authenticated owner before task insertion. The inserted tasks use the newly created job ID and never inherit prior-job client or internal metadata. |
| Empty-template prevention | A job with no tasks cannot be saved as a checklist template. |
| Operator clarity | The Job Workspace labels templates as private reusable checklists and explains the intentional non-copy boundary before saving. |

## Validation Evidence

**36 Vitest files / 126 tests passed**, including the dedicated template ownership, item-isolation, application, and interface-boundary contracts. Strict TypeScript passed. The production dependency audit found no known vulnerabilities. Production bundle budgets passed: 515.4 KiB entry / 560 KiB, 567.7 KiB Dashboard / 650 KiB, 112.6 KiB Home / 140 KiB, 424.7 KiB charts / 500 KiB, and 218.7 KiB CSS / 240 KiB.

The existing managed preview environment remains unable to produce visual capture because its expected port is externally reserved; authenticated live owner testing is therefore an external validation gate. No claim is made about real user adoption or actual time saved.

## References

[1] [Moxie Help Center, “Templates – projects”](https://help.withmoxie.com/en/articles/6167915-templates-projects)
