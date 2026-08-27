# Google OAuth Token Protection — 2026-08-27

Newly issued Google Calendar OAuth access and refresh tokens are now authenticated-encrypted before persistence using the established server-side secret-protection primitive. The token table was confirmed empty before the change, so no legacy row conversion was required.

Google’s server-side OAuth guidance recommends encrypted at-rest token storage and prompt revocation/deletion when tokens are no longer needed.[1]

Validation passed with strict TypeScript, 83 Vitest files / 226 tests, production build, and bundle budgets. This does not validate active event synchronization or provider authorization.

[1]: https://developers.google.com/identity/protocols/oauth2/resources/best-practices "Google OAuth best practices"
