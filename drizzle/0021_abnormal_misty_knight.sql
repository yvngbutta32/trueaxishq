CREATE TABLE `contractTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(100),
	`body` text NOT NULL,
	`isBuiltIn` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contractTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intakeForms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`fields` text NOT NULL DEFAULT ('[]'),
	`active` boolean NOT NULL DEFAULT true,
	`publicSlug` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intakeForms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intakeResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`userId` int NOT NULL,
	`respondentName` varchar(255),
	`respondentEmail` varchar(255),
	`answers` text NOT NULL DEFAULT ('{}'),
	`linkedClientId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intakeResponses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenueGoals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`year` int NOT NULL,
	`month` int,
	`targetAmount` decimal(12,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`label` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revenueGoals_id` PRIMARY KEY(`id`)
);
