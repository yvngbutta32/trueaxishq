CREATE TABLE `jobSubcontractorNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assignmentId` int NOT NULL,
	`note` varchar(1000) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobSubcontractorNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobSubcontractors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`subId` int NOT NULL,
	`scopeNote` text,
	`shareClientContact` boolean NOT NULL DEFAULT false,
	`status` enum('invited','accepted','declined','completed') NOT NULL DEFAULT 'invited',
	`token` varchar(96) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`respondedAt` timestamp,
	`lastViewedAt` timestamp,
	`revokedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobSubcontractors_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobSubcontractors_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `subcontractors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`trade` varchar(64),
	`email` varchar(255),
	`notes` varchar(1000),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subcontractors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `jobSubcontractorNotes_assignmentId_idx` ON `jobSubcontractorNotes` (`assignmentId`);--> statement-breakpoint
CREATE INDEX `jobSubcontractors_userId_idx` ON `jobSubcontractors` (`userId`);--> statement-breakpoint
CREATE INDEX `jobSubcontractors_jobId_idx` ON `jobSubcontractors` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobSubcontractors_subId_idx` ON `jobSubcontractors` (`subId`);--> statement-breakpoint
CREATE INDEX `subcontractors_userId_idx` ON `subcontractors` (`userId`);