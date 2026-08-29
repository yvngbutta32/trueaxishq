# Owner Proof-Photo Attachment and Sharing Journey

**Date:** 2026-08-29  
**Scope:** Controlled local owner/client proof-photo journey and final owner-scoped attachment repair

## Observed repair

The owner Job Photos screen accepts an unlinked owner proof upload as a default-private record. The Job Workspace attachment picker previously filtered only by the target client and therefore hid those unlinked owner uploads. The repair adds a protected target-job-scoped candidate query. It returns only unlinked, non-receipt photos owned by the current owner whose client association is either the target job’s client or absent; it does not return another client’s photo.

At final attachment, an eligible unlinked owner proof photo inherits the target owned job’s client association. The protected mutation retains final owner, job, same-client, unlinked-photo, and non-receipt predicates. It continues to reject other-client, receipt, unowned, and already-linked photo attachment attempts. The photo remains private until the owner uses the existing explicit sharing control.

## Controlled local browser evidence

Using a disposable non-customer TrueAxis HQ image, an authorized local owner upload was initially shown as an eligible unlinked candidate in the repaired picker. The owner attached it to the disposable Test Client job and the workspace displayed **Private to your workspace**. The owner then shared it; the same valid controlled client portal displayed one estimate proof photo. After the owner hid the photo, the same portal displayed zero proof photos. The client portal continued to show the reviewed task title and omitted the private job scope note.

## Observed validation

| Validation | Observed result |
|---|---|
| TypeScript | `pnpm check` completed successfully after the protected candidate-query change. |
| Focused coverage | Proof-photo association and portal privacy coverage completed successfully before the final journey recheck. |
| Full regression suite | `pnpm test -- --reporter=dot`: **119 files / 329 tests passed**. |
| Production build | `pnpm run build` completed successfully. |
| Bundle budget | `pnpm run check:bundle` passed: entry **517.0/560 KiB**, dashboard **584.5/650 KiB**, home **112.6/140 KiB**, charts **424.7/500 KiB**, CSS **233.1/240 KiB**. |

## Explicit limits

The controlled path used local disposable data and one owner-authenticated browser session plus one valid client portal token. It did not test a staff identity, a foreign valid client token, an inactive token, a receipt photo, a user-supplied production image, client upload, mobile authenticated rendering, storage provider behavior, production deployment, or any delivery, payment, calendar, routing, or GPS outcome.
