CREATE TABLE `jobAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`teamMemberId` int NOT NULL,
	`assignmentRole` enum('lead','support','reviewer','coordinator') NOT NULL DEFAULT 'support',
	`status` enum('assigned','acknowledged','declined','completed') NOT NULL DEFAULT 'assigned',
	`plannedMinutes` int,
	`note` varchar(1000),
	`acknowledgedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobAssignments_owner_job_member_unique_idx` UNIQUE(`userId`,`jobId`,`teamMemberId`)
);
--> statement-breakpoint
CREATE TABLE `serviceVisits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`teamMemberId` int,
	`title` varchar(255) NOT NULL,
	`scheduledStart` timestamp NOT NULL,
	`scheduledEnd` timestamp NOT NULL,
	`status` enum('scheduled','en_route','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`siteLabel` varchar(255),
	`dispatchNote` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `serviceVisits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teamMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(32),
	`role` enum('coordinator','manager','specialist','technician','contractor') NOT NULL DEFAULT 'specialist',
	`color` varchar(16) NOT NULL DEFAULT '#D4922A',
	`weeklyCapacityMinutes` int NOT NULL DEFAULT 2400,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teamMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `jobAssignments_userId_idx` ON `jobAssignments` (`userId`);--> statement-breakpoint
CREATE INDEX `jobAssignments_jobId_idx` ON `jobAssignments` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobAssignments_memberId_idx` ON `jobAssignments` (`teamMemberId`);--> statement-breakpoint
CREATE INDEX `serviceVisits_userId_idx` ON `serviceVisits` (`userId`);--> statement-breakpoint
CREATE INDEX `serviceVisits_jobId_idx` ON `serviceVisits` (`jobId`);--> statement-breakpoint
CREATE INDEX `serviceVisits_member_time_idx` ON `serviceVisits` (`teamMemberId`,`scheduledStart`);--> statement-breakpoint
CREATE INDEX `serviceVisits_owner_time_idx` ON `serviceVisits` (`userId`,`scheduledStart`);--> statement-breakpoint
CREATE INDEX `teamMembers_userId_idx` ON `teamMembers` (`userId`);--> statement-breakpoint
CREATE INDEX `teamMembers_user_active_idx` ON `teamMembers` (`userId`,`active`);
