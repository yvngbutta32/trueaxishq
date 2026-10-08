-- Voice receptionist: AI phone answering + voicemail fallback.
-- Per-owner settings and a transcript/outcome record for every answered call.

CREATE TABLE `voiceSettings` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `greeting` varchar(500) NOT NULL,
  `businessInfo` varchar(1500) NOT NULL DEFAULT '',
  `agentMode` ENUM('ai','voicemail') NOT NULL DEFAULT 'voicemail',
  `voicemailEnabled` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `voiceSettings_userId_uniq` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint

CREATE TABLE `voiceCalls` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `callSid` varchar(64) NOT NULL,
  `fromNumber` varchar(32) NOT NULL DEFAULT '',
  `status` ENUM('ringing','answered','voicemail','completed','failed') NOT NULL DEFAULT 'ringing',
  `outcome` ENUM('unknown','lead_captured','info_given','voicemail','handoff') NOT NULL DEFAULT 'unknown',
  `transcriptJson` JSON,
  `callerName` varchar(120) DEFAULT NULL,
  `serviceRequested` varchar(300) DEFAULT NULL,
  `preferredTime` varchar(200) DEFAULT NULL,
  `leadId` int DEFAULT NULL,
  `durationSeconds` int NOT NULL DEFAULT 0,
  `recordingUrl` varchar(500) DEFAULT NULL,
  `turns` int NOT NULL DEFAULT 0,
  `startedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `endedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `voiceCalls_callSid_uniq` (`callSid`),
  KEY `voiceCalls_userId_idx` (`userId`),
  KEY `voiceCalls_startedAt_idx` (`startedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
