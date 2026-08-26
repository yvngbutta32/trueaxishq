CREATE TABLE `calendarFeedTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`revoked` boolean NOT NULL DEFAULT false,
	`revokedAt` timestamp,
	`lastAccessedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calendarFeedTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendarFeedTokens_token_unique` UNIQUE(`token`),
	CONSTRAINT `calendar_feed_tokens_user_idx` UNIQUE(`userId`)
);
