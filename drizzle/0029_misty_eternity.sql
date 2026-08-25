CREATE TABLE `jobActivities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`actor` varchar(32) NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobActivities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobRunGuards` (
	`jobKey` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobRunGuards_jobKey` PRIMARY KEY(`jobKey`)
);
--> statement-breakpoint
CREATE TABLE `jobTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('todo','in_progress','done') NOT NULL DEFAULT 'todo',
	`dueDate` varchar(32),
	`sortOrder` int NOT NULL DEFAULT 0,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int NOT NULL,
	`bookingId` int,
	`invoiceId` int,
	`proposalId` int,
	`contractId` int,
	`jobNumber` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('lead','quoted','approved','scheduled','in_progress','awaiting_client','completed','cancelled') NOT NULL DEFAULT 'lead',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`startDate` varchar(32),
	`targetDate` varchar(32),
	`budgetAmount` decimal(12,2),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobs_userId_jobNumber_idx` UNIQUE(`userId`,`jobNumber`)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `slotKey` varchar(160);--> statement-breakpoint
ALTER TABLE `clientPortalTokens` ADD `revoked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `clientPortalTokens` ADD `revokedAt` timestamp;--> statement-breakpoint
ALTER TABLE `jobPhotos` ADD `jobId` int;--> statement-breakpoint
ALTER TABLE `timeEntries` ADD `jobId` int;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_slotKey_unique` UNIQUE(`slotKey`);--> statement-breakpoint
CREATE INDEX `jobActivities_userId_idx` ON `jobActivities` (`userId`);--> statement-breakpoint
CREATE INDEX `jobActivities_jobId_idx` ON `jobActivities` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobTasks_userId_idx` ON `jobTasks` (`userId`);--> statement-breakpoint
CREATE INDEX `jobTasks_jobId_idx` ON `jobTasks` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobs_userId_idx` ON `jobs` (`userId`);--> statement-breakpoint
CREATE INDEX `jobs_clientId_idx` ON `jobs` (`clientId`);--> statement-breakpoint
CREATE INDEX `jobs_bookingId_idx` ON `jobs` (`bookingId`);--> statement-breakpoint
CREATE INDEX `jobPhotos_jobId_idx` ON `jobPhotos` (`jobId`);--> statement-breakpoint
CREATE INDEX `timeEntries_jobId_idx` ON `timeEntries` (`jobId`);
