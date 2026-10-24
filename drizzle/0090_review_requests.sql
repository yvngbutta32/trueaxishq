-- Public review-site request engine (Google reviews et al.).
-- reviewSettings: one row per owner — where to send happy clients, and whether
-- completed jobs trigger an automatic ask.
-- reviewRequests: every ask we made (or honestly skipped), so the log the
-- owner sees is the truth, not a marketing claim.

CREATE TABLE `reviewSettings` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `reviewSiteUrl` varchar(512) NOT NULL,
  `autoAfterCompletion` tinyint(1) DEFAULT 0 NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  UNIQUE KEY `reviewSettings_userId_unique_idx` (`userId`)
);

--> statement-breakpoint

CREATE TABLE `reviewRequests` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `clientId` int NOT NULL,
  `jobId` int,
  `channel` enum('sms','email') NOT NULL,
  `status` enum('sent','failed','skipped') NOT NULL,
  `detail` varchar(255) NULL,
  `sentAt` timestamp NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  KEY `reviewRequests_owner_idx` (`userId`, `clientId`),
  KEY `reviewRequests_job_idx` (`jobId`),
  KEY `reviewRequests_recent_idx` (`userId`, `sentAt`)
);
