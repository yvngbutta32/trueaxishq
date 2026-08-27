# Customer asset correction evidence — 2026-08-27

Microsoft Field Service separates a customer-asset service history, built from related work records, from property-log functionality that tracks historical property values over time. [1] [2] That distinction supports a narrowly scoped TrueAxis HQ correction workflow: the owner may update current private asset identity, tag, functional-location label, and notes without rewriting existing job links, inspection-response snapshots, or service-history entries.

This work does not implement property logs, audit trails for each asset-field change, maintenance management, inventory, warranty tracking, sensors, automated notifications, attachments, client sharing, or portal editing. Client association is intentionally immutable through this correction route; moving an asset to another client would need a separate, reviewed data-integrity design.

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/assets "Microsoft Learn: Work with customer assets"
[2]: https://learn.microsoft.com/en-us/dynamics365/field-service/property-logs "Microsoft Learn: Property logs"
