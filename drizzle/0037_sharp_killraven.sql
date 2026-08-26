CREATE TABLE `jobChecklistTemplateItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`templateId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `jobChecklistTemplateItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobChecklistTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobChecklistTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `jobChecklistTemplateItems_template_idx` ON `jobChecklistTemplateItems` (`templateId`);--> statement-breakpoint
CREATE INDEX `jobChecklistTemplateItems_owner_template_idx` ON `jobChecklistTemplateItems` (`userId`,`templateId`);--> statement-breakpoint
CREATE INDEX `jobChecklistTemplates_owner_idx` ON `jobChecklistTemplates` (`userId`);