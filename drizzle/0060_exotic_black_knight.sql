ALTER TABLE `jobTasks` ADD `clientVisible` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `jobTasks_user_job_clientVisible_idx` ON `jobTasks` (`userId`,`jobId`,`clientVisible`);