# Controlled User-Journey Browser Access

**Date:** 2026-08-29  
**Scope:** Browser access preparation only

## Observed result

The temporary preview URL initially showed its unavailable/wake screen. Activating the visible wake control redirected the sandbox browser to a Manus sign-in page rather than returning to the application. No TrueAxis HQ account, owner workflow, staff workflow, client portal, form, or data record was accessed.

## Boundary

The controlled owner, staff, and client user-journey validation is blocked until a usable browser session can reach the active preview. No authentication, tenant-isolation, mobile workflow, or production conclusion is drawn from this browser-access attempt.

## Local owner sign-in observation

The local development server exposed the TrueAxis HQ Admin password form independently of the platform sign-in gateway. Using the user-authorized disposable test credentials, the form navigated to `/admin` and returned authenticated Admin panel content. No credential values, personal data, or non-test customer records are recorded in this evidence file.

This confirms one local owner sign-in path only. It does not establish deployed-domain authentication, staff or client access, session persistence, authorization across a second identity, or production behavior.

The authenticated local Admin session completed its load and displayed the restricted Admin navigation and dashboard data. Selecting its Dashboard control navigated to the local `/dashboard` owner workspace, which was still loading at capture time. No owner business-workspace action or data mutation has been performed.

The local owner workspace subsequently loaded and displayed the owner navigation, a dismissible product-update dialog, dashboard metrics, and existing test records. The observed dialog was corrected in the same local session: its feature wording now describes notification review, invoice-plan configuration, a subscription calendar export, payment links with separate provider validation, and automation readiness with separate delivery and scheduling validation. The health control now identifies its state as the latest configured checks rather than universal operational status.

This is a local authenticated rendering observation. It does not establish the accuracy of displayed metrics, dashboard data, payment operation, notification delivery, calendar behavior, background execution, provider behavior, or production operation.

The authenticated browser reported a 1280 by 1100 viewport. A direct in-page resize attempt did not produce an authenticated 375px viewport in this browser session. The authenticated mobile Dashboard visual check remains unexecuted; no responsive owner-workflow conclusion is made from desktop rendering.

While locally authenticated as the owner, selecting the visible **Jobs** sidebar control left the Dashboard view in place in two successive browser observations. No job workspace content loaded and no data was changed. This is an observed navigation failure that must be investigated before using the owner task or proof-photo controls as user-journey evidence.

The initial navigation observation was rechecked after dismissing the change-log dialog. The visible **Jobs** control then changed the local document title to **Job Workspace — TrueAxis HQ** and rendered the owner Job Workspace empty state. The earlier click was intercepted by the open dialog overlay; no sidebar state-code change was required. The authenticated owner journey has therefore reached the Job Workspace, but it has not yet created or changed a job, task, or photo.

Using the local authenticated owner session and the existing local Test Client, a disposable job was created with a local scope note and target date. The Job Workspace then accepted a new checklist item. It displayed **Private to your workspace** by default. Selecting the explicit visibility control displayed a success toast, changed the control to **Shared with client**, and added a private timeline entry stating that the checklist item was shared. No photo, receipt, asset, inspection response, cost, client message, external provider, or payment interaction was used.

This verifies the observed owner-side default-private and explicit task-sharing interaction in the local browser. It does not establish what a valid client portal displays, cross-client isolation in a browser, provider delivery, or production behavior.

The authenticated owner then opened the local Test Client profile. The profile displayed private owner fields, document controls, and a **Share Portal** action. It explicitly described private client fields as owner-only and not shown in the client portal. No portal link was created or opened at this point, and no client data was altered.

The owner selected **Share Portal** for the local Test Client and the application displayed a **Portal link copied to clipboard** success toast. A subsequent browser clipboard-read request timed out, so no portal token was inspected, displayed, or reused from that path. The valid token-scoped client journey remains pending a non-clipboard access method.

Using the owner-authorized local Test Client token through a controlled database lookup, the valid local portal rendered the Test Client’s identity, the disposable job, and the explicitly shared checklist item. It showed **Confirm access details** in Milestones, consistent with the owner’s explicit share action. The proof-photo gallery was empty. The portal did not display a task description, receipt photo, asset, inspection response, cost, route, staff availability, or internal activity record in this test.

The same valid portal rendered the owner-authored job scope note. Because job scope is not currently an explicitly reviewed portal field, this is a verified portal-minimization gap that requires correction before treating the portal as fully minimized. A separate invalid-token request rendered the inactive-link screen and did not expose client information.

