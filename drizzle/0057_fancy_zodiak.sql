CREATE TABLE `staffAvailabilityBlocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`teamMemberId` int NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`reason` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staffAvailabilityBlocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `staffAvailabilityBlocks_owner_member_start_idx` ON `staffAvailabilityBlocks` (`userId`,`teamMemberId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `staffAvailabilityBlocks_owner_start_idx` ON `staffAvailabilityBlocks` (`userId`,`startsAt`);