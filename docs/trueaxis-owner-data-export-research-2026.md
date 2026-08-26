# Owner-Controlled Data Export Research

**Evidence label:** **Research-supported opportunity; not yet an implementation claim.**

Moxie’s official documentation places data import/export in the workspace and describes importing clients, contacts, projects, deliverables, invoices, expenses, and time worked.[1] HoneyBook’s official help center documents downloading a CSV contact list containing basic client information such as name, email, phone, address, notes, and creation date.[2] Together, these sources support a narrowly bounded owner-controlled export opportunity for TrueAxis HQ.

The justified first scope is a protected, owner-scoped CSV export for client records. It should include only records owned by the requesting workspace and should use conservative fields already present in the CRM. It should not claim full-account backup, encrypted archive delivery, audit export, document/media export, cross-provider migration, legal retention, or project/invoice/task export unless those scopes are separately implemented and validated.

## Implemented Boundary and Validation

TrueAxis HQ now offers a protected owner-controlled CSV export for client records. The server query filters by the authenticated owner and limits the export to 10,000 client records. The CSV includes name, email, phone, service, status, notes, and record creation time. It does not export documents, portal tokens, invoice/payment data, activity history, approvals, team/dispatch records, or full-account backups.

The export builder quotes every field, escapes embedded quotes, and prefixes formula-like cell values (`=`, `+`, `-`, `@`, tab, or carriage return) with an apostrophe to reduce spreadsheet formula interpretation risk. The dashboard uses the server-backed export rather than constructing a CSV from its current visible client list.

| Validation gate | Result |
|---|---|
| Ownership and scope | The export is a protected procedure and selects only `clients.userId = ctx.user.id`. |
| CSV safety | Deterministic tests cover quoted commas/quotes, formula-prefix neutralization, documented headers, server-backed download, and absence of prior unsafe local-row joining. |
| Release quality | **37 Vitest files and 129 tests passed**; strict TypeScript, production build, dependency audit, and bundle-budget gates passed. |
| External boundary | The managed preview environment cannot produce a visual capture and authenticated owner interaction is not independently observed. No claim is made about full migration or backup usability. |

## References

[1] [Moxie Help Center, “Import your data”](https://help.withmoxie.com/en/articles/6458227-import-your-data)  
[2] [HoneyBook Help Center, “Download and export your contacts list from HoneyBook”](https://help.honeybook.com/en/articles/2650752-download-and-export-your-contacts-list-from-honeybook)
