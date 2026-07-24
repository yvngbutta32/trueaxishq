CREATE TABLE `automationLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`automationId` int NOT NULL,
	`userId` int NOT NULL,
	`trigger` varchar(64) NOT NULL,
	`entityType` varchar(64),
	`entityId` int,
	`status` enum('success','failed','skipped') NOT NULL DEFAULT 'success',
	`actionsExecuted` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `automationLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `automations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`trigger` varchar(64) NOT NULL,
	`triggerDelayHours` int DEFAULT 0,
	`conditions` text DEFAULT ('[]'),
	`actions` text NOT NULL DEFAULT ('[]'),
	`active` boolean NOT NULL DEFAULT true,
	`runCount` int NOT NULL DEFAULT 0,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`category` varchar(64) NOT NULL DEFAULT 'other',
	`description` varchar(512) NOT NULL,
	`vendor` varchar(255),
	`date` varchar(32) NOT NULL,
	`receiptUrl` text,
	`taxDeductible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int,
	`clientName` varchar(255) NOT NULL,
	`clientEmail` varchar(320),
	`title` varchar(512) NOT NULL,
	`scope` text,
	`lineItems` text NOT NULL DEFAULT ('[]'),
	`subtotal` decimal(10,2) NOT NULL DEFAULT '0',
	`taxRate` decimal(5,2) DEFAULT '0',
	`total` decimal(10,2) NOT NULL DEFAULT '0',
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`validUntil` varchar(32),
	`status` enum('draft','sent','viewed','signed','declined') NOT NULL DEFAULT 'draft',
	`token` varchar(128),
	`signedAt` timestamp,
	`signatureName` varchar(255),
	`viewedAt` timestamp,
	`sentAt` timestamp,
	`linkedInvoiceId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proposals_id` PRIMARY KEY(`id`),
	CONSTRAINT `proposals_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`durationMinutes` int DEFAULT 60,
	`category` varchar(64) DEFAULT 'service',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
