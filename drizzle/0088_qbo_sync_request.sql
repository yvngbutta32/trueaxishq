-- QuickBooks Online sync demand gate: one request per company, with the plan
-- at request time snapshotted so "paying companies asking" is measurable.
CREATE TABLE `qboSyncRequests` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `planId` varchar(32) NOT NULL,
  `businessName` varchar(255) NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE KEY `qboSyncRequests_userId_unique_idx` (`userId`),
  KEY `qboSyncRequests_plan_idx` (`planId`)
);
