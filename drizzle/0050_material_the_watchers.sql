CREATE TABLE `assetInspectionTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`fields` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assetInspectionTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `assetInspectionTemplates_owner_active_idx` ON `assetInspectionTemplates` (`userId`,`active`);