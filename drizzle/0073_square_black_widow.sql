CREATE TABLE `serviceVisitTrackLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`visitId` int NOT NULL,
	`token` varchar(96) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`techConsented` boolean NOT NULL DEFAULT false,
	`lastLat` double,
	`lastLng` double,
	`lastAccuracy` double,
	`lastPingAt` timestamp,
	`lastViewedAt` timestamp,
	`revokedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `serviceVisitTrackLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `serviceVisitTrackLinks_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE INDEX `serviceVisitTrackLinks_userId_idx` ON `serviceVisitTrackLinks` (`userId`);--> statement-breakpoint
CREATE INDEX `serviceVisitTrackLinks_visitId_active_idx` ON `serviceVisitTrackLinks` (`visitId`,`active`);