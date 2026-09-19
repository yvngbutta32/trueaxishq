CREATE TABLE `smsLoginCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`phone` varchar(32) NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`attempts` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smsLoginCodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `slc_userId_idx` ON `smsLoginCodes` (`userId`);--> statement-breakpoint
CREATE INDEX `slc_phone_idx` ON `smsLoginCodes` (`phone`);