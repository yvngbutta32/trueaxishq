ALTER TABLE `clientPortalTokens`
  ADD `revoked` boolean NOT NULL DEFAULT false,
  ADD `revokedAt` timestamp;
