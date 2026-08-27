# Customer asset service-history evidence — 2026-08-27

Microsoft Field Service documents an asset service-history pattern based on asset associations with work order incidents and, separately, service-agreement incidents. Its guidance also states that assets used on a work order should ordinarily belong to the same service account as that work order. [1] [2]

The bounded TrueAxis HQ implementation may therefore present the owner with an observational list of existing same-owner, same-client asset-linked jobs and a count of existing private inspection responses. It must not infer maintenance status, repair outcomes, warranty coverage, inventory consumption, sensor data, service agreements, compliance, client sharing, automated notifications, or a complete external asset record.

## References

[1]: https://learn.microsoft.com/en-us/dynamics365/field-service/service-history "Microsoft Learn: Build a service history for assets"
[2]: https://learn.microsoft.com/en-us/dynamics365/field-service/assets "Microsoft Learn: Work with customer assets"
