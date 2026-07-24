ALTER TABLE `passwordResetTokens` ADD CONSTRAINT `prt_token_idx` UNIQUE(`token`);--> statement-breakpoint
ALTER TABLE `proposals` ADD CONSTRAINT `proposals_token_idx` UNIQUE(`token`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_idx` UNIQUE(`email`);--> statement-breakpoint
CREATE INDEX `bookings_userId_idx` ON `bookings` (`userId`);--> statement-breakpoint
CREATE INDEX `bookings_date_idx` ON `bookings` (`date`);--> statement-breakpoint
CREATE INDEX `portal_userId_clientId_idx` ON `clientPortalTokens` (`userId`,`clientId`);--> statement-breakpoint
CREATE INDEX `clients_userId_idx` ON `clients` (`userId`);--> statement-breakpoint
CREATE INDEX `followUps_userId_idx` ON `followUps` (`userId`);--> statement-breakpoint
CREATE INDEX `intakeForms_userId_idx` ON `intakeForms` (`userId`);--> statement-breakpoint
CREATE INDEX `invoices_userId_idx` ON `invoices` (`userId`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `prt_userId_idx` ON `passwordResetTokens` (`userId`);--> statement-breakpoint
CREATE INDEX `proposals_userId_idx` ON `proposals` (`userId`);