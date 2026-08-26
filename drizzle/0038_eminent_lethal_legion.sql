CREATE TABLE `clientCustomFieldValues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int NOT NULL,
	`fieldId` int NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientCustomFieldValues_id` PRIMARY KEY(`id`),
	CONSTRAINT `clientCustomFieldValues_owner_client_field_unique` UNIQUE(`userId`,`clientId`,`fieldId`)
);
--> statement-breakpoint
CREATE TABLE `clientCustomFields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`label` varchar(100) NOT NULL,
	`fieldKey` varchar(100) NOT NULL,
	`fieldType` enum('text','select') NOT NULL,
	`options` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientCustomFields_id` PRIMARY KEY(`id`),
	CONSTRAINT `clientCustomFields_owner_key_unique` UNIQUE(`userId`,`fieldKey`)
);
--> statement-breakpoint
CREATE INDEX `clientCustomFieldValues_owner_client_idx` ON `clientCustomFieldValues` (`userId`,`clientId`);--> statement-breakpoint
CREATE INDEX `clientCustomFields_owner_idx` ON `clientCustomFields` (`userId`);