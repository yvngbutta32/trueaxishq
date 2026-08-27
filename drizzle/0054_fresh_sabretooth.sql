ALTER TABLE `workflowWebhookDeliveries` MODIFY COLUMN `status` enum('pending','delivered','failed','retryable','terminal') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `workflowWebhookDeliveries` ADD `endpointUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `workflowWebhookDeliveries` ADD `payloadCiphertext` text;--> statement-breakpoint
ALTER TABLE `workflowWebhookDeliveries` ADD `attemptCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `workflowWebhookDeliveries` ADD `nextAttemptAt` timestamp;--> statement-breakpoint
ALTER TABLE `workflowWebhookDeliveries` ADD `lastAttemptAt` timestamp;--> statement-breakpoint
ALTER TABLE `workflowWebhookDeliveries` ADD `terminalAt` timestamp;--> statement-breakpoint
CREATE INDEX `workflowWebhookDeliveries_owner_retry_due_idx` ON `workflowWebhookDeliveries` (`userId`,`status`,`nextAttemptAt`);