CREATE TABLE `backgroundJobRuns` (
  `id` int AUTO_INCREMENT NOT NULL,
  `jobName` varchar(100) NOT NULL,
  `status` enum('running','succeeded','failed') NOT NULL,
  `startedAt` timestamp NOT NULL DEFAULT (now()),
  `completedAt` timestamp,
  `errorMessage` varchar(1000),
  CONSTRAINT `backgroundJobRuns_id` PRIMARY KEY(`id`)
);
CREATE INDEX `backgroundJobRuns_jobName_startedAt_idx` ON `backgroundJobRuns` (`jobName`,`startedAt`);
CREATE INDEX `backgroundJobRuns_status_startedAt_idx` ON `backgroundJobRuns` (`status`,`startedAt`);