These observations were made in the local development environment with the owner-authorized token. They do not establish cross-client browser denial, token revocation, client message delivery, provider behavior, or production behavior.

## Reviewed summary recheck

After the reviewed client-summary correction, the authenticated owner opened the disposable job in Job Workspace, entered a short client-ready summary, deliberately enabled its share checkbox, and saved it. The interface changed from **Private to your workspace** to **Shared with client**, displayed a success toast, and added a private timeline activity for the summary update. The pre-existing private scope note remained visible in the owner workspace.

The same owner-authorized Test Client portal then displayed the reviewed summary and the explicitly shared checklist task. The private scope note text was absent from this portal capture. The capture still contained the existing Test Client identity and configured provider contact detail, but it did not display a proof photo, expense, asset, inspection response, route, availability block, or task description. This is local controlled browser evidence for one test client and token only; it does not establish behavior for another client, a revoked token, a staff session, or production data.

The owner then returned to the same Job Workspace. The reviewed summary persisted with the **Shared with client** state and the private scope note was still displayed only in the owner context. The next controlled check will deliberately hide the summary and verify its absence from the same authorized portal token.

The owner returned to the same Job Workspace and selected the reviewed-summary share checkbox to begin the deliberate unshare check. The summary had not been saved in its new visibility state at this point, so no portal conclusion is recorded yet.

The first index-based browser click did not change the selected checkbox state. A native DOM click on the same located owner control then changed the checked state to false. This is a browser automation interaction discrepancy only; the owner summary had not yet been saved or rechecked in the portal.

The owner then saved the unchecked summary control. The Job Workspace showed **Private to your workspace**, and reopening the same controlled Test Client portal no longer displayed the reviewed summary. The private job scope note was also absent; the portal displayed the shared task title only. This confirms the explicit share-and-unshare path for this disposable local owner/client dataset. It does not test a separate staff session, a foreign valid client token, inactive token, uploaded proof photo, or a mobile authenticated session.

The controlled local owner/client test also confirmed the valid portal showed the reviewed summary while sharing was enabled and removed it after the owner disabled sharing and saved. The invalid-token route continued to render the inactive-link screen. The local browser remained at a desktop-sized viewport; the available browser viewport resize attempt did not produce an authenticated 375px rendering.

When returning to the authenticated local Dashboard, an index-based browser click labelled **Job Photos** opened the Admin panel instead. No Admin data was changed. This is recorded as a browser automation navigation discrepancy; the owner photo workflow has not yet been exercised.

A second current-index click labelled **Job Photos** again opened the Admin panel instead of the Job Photos workspace. No administrative control was invoked. Subsequent sidebar navigation for this controlled browser run will use the currently visible target position and recheck the resulting page title rather than rely on the mislabeled index.

The visible-coordinate attempt to reach Job Photos instead opened Billing. No invoice action was invoked. Index and coordinate selection have both been inconsistent for late-sidebar items in this browser session, so the remaining user-journey evidence will avoid interpreting those navigation mismatches as application defects without a reproducible component-state failure.

After returning to Dashboard, the AI Assistant sidebar control correctly opened its corresponding panel. The adjacent current-index Job Photos control again opened the Admin panel. This repeated sequence is now treated as an observed authenticated owner sidebar routing defect, not merely a coordinate discrepancy. No administrative mutation was performed.

Source inspection confirms the Job Photos navigation item maps to the `photos` active panel, while the Admin control is a separate footer navigation action. A direct native click on the rendered Job Photos button found the intended element; its immediate synchronous title was unchanged, so the asynchronous panel transition is being rechecked separately. No navigation-code change has been made.

The direct rendered Job Photos button completed its asynchronous transition to the owner Job Photos panel. A non-customer TrueAxis HQ logo image was saved outside the project directory solely as disposable upload input. No customer image or project static asset was used.

The browser file-upload action could not locate the Job Photos panel’s hidden file input even though the rendered DOM reported one `image/*` multiple-file input. No upload was attempted against the application handler. The proof-photo share path remains untested through the browser until a controlled alternative can invoke the same owner upload input.

A controlled native change event on that rendered input invoked the normal application upload path with the disposable non-customer image. The owner Job Photos panel showed a **1 photo uploaded** confirmation and rendered the uploaded photo. This establishes local owner upload handling for one disposable estimate-type photo; it does not attach or share that photo with a job or client portal.

