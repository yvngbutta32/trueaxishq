CREATE TABLE `workspaceStaffInvites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`teamMemberId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('field_member','operations_manager') NOT NULL DEFAULT 'field_member',
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`acceptedUserId` int,
	`revoked` boolean NOT NULL DEFAULT false,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspaceStaffInvites_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaceStaffInvites_token_unique_idx` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `workspaceStaffMemberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`memberUserId` int NOT NULL,
	`teamMemberId` int NOT NULL,
	`role` enum('field_member','operations_manager') NOT NULL DEFAULT 'field_member',
	`active` boolean NOT NULL DEFAULT true,
	`acceptedAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaceStaffMemberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaceStaffMemberships_owner_member_unique_idx` UNIQUE(`ownerUserId`,`memberUserId`),
	CONSTRAINT `workspaceStaffMemberships_owner_team_unique_idx` UNIQUE(`ownerUserId`,`teamMemberId`)
);
--> statement-breakpoint
CREATE INDEX `workspaceStaffInvites_owner_idx` ON `workspaceStaffInvites` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `workspaceStaffInvites_member_idx` ON `workspaceStaffInvites` (`teamMemberId`);--> statement-breakpoint
CREATE INDEX `workspaceStaffMemberships_owner_idx` ON `workspaceStaffMemberships` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `workspaceStaffMemberships_member_idx` ON `workspaceStaffMemberships` (`memberUserId`);
