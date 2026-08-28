# Owner Automation Starter Chooser

**Date:** 2026-08-28  
**Scope:** Protected owner Workflow Automation workspace

## Verified behavior

The owner workflow workspace now offers three concise starter choices: booking review, overdue-invoice follow-up, and client welcome. Selecting a starter opens the existing automation form with a populated **paused** draft. The owner reviews the name, trigger, delay, and action fields, then deliberately saves it. The chooser itself does not create, activate, execute, send, enqueue, or log a workflow.

## Boundaries

| Area | Current behavior | Explicit non-claim |
|---|---|---|
| Starter selection | Prefills an existing private automation form as paused. | It does not activate a rule or send an action. |
| Review | The owner can inspect and modify all populated fields before saving. | A saved workflow still depends on its configured rule and available dependencies. |
| Email example | The welcome starter identifies delivery as a configured dependency. | It does not promise SMTP delivery, inbox placement, or recipient engagement. |
| Visibility | The chooser is present only in the protected owner workspace. | It adds no client portal, public booking, external-provider, or scheduler behavior. |

## Validation record

Strict TypeScript checking passed. Focused automation starter and readiness coverage passed: **2 files / 3 tests**. The full deterministic Vitest suite passed: **100 files / 273 tests**. The production build and configured bundle budgets also passed.
