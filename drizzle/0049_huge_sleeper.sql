ALTER TABLE `jobs` ADD `customerAssetId` int;--> statement-breakpoint
CREATE INDEX `jobs_customerAssetId_idx` ON `jobs` (`customerAssetId`);