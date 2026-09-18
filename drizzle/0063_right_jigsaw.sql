ALTER TABLE `googleCalendarTokens` ADD `lastSyncedAt` timestamp;--> statement-breakpoint
ALTER TABLE `googleCalendarTokens` ADD `lastError` varchar(512);--> statement-breakpoint
ALTER TABLE `googleCalendarTokens` ADD `lastErrorKind` varchar(32);--> statement-breakpoint
ALTER TABLE `googleCalendarTokens` ADD `lastErrorAt` timestamp;