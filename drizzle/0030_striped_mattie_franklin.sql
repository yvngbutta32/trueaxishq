ALTER TABLE `bookings` DROP INDEX `bookings_slotKey_unique`;--> statement-breakpoint
ALTER TABLE `jobs` DROP INDEX `jobs_userId_jobNumber_idx`;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_live_slot_unique_idx` UNIQUE(`slotKey`);--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_userId_jobNumber_unique_idx` UNIQUE(`userId`,`jobNumber`);
