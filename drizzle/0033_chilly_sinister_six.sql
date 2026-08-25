CREATE TABLE `workflowWebhookDeliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`webhookId` int NOT NULL,
	`eventId` varchar(64) NOT NULL,
	`eventType` enum('job.status_changed','service_visit.scheduled','service_visit.status_changed') NOT NULL,
	`status` enum('pending','delivered','failed') NOT NULL DEFAULT 'pending',
	`responseStatus` int,
	`responseSummary` varchar(1000),
	`errorMessage` varchar(1000),
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflowWebhookDeliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `workflowWebhookDeliveries_webhook_event_unique_idx` UNIQUE(`webhookId`,`eventId`)
);
--> statement-breakpoint
CREATE TABLE `workflowWebhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`endpointUrl` varchar(2048) NOT NULL,
	`encryptedSecret` text NOT NULL,
	`events` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`failureCount` int NOT NULL DEFAULT 0,
	`lastDeliveredAt` timestamp,
	`lastError` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflowWebhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `workflowWebhookDeliveries_userId_idx` ON `workflowWebhookDeliveries` (`userId`);--> statement-breakpoint
CREATE INDEX `workflowWebhookDeliveries_webhookId_idx` ON `workflowWebhookDeliveries` (`webhookId`);--> statement-breakpoint
CREATE INDEX `workflowWebhookDeliveries_event_created_idx` ON `workflowWebhookDeliveries` (`eventType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `workflowWebhooks_userId_idx` ON `workflowWebhooks` (`userId`);--> statement-breakpoint
CREATE INDEX `workflowWebhooks_user_active_idx` ON `workflowWebhooks` (`userId`,`active`);