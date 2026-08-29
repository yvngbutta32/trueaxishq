ALTER TABLE `jobs` ADD `clientSummary` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `clientSummaryVisible` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `jobs_user_clientSummaryVisible_idx` ON `jobs` (`userId`,`clientId`,`clientSummaryVisible`);