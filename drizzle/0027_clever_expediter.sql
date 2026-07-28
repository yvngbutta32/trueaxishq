ALTER TABLE `platformSettings` MODIFY COLUMN `siteName` varchar(255) NOT NULL DEFAULT 'TrueAxis HQ';--> statement-breakpoint
ALTER TABLE `platformSettings` MODIFY COLUMN `supportEmail` varchar(320) DEFAULT 'support@trueaxishq.com';--> statement-breakpoint
ALTER TABLE `bookings` ADD `reminderSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `checkInSentAt` timestamp;