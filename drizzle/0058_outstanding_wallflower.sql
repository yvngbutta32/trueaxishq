ALTER TABLE `recurringServicePlans` ADD `customerAssetId` int;--> statement-breakpoint
CREATE INDEX `recurringServicePlans_owner_asset_idx` ON `recurringServicePlans` (`userId`,`customerAssetId`);