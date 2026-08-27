ALTER TABLE `stripeWebhookEvents` ADD `status` enum('received','processing','processed','retryable','terminal') DEFAULT 'processed' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripeWebhookEvents` ADD `payloadCiphertext` text;--> statement-breakpoint
ALTER TABLE `stripeWebhookEvents` ADD `attemptCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stripeWebhookEvents` ADD `nextAttemptAt` timestamp;--> statement-breakpoint
ALTER TABLE `stripeWebhookEvents` ADD `lastError` varchar(1000);--> statement-breakpoint
ALTER TABLE `stripeWebhookEvents` ADD `completedAt` timestamp;--> statement-breakpoint
ALTER TABLE `stripeWebhookEvents` ADD `processingStartedAt` timestamp;--> statement-breakpoint
CREATE INDEX `stripeWebhookEvents_retry_due_idx` ON `stripeWebhookEvents` (`status`,`nextAttemptAt`);