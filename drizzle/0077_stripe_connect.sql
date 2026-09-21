CREATE TABLE `stripeAccounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `stripeAccountId` varchar(64) NOT NULL,
  `chargesEnabled` tinyint NOT NULL DEFAULT 0,
  `payoutsEnabled` tinyint NOT NULL DEFAULT 0,
  `detailsSubmitted` tinyint NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripeAccounts_userId_unique` (`userId`),
  UNIQUE KEY `stripeAccounts_stripeAccountId_unique` (`stripeAccountId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
