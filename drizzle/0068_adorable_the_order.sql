CREATE TABLE `jobPhases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`status` enum('planned','in_progress','done') NOT NULL DEFAULT 'planned',
	`position` int NOT NULL DEFAULT 0,
	`scheduledDate` varchar(32),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobPhases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `jobTasks` ADD `phaseId` int;--> statement-breakpoint
CREATE INDEX `jobPhases_userId_idx` ON `jobPhases` (`userId`);--> statement-breakpoint
CREATE INDEX `jobPhases_jobId_idx` ON `jobPhases` (`jobId`);--> statement-breakpoint
CREATE INDEX `jobPhases_user_job_position_idx` ON `jobPhases` (`userId`,`jobId`,`position`);--> statement-breakpoint
CREATE INDEX `jobTasks_phaseId_idx` ON `jobTasks` (`userId`,`phaseId`);