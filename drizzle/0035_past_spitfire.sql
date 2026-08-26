CREATE TABLE `clientApprovalRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clientId` int NOT NULL,
	`jobId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('pending','approved','changes_requested') NOT NULL DEFAULT 'pending',
	`clientResponse` text,
	`respondedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientApprovalRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `clientApprovalRequests_userId_idx` ON `clientApprovalRequests` (`userId`);--> statement-breakpoint
CREATE INDEX `clientApprovalRequests_jobId_idx` ON `clientApprovalRequests` (`jobId`);--> statement-breakpoint
CREATE INDEX `clientApprovalRequests_clientId_idx` ON `clientApprovalRequests` (`clientId`);--> statement-breakpoint
CREATE INDEX `clientApprovalRequests_owner_status_idx` ON `clientApprovalRequests` (`userId`,`status`);