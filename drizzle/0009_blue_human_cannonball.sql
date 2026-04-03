CREATE TABLE `clientPortalTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp,
	`lastViewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientPortalTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `clientPortalTokens_token_unique` UNIQUE(`token`)
);
