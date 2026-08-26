ALTER TABLE `expenses` ADD `jobId` int;--> statement-breakpoint
CREATE INDEX `expenses_owner_job_idx` ON `expenses` (`userId`,`jobId`);