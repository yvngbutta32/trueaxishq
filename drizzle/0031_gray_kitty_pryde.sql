CREATE TABLE `jobActivities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`actor` enum('owner','client','system') NOT NULL DEFAULT 'owner',
	`eventType` varchar(100) NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobActivities_id` PRIMARY KEY(`id`)
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
	`completedAt` timestamp,
	`sortOrder` int NOT NULL DEFAULT 0,
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
	`proposalId` int,
	`contractId` int,
	`invoiceId` int,
	`jobNumber` varchar(40) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('lead','quoted','approved','scheduled','in_progress','awaiting_client','completed','cancelled') NOT NULL DEFAULT 'lead',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`startDate` varchar(32),
	`targetDate` varchar(32),
	`completedAt` timestamp,
	`budgetAmount` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobs_userId_jobNumber_unique_idx` UNIQUE(`userId`,`jobNumber`)
);
--> statement-breakpoint
ALTER TABLE `jobPhotos` ADD `jobId` int;--> statement-breakpoint
ALTER TABLE `timeEntries` ADD `jobId` int;--> statement-breakpoint
CREATE INDEX `jobActivities_userId_idx` ON `jobActivities` (`userId`);--> statement-breakpoint
CREATE INDEX `jobActivities_jobId_idx` ON `jobActivities` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobTasks_userId_idx` ON `jobTasks` (`userId`);--> statement-breakpoint
CREATE INDEX `jobTasks_jobId_idx` ON `jobTasks` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobs_userId_idx` ON `jobs` (`userId`);--> statement-breakpoint
CREATE INDEX `jobs_clientId_idx` ON `jobs` (`clientId`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobPhotos_jobId_idx` ON `jobPhotos` (`jobId`);--> statement-breakpoint
CREATE INDEX `timeEntries_jobId_idx` ON `timeEntries` (`jobId`);