The owner Job Workspace then rendered its existing **Link photo** action for the disposable job and its private proof-of-work section. The uploaded image has not yet been linked or shared; no client portal photo projection has been asserted.

After the owner photo-attachment procedure was updated, the local authenticated Dashboard reloaded successfully. The disposable local owner session remained available. The proof photo has not yet been attached, shared, or checked in the client portal after that server-side correction.

The owner Job Photos panel was reached through direct activation of its rendered sidebar button. The panel displayed the disposable non-customer estimate photo that had been uploaded in the earlier owner session. The owner upload is still unlinked at this point; the repaired job-attachment and explicit photo-sharing path has not yet been exercised.

The owner Job Workspace then reloaded and displayed the disposable job, its reviewed client summary control, the reviewed checklist item, and the **Link photo** control. The job had no attached proof photo before the repaired attachment recheck.

The existing open attachment dialog retained its earlier empty-state text after the owner candidate-query change was hot-reloaded. The dialog must be closed and reopened before it can be treated as evidence of the repaired query; no result is inferred from the stale open dialog.

After the dialog was closed and reopened, its browser-rendered copy still reflected the preceding version even though the current source contained the new target-job candidate wording. The local owner workspace needs a full page reload before the repaired picker can be used as browser evidence.

After a full local dashboard reload, the authenticated owner session remained active and the Dashboard rendered normally. The owner Job Workspace must now be reopened before the repaired candidate picker can be evaluated.

After the owner reopened Job Workspace and then the attachment dialog, the repaired picker displayed the disposable unlinked non-receipt proof image with the updated target-job wording. This is observed owner-side evidence that the protected candidate query returns an eligible unlinked owner upload. The image has not yet been attached or shared.

The owner selected the disposable estimate proof image. The owner workspace displayed **Photo added to this job**, a private proof card, and a private job timeline entry. The image remained marked **Private to your workspace**; it has not yet been shared or evaluated in the portal.

After closing the attachment dialog, the owner selected the visible **Private to your workspace** proof-photo control. The workspace displayed **Proof photo shared with client**, changed the card label to **Shared with client**, and added the corresponding private owner timeline entry. The controlled client portal has not yet been rechecked.

The same authorized local Test Client portal then displayed one estimate proof photo in the job progress and Job Photos areas. It continued to show the reviewed task title and omitted the private job scope note. This is controlled local evidence of the explicit proof-photo sharing path; the photo has not yet been unshared or tested with a foreign or inactive token.

The owner then selected **Shared with client** on the attached disposable proof card. The control changed to **Private to your workspace**, and reopening the same controlled client portal displayed zero proof photos and only the job-status event. This confirms the explicit share-and-unshare flow for the disposable owner/client dataset; it does not test a separate staff session, a foreign valid token, inactive-token revocation, authenticated mobile rendering, provider behavior, or production data.

The authenticated owner entered Team & Capacity through the rendered Team control. The workspace showed an empty owner-managed roster and the existing disposable job as needing an active job owner. Its Staff access section stated that staff access requires an active roster member with an email and is limited to assigned work. No staff record, invite, membership, or staff session has been created yet.

The owner opened the Add team member form and entered a clearly disposable local roster name, a disposable email, and a twenty-hour weekly capacity. The form explicitly stated that this creates an internal planning record only and does not create a user login or grant workspace access. The form has not yet been submitted.

The owner submitted the roster record successfully. Team & Capacity then showed one active owner-managed roster member with twenty hours of remaining planned capacity and no access. The owner created a private staff access link. The interface reported that the link was copied for direct sharing and that no email was sent automatically; the member status changed to Link pending. The raw link was not recorded in this evidence file.

The owner then returned to the local Dashboard and reopened Job Workspace. The attached estimate photo remained marked **Shared with client**, providing the starting state for the controlled unshare check.

Before the identity-repair change, opening the local private staff link while the browser remained authenticated as the unrelated local owner displayed the owner email and an **Accept staff access** action. The action was not clicked, so this observation does not establish that a membership was created or that cross-account access was granted. It does establish an unsafe acceptance precondition in the private-link interface; the route was taken out of the test flow for repair before any acceptance mutation was invoked.

After the local repair and development-service restart, reopening the same unconsumed link in the same unrelated owner session displayed a visible private-link denial message and no acceptance action. The message instructed the viewer to sign in with the invited account and stated that no access had been activated. This browser observation is paired with focused procedure tests for the final normalized-email and active-roster predicates; it does not substitute for an actual unrelated-account mutation attempt, staff acceptance, provider delivery, or production behavior.

The owner then used the application’s local logout procedure and reopened the same unconsumed private link without an active owner session. The link showed its existing account-creation route. A separate disposable staff identity was entered with case variation around the invited address to exercise the safe normalization path. The registration form has not yet been submitted; no credentials or raw link material are retained here.

Submitting the local disposable registration displayed the application success toast and initially navigated toward the staff route. The browser then rendered the general sign-in page rather than a staff workspace, so no authenticated staff route, owner-admin denial, or staff-data boundary is claimed from this attempt. The reason for the post-registration redirect has not yet been established from the browser alone.

A narrow local database check after that submission found that the disposable invite had been consumed, bound to an account, and had one active membership matching the accepted account and roster record. The browser then opened the ordinary local sign-in route and prepared the same disposable account for the existing password-login flow. No credential, raw invitation token, customer data, or owner data is recorded in this log.

The ordinary local sign-in flow authenticated the disposable staff account and routed it to the general Dashboard shell rather than the limited staff workspace. The dashboard rendered a zero-data workspace for the staff account; the owner’s existing clients, jobs, finance, routes, availability, and private notes were not displayed in this observation. Nevertheless, this is an incorrect staff entry surface relative to the intended limited staff routes, so the team is correcting the route guard before any staff dashboard control is used.

During the first post-change browser recheck, the controlled browser session became unavailable and resumed at a blank page. The corrected staff route-guard behavior has not yet been observed in the browser from that interrupted session. No additional data action was taken after the interruption.

The recovered browser reached the ordinary local sign-in boundary after an initial loading state. The staff route-guard recheck is resuming from that boundary; no owner or staff data action occurred during recovery.

After the corrected local sign-in flow, the accepted disposable staff account was redirected to `/staff`. The rendered Field workspace showed only the roster role, an empty assigned-work state, an empty service-visit state, and explicit exclusions for client contact, finance, private CRM, GPS, routing, and private dispatch. No owner dashboard panel or owner data was rendered in this corrected staff-session observation.

Entering the general local dashboard path directly while still authenticated as that active staff account immediately returned the browser to `/staff` and rendered the same limited Field workspace. Entering the local owner-admin route redirected to the owner credential form. The staff account did not submit that form and no owner-admin data was displayed. These browser checks do not establish a separate-device result, authenticated mobile behavior, foreign valid-token coverage, provider behavior, or production behavior.

## Staff identity and route-scope validation

The staff-invite repair uses safe trim-and-lowercase email comparison only; it does not alter mailbox aliases or apply provider-specific canonicalization. Focused staff tests covered an unmatched authenticated account before any claim or membership insert, safe normalization for matching registration and acceptance, revoked, consumed, expired, and inactive-roster invite rejection, the invited-account membership binding, a dedicated staff procedure, the general owner-procedure denial, and a non-staff guard positive control. The focused staff suite passed 2 files and 15 tests. The broader focused set including auth logout and proof-photo portal isolation passed 4 files and 18 tests. Strict TypeScript passed, the single full suite passed 120 files and 339 tests, and the production build plus bundle budgets passed.

This evidence is local and controlled. It does not establish separate-device or concurrent-session behavior, authenticated mobile accessibility, every owner procedure’s user-interface state, foreign valid client-token behavior, inactive client-token revocation, email or provider delivery, payment or calendar behavior, or production deployment behavior.

## Staff registration continuity correction

The post-registration redirect observation was traced to the staff access page navigating after success without first updating the existing authenticated-account query cache. The page now seeds that cache from the successful registration result before it routes to the dedicated staff workspace, matching the existing ordinary sign-in cache handoff. The change does not alter invite issuance, email delivery, passwords, authentication cookies, membership predicates, owner data, or client-portal data.

Focused staff coverage passed 2 files and 16 tests. Strict TypeScript passed. The single full suite passed 120 files and 341 tests, and the production build plus bundle budgets passed.

The controlled staff session subsequently rendered the new visible Sign out control. Using it returned the browser to the ordinary local sign-in boundary and showed the local confirmation. A second disposable roster-and-invite record was then used only for local testing. Submitting a matching registration displayed the activation confirmation and immediately rendered the limited Field workspace for that roster record; it did not fall back to the general sign-in page. The private access link, credentials, and account identifiers are not retained here. This observation does not establish email delivery, mobile behavior, foreign-token behavior, concurrent sessions, provider behavior, or production behavior.
