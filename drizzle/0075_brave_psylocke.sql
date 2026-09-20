ALTER TABLE `serviceVisits`
	ADD COLUMN `routeOrder` int;
--> statement-breakpoint

CREATE TABLE `geocodeCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`labelKey` varchar(512) NOT NULL,
	`lat` double NOT NULL,
	`lng` double NOT NULL,
	`source` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
	`updatedAt` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
	CONSTRAINT `geocodeCache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `geocodeCache_owner_label_idx` ON `geocodeCache` (`userId`,`labelKey`);
