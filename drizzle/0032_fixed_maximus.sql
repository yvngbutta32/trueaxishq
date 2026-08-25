CREATE TABLE `integrationConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('google_calendar','outlook_calendar','quickbooks','gmail','outlook','slack','twilio','zapier','stripe') NOT NULL,
	`category` enum('calendar','accounting','communications','automation','payments') NOT NULL,
	`status` enum('not_connected','needs_configuration','connected','error') NOT NULL DEFAULT 'not_connected',
	`configurationNote` varchar(1000),
	`lastCheckedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrationConnections_id` PRIMARY KEY(`id`),
	CONSTRAINT `integrationConnections_owner_provider_unique_idx` UNIQUE(`userId`,`provider`)
);
--> statement-breakpoint
CREATE INDEX `integrationConnections_userId_idx` ON `integrationConnections` (`userId`);