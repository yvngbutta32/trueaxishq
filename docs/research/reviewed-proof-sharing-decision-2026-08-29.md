# Reviewed Proof-Sharing Decision

**Date:** 2026-08-29  
**Decision scope:** Client portal job photos; no provider comparison claim

## External context

Jobber documents a client hub that exposes selected client work information, including appointments, quotes, invoices, and work history. Its documentation also warns that anyone given a client-hub link can access the same client information.[1] Housecall Pro documents a customer portal for self-service job, appointment, and invoice functions, while describing its own calendar and communication capabilities separately.[2]

These vendor descriptions establish that client-facing job information is a common product category. They do not establish that TrueAxis HQ has the same authentication model, visibility rules, delivery behavior, feature parity, or provider outcomes.

## Code-level observation and decision

TrueAxis HQ already provides explicit owner review for documents, service visits, and job tasks. Its portal job query limited photos to `estimate`, `wip`, and `finished` types, but did not require an explicit per-photo visibility decision. Because photo type alone does not prove that a specific image is appropriate for client viewing, the selected refinement is a default-private `clientVisible` field with an owner-controlled reveal/hide action and a token-scoped portal filter.

This change is intentionally distinct from existing client updates, documents, proof-photo storage, and service-visit sharing. It does not introduce staff images, GPS, route data, calendar synchronization, messaging delivery, or a new portal authentication mechanism.

## References

[1] [Jobber Help Center — What Do Your Clients See in Client Hub?](https://help.getjobber.com/en/articles/what-do-your-clients-see-in-client-hub/)

[2] [Housecall Pro — Online Client Portal](https://www.housecallpro.com/features/customer-portal/)
