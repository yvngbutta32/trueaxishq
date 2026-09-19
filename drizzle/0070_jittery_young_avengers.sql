CREATE TABLE `customReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`dataset` enum('jobs','invoices','time_entries','expenses','proposals') NOT NULL,
	`metric` varchar(32) NOT NULL,
	`groupBy` varchar(32) NOT NULL DEFAULT 'none',
	`filters` text NOT NULL DEFAULT ('{}'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `customReports_userId_idx` ON `customReports` (`userId`);