-- Managed business lines: numbers the platform purchases for its clients.
CREATE TABLE `voiceLines` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `phoneNumber` varchar(32) NOT NULL,
  `twilioSid` varchar(64) NOT NULL,
  `areaCode` varchar(5) NOT NULL DEFAULT '',
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `voiceLines_userId_uniq` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
