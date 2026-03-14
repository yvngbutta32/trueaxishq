CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int,
	`clientName` varchar(255) NOT NULL,
	`clientEmail` varchar(320),
	`service` varchar(255),
	`date` varchar(32) NOT NULL,
	`time` varchar(32) NOT NULL,
	`duration` int DEFAULT 60,
	`status` enum('scheduled','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
	`notes` text,
	`isPublicBooking` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(32),
	`service` varchar(255),
	`status` enum('active','inactive','prospect') NOT NULL DEFAULT 'active',
	`notes` text,
	`avatarInitials` varchar(4),
	`totalRevenue` decimal(10,2) DEFAULT '0',
	`sessionsCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastContactedAt` timestamp,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`subject` varchar(512) NOT NULL,
	`body` text NOT NULL,
	`category` varchar(64) DEFAULT 'follow_up',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `followUps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int,
	`clientName` varchar(255) NOT NULL,
	`clientEmail` varchar(320),
	`subject` varchar(512),
	`body` text NOT NULL,
	`status` enum('draft','sent') NOT NULL DEFAULT 'draft',
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `followUps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int,
	`invoiceNumber` varchar(32) NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`clientEmail` varchar(320),
	`service` text,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('draft','sent','paid','overdue') NOT NULL DEFAULT 'draft',
	`dueDate` varchar(32),
	`notes` text,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`source` varchar(64) DEFAULT 'landing_page',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `businessName` text;--> statement-breakpoint
ALTER TABLE `users` ADD `businessPhone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `businessAddress` text;--> statement-breakpoint
ALTER TABLE `users` ADD `businessWebsite` varchar(512);--> statement-breakpoint
ALTER TABLE `users` ADD `bookingUsername` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `bookingBio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bookingServices` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bookingAvailability` text;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyNewBooking` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyInvoicePaid` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD `notifyNewLead` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_bookingUsername_unique` UNIQUE(`bookingUsername`);