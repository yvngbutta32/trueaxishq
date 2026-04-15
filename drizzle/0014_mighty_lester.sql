CREATE TABLE `bookingCancelTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`action` enum('cancel','reschedule') NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookingCancelTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookingCancelTokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `clientTags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int NOT NULL,
	`tag` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientTags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `followUpRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`triggerDays` int NOT NULL DEFAULT 30,
	`emailSubject` varchar(512) NOT NULL,
	`emailBody` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `followUpRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `googleCalendarTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` timestamp,
	`calendarId` varchar(255) DEFAULT 'primary',
	`syncEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `googleCalendarTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `googleCalendarTokens_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `portalMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int NOT NULL,
	`senderRole` enum('client','owner') NOT NULL,
	`body` text NOT NULL,
	`read` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portalMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int,
	`clientName` varchar(255) NOT NULL,
	`clientEmail` varchar(320),
	`invoiceId` int,
	`body` text,
	`rating` int,
	`status` enum('requested','submitted','approved','rejected') NOT NULL DEFAULT 'requested',
	`requestToken` varchar(128),
	`approvedAt` timestamp,
	`submittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `testimonials_id` PRIMARY KEY(`id`),
	CONSTRAINT `testimonials_requestToken_unique` UNIQUE(`requestToken`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `monthlyReportEnabled` boolean DEFAULT true;