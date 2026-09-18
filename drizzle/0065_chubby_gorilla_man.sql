CREATE TABLE `twoFactorBackupCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `twoFactorBackupCodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorSecret` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `twoFactorBackupCodes_userId_idx` ON `twoFactorBackupCodes` (`userId`);