# Client Portal File-Sharing Research

**Prepared:** August 26, 2026  
**Evidence label:** **Research-supported opportunity, not an implementation claim.**

Moxie’s official portal documentation states that files may be shared with a client as task attachments or as links in comments. [1] HoneyBook’s official client-portal documentation states that clients can review shared documents and attachments, while internal tools, internal notes, and project fields marked not client-visible remain private. [2]

These sources support a narrowly scoped TrueAxis HQ opportunity: an owner-controlled document-sharing layer within the existing token-scoped portal. They do not justify a claim that TrueAxis HQ has full document collaboration, versioning, external-cloud integration, multi-project client accounts, or equivalent portal breadth.

## Implemented Boundary and Validation

TrueAxis HQ now gives each existing client document an owner-controlled `clientVisible` state that defaults to `false`. Owners can explicitly share or remove a document from the portal through the client document list. The portal issues a separate token-scoped document query and returns only the document ID, file name, URL, MIME type, size, and creation time for documents that match the active token’s owner and client and have `clientVisible = true`. It does not return file keys or internal operational records.

| Validation gate | Result |
|---|---|
| Schema and data isolation | The additive migration defaults existing documents to private and adds an owner/visibility index. |
| Deterministic privacy contract | New tests assert owner-scoped visibility changes, active-token owner/client scoping, explicit client-visible filtering, and absence of file-key exposure in the portal query. |
| Release checks | **35 Vitest files and 123 tests passed**; strict TypeScript, production build, production dependency audit, and production bundle budgets passed. |
| Remaining boundary | An authenticated owner/client session is still required to observe actual shared-file interaction. File versioning, client uploads, virus scanning, external-drive links, notifications, and full document collaboration are not claimed. |

| Evidence-supported requirement | TrueAxis acceptance boundary |
|---|---|
| Files are deliberately shared rather than automatically exposed. | Each document must receive an explicit owner-controlled client-visible state; unshared files remain absent from portal data. |
| The portal exposes only client-relevant documents. | The token query must scope by owner and client, and it must not reveal internal document metadata or files for other clients. |
| Clients may attach files in mature portals. | Client upload is already limited to estimate photos in TrueAxis; generalized client document upload is outside this bounded proposal until storage, content validation, and notification rules are separately designed. |
| Internal work stays private. | Team assignments, dispatch notes, receipts, internal job activities, and private documents must remain excluded. |

## References

[1] [Moxie Help Center, “Client Portal – Features”](https://help.withmoxie.com/en/articles/5855650-client-portal-features)  
[2] [HoneyBook Help Center, “What clients can see and do in the client portal”](https://help.honeybook.com/en/articles/6428603-what-clients-can-see-and-do-in-the-client-portal)
