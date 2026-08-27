CREATE TABLE `assetInspectionResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`clientId` int NOT NULL,
	`customerAssetId` int NOT NULL,
	`templateId` int NOT NULL,
	`templateVersion` int NOT NULL,
	`responses` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assetInspectionResponses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `assetInspectionResponses_owner_job_idx` ON `assetInspectionResponses` (`userId`,`jobId`);--> statement-breakpoint
CREATE INDEX `assetInspectionResponses_owner_asset_idx` ON `assetInspectionResponses` (`userId`,`customerAssetId`);