# Inspection template versioning evidence — 2026-08-27

Microsoft Field Service documents an inspection workflow in which published inspection templates become read-only, changes create a new draft version, and existing service tasks retain the version that was active when they were created. It also distinguishes inspection questions and required-answer behavior from broader features such as file capture, exports, logic, and client sharing. [1] [2]

This supports a bounded TrueAxis HQ approach: owner-only revisions must create a new template record/version rather than modify an existing active template’s fields; earlier templates may be made inactive deliberately; and already-created private job responses must render from their stored `templateFields` snapshot. The scope does not inherit file capture, reports, PDFs, conditional logic, translation, client sharing, service-task binding, or compliance behavior from the external product.

Jobber’s current checklist documentation similarly describes configurable required questions, a range of richer input types, previewing, attachments, and sharing as distinct capabilities. [3] TrueAxis HQ must not imply any of those richer behaviors where they are not explicitly implemented.

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/inspections "Microsoft Learn: Use inspections in work orders"
[2]: https://learn.microsoft.com/en-us/dynamics365/field-service/inspections-advanced "Microsoft Learn: Configure advanced options for inspections"
[3]: https://help.getjobber.com/en/articles/checklists/ "Jobber Help Center: Checklists"
