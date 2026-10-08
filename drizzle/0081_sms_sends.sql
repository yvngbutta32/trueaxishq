-- Bundled SMS fair-use metering: one row per platform-delivered SMS.
-- No message bodies or recipient numbers are stored — this table exists
-- only to count sends per account per month against the plan allowance.
CREATE TABLE `smsSends` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `kind` varchar(24) NOT NULL DEFAULT 'other',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `smsSends_userId_idx` (`userId`),
  KEY `smsSends_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
