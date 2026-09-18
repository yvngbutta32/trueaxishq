ALTER TABLE `bookings` ADD `depositAmountCents` int;--> statement-breakpoint
ALTER TABLE `bookings` ADD `depositStatus` enum('required','paid','waived');--> statement-breakpoint
ALTER TABLE `bookings` ADD `depositPaidAt` timestamp;