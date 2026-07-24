ALTER TABLE `automations` MODIFY COLUMN `conditions` text;--> statement-breakpoint
ALTER TABLE `automations` MODIFY COLUMN `actions` text NOT NULL;--> statement-breakpoint
ALTER TABLE `proposals` MODIFY COLUMN `lineItems` text NOT NULL;