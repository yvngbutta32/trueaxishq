ALTER TABLE `clients` ADD `pipelineStage` enum('inquiry','proposal_sent','active','completed','lost') DEFAULT 'inquiry';--> statement-breakpoint
ALTER TABLE `invoices` ADD `payLinkToken` varchar(64);--> statement-breakpoint
ALTER TABLE `invoices` ADD `stripePaymentLinkUrl` text;