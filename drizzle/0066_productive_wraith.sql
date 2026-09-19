CREATE TABLE `priceBookItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` varchar(1024),
	`category` varchar(64) NOT NULL DEFAULT 'service',
	`unit` varchar(32) NOT NULL DEFAULT 'job',
	`unitPrice` decimal(10,2) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `priceBookItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `priceBookItems_userId_idx` ON `priceBookItems` (`userId`);