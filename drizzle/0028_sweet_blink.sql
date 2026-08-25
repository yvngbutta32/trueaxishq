CREATE TABLE `jobRunGuards` (
  `jobKey` varchar(191) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `jobRunGuards_jobKey` PRIMARY KEY(`jobKey`)
);
