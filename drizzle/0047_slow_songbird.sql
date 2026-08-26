ALTER TABLE `calendarFeedTokens` RENAME COLUMN `token` TO `tokenHash`;--> statement-breakpoint
ALTER TABLE `calendarFeedTokens` DROP INDEX `calendarFeedTokens_token_unique`;--> statement-breakpoint
ALTER TABLE `calendarFeedTokens` CHANGE COLUMN `token` `tokenHash` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `calendarFeedTokens` ADD CONSTRAINT `calendarFeedTokens_tokenHash_unique` UNIQUE(`tokenHash`);
