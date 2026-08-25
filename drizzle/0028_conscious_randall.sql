CREATE TABLE IF NOT EXISTS `publicPhotoUploadSessions` (
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
	CONSTRAINT `publicPhotoUploadSessions_tokenHash_unique` UNIQUE(`tokenHash`),
	KEY `publicPhotoUploadSessions_userId_idx` (`userId`),
	KEY `publicPhotoUploadSessions_expiresAt_idx` (`expiresAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `publicPhotoUploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`photoKey` varchar(512) NOT NULL,
	`photoUrl` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `publicPhotoUploads_id` PRIMARY KEY(`id`),
	CONSTRAINT `publicPhotoUploads_photoKey_unique` UNIQUE(`photoKey`),
	KEY `publicPhotoUploads_sessionId_idx` (`sessionId`)
);
