ALTER TABLE `bookings` ADD `clientPhone` varchar(32);--> statement-breakpoint
ALTER TABLE `clients` ADD `smsOptIn` boolean DEFAULT false NOT NULL;