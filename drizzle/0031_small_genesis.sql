CREATE TABLE `publicPhotoUploadSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`purpose` enum('booking','intake') NOT NULL,
	`referenceId` int,
	`maxUploads` int NOT NULL DEFAULT 5,
	`uploadCount` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `publicPhotoUploadSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `publicPhotoUploadSessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `publicPhotoUploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`photoKey` varchar(512) NOT NULL,
	`photoUrl` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `publicPhotoUploads_id` PRIMARY KEY(`id`),
	CONSTRAINT `publicPhotoUploads_photoKey_unique` UNIQUE(`photoKey`)
);
--> statement-breakpoint
DROP INDEX `jobs_status_idx` ON `jobs`;--> statement-breakpoint
ALTER TABLE `bookings` MODIFY COLUMN `slotKey` varchar(160);--> statement-breakpoint
ALTER TABLE `jobActivities` MODIFY COLUMN `actor` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `jobActivities` MODIFY COLUMN `eventType` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `jobRunGuards` MODIFY COLUMN `jobKey` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` MODIFY COLUMN `jobNumber` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` MODIFY COLUMN `budgetAmount` decimal(12,2);--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_slotKey_unique` UNIQUE(`slotKey`);--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_owner_number_unique_idx` UNIQUE(`userId`,`invoiceNumber`);--> statement-breakpoint
CREATE INDEX `publicPhotoUploadSessions_userId_idx` ON `publicPhotoUploadSessions` (`userId`);--> statement-breakpoint
CREATE INDEX `publicPhotoUploadSessions_expiresAt_idx` ON `publicPhotoUploadSessions` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `publicPhotoUploads_sessionId_idx` ON `publicPhotoUploads` (`sessionId`);--> statement-breakpoint
CREATE INDEX `jobs_bookingId_idx` ON `jobs` (`bookingId`);