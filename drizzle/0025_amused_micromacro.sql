CREATE TABLE `stripeWebhookEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(255) NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripeWebhookEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeWebhookEvents_eventId_idx` UNIQUE(`eventId`)
);
