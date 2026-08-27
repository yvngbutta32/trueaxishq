CREATE TABLE `customerAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`assetTag` varchar(128),
	`functionalLocation` varchar(255),
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerAssets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `customerAssets_owner_client_idx` ON `customerAssets` (`userId`,`clientId`);--> statement-breakpoint
CREATE INDEX `customerAssets_owner_active_idx` ON `customerAssets` (`userId`,`active`);