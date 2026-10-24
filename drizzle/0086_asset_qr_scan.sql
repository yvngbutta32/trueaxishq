-- QR asset check-in labels (Oct 23 2026). ServiceM8's signature feature:
-- a scannable label on customer equipment gives instant field lookup and
-- lets the customer request service for that exact asset. Tokens are
-- generated lazily when an owner first prints a label, so existing assets
-- need no backfill. Service requests land in a per-owner queue (never a
-- global table) so the owner always sees their own requests.
ALTER TABLE `customerAssets`
  ADD COLUMN `scanToken` VARCHAR(64) NULL AFTER `assetTag`,
  ADD COLUMN `lastScanAt` TIMESTAMP NULL AFTER `scanToken`,
  ADD UNIQUE INDEX `customerAssets_scanToken_unique_idx` (`scanToken`);
--> statement-breakpoint
CREATE TABLE `assetServiceRequests` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `userId` int NOT NULL,
  `assetId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(32) NOT NULL,
  `message` text NOT NULL,
  `handled` boolean DEFAULT false NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `assetServiceRequests_userId_idx` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `assetServiceRequests_assetId_idx` FOREIGN KEY (`assetId`) REFERENCES `customerAssets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
--> statement-breakpoint
CREATE INDEX `assetServiceRequests_owner_created_idx` ON `assetServiceRequests` (`userId`, `createdAt`);
--> statement-breakpoint
CREATE INDEX `assetServiceRequests_owner_open_idx` ON `assetServiceRequests` (`userId`, `handled`);
