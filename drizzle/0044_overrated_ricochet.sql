CREATE TABLE `recurringServicePlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`serviceName` varchar(255) NOT NULL,
	`frequency` enum('weekly','monthly') NOT NULL,
	`weekday` int,
	`dayOfMonth` int,
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10),
	`durationMinutes` int NOT NULL DEFAULT 60,
	`nextVisitAt` timestamp,
	`planningNote` varchar(1000),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurringServicePlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `serviceVisits` ADD `recurringServicePlanId` int;--> statement-breakpoint
CREATE INDEX `recurringServicePlans_userId_idx` ON `recurringServicePlans` (`userId`);--> statement-breakpoint
CREATE INDEX `recurringServicePlans_jobId_idx` ON `recurringServicePlans` (`jobId`);--> statement-breakpoint
CREATE INDEX `recurringServicePlans_owner_active_idx` ON `recurringServicePlans` (`userId`,`active`);--> statement-breakpoint
CREATE INDEX `serviceVisits_recurring_plan_start_idx` ON `serviceVisits` (`recurringServicePlanId`,`scheduledStart`